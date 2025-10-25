/**
 * Chat API 路由模块
 * 提供 AI 对话代理接口，支持通义千问和 OpenAI 模型
 */

const express = require("express");
const OpenAI = require("openai");
const https = require('https');
const http = require('http');
const { getModelscopeApiKey } = require("../utils/keyManager");
const router = express.Router();

/**
 * 创建连接代理（复用TCP连接）
 * @param {boolean} isHttps - 是否为HTTPS连接
 * @returns {Agent} - HTTP/HTTPS代理实例
 */
const createKeepAliveAgent = (isHttps = true) => {
  const Agent = isHttps ? https.Agent : http.Agent;
  return new Agent({
    keepAlive: true,         // 启用连接复用
    keepAliveMsecs: 30000,   // 空闲连接保持30s
    maxSockets: 30,          // 最大并发连接（根据API并发限制调整，如30）
    maxFreeSockets: 5,       // 保留5个空闲连接，避免频繁创建
    scheduling: 'fifo'       // 先进先出调度，避免连接饥饿
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
      httpAgent: createKeepAliveAgent(false),  // HTTP连接复用
      httpsAgent: createKeepAliveAgent(true),   // HTTPS连接复用
      timeout: 60000,  // 延长超时到60s，适配长响应
    });
  } else if (serviceType === "modelscope") {
    return new OpenAI({
      apiKey: getModelscopeApiKey(), // 使用key管理器获取密钥
      baseURL: process.env.MODELSCOPE_BASE_URL,
      httpAgent: createKeepAliveAgent(false),  // HTTP连接复用
      httpsAgent: createKeepAliveAgent(true),   // HTTPS连接复用
      timeout: 60000,  // 延长超时到60s，适配长响应
    });
  } else if (serviceType === "openai") {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
      httpAgent: createKeepAliveAgent(false),  // HTTP连接复用
      httpsAgent: createKeepAliveAgent(true),   // HTTPS连接复用
      timeout: 60000,  // 延长超时到60s，适配长响应
    });
  } else {
    throw new Error(`不支持的服务类型: ${serviceType}`);
  }
}

/**
 * 参数校验中间件
 */
function validateChatRequest(req, res, next) {
  const { messages, model } = req.body;

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
    stream = false,
    temperature = 0.7,
    max_tokens = 8000,
  } = req.body;

  // 记录开始时间
  const startTime = Date.now();

  try {
    // 判断使用哪个 AI 服务
    const serviceType = getServiceType(model);
    console.log(`🤖 使用 ${serviceType} 服务，模型: ${model}`);

    // 创建对应的 OpenAI 客户端
    const openai = createOpenAIClient(serviceType);

    // 确保有系统消息
    const messagesWithSystem =
      messages[0]?.role === "system"
        ? messages
        : [
            {
              role: "system",
              content:
                "You are a helpful assistant. Please respond in Chinese.",
            },
            ...messages,
          ];

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

        const completion = await openai.chat.completions.create(
          {
            model,
            messages: messagesWithSystem,
            stream: true,
            temperature,
            max_tokens,
            // 添加 stream_options 以获取 token 统计信息
            stream_options: {
              include_usage: true,
            },
          },
          {
            signal: controller.signal,
          }
        );

        // 初始化合并缓存和超时器（优化流式传输性能）
        let buffer = ''; // 缓存待合并的内容
        let timeoutId = null;
        const MERGE_THRESHOLD = 60; // 字符阈值（中文约30字，英文约60字符）
        const MERGE_TIMEOUT = 30; // 超时阈值（30ms内未达阈值则强制发送）

        // 发送缓存内容的函数
        const flushBuffer = () => {
          if (buffer) {
            res.write(`data: ${JSON.stringify({ content: buffer })}\n\n`);
            buffer = '';
          }
          timeoutId = null;
        };

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            // 缓存当前chunk内容
            buffer += content;

            // 清除上一次的超时器（避免提前发送）
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            // 满足阈值则立即发送，否则等待超时
            if (buffer.length >= MERGE_THRESHOLD) {
              flushBuffer();
            } else {
              // 超时未达阈值，强制发送（保证实时性）
              timeoutId = setTimeout(flushBuffer, MERGE_TIMEOUT);
            }
          }

          // 收集token使用信息
          if (chunk.usage) {
            totalTokens = chunk.usage.total_tokens || 0;
            promptTokens = chunk.usage.prompt_tokens || 0;
            completionTokens = chunk.usage.completion_tokens || 0;
          }
        }

        // 流结束后，发送剩余缓存内容
        if (buffer) {
          res.write(`data: ${JSON.stringify({ content: buffer })}\n\n`);
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
  } finally {
    // 清理可能存在的超时器
    if (req.body.stream && typeof timeoutId !== 'undefined' && timeoutId) {
      clearTimeout(timeoutId);
    }
  }
});

module.exports = router;
