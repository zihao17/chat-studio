/**
 * 混合检索（FTS5 BM25 + 向量相似度融合）
 */
'use strict';

const { getDatabase } = require('../db/database');
const { embedBatch, cosine } = require('./embedding');

function minMaxNorm(values) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

/**
 * 从 SQLite FTS5 进行 BM25 候选召回
 */
function searchBM25({ collectionId, query, limit = 50 }) {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    const sql = `SELECT rowid AS chunk_id, bm25(kb_chunks_fts) AS bm25
                 FROM kb_chunks_fts
                 WHERE kb_chunks_fts MATCH ? AND collection_id=?
                 LIMIT ?`;
    db.all(sql, [query, collectionId, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * 从主表抓取 chunk 详情
 */
function fetchChunks(chunkIds) {
  if (!chunkIds.length) return Promise.resolve([]);
  const db = getDatabase();
  const placeholders = chunkIds.map(() => '?').join(',');
  const sql = `SELECT c.id AS chunk_id, c.doc_id, c.collection_id, c.idx, c.content
               FROM kb_chunks c WHERE c.id IN (${placeholders})`;
  return new Promise((resolve, reject) => {
    db.all(sql, chunkIds, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

/**
 * 在集合内计算向量相似度（MVP：Node 端计算）
 */
async function vectorSearch({ collectionId, query, candidateLimit = 1000 }) {
  const db = getDatabase();
  
  // 从 kb_embeddings 读取已存向量（而不是重新计算）
  const sql = `SELECT e.chunk_id, e.vector, e.dim, c.doc_id, c.idx, c.content
               FROM kb_embeddings e
               JOIN kb_chunks c ON e.chunk_id = c.id
               WHERE e.collection_id = ? AND c.idx != -1
               ORDER BY c.id DESC LIMIT ?`;
               
  const rows = await new Promise((resolve, reject) => {
    db.all(sql, [collectionId, candidateLimit], (err, rs) => (err ? reject(err) : resolve(rs || [])));
  });

  // 只嵌入 query（1次 API 调用）
  const [qv] = await embedBatch([query]);

  const scored = rows.map((r) => {
    // 兼容可能存在的 buffer offset
    const buf = r.vector;
    const storedVec = Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
    return { ...r, cos: cosine(qv, storedVec) };
  });
  scored.sort((a, b) => b.cos - a.cos);
  return scored.slice(0, 200); // 向量候选上限
}

/**
 * 融合 BM25 与 向量分数，并集去重
 */
async function hybridSearch({ collectionId, query, alpha = 0.5, topK = 50 }) {
  const [bm25Rows, vecRows] = await Promise.all([
    searchBM25({ collectionId, query, limit: 50 }),
    vectorSearch({ collectionId, query }),
  ]);

  const bm25Map = new Map();
  for (const r of bm25Rows) bm25Map.set(r.chunk_id, r.bm25);

  const union = new Map();
  for (const r of vecRows) union.set(r.chunk_id, { ...r, bm25: bm25Map.get(r.chunk_id) ?? null });
  for (const r of bm25Rows) {
    if (!union.has(r.chunk_id)) {
      union.set(r.chunk_id, { chunk_id: r.chunk_id, bm25: r.bm25 });
    }
  }

  const items = Array.from(union.values());
  // 归一化分数
  const bm25Vals = items.map((x) => (x.bm25 == null ? 0 : -x.bm25)); // bm25 值越小越好，取相反数
  const vecVals = items.map((x) => x.cos ?? 0);
  const bm25N = minMaxNorm(bm25Vals);
  const vecN = minMaxNorm(vecVals);
  const scored = items.map((x, i) => ({
    ...x,
    hybrid: alpha * bm25N[i] + (1 - alpha) * vecN[i],
  }));
  scored.sort((a, b) => b.hybrid - a.hybrid);
  return scored.slice(0, topK);
}

module.exports = { hybridSearch, fetchChunks };
