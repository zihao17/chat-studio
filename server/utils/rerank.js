/**
 * 重排工具（DashScope Qwen-gte-rerank-v2）
 * 首选直调 DashScope 重排 API，失败时回退为向量分数排序。
 */
'use strict';

const axios = require('axios');
const { embedBatch, cosine } = require('./embedding');

function getRerankEndpoint() {
  // 允许通过环境变量覆盖
  if (process.env.DASHSCOPE_RERANK_URL) return process.env.DASHSCOPE_RERANK_URL;
  // 根据 BASE_URL 判断是否使用 intl 域名
  const base = process.env.DASHSCOPE_BASE_URL || '';
  const intl = /dashscope-intl/.test(base);
  const host = intl ? 'https://dashscope-intl.aliyuncs.com' : 'https://dashscope.aliyuncs.com';
  return `${host}/api/v1/services/rerank/text-rerank/text-rerank`;
}

/**
 * 调用 DashScope Rerank API
 * @param {string} query
 * @param {string[]} documents
 * @param {number} topN
 * @param {string} model
 */
async function dashscopeRerank(query, documents, topN = 10, model = 'Qwen-gte-rerank-v2') {
  const url = getRerankEndpoint();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
  };
  const body = {
    model,
    input: { query, documents },
    parameters: { top_n: topN, return_documents: true },
  };
  const resp = await axios.post(url, body, { headers, timeout: 20000 });
  const items = resp.data?.output?.results || resp.data?.data || [];
  // 标准化输出：[{index, score, document}]
  return items.map((it) => ({ index: it.index ?? it.document_index ?? 0, score: it.score ?? it.relevance_score ?? 0, document: it.document ?? documents[it.index] }));
}

/**
 * 回退：用向量余弦分数排序
 */
async function fallbackRerank(query, documents, topN = 10) {
  const [qv] = await embedBatch([query]);
  const dv = await embedBatch(documents);
  const scored = documents.map((doc, i) => ({ index: i, score: cosine(qv, dv[i]), document: doc }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

async function rerank(query, documents, topN = 10) {
  try {
    return await dashscopeRerank(query, documents, topN);
  } catch (e) {
    console.warn('⚠️ DashScope 重排失败，使用回退：', e?.message || e);
    return await fallbackRerank(query, documents, topN);
  }
}

module.exports = { rerank };

