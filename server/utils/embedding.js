/**
 * 嵌入向量工具（DashScope text-embedding-v4）
 */
'use strict';

const OpenAI = require('openai');
const https = require('https');
const http = require('http');

function createKeepAliveAgent(isHttps = true) {
  const Agent = isHttps ? https.Agent : http.Agent;
  return new Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 30, maxFreeSockets: 5 });
}

function createDashscopeClient() {
  if (!process.env.DASHSCOPE_API_KEY || !process.env.DASHSCOPE_BASE_URL) {
    throw new Error('缺少 DASHSCOPE_API_KEY 或 DASHSCOPE_BASE_URL');
  }
  return new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: process.env.DASHSCOPE_BASE_URL,
    httpAgent: createKeepAliveAgent(false),
    httpsAgent: createKeepAliveAgent(true),
    timeout: 60000,
  });
}

function l2norm(vec) {
  let s = 0;
  for (const v of vec) s += v * v;
  return Math.sqrt(Math.max(s, 1e-12));
}

function normalize(vec) {
  const n = l2norm(vec);
  return vec.map((v) => v / n);
}

/**
 * 批量生成嵌入（自动分批，返回单位向量）
 * @param {string[]} inputs
 * @param {object} options
 * @param {number} [options.batchSize=64]
 * @param {string} [options.model='text-embedding-v4']
 */
async function embedBatch(inputs, options = {}) {
  const batchSize = options.batchSize ?? 64;
  const model = options.model ?? 'text-embedding-v4';
  const client = createDashscopeClient();

  const out = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    const slice = inputs.slice(i, i + batchSize);
    let resp;
    try {
      resp = await client.embeddings.create({ model, input: slice });
    } catch (e) {
      // 简单重试一次
      resp = await client.embeddings.create({ model, input: slice });
    }
    const arr = resp.data.map((d) => normalize(d.embedding));
    out.push(...arr);
  }
  return out;
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // 已单位化
}

module.exports = { embedBatch, cosine, normalize };

