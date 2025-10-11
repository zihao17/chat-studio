// 本地后端 API 配置
const API_BASE_URL = "http://localhost:3001";

// 消息类型定义
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// 流式响应错误处理函数
function handleStreamError(error: unknown): string {
  console.error("AI流式API调用失败:", error);

  let errorMessage = "抱歉，AI服务暂时不可用，请稍后重试。";

  if (error instanceof Error) {
    if (error.message.includes("API key") || error.message.includes("401")) {
      errorMessage = "API密钥配置错误，请检查配置。";
    } else if (
      error.message.includes("network") ||
      error.message.includes("timeout") ||
      error.message.includes("Failed to fetch")
    ) {
      errorMessage = "网络连接失败，请检查网络连接。";
    } else if (
      error.message.includes("rate limit") ||
      error.message.includes("429")
    ) {
      errorMessage = "API调用频率超限，请稍后重试。";
    } else if (error.message.includes("408")) {
      errorMessage = "请求超时，请稍后重试。";
    }
  }

  return errorMessage;
}

/**
 * 流式调用AI聊天接口（统一接口）
 * @param messages 聊天消息历史
 * @param onChunk 接收到数据块时的回调
 * @param onError 错误处理回调
 * @param model 使用的模型
 * @param abortController 用于中断请求的控制器
 */
export async function callAIChatStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onError?: (error: string) => void,
  model: string = "qwen-max",
  abortController?: AbortController
): Promise<void> {
  try {
    // 调用本地后端代理接口（流式）
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        model,
        stream: true,
        temperature: 0.7,
        max_tokens: 8000, // 增加 max_tokens 以支持更长的回复
      }),
      signal: abortController?.signal, // 添加中断信号
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    // 处理流式响应
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法获取响应流");
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              onChunk(parsed.content);
            } else if (parsed.error) {
              // 处理流式响应中的错误
              const errorMsg = handleStreamError(new Error(parsed.error));
              if (onError) {
                onError(errorMsg);
              } else {
                onChunk(errorMsg);
              }
              return;
            }
          } catch (e) {
            // 忽略解析错误，继续处理下一行
          }
        }
      }
    }
  } catch (error) {
    // 检查是否为中断错误
    if (error instanceof Error && error.name === 'AbortError') {
      // 中断请求不需要显示错误信息
      return;
    }
    
    const errorMsg = handleStreamError(error);
    if (onError) {
      onError(errorMsg);
    } else {
      onChunk(errorMsg);
    }
  }
}
