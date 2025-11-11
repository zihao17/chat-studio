/**
 * Chat API 路由模块
 * 提供 AI 对话代理接口，支持通义千问和 OpenAI 模型
 */

const express = require("express");
const OpenAI = require("openai");
const https = require("https");
const http = require("http");
const { getModelscopeApiKey } = require("../utils/keyManager");
const { getDatabase } = require("../db/database");
const router = express.Router();

/**
 * 创建连接代理（复用TCP连接）
 * @param {boolean} isHttps - 是否为HTTPS连接
 * @returns {Agent} - HTTP/HTTPS代理实例
 */
const createKeepAliveAgent = (isHttps = true) => {
  const Agent = isHttps ? https.Agent : http.Agent;
  return new Agent({
    keepAlive: true, // 启用连接复用
    keepAliveMsecs: 30000, // 空闲连接保持30s
    maxSockets: 30, // 最大并发连接（根据API并发限制调整，如30）
    maxFreeSockets: 5, // 保留5个空闲连接，避免频繁创建
    scheduling: "fifo", // 先进先出调度，避免连接饥饿
  });
};

/**
 * 根据模型名称判断使用哪个 AI 服务
 * @param {string} model - 模型名称
 * @returns {string} - 服务类型：'dashscope'、'modelscope' 或 'openai'
 */
function getServiceType(model) {
  // 阿里百炼通义千问模型列表
  const dashscopeModels = [
    "qwen3-max",
    "qwen-flash-2025-07-28",
    "qwen3-vl-flash",
  ];

  // 魔搭ModelScope模型列表
  const modelscopeModels = [
    "Qwen/Qwen3-Next-80B-A3B-Instruct",
    "ZhipuAI/GLM-4.6",
    "deepseek-ai/DeepSeek-R1-0528",
    "Qwen/Qwen3-235B-A22B",
    "Qwen/Qwen3-8B",
    "deepseek-ai/DeepSeek-V3.2-Exp",
  ];

  // OpenAI 模型列表
  const openaiModels = [];

  if (dashscopeModels.includes(model)) {
    return "dashscope";
  } else if (modelscopeModels.includes(model)) {
    return "modelscope";
  } else if (openaiModels.includes(model)) {
    return "openai";
  } else {
    // 默认使用Qwen Next 80B模型
    return "modelscope";
  }
}

/**
 * 创建 OpenAI 客户端实例
 * @param {string} serviceType - 服务类型
 * @returns {OpenAI} - OpenAI 客户端实例
 */
function createOpenAIClient(serviceType) {
  if (serviceType === "dashscope") {
    return new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: process.env.DASHSCOPE_BASE_URL,
      httpAgent: createKeepAliveAgent(false), // HTTP连接复用
      httpsAgent: createKeepAliveAgent(true), // HTTPS连接复用
      timeout: 60000, // 延长超时到60s，适配长响应
    });
  } else if (serviceType === "modelscope") {
    return new OpenAI({
      apiKey: getModelscopeApiKey(), // 使用key管理器获取密钥
      baseURL: process.env.MODELSCOPE_BASE_URL,
      httpAgent: createKeepAliveAgent(false), // HTTP连接复用
      httpsAgent: createKeepAliveAgent(true), // HTTPS连接复用
      timeout: 60000, // 延长超时到60s，适配长响应
    });
  } else if (serviceType === "openai") {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
      httpAgent: createKeepAliveAgent(false), // HTTP连接复用
      httpsAgent: createKeepAliveAgent(true), // HTTPS连接复用
      timeout: 60000, // 延长超时到60s，适配长响应
    });
  } else {
    throw new Error(`不支持的服务类型: ${serviceType}`);
  }
}

/**
 * 参数校验中间件
 */
function validateChatRequest(req, res, next) {
  const { messages, model, temperature, max_tokens, top_p, user_system_prompt } = req.body;

  // 校验 messages 参数
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "Invalid request",
      message: "messages 参数必须是非空数组",
    });
  }

  // 校验每个消息的格式
  for (const message of messages) {
    if (!message.role || !message.content) {
      return res.status(400).json({
        error: "Invalid request",
        message: "每个消息必须包含 role 和 content 字段",
      });
    }

    if (!["system", "user", "assistant"].includes(message.role)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "role 字段必须是 system、user 或 assistant",
      });
    }
  }

  // 校验 model 参数
  if (!model || typeof model !== "string") {
    return res.status(400).json({
      error: "Invalid request",
      message: "model 参数必须是字符串",
    });
  }

  // 校验 temperature 参数（可选）
  if (
    temperature !== undefined &&
    (typeof temperature !== "number" || temperature < 0 || temperature > 2)
  ) {
    return res.status(400).json({
      error: "Invalid request",
      message: "temperature 参数必须是 0-2 之间的数字",
    });
  }

  // 校验 max_tokens 参数（可选）
  if (
    max_tokens !== undefined &&
    (typeof max_tokens !== "number" || max_tokens < 1)
  ) {
    return res.status(400).json({
      error: "Invalid request",
      message: "max_tokens 参数必须是大于 0 的数字",
    });
  }

  // 校验 top_p 参数（可选）
  if (
    top_p !== undefined &&
    (typeof top_p !== "number" || top_p < 0 || top_p > 1)
  ) {
    return res.status(400).json({
      error: "Invalid request",
      message: "top_p 参数必须是 0-1 之间的数字",
    });
  }

  // 校验 user_system_prompt 参数（可选）
  if (
    user_system_prompt !== undefined &&
    typeof user_system_prompt !== "string"
  ) {
    return res.status(400).json({
      error: "Invalid request",
      message: "user_system_prompt 必须是字符串",
    });
  }

  next();
}

/**
 * POST /api/chat - AI 对话接口
 * 支持流式和非流式响应
 */
router.post("/chat", validateChatRequest, async (req, res) => {
  const {
    messages,
    model,
    stream = true,
    temperature = 0.7,
    max_tokens = 10000,
    top_p = 0.9, // 添加 top_p 参数支持，默认值 0.9
    user_system_prompt,
    // RAG 相关参数
    kb_enabled = false,
    kb_collection_id,
    kb_top_k = 6,
  } = req.body;

  // 记录开始时间
  const startTime = Date.now();

  try {
    // 判断使用哪个 AI 服务
    const serviceType = getServiceType(model);
    console.log(`🤖 使用 ${serviceType} 服务，模型: ${model}`);

    // 创建对应的 OpenAI 客户端
    const openai = createOpenAIClient(serviceType);

    // 平台系统提示词（A）
    const platformSystemPrompt =
      "你是 Chat Studio 智能伙伴，一个专为学习、工作与生活场景设计的 AI 助手，智能贴心且全面。请以清晰、自然、有帮助的方式回应用户。始终使用简体中文，语言流畅，语气可随用户风格灵活调整（专业严谨或轻松亲切）。擅长解答知识问题、提供建议、辅助（如代码、文本、生活等），并能帮用户梳理逻辑、解决实际问题。";

    // 用户自定义系统提示词（B）
    const userSystemPrompt =
      user_system_prompt && typeof user_system_prompt === "string"
        ? user_system_prompt.trim()
        : "";

    // 轻量级安全合规指令（S）
    const safetyPrompt =
      "请遵守法律法规与平台政策，不输出违法、隐私泄露、恶意利用指引、血腥暴力、仇恨歧视或成人露骨内容。涉及医疗、法律、金融与安全等敏感领域，仅提供一般性信息并提示咨询专业人士；如与系统指令或合规要求冲突，以系统指令与合规要求优先。";

    // 合成最终系统提示词（C = A + B + S）
    const parts = [platformSystemPrompt];
    if (userSystemPrompt) parts.push(userSystemPrompt);
    parts.push(safetyPrompt);
    const finalSystemPrompt = parts.join("\n\n");

    // 过滤掉用户传来的 system 消息，统一由服务端注入 C
    const nonSystemMessages = Array.isArray(messages)
      ? messages.filter((m) => m && m.role !== "system")
      : [];

    const messagesWithSystem = [
      { role: "system", content: finalSystemPrompt },
      ...nonSystemMessages,
    ];

    // （日志已移除）

    // 设置请求超时
    const timeout = parseInt(process.env.REQUEST_TIMEOUT) || 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      if (stream) {
        // 流式响应
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");

        let totalTokens = 0;
        let promptTokens = 0;
        let completionTokens = 0;
        let citations = [];

        // 若启用 RAG：执行混检+重排，拼装上下文
        let messagesFinal = messagesWithSystem;
        if (kb_enabled && kb_collection_id) {
          try {
            const { hybridSearch } = require("../utils/hybridSearch");
            const { rerank } = require("../utils/rerank");
            const collectionId = parseInt(kb_collection_id, 10);
            const userQuery = nonSystemMessages[nonSystemMessages.length - 1]?.content || "";
            const t0 = Date.now();
            const hybrid = await hybridSearch({ collectionId, query: userQuery, topK: 50 });
            // DashScope Rerank 对输入文档存在批量上限（<=10）。
            const RERANK_INPUT_MAX = 10;
            const candidates = hybrid.slice(0, RERANK_INPUT_MAX);
            const docs = candidates.map((h) => h.content);
            let reranked;
            try {
              reranked = await rerank(userQuery, docs, Math.min(RERANK_INPUT_MAX, docs.length));
            } catch (err) {
              // 再保险降级：若 rerank 全链路失败，则使用 hybrid 排序直接取前 kb_top_k
              console.warn("RERANK 调用失败，使用 HYBRID 直接排序降级:", err?.message || err);
              reranked = candidates.map((_, i) => ({ index: i, score: candidates[i].hybrid }));
            }
            const keep = reranked.slice(0, Math.min(kb_top_k, 6));
            // 取文档标题
            const docIds = Array.from(new Set(keep.map((r) => candidates[r.index].doc_id)));
            let titleMap = new Map();
            if (docIds.length) {
              const db = getDatabase();
              const placeholders = docIds.map(() => "?").join(",");
              const rows = await new Promise((resolve, reject) => {
                db.all(
                  `SELECT id, filename FROM kb_documents WHERE id IN (${placeholders})`,
                  docIds,
                  (err, rs) => (err ? reject(err) : resolve(rs || []))
                );
              });
              // 尝试修复历史乱码文件名
              const fixGarbled = (t) => {
                try {
                  const repaired = Buffer.from(String(t), 'latin1').toString('utf8');
                  const nonAsciiOrig = (String(t).match(/[^\x00-\x7F]/g) || []).length;
                  const nonAsciiNew = (repaired.match(/[^\x00-\x7F]/g) || []).length;
                  return nonAsciiNew > nonAsciiOrig ? repaired : t;
                } catch { return t; }
              };
              titleMap = new Map(rows.map((r) => [r.id, fixGarbled(r.filename)]));
            }
            citations = keep.map((r) => {
              const h = candidates[r.index];
              const title = titleMap.get(h.doc_id) || `doc-${h.doc_id}`;
              const preview = (h.content || "").slice(0, 120);
              return { title, preview, docId: h.doc_id, chunkId: h.chunk_id, score: r.score, idx: h.idx };
            });
            const contextBlocks = keep.map((r, i) => {
              const h = candidates[r.index];
              const title = citations[i]?.title || `doc-${h.doc_id}`;
              return `【来源${i + 1}｜${title}｜#${h.idx}】\n${h.content}`;
            });
            const ragPrefix = `你可以参考以下已检索到的资料（如无关请忽略）：\n\n${contextBlocks.join("\n\n")}`;
            messagesFinal = [
              { role: "system", content: finalSystemPrompt },
              { role: "system", content: ragPrefix },
              ...nonSystemMessages,
            ];
            console.log(`RAG 检索用时: ${(Date.now() - t0)}ms, 命中: ${keep.length}`);
          } catch (e) {
            console.warn("RAG 流程失败，回退无检索:", e?.message || e);
          }
        }

        const completion = await openai.chat.completions.create(
          {
            model,
            messages: messagesFinal,
            stream: true,
            temperature,
            max_tokens,
            top_p, // 添加 top_p 参数
            // 添加 stream_options 以获取 token 统计信息
            stream_options: {
              include_usage: true,
            },
          },
          {
            signal: controller.signal,
          }
        );

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            // 发送 SSE 格式数据
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }

          // 收集token使用信息
          if (chunk.usage) {
            totalTokens = chunk.usage.total_tokens || 0;
            promptTokens = chunk.usage.prompt_tokens || 0;
            completionTokens = chunk.usage.completion_tokens || 0;
          }
        }

        // 计算响应时间
        const responseTime = ((Date.now() - startTime) / 1000).toFixed(1);

        // 发送统计信息
        res.write(
          `data: ${JSON.stringify({
            stats: {
              model,
              responseTime: `${responseTime}s`,
              totalTokens,
              promptTokens,
              completionTokens,
              citations,
            },
          })}\n\n`
        );

        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        // 非流式响应
        const completion = await openai.chat.completions.create(
          {
            model,
            messages: messagesWithSystem,
            stream: false,
            temperature,
            max_tokens,
            top_p, // 添加 top_p 参数
          },
          {
            signal: controller.signal,
          }
        );

        const content = completion.choices[0]?.message?.content || "";

        // 计算响应时间
        const responseTime = ((Date.now() - startTime) / 1000).toFixed(1);

        res.json({
          content: content.trim(),
          model,
          usage: completion.usage,
          stats: {
            model,
            responseTime: `${responseTime}s`,
            totalTokens: completion.usage?.total_tokens || 0,
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
          },
        });
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("AI API 调用失败:", error);

    // 处理不同类型的错误
    let statusCode = 500;
    let errorMessage = "AI 服务暂时不可用，请稍后重试";

    if (error.name === "AbortError") {
      statusCode = 408;
      errorMessage = "请求超时，请稍后重试";
    } else if (error.status) {
      // OpenAI API 错误
      statusCode = error.status;
      if (error.status === 401) {
        errorMessage = "API 密钥无效或已过期";
      } else if (error.status === 429) {
        errorMessage = "API 调用频率超限，请稍后重试";
      } else if (error.status === 400) {
        errorMessage = "请求参数错误";
      } else {
        errorMessage = error.message || errorMessage;
      }
    } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      statusCode = 503;
      errorMessage = "网络连接失败，请检查网络连接";
    }

    // 如果是流式响应且已经开始发送数据，发送错误事件
    if (req.body.stream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    } else {
      res.status(statusCode).json({
        error: "API Error",
        message: errorMessage,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
});

module.exports = router;
