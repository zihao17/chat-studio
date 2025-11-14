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
 * @param {number} [options.batchSize=10] - 批量大小，强制不超过 10（DashScope API 限制）
 * @param {string} [options.model='text-embedding-v4']
 */
async function embedBatch(inputs, options = {}) {
  // 强制 batchSize 不超过 10（DashScope API 限制）
  const batchSize = Math.min(options.batchSize ?? 10, 10);
  const model = options.model ?? 'text-embedding-v4';
  const client = createDashscopeClient();

  const out = [];
  const totalBatches = Math.ceil(inputs.length / batchSize);

  for (let i = 0; i < inputs.length; i += batchSize) {
    const slice = inputs.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    let resp;
    let retries = 0;
    const maxRetries = 2;

    // 批次级重试机制（最多 2 次，指数退避）
    while (retries <= maxRetries) {
      try {
        const startTime = Date.now();
        resp = await client.embeddings.create({ model, input: slice });
        const duration = Date.now() - startTime;

        console.log(`✅ 嵌入批次 ${batchNum}/${totalBatches} 完成 (${slice.length} 条, ${duration}ms)`);
        break;
      } catch (e) {
        retries++;
        if (retries > maxRetries) {
          console.error(`❌ 嵌入批次 ${batchNum}/${totalBatches} 失败 (已重试 ${maxRetries} 次):`, e?.message || e);
          throw new Error(`批次 ${batchNum} 嵌入失败: ${e?.message || '未知错误'}`);
        }
        console.warn(`⚠️ 嵌入批次 ${batchNum}/${totalBatches} 失败，重试 ${retries}/${maxRetries}...`);
        // 指数退避：1s, 2s
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
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

