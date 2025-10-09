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
}

// 会话类型定义
export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
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
  
  // 会话管理方法
  createNewSession: () => ChatSession;
  switchToSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  
  // 消息管理方法
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  
  // AI交互方法
  sendMessage: (content: string) => Promise<void>;
  
  // 智能新对话逻辑
  handleNewChat: () => void;
}

// 本地存储键名常量
export const STORAGE_KEYS = {
  CHAT_SESSIONS: 'chat-studio-sessions',
  CURRENT_SESSION_ID: 'chat-studio-current-session-id',
} as const;

// 默认欢迎消息
export const DEFAULT_WELCOME_MESSAGE = "你好！我是 Chat Studio AI 助手，有什么可以帮助您的吗？";

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
  return firstUserMessage.trim().slice(0, 8) + (firstUserMessage.length > 8 ? "..." : "");
};