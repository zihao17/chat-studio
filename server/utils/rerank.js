/**
 * 重排工具（DashScope qwen3-rerank / Qwen-gte-rerank-v2）
 * 首选直调 DashScope 重排 API，失败时回退为向量分数排序；
 * 同时兼容不同模型的输入字段（documents/contents/对象数组）。
 */
"use strict";

const axios = require("axios");
const { embedBatch, cosine } = require("./embedding");

function getRerankEndpoint() {
  // 允许通过环境变量覆盖完整 URL
  if (process.env.DASHSCOPE_RERANK_URL) return process.env.DASHSCOPE_RERANK_URL;
  // 根据 BASE_URL 判断是否使用 intl 域名
  const base = process.env.DASHSCOPE_BASE_URL || "";
  const intl = /dashscope-intl/.test(base);
  const host = intl
    ? "https://dashscope-intl.aliyuncs.com"
    : "https://dashscope.aliyuncs.com";
  return `${host}/api/v1/services/rerank/text-rerank/text-rerank`;
}

function getRerankModel() {
  return process.env.DASHSCOPE_RERANK_MODEL || "qwen3-rerank"; // 或 Qwen-gte-rerank-v2
}

function toStringArray(arr) {
  const out = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    if (typeof x === "string") out.push(x);
    else if (x !== null && x !== undefined) out.push(String(x));
  }
  return out;
}

async function tryDashscopeRerank({ url, headers, model, query, documents, topN }) {
  // 形态1：input.documents = string[]
  const body1 = { model, input: { query, documents }, parameters: { top_n: topN, return_documents: true } };
  try {
    const resp = await axios.post(url, body1, { headers, timeout: 20000 });
    const items = resp.data?.output?.results || resp.data?.data || [];
    return items.map((it) => ({
      index: it.index ?? it.document_index ?? 0,
      score: it.score ?? it.relevance_score ?? 0,
      document: it.document ?? documents[it.index],
    }));
  } catch (e1) {
    const msg = e1?.response?.data?.message || e1?.message || "";
    const needContents = /contents is neither str|expect.*contents/i.test(msg);
    const needObjectDocs = /documents.*(object|map)/i.test(msg);

    // 形态2：input.contents = string[]（部分模型报错提示 contents）
    if (needContents) {
      const body2 = { model, input: { query, contents: documents }, parameters: { top_n: topN, return_documents: true } };
      try {
        const resp2 = await axios.post(url, body2, { headers, timeout: 20000 });
        const items2 = resp2.data?.output?.results || resp2.data?.data || [];
        return items2.map((it) => ({
          index: it.index ?? it.document_index ?? 0,
          score: it.score ?? it.relevance_score ?? 0,
          document: it.document ?? documents[it.index],
        }));
      } catch (e2) {
        throw e2;
      }
    }

    // 形态3：input.documents = [{ text }]
    if (needObjectDocs) {
      const docObjs = documents.map((t) => ({ text: t }));
      const body3 = { model, input: { query, documents: docObjs }, parameters: { top_n: topN, return_documents: true } };
      try {
        const resp3 = await axios.post(url, body3, { headers, timeout: 20000 });
        const items3 = resp3.data?.output?.results || resp3.data?.data || [];
        return items3.map((it) => ({
          index: it.index ?? it.document_index ?? 0,
          score: it.score ?? it.relevance_score ?? 0,
          document: it.document ?? documents[it.index],
        }));
      } catch (e3) {
        throw e3;
      }
    }

    throw e1;
  }
}

async function dashscopeRerank(query, docs, topN = 10) {
  const url = getRerankEndpoint();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
  };
  const model = getRerankModel();
  const documents = toStringArray(docs).slice(0, Math.min(10, toStringArray(docs).length));
  const top = Math.min(topN, documents.length);
  return await tryDashscopeRerank({ url, headers, model, query, documents, topN: top });
}

/** 回退：用向量余弦分数排序 */
async function fallbackRerank(query, documents, topN = 10) {
  const docs = toStringArray(documents).slice(0, Math.max(1, topN));
  const [qv] = await embedBatch([query]);
  const dv = await embedBatch(docs);
  const scored = docs.map((doc, i) => ({ index: i, score: cosine(qv, dv[i]), document: doc }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

async function rerank(query, documents, topN = 10) {
  try {
    return await dashscopeRerank(query, documents, topN);
  } catch (e) {
    console.warn("⚠️ DashScope 重排失败，使用回退：", e?.response?.data?.message || e?.message || e);
    return await fallbackRerank(query, documents, topN);
  }
}

module.exports = { rerank };
