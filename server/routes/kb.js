/**
 * 知识库路由：集合管理、文档上传与入库、搜索调试
 */
'use strict';

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { getDatabase } = require('../db/database');
const { extractText } = require('../utils/fileParser');
const { chunkText } = require('../utils/chunker');
const { embedBatch } = require('../utils/embedding');
const { hybridSearch, fetchChunks } = require('../utils/hybridSearch');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 10 } });

function getUserId(req) {
  // MVP：若有鉴权可从 req.user.id 取；暂用 1
  return (req.user && req.user.id) || 1;
}

/**
 * 安全解码上传的文件名，防止中文乱码。
 * 某些代理/浏览器会把原始 UTF-8 字节按 latin1 解读成 JS 字符串，例如 "中文" -> "Ã¤Â¸Â­Ã¦Â–Â‡"。
 * 仅在“看起来像乱码”或转换后更像 CJK 文本时才进行 latin1->utf8 转换，避免误改本就正常的名字。
 * @param {string} name 原始文件名
 * @returns {string} 解析后的文件名（尽可能保持中文正常显示）
 */
function decodeFilename(name) {
  const s = name || 'unnamed';
  try {
    const looksMojibake = /Ã|Â|â|€|¢|„|™|œ|�/.test(s);
    const originalHasCJK = /[\u4E00-\u9FFF]/.test(s);
    const converted = Buffer.from(s, 'latin1').toString('utf8');
    const convertedHasCJK = /[\u4E00-\u9FFF]/.test(converted);
    if (looksMojibake || (convertedHasCJK && !originalHasCJK)) {
      return converted || s;
    }
    return s;
  } catch {
    return s;
  }
}

/**
 * 兼容历史数据：尝试修复被误按 latin1 保存的 UTF-8 文本为正确中文。
 * 典型乱码形态如："Ã¤Â¸Â­Ã¦Â–Â‡"，修复后为："中文"。
 * 仅当原始文本看起来像乱码，或转换后明显不像 CJK 文本时，才采用修复结果。
 * @param {string} text 原始文本
 * @returns {string} 修复后的文本
 */
function fixGarbledUtf8(text) {
  if (!text) return text;
  try {
    const s = String(text);
    const looksMojibake = /Ã|Â|â|€|¢|„|™|œ|�/.test(s);
    const repaired = Buffer.from(s, 'latin1').toString('utf8');
    const repairedHasCJK = /[\u4E00-\u9FFF]/.test(repaired);
    const originalHasCJK = /[\u4E00-\u9FFF]/.test(s);
    if (looksMojibake || (repairedHasCJK && !originalHasCJK)) {
      return repaired;
    }
    return s;
  } catch {
    return text;
  }
}

// 创建知识库集合
router.post('/collections', (req, res) => {
  const db = getDatabase();
  const { name, description } = req.body || {};
  const userId = getUserId(req);
  if (!name) return res.status(400).json({ success: false, message: '缺少 name' });
  const sql = 'INSERT INTO kb_collections(user_id, name, description) VALUES(?,?,?)';
  db.run(sql, [userId, name, description || null], function (err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, id: this.lastID, name, description: description || '' });
  });
});

// 列出集合
router.get('/collections', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const sql = 'SELECT id, name, description, created_at FROM kb_collections WHERE user_id=? ORDER BY id DESC';
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, items: rows || [] });
  });
});

// 列出集合下的文档
router.get('/collections/:id/documents', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  const check = 'SELECT id FROM kb_collections WHERE id=? AND user_id=?';
  db.get(check, [id, userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: '未找到集合' });
    const sql = `SELECT d.id as docId, d.filename, d.ext, d.mime, d.size, d.status, d.created_at,
                        (SELECT COUNT(1) FROM kb_chunks c WHERE c.doc_id = d.id AND c.idx != -1) as chunk_count
                 FROM kb_documents d WHERE d.collection_id=? ORDER BY d.id DESC`;
    db.all(sql, [id], (e, rows) => {
      if (e) return res.status(500).json({ success: false, message: e.message });
      const items = (rows || []).map(r => ({ ...r, filename: fixGarbledUtf8(r.filename) }));
      res.json({ success: true, items });
    });
  });
});

// 删除集合（级联）
router.delete('/collections/:id', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  const check = 'SELECT id FROM kb_collections WHERE id=? AND user_id=?';
  db.get(check, [id, userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: '未找到集合' });
    db.run('DELETE FROM kb_collections WHERE id=?', [id], (e) => {
      if (e) return res.status(500).json({ success: false, message: e.message });
      res.json({ success: true });
    });
  });
});

// 上传文档并登记（仅元信息+原文）
router.post('/documents/upload', upload.array('files'), async (req, res) => {
  try {
    const db = getDatabase();
    const collectionId = parseInt(req.body.collection_id || req.query.collection_id, 10);
    if (!collectionId) return res.status(400).json({ success: false, message: '缺少 collection_id' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, message: '未收到文件' });

    const inserted = [];
    for (const f of files) {
      const sha = crypto.createHash('sha256').update(f.buffer).digest('hex');
      // 解析文本 + 文件名解码
      const filename = decodeFilename(f.originalname || 'unnamed');
      const ext = (path.extname(filename).replace('.', '') || '').toLowerCase();
      const mime = f.mimetype || '';
      const size = f.size || 0;
      const { text } = await extractText({ buffer: f.buffer, mime, ext });

      // 文档表
      const docSql = `INSERT INTO kb_documents(collection_id, filename, ext, mime, size, sha256, status)
                      VALUES(?,?,?,?,?,?,?)`;
      const docParams = [collectionId, filename, ext, mime, size, sha, 'uploaded'];
      const docId = await new Promise((resolve, reject) => {
        db.run(docSql, docParams, function (err) { return err ? reject(err) : resolve(this.lastID); });
      });
      inserted.push({ docId, filename: f.originalname, size });

      // 将原文临时放入 chunks 表（idx=-1）以备调试（可选）
      await new Promise((resolve) => {
        db.run(
          'INSERT INTO kb_chunks(collection_id, doc_id, idx, content, tokens, start_pos, end_pos) VALUES(?,?,?,?,?,?,?)',
          [collectionId, docId, -1, text, Math.ceil(text.length / 4), 0, text.length],
          () => resolve()
        );
      });
    }

    res.json({ success: true, items: inserted });
  } catch (e) {
    console.error('上传失败', e);
    res.status(500).json({ success: false, message: e?.message || '上传失败' });
  }
});

// 入库：切分 → 嵌入 → 写入 chunks/embeddings/fts
router.post('/documents/:docId/ingest', async (req, res) => {
  const db = getDatabase();
  const docId = parseInt(req.params.docId, 10);
  if (!docId) return res.status(400).json({ success: false, message: '缺少 docId' });
  try {
    const doc = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM kb_documents WHERE id=?', [docId], (err, row) => (err ? reject(err) : resolve(row)));
    });
    if (!doc) return res.status(404).json({ success: false, message: '文档不存在' });

    // 取原文（idx=-1）
    const raw = await new Promise((resolve, reject) => {
      db.get('SELECT content FROM kb_chunks WHERE doc_id=? AND idx=-1', [docId], (err, row) => (err ? reject(err) : resolve(row?.content || '')));
    });
    if (!raw) return res.status(400).json({ success: false, message: '未找到原文内容，请先上传解析' });

    // 切分
    const pieces = chunkText(raw, { targetChars: 3200, overlapChars: 600 });
    // 插入 chunks
    const collectionId = doc.collection_id;
    const chunkIds = [];
    for (const p of pieces) {
      const id = await new Promise((resolve) => {
        db.run(
          'INSERT INTO kb_chunks(collection_id, doc_id, idx, content, tokens, start_pos, end_pos) VALUES(?,?,?,?,?,?,?)',
          [collectionId, docId, p.idx, p.content, p.tokens, p.start_pos, p.end_pos],
          function () { resolve(this.lastID); }
        );
      });
      chunkIds.push(id);
    }

    // 嵌入
    const vectors = await embedBatch(pieces.map((x) => x.content));
    const dim = vectors[0]?.length || 0;
    for (let i = 0; i < vectors.length; i++) {
      await new Promise((resolve) => {
        db.run(
          'INSERT OR REPLACE INTO kb_embeddings(chunk_id, collection_id, vector, dim) VALUES(?,?,?,?)',
          [chunkIds[i], collectionId, Buffer.from(new Float32Array(vectors[i]).buffer), dim],
          () => resolve()
        );
      });
    }

    // 状态更新
    await new Promise((resolve) => {
      db.run('UPDATE kb_documents SET status=? WHERE id=?', ['ready', docId], () => resolve());
    });

    res.json({ success: true, chunks: chunkIds.length, dim });
  } catch (e) {
    console.error('入库失败', e);
    res.status(500).json({ success: false, message: e?.message || '入库失败' });
  }
});

// 搜索调试：混合检索 + 重排（仅返回片段，不调用大模型）
router.post('/search', async (req, res) => {
  try {
    const { collection_id, query, top_k = 10 } = req.body || {};
    if (!collection_id || !query) return res.status(400).json({ success: false, message: '缺少 collection_id 或 query' });
    const hybrid = await hybridSearch({ collectionId: parseInt(collection_id, 10), query, topK: 50 });
    const docs = hybrid.map((h) => h.content);
    const { rerank } = require('../utils/rerank');
    const reranked = await rerank(query, docs, Math.min(top_k, 10));

    // 组装最终返回
    const idSet = new Set(reranked.map((r) => hybrid[r.index].chunk_id));
    const items = hybrid
      .map((h, i) => ({ ...h, rerankScore: reranked.find((r) => r.index === i)?.score || null, i }))
      .filter((x) => idSet.has(x.chunk_id))
      .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
      .slice(0, top_k)
      .map((x) => ({ chunkId: x.chunk_id, docId: x.doc_id, content: x.content, score: x.hybrid, rerankScore: x.rerankScore }));
    res.json({ success: true, items });
  } catch (e) {
    console.error('搜索失败', e);
    res.status(500).json({ success: false, message: e?.message || '搜索失败' });
  }
});

module.exports = router;
