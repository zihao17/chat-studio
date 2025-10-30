/**
 * 聊天相关的数据类型定义
 */

// 消息类型定义 - 触发重新编译
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isLoading?: boolean;
  // 标记是否为错误消息（用于 UI 自动滚动等逻辑，样式保持一致）
  isError?: boolean;
  // AI回复的统计信息
  stats?: {
    model: string;
    responseTime: string;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  };
}

// 会话类型定义
export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isLoading?: boolean; // 每个会话独立的加载状态
}

// 会话状态管理接口
export interface ChatContextType {
  // 当前会话列表
  sessions: ChatSession[];
  // 当前活跃会话ID
  currentSessionId: string | null;
  // 当前活跃会话
  currentSession: ChatSession | null;
  // 是否正在加载AI回复
  isAILoading: boolean;
  // 当前选中的模型
  currentModel: string;
  // 获取指定会话的生成状态
  isSessionGenerating: (sessionId: string) => boolean;

  // 会话管理方法
  createNewSession: () => ChatSession;
  switchToSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;

  // 消息管理方法
  addMessage: (
    sessionId: string,
    message: Omit<Message, "id" | "timestamp">
  ) => void;
  updateMessage: (
    sessionId: string,
    messageId: string,
    updates: Partial<Message>
  ) => void;

  // AI交互方法
  sendMessage: (content: string) => Promise<void>;
  // 停止生成方法
  stopGeneration: (sessionId: string) => void;
  // 设置当前模型
  setCurrentModel: (modelId: string) => void;

  // 智能新对话逻辑
  handleNewChat: () => void;

  // 高级设置：温度、top_p 与系统提示词
  temperature: number;
  topP: number;
  systemPrompt: string;
  setTemperature: (v: number) => void;
  setTopP: (v: number) => void;
  setSystemPrompt: (v: string) => void;
}

// 本地存储键名常量
export const STORAGE_KEYS = {
  CHAT_SESSIONS: "chat-studio-sessions",
  CURRENT_SESSION_ID: "chat-studio-current-session-id",
  CURRENT_MODEL: "chat-studio-current-model",
  ADVANCED_SETTINGS: "chat-studio-advanced-settings",
} as const;

// 默认欢迎消息
export const DEFAULT_WELCOME_MESSAGE =
  "你好！我是 Chat Studio AI 助手，有什么可以帮助您的吗？";

// 默认系统提示词（作为占位符展示，不默认生效）
export const DEFAULT_SYSTEM_PROMPT_PLACEHOLDER =
  "你是 Chat Studio 的 AI 助手。请以清晰、简洁且结构化的方式作答，必要时使用项目符号或表格帮助理解。避免编造信息。";

// 生成唯一ID的工具函数
export const generateId = (): string => {
  return Date.now().toString();
};

// 生成消息ID的工具函数
export const generateMessageId = (): string => {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// 截取标题的工具函数（取用户消息前8字）
export const generateSessionTitle = (firstUserMessage: string): string => {
  if (!firstUserMessage.trim()) return "新对话";
  return (
    firstUserMessage.trim().slice(0, 10) +
    (firstUserMessage.length > 10 ? "..." : "")
  );
};
