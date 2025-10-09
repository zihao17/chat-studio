import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  type ChatSession, 
  type Message, 
  STORAGE_KEYS, 
  DEFAULT_WELCOME_MESSAGE,
  generateId,
  generateMessageId,
  generateSessionTitle
} from '../types/chat';
import { callAIChat, type ChatMessage } from '../utils/aiApi';

/**
 * 会话状态管理Hook
 * 提供会话的创建、切换、删除等功能
 */
export const useChatSessions = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  
  // 防抖保存的引用
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // 获取当前活跃会话
  const currentSession = sessions.find(session => session.id === currentSessionId) || null;

  // 防抖保存到localStorage
  const debouncedSave = useCallback((sessionsToSave: ChatSession[], currentId: string | null) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.CHAT_SESSIONS, JSON.stringify(sessionsToSave));
        if (currentId) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, currentId);
        }
      } catch (error) {
        console.error('保存会话数据失败:', error);
      }
    }, 500);
  }, []);

  // 从localStorage加载数据
  const loadFromStorage = useCallback(() => {
    try {
      const savedSessions = localStorage.getItem(STORAGE_KEYS.CHAT_SESSIONS);
      const savedCurrentId = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION_ID);
      
      if (savedSessions) {
        const parsedSessions: ChatSession[] = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        
        // 恢复当前会话
        if (savedCurrentId && parsedSessions.find(s => s.id === savedCurrentId)) {
          setCurrentSessionId(savedCurrentId);
        } else if (parsedSessions.length > 0) {
          // 如果没有保存的当前会话ID，选择最新的会话
          const latestSession = parsedSessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setCurrentSessionId(latestSession.id);
        }
      }
    } catch (error) {
      console.error('加载会话数据失败:', error);
    }
  }, []);

  // 创建新会话
  const createNewSession = useCallback((): ChatSession => {
    const newSession: ChatSession = {
      id: generateId(),
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSessions(prev => {
      const updated = [newSession, ...prev];
      debouncedSave(updated, newSession.id);
      return updated;
    });
    
    setCurrentSessionId(newSession.id);
    return newSession;
  }, [debouncedSave]);

  // 切换到指定会话
  const switchToSession = useCallback((sessionId: string) => {
    const targetSession = sessions.find(s => s.id === sessionId);
    if (targetSession) {
      setCurrentSessionId(sessionId);
      debouncedSave(sessions, sessionId);
    }
  }, [sessions, debouncedSave]);

  // 删除会话
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      
      // 如果删除的是当前会话，需要切换到其他会话
      if (sessionId === currentSessionId) {
        const newCurrentId = updated.length > 0 ? updated[0].id : null;
        setCurrentSessionId(newCurrentId);
        debouncedSave(updated, newCurrentId);
      } else {
        debouncedSave(updated, currentSessionId);
      }
      
      return updated;
    });
  }, [currentSessionId, debouncedSave]);

  // 更新会话标题
  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setSessions(prev => {
      const updated = prev.map(session => 
        session.id === sessionId 
          ? { ...session, title, updatedAt: Date.now() }
          : session
      );
      debouncedSave(updated, currentSessionId);
      return updated;
    });
  }, [currentSessionId, debouncedSave]);

  // 添加消息
  const addMessage = useCallback((sessionId: string, messageData: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...messageData,
      id: generateMessageId(),
      timestamp: Date.now(),
    };

    setSessions(prev => {
      const updated = prev.map(session => {
        if (session.id === sessionId) {
          const updatedMessages = [...session.messages, newMessage];
          return {
            ...session,
            messages: updatedMessages,
            updatedAt: Date.now(),
          };
        }
        return session;
      });
      debouncedSave(updated, currentSessionId);
      return updated;
    });

    return newMessage;
  }, [currentSessionId, debouncedSave]);

  // 更新消息
  const updateMessage = useCallback((sessionId: string, messageId: string, updates: Partial<Message>) => {
    setSessions(prev => {
      const updated = prev.map(session => {
        if (session.id === sessionId) {
          const updatedMessages = session.messages.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          );
          return {
            ...session,
            messages: updatedMessages,
            updatedAt: Date.now(),
          };
        }
        return session;
      });
      debouncedSave(updated, currentSessionId);
      return updated;
    });
  }, [currentSessionId, debouncedSave]);

  // 发送消息并获取AI回复
  const sendMessage = useCallback(async (content: string) => {
    if (!currentSessionId || !content.trim() || isAILoading) return;

    addMessage(currentSessionId, {
      role: "user",
      content: content.trim(),
    });

    // 如果是会话的第一条用户消息，更新会话标题
    const session = sessions.find(s => s.id === currentSessionId);
    if (session && session.messages.filter(m => m.role === "user").length === 0) {
      updateSessionTitle(currentSessionId, generateSessionTitle(content));
    }

    // 添加AI加载消息
    const loadingMessage = addMessage(currentSessionId, {
      role: "assistant",
      content: "",
      isLoading: true,
    });

    setIsAILoading(true);

    try {
      // 准备发送给AI的消息历史
      const chatMessages: ChatMessage[] = session?.messages
        .filter(m => !m.isLoading)
        .map(m => ({
          role: m.role,
          content: m.content,
        })) || [];
      
      // 添加当前用户消息
      chatMessages.push({
        role: "user",
        content: content.trim(),
      });

      // 调用AI接口
      const aiResponse = await callAIChat(chatMessages);
      
      if (aiResponse.error) {
        throw new Error(aiResponse.error);
      }

      // 更新AI消息
      updateMessage(currentSessionId, loadingMessage.id, {
        content: aiResponse.content,
        isLoading: false,
      });

    } catch (error) {
      console.error('AI回复失败:', error);
      
      // 更新错误消息
      updateMessage(currentSessionId, loadingMessage.id, {
        content: "抱歉，AI回复失败，请稍后重试。",
        isLoading: false,
      });
    } finally {
      setIsAILoading(false);
    }
  }, [currentSessionId, isAILoading, sessions, addMessage, updateSessionTitle, updateMessage]);

  // 智能新对话逻辑
  const handleNewChat = useCallback(() => {
    // 检查当前最新会话是否为空
    if (sessions.length > 0) {
      const latestSession = sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const hasUserMessages = latestSession.messages.some(m => m.role === "user");
      
      if (!hasUserMessages) {
        // 如果最新会话没有用户消息，直接切换到该会话
        switchToSession(latestSession.id);
        return;
      }
    }
    
    // 否则创建新会话
    createNewSession();
  }, [sessions, switchToSession, createNewSession]);

  // 组件挂载时加载数据
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // 如果没有会话，自动创建第一个
  useEffect(() => {
    if (sessions.length === 0 && currentSessionId === null) {
      createNewSession();
    }
  }, [sessions.length, currentSessionId, createNewSession]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    sessions,
    currentSessionId,
    currentSession,
    isAILoading,
    createNewSession,
    switchToSession,
    deleteSession,
    updateSessionTitle,
    addMessage,
    updateMessage,
    sendMessage,
    handleNewChat,
  };
};