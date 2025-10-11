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
import { callAIChatStream, type ChatMessage } from '../utils/aiApi';

/**
 * 会话状态管理Hook
 * 提供会话的创建、切换、删除等功能
 */
export const useChatSessions = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  // 存储每个会话的AbortController，用于中断流式响应
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  
  // 防抖保存的引用
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // 获取当前活跃会话
  const currentSession = sessions.find(session => session.id === currentSessionId) || null;

  // 获取当前会话的加载状态
  const isAILoading = currentSession?.isLoading || false;

  // 获取指定会话的生成状态
  const isSessionGenerating = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    return session?.isLoading || false;
  }, [sessions]);

  // 停止指定会话的生成
  const stopGeneration = useCallback((sessionId: string) => {
    const abortController = abortControllersRef.current.get(sessionId);
    if (abortController) {
      abortController.abort();
      abortControllersRef.current.delete(sessionId);
      
      // 立即清除会话的加载状态
      setSessionLoading(sessionId, false);
      
      // 查找并更新正在加载的消息
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        const loadingMessage = session.messages.find(m => m.isLoading);
        if (loadingMessage) {
          updateMessage(sessionId, loadingMessage.id, {
            content: loadingMessage.content + "\n\n[生成已停止]",
            isLoading: false,
          });
        }
      }
    }
  }, [sessions]);

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

  // 设置指定会话的加载状态
  const setSessionLoading = useCallback((sessionId: string, loading: boolean) => {
    setSessions(prev => {
      const prevSessions = Array.isArray(prev) ? prev : [];
      const updated = prevSessions.map(session => 
        session.id === sessionId 
          ? { ...session, isLoading: loading, updatedAt: Date.now() }
          : session
      );
      debouncedSave(updated, currentSessionId);
      return updated;
    });
  }, [currentSessionId, debouncedSave]);

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
      // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
      const prevSessions = Array.isArray(prev) ? prev : [];
      const updated = [newSession, ...prevSessions];
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
      // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
      const prevSessions = Array.isArray(prev) ? prev : [];
      const updated = prevSessions.filter(s => s.id !== sessionId);
      
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
      // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
      const prevSessions = Array.isArray(prev) ? prev : [];
      const updated = prevSessions.map(session => 
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
      // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
      const prevSessions = Array.isArray(prev) ? prev : [];
      const updated = prevSessions.map(session => {
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
      // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
      const prevSessions = Array.isArray(prev) ? prev : [];
      const updated = prevSessions.map(session => {
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

  // 发送消息并获取AI回复（流式）
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

    // 设置当前会话的加载状态
    setSessionLoading(currentSessionId, true);

    // 创建AbortController用于中断请求
    const abortController = new AbortController();
    abortControllersRef.current.set(currentSessionId, abortController);

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

      // 用于累积流式响应内容
      let accumulatedContent = "";

      // 调用流式AI接口
      await callAIChatStream(
        chatMessages,
        // onChunk: 接收到数据块时的回调
        (chunk: string) => {
          accumulatedContent += chunk;
          // 实时更新AI消息内容
          updateMessage(currentSessionId, loadingMessage.id, {
            content: accumulatedContent,
            isLoading: true, // 保持加载状态直到完成
          });
        },
        // onError: 错误处理回调
        (error: string) => {
          console.error('AI流式回复失败:', error);
          updateMessage(currentSessionId, loadingMessage.id, {
            content: error,
            isLoading: false,
          });
          setSessionLoading(currentSessionId, false);
          abortControllersRef.current.delete(currentSessionId);
        },
        "qwen-max", // model
        abortController // 传入AbortController
      );

      // 流式传输完成，清除加载状态
      updateMessage(currentSessionId, loadingMessage.id, {
        content: accumulatedContent,
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
      // 清除当前会话的加载状态和AbortController
      setSessionLoading(currentSessionId, false);
      abortControllersRef.current.delete(currentSessionId);
    }
  }, [currentSessionId, isAILoading, sessions, addMessage, updateSessionTitle, updateMessage, setSessionLoading]);

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
    isSessionGenerating,
    createNewSession,
    switchToSession,
    deleteSession,
    updateSessionTitle,
    addMessage,
    updateMessage,
    sendMessage,
    stopGeneration,
    handleNewChat,
  };
};