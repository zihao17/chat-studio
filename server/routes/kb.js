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
  const { name, description, group_id } = req.body || {};
  const userId = getUserId(req);
  if (!name) return res.status(400).json({ success: false, message: '缺少 name' });
  const sql = 'INSERT INTO kb_collections(user_id, name, description, group_id) VALUES(?,?,?,?)';
  db.run(sql, [userId, name, description || null, group_id || null], function (err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, id: this.lastID, name, description: description || '', group_id: group_id || null });
  });
});

// 列出集合（可按分组筛选）
router.get('/collections', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const groupId = req.query.group_id ? parseInt(req.query.group_id, 10) : null;
  const sql = groupId
    ? 'SELECT id, name, description, group_id, created_at FROM kb_collections WHERE user_id=? AND group_id=? ORDER BY id DESC'
    : 'SELECT id, name, description, group_id, created_at FROM kb_collections WHERE user_id=? ORDER BY id DESC';
  const params = groupId ? [userId, groupId] : [userId];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, items: rows || [] });
  });
});

// 更新集合（重命名/分组移动/描述）
router.put('/collections/:id', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  const { name, description, group_id } = req.body || {};
  const check = 'SELECT id FROM kb_collections WHERE id=? AND user_id=?';
  db.get(check, [id, userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: '未找到集合' });
    const fields = [];
    const vals = [];
    if (typeof name === 'string') { fields.push('name=?'); vals.push(name); }
    if (typeof description === 'string') { fields.push('description=?'); vals.push(description); }
    if (typeof group_id !== 'undefined') { fields.push('group_id=?'); vals.push(group_id || null); }
    if (!fields.length) return res.json({ success: true });
    const sql = `UPDATE kb_collections SET ${fields.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`;
    vals.push(id);
    db.run(sql, vals, (e) => {
      if (e) return res.status(500).json({ success: false, message: e.message });
      res.json({ success: true });
    });
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
    const sql = `SELECT d.id as docId, d.filename, d.ext, d.mime, d.size, d.status, d.error, d.created_at,
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

// 分组：创建
router.post('/groups', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ success: false, message: '缺少 name' });
  db.run('INSERT INTO kb_groups(user_id, name, description) VALUES(?,?,?)', [userId, name, description || null], function (err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, id: this.lastID, name, description: description || '' });
  });
});

// 分组：列表
router.get('/groups', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  db.all('SELECT id, name, description, created_at FROM kb_groups WHERE user_id=? ORDER BY id DESC', [userId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, items: rows || [] });
  });
});

// 分组：更新
router.put('/groups/:id', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  const { name, description } = req.body || {};
  const check = 'SELECT id FROM kb_groups WHERE id=? AND user_id=?';
  db.get(check, [id, userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: '未找到分组' });
    const fields = [];
    const vals = [];
    if (typeof name === 'string') { fields.push('name=?'); vals.push(name); }
    if (typeof description === 'string') { fields.push('description=?'); vals.push(description); }
    if (!fields.length) return res.json({ success: true });
    const sql = `UPDATE kb_groups SET ${fields.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`;
    vals.push(id);
    db.run(sql, vals, (e) => {
      if (e) return res.status(500).json({ success: false, message: e.message });
      res.json({ success: true });
    });
  });
});

// 分组：删除（若存在集合引用则禁止）
router.delete('/groups/:id', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const id = parseInt(req.params.id, 10);
  const check = 'SELECT id FROM kb_groups WHERE id=? AND user_id=?';
  db.get(check, [id, userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: '未找到分组' });
    db.get('SELECT COUNT(1) AS cnt FROM kb_collections WHERE group_id=?', [id], (e2, r2) => {
      if (e2) return res.status(500).json({ success: false, message: e2.message });
      if ((r2?.cnt || 0) > 0) return res.status(400).json({ success: false, message: '该分组下仍有知识库，无法删除' });
      db.run('DELETE FROM kb_groups WHERE id=?', [id], (e3) => {
        if (e3) return res.status(500).json({ success: false, message: e3.message });
        res.json({ success: true });
      });
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

// 粘贴纯文本创建文档
router.post('/documents/paste', async (req, res) => {
  try {
    const db = getDatabase();
    const { collection_id, text, filename } = req.body || {};
    const collectionId = parseInt(collection_id, 10);
    if (!collectionId || !text) return res.status(400).json({ success: false, message: '缺少 collection_id 或 text' });
    const safeName = decodeFilename(filename || `pasted-${Date.now()}.txt`);
    const size = Buffer.byteLength(text, 'utf8');
    const sha = crypto.createHash('sha256').update(text).digest('hex');
    const docId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO kb_documents(collection_id, filename, ext, mime, size, sha256, status, progress) VALUES(?,?,?,?,?,?,?,?)',
        [collectionId, safeName, 'txt', 'text/plain', size, sha, 'uploaded', 0],
        function (err) { return err ? reject(err) : resolve(this.lastID); }
      );
    });
    await new Promise((resolve) => {
      db.run(
        'INSERT INTO kb_chunks(collection_id, doc_id, idx, content, tokens, start_pos, end_pos) VALUES(?,?,?,?,?,?,?)',
        [collectionId, docId, -1, text, Math.ceil(text.length / 4), 0, text.length],
        () => resolve()
      );
    });
    res.json({ success: true, docId });
  } catch (e) {
    console.error('粘贴文本创建失败', e);
    res.status(500).json({ success: false, message: e?.message || '粘贴文本创建失败' });
  }
});

// 入库：切分 → 嵌入 → 写入 chunks/embeddings/fts
router.post('/documents/:docId/ingest', async (req, res) => {
  const db = getDatabase();
  const docId = parseInt(req.params.docId, 10);
  if (!docId) return res.status(400).json({ success: false, message: '缺少 docId' });
  try {
    await new Promise((resolve) => db.run('UPDATE kb_documents SET status=?, progress=10, error=NULL WHERE id=?', ['processing', docId], () => resolve()));
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
    await new Promise((resolve) => db.run('UPDATE kb_documents SET progress=? WHERE id=?', [40, docId], () => resolve()));

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
      
      // 优化进度更新频率：每 5 个 chunk 或最后一个时更新
      if (i % 5 === 0 || i === vectors.length - 1) {
        const pct = 40 + Math.round(((i + 1) / vectors.length) * 55);
        await new Promise((resolve) => 
          db.run('UPDATE kb_documents SET progress=? WHERE id=?', [Math.min(95, pct), docId], () => resolve())
        );
      }
    }

    // 状态更新
    await new Promise((resolve) => {
      db.run('UPDATE kb_documents SET status=?, progress=? WHERE id=?', ['ready', 100, docId], () => resolve());
    });

    res.json({ success: true, chunks: chunkIds.length, dim });
  } catch (e) {
    console.error('入库失败', e);

    // 错误分类处理
    let userMessage = '入库失败';
    let errorType = 'unknown';

    if (e?.message?.includes('batch size is invalid')) {
      userMessage = '文档过大，批处理失败。请联系管理员优化配置。';
      errorType = 'batch_size_limit';
    } else if (e?.message?.includes('批次') && e?.message?.includes('嵌入失败')) {
      userMessage = `向量嵌入失败: ${e.message}`;
      errorType = 'embedding_failed';
    } else if (e?.code === 'ECONNREFUSED' || e?.code === 'ETIMEDOUT') {
      userMessage = '网络连接失败，请检查网络或稍后重试';
      errorType = 'network_error';
    } else if (e?.status === 401 || e?.status === 403) {
      userMessage = 'API 密钥无效或已过期';
      errorType = 'auth_error';
    } else {
      userMessage = e?.message || '入库失败';
    }

    await new Promise((resolve) => 
      db.run(
        'UPDATE kb_documents SET status=?, error=?, progress=? WHERE id=?', 
        ['error', userMessage, 0, docId], 
        () => resolve()
      )
    );

    res.status(500).json({ 
      success: false, 
      message: userMessage,
      errorType,
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    });
  }
});

// 文档详情（状态/进度）
router.get('/documents/:docId', (req, res) => {
  const db = getDatabase();
  const docId = parseInt(req.params.docId, 10);
  db.get('SELECT id as docId, filename, status, progress, error, created_at FROM kb_documents WHERE id=?', [docId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: '未找到文档' });
    res.json({ success: true, item: row });
  });
});

// 删除文档
router.delete('/documents/:docId', (req, res) => {
  const db = getDatabase();
  const userId = getUserId(req);
  const docId = parseInt(req.params.docId, 10);
  const sql = `SELECT d.id, c.user_id FROM kb_documents d JOIN kb_collections c ON d.collection_id=c.id WHERE d.id=?`;
  db.get(sql, [docId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row || row.user_id !== userId) return res.status(404).json({ success: false, message: '文档不存在' });
    db.run('DELETE FROM kb_documents WHERE id=?', [docId], (e2) => {
      if (e2) return res.status(500).json({ success: false, message: e2.message });
      res.json({ success: true });
    });
  });
});

// 搜索调试：混合检索 + 重排（仅返回片段，不调用大模型）
router.post('/search', async (req, res) => {
  try {
    const { collection_id, query, top_k = 10 } = req.body || {};
    if (!collection_id || !query) return res.status(400).json({ success: false, message: '缺少 collection_id 或 query' });
    const hybrid = await hybridSearch({ collectionId: parseInt(collection_id, 10), query, topK: 50 });
    const RERANK_INPUT_MAX = 10;
    const candidates = hybrid.slice(0, RERANK_INPUT_MAX);
    const docs = candidates.map((h) => h.content);
    const { rerank } = require('../utils/rerank');
    let reranked;
    try {
      reranked = await rerank(query, docs, Math.min(top_k, RERANK_INPUT_MAX, docs.length));
    } catch (err) {
      // 降级：用 hybrid 分数直接排序
      console.warn('RERANK 调用失败，使用 HYBRID 直接排序降级:', err?.message || err);
      reranked = candidates.map((c, i) => ({ index: i, score: c.hybrid }));
    }

    // 组装最终返回（增加文档名）
    const idSet = new Set(reranked.map((r) => candidates[r.index].chunk_id));
    const items = candidates
      .map((h, i) => ({ ...h, rerankScore: reranked.find((r) => r.index === i)?.score || null, i }))
      .filter((x) => idSet.has(x.chunk_id))
      .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
      .slice(0, top_k);
    
    // 批量查询文档名
    const docIds = [...new Set(items.map(x => x.doc_id))];
    const docNames = await new Promise((resolve, reject) => {
      if (!docIds.length) return resolve({});
      const placeholders = docIds.map(() => '?').join(',');
      const db = getDatabase();
      db.all(`SELECT id, filename FROM kb_documents WHERE id IN (${placeholders})`, docIds, (err, rows) => {
        if (err) return reject(err);
        const map = {};
        (rows || []).forEach(r => { map[r.id] = fixGarbledUtf8(r.filename); });
        resolve(map);
      });
    });

    const result = items.map((x) => ({ 
      chunkId: x.chunk_id, 
      docId: x.doc_id, 
      docName: docNames[x.doc_id] || `doc-${x.doc_id}`,
      idx: x.idx,
      content: x.content, 
      score: x.hybrid, 
      rerankScore: x.rerankScore 
    }));
    res.json({ success: true, items: result });
  } catch (e) {
    console.error('搜索失败', e);
    res.status(500).json({ success: false, message: e?.message || '搜索失败' });
  }
});

// 获取单个chunk详情（用于引用卡片展开）
router.get('/chunks/:chunkId', (req, res) => {
  const db = getDatabase();
  const chunkId = parseInt(req.params.chunkId, 10);
  if (!chunkId) return res.status(400).json({ success: false, message: '缺少 chunkId' });
  
  const sql = `SELECT c.id as chunkId, c.doc_id as docId, c.idx, c.content, c.tokens,
                      d.filename as docName, d.ext, d.mime
               FROM kb_chunks c
               LEFT JOIN kb_documents d ON c.doc_id = d.id
               WHERE c.id = ?`;
  
  db.get(sql, [chunkId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: '未找到chunk' });
    
    // 修复文档名乱码
    const item = { ...row, docName: fixGarbledUtf8(row.docName) };
    res.json({ success: true, item });
  });
});

module.exports = router;
