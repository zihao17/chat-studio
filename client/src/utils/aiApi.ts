import OpenAI from "openai";

// 阿里百炼平台配置
const DASHSCOPE_API_KEY = "sk-4b0cc5d6086d484f9ecbb6c530213975";
const DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

// 初始化OpenAI客户端（兼容阿里百炼）
const openai = new OpenAI({
  apiKey: DASHSCOPE_API_KEY,
  baseURL: DASHSCOPE_BASE_URL,
  dangerouslyAllowBrowser: true, // 允许在浏览器环境中使用
});

// 消息类型定义
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// AI响应类型定义
export interface AIResponse {
  content: string;
  error?: string;
}

/**
 * 调用AI聊天接口
 * @param messages 聊天消息历史
 * @param model 使用的模型，默认为qwen-max
 * @returns AI回复内容
 */
export async function callAIChat(
  messages: ChatMessage[],
  model: string = "qwen-max"
): Promise<AIResponse> {
  try {
    // 确保有系统消息
    const messagesWithSystem: ChatMessage[] = [
      {
        role: "system",
        content: "You are a helpful assistant. Please respond in Chinese.",
      },
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages: messagesWithSystem,
      stream: false, // 暂时使用非流式响应，后续可以改为流式
      temperature: 0.7,
      max_tokens: 8000,
    });

    const content = completion.choices[0]?.message?.content || "";

    return {
      content: content.trim(),
    };
  } catch (error) {
    console.error("AI API调用失败:", error);

    // 错误处理
    let errorMessage = "抱歉，AI服务暂时不可用，请稍后重试。";

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        errorMessage = "API密钥配置错误，请检查配置。";
      } else if (
        error.message.includes("network") ||
        error.message.includes("timeout")
      ) {
        errorMessage = "网络连接失败，请检查网络连接。";
      } else if (error.message.includes("rate limit")) {
        errorMessage = "API调用频率超限，请稍后重试。";
      }
    }

    return {
      content: "",
      error: errorMessage,
    };
  }
}

/**
 * 流式调用AI聊天接口（预留接口，后续实现）
 * @param messages 聊天消息历史
 * @param onChunk 接收到数据块时的回调
 * @param model 使用的模型
 */
export async function callAIChatStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  model: string = "qwen-max"
): Promise<void> {
  try {
    const messagesWithSystem: ChatMessage[] = [
      {
        role: "system",
        content: "You are a helpful assistant. Please respond in Chinese.",
      },
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages: messagesWithSystem,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        onChunk(content);
      }
    }
  } catch (error) {
    console.error("AI流式API调用失败:", error);
    onChunk("抱歉，AI服务暂时不可用，请稍后重试。");
  }
}
