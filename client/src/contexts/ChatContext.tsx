import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { type ChatContextType } from '../types/chat';
import { useChatSessions } from '../hooks/useChatSessions';

// 创建Context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Context Provider组件
interface ChatProviderProps {
  children: ReactNode;
}

/**
 * 聊天状态管理Provider
 * 为整个应用提供会话状态管理功能
 */
export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const chatState = useChatSessions();

  return (
    <ChatContext.Provider value={chatState}>
      {children}
    </ChatContext.Provider>
  );
};

// 自定义Hook来使用ChatContext
export const useChatContext = (): ChatContextType => {
  const context = useContext(ChatContext);
  
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  
  return context;
};

export default ChatContext;
