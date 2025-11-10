import { useState, useEffect, useCallback, useRef } from "react";
import {
  type ChatSession,
  type Message,
  type AttachmentMeta,
  STORAGE_KEYS,
  generateId,
  generateMessageId,
  generateSessionTitle,
} from "../types/chat";
import { callAIChatStream, type ChatMessage } from "../utils/aiApi";
import { useAuth } from "../contexts/AuthContext";
import { useChatSync } from "./useChatSync";

/**
 * 会话状态管理Hook
 * 提供会话的创建、切换、删除等功能
 */
export const useChatSessions = () => {
  const { state: authState } = useAuth();
  const chatSync = useChatSync();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>("Qwen/Qwen3-Next-80B-A3B-Instruct"); // 默认模型
  // 高级设置：温度、top_p、系统提示词（系统提示词默认不生效，仅作占位展示）
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.9);
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  // RAG：知识库开关与当前集合
  const [kbEnabled, setKbEnabled] = useState<boolean>(false);
  const [kbCollectionId, setKbCollectionId] = useState<number | undefined>(undefined);
  // 存储每个会话的AbortController，用于中断流式响应
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  // 标记是否已经进行过登录后的数据同步
  const [hasSyncedAfterLogin, setHasSyncedAfterLogin] = useState(false);

  // 防抖保存的引用
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  // 自动创建会话的延时器引用
  const autoCreateTimeoutRef = useRef<number | undefined>(undefined);

  // 获取当前活跃会话
  const currentSession =
    sessions.find((session) => session.id === currentSessionId) || null;

  // 获取当前会话的加载状态
  const isAILoading = currentSession?.isLoading || false;

  // 获取指定会话的生成状态
  const isSessionGenerating = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      return session?.isLoading || false;
    },
    [sessions]
  );

  // 停止指定会话的生成
  const stopGeneration = useCallback(
    (sessionId: string) => {
      const abortController = abortControllersRef.current.get(sessionId);
      if (abortController) {
        abortController.abort();
        abortControllersRef.current.delete(sessionId);

        // 查找并更新正在加载的消息，同时清除会话的加载状态
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
          const loadingMessage = session.messages.find((m) => m.isLoading);
          if (loadingMessage) {
            // 如果消息内容为空或只有空白字符，删除这条消息
            if (!loadingMessage.content || !loadingMessage.content.trim()) {
              // 删除空的加载消息，避免影响后续请求
              setSessions((prevSessions) =>
                prevSessions.map((s) =>
                  s.id === sessionId
                    ? {
                        ...s,
                        messages: s.messages.filter((m) => m.id !== loadingMessage.id),
                        isLoading: false, // 清除会话加载状态
                        updatedAt: Date.now(),
                      }
                    : s
                )
              );
            } else {
              // 如果有内容，添加停止标记
              setSessions((prevSessions) =>
                prevSessions.map((s) =>
                  s.id === sessionId
                    ? {
                        ...s,
                        messages: s.messages.map((msg) =>
                          msg.id === loadingMessage.id
                            ? {
                                ...msg,
                                content: msg.content + "\n\n[生成已停止]",
                                isLoading: false,
                              }
                            : msg
                        ),
                        isLoading: false, // 清除会话加载状态
                        updatedAt: Date.now(),
                      }
                    : s
                )
              );
            }
          } else {
            // 如果没有找到加载中的消息，只清除会话加载状态
            setSessions((prevSessions) =>
              prevSessions.map((s) =>
                s.id === sessionId
                  ? { ...s, isLoading: false, updatedAt: Date.now() }
                  : s
              )
            );
          }
        }
      }
    },
    [sessions, setSessions]
  );

  // 防抖保存到localStorage（仅在游客模式下）
  const debouncedSave = useCallback(
    (
      sessionsToSave: ChatSession[],
      currentId: string | null,
      modelId?: string
    ) => {
      // 如果用户已登录，不保存到localStorage
      if (authState.isAuthenticated) {
        return;
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(
            STORAGE_KEYS.CHAT_SESSIONS,
            JSON.stringify(sessionsToSave)
          );
          if (currentId) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, currentId);
          }
          if (modelId) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_MODEL, modelId);
          }
        } catch (error) {
          console.error("保存会话数据失败:", error);
        }
      }, 500);
    },
    [authState.isAuthenticated]
  );

  // 设置当前模型并保存到localStorage
  const handleSetCurrentModel = useCallback(
    (modelId: string) => {
      setCurrentModel(modelId);
      // 保存到localStorage（仅在游客模式下）
      if (!authState.isAuthenticated) {
        debouncedSave(sessions, currentSessionId, modelId);
      }
    },
    [authState.isAuthenticated, sessions, currentSessionId, debouncedSave]
  );

  // 设置指定会话的加载状态
  const setSessionLoading = useCallback(
    (sessionId: string, loading: boolean) => {
      setSessions((prev) => {
        const prevSessions = Array.isArray(prev) ? prev : [];
        const updated = prevSessions.map((session) =>
          session.id === sessionId
            ? { ...session, isLoading: loading, updatedAt: Date.now() }
            : session
        );
        debouncedSave(updated, currentSessionId);
        return updated;
      });
    },
    [currentSessionId, debouncedSave]
  );

  // 从localStorage加载数据（仅在游客模式下）
  const loadFromStorage = useCallback(() => {
    // 如果用户已登录，不从localStorage加载
    if (authState.isAuthenticated) {
      return;
    }

    try {
      const savedSessions = localStorage.getItem(STORAGE_KEYS.CHAT_SESSIONS);
      const savedCurrentId = localStorage.getItem(
        STORAGE_KEYS.CURRENT_SESSION_ID
      );
      const savedModel = localStorage.getItem(STORAGE_KEYS.CURRENT_MODEL);
      const savedAdvanced = localStorage.getItem(STORAGE_KEYS.ADVANCED_SETTINGS);

      // 恢复模型选择
      if (savedModel) {
        setCurrentModel(savedModel);
      }

      // 恢复高级设置
      if (savedAdvanced) {
        try {
          const parsed = JSON.parse(savedAdvanced) as { temperature?: number; topP?: number; systemPrompt?: string };
          const clamp = (v: number) => Math.min(1.0, Math.max(0.1, v));
          const round1 = (v: number) => Math.round(v * 10) / 10;
          if (typeof parsed.temperature === 'number') setTemperature(round1(clamp(parsed.temperature)));
          if (typeof parsed.topP === 'number') setTopP(round1(clamp(parsed.topP)));
          if (typeof parsed.systemPrompt === 'string') setSystemPrompt(parsed.systemPrompt.trim() === '' ? '' : parsed.systemPrompt);
        } catch {}
      }

      if (savedSessions) {
        const parsedSessions: ChatSession[] = JSON.parse(savedSessions);
        setSessions(parsedSessions);

        // 恢复当前会话
        if (
          savedCurrentId &&
          parsedSessions.find((s) => s.id === savedCurrentId)
        ) {
          setCurrentSessionId(savedCurrentId);
        } else if (parsedSessions.length > 0) {
          // 如果没有保存的当前会话ID，选择最新的会话
          const latestSession = parsedSessions.sort(
            (a, b) => b.updatedAt - a.updatedAt
          )[0];
          setCurrentSessionId(latestSession.id);
        }
      }
    } catch (error) {
      console.error("加载会话数据失败:", error);
    }
  }, [authState.isAuthenticated]);

  // 持久化高级设置到本地
  useEffect(() => {
    const payload = JSON.stringify({ temperature, topP, systemPrompt });
    try {
      localStorage.setItem(STORAGE_KEYS.ADVANCED_SETTINGS, payload);
    } catch {}
  }, [temperature, topP, systemPrompt]);

  // 创建新会话
  const createNewSession = useCallback((): ChatSession => {
    const newSession: ChatSession = {
      id: generateId(),
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    console.log("🎯 创建新会话", {
      sessionId: newSession.id,
      title: newSession.title,
      timestamp: new Date(newSession.createdAt).toLocaleString()
    });

    setSessions((prev) => {
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
  const switchToSession = useCallback(
    (sessionId: string) => {
      const targetSession = sessions.find((s) => s.id === sessionId);
      if (targetSession) {
        setCurrentSessionId(sessionId);
        debouncedSave(sessions, sessionId);
      }
    },
    [sessions, debouncedSave]
  );

  // 删除会话
  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
        const prevSessions = Array.isArray(prev) ? prev : [];
        const updated = prevSessions.filter((s) => s.id !== sessionId);

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

      // 如果用户已登录，同时删除云端数据
      if (authState.isAuthenticated) {
        chatSync.deleteSession(sessionId);
      }
    },
    [currentSessionId, debouncedSave, authState.isAuthenticated, chatSync]
  );

  // 更新会话标题
  const updateSessionTitle = useCallback(
    (sessionId: string, title: string) => {
      setSessions((prev) => {
        // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
        const prevSessions = Array.isArray(prev) ? prev : [];
        const updated = prevSessions.map((session) =>
          session.id === sessionId
            ? { ...session, title, updatedAt: Date.now() }
            : session
        );
        debouncedSave(updated, currentSessionId);
        return updated;
      });
    },
    [currentSessionId, debouncedSave]
  );

  // 添加消息
  const addMessage = useCallback(
    (sessionId: string, messageData: Omit<Message, "id" | "timestamp">) => {
      const newMessage: Message = {
        ...messageData,
        id: generateMessageId(),
        timestamp: Date.now(),
      };

      setSessions((prev) => {
        // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
        const prevSessions = Array.isArray(prev) ? prev : [];
        const updated = prevSessions.map((session) => {
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

      // 如果用户已登录，同时保存到云端
      if (authState.isAuthenticated && !messageData.isLoading) {
        // 不在这里保存消息，避免重复保存
        // 用户消息在sendMessage中保存，AI消息在流式完成后保存
      }

      return newMessage;
    },
    [currentSessionId, debouncedSave, authState.isAuthenticated, chatSync]
  );

  // 更新消息
  const updateMessage = useCallback(
    (sessionId: string, messageId: string, updates: Partial<Message>) => {
      setSessions((prev) => {
        // 确保 prev 是一个数组，防止 "prev is not iterable" 错误
        const prevSessions = Array.isArray(prev) ? prev : [];
        const updated = prevSessions.map((session) => {
          if (session.id === sessionId) {
            const updatedMessages = session.messages.map((msg) =>
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
    },
    [currentSessionId, debouncedSave]
  );

  // 发送消息并获取AI回复（流式）
  const sendMessage = useCallback(
    async (
      content: string,
      attachmentsMeta?: AttachmentMeta[],
      options?: { displayContent?: string }
    ) => {
      if (!currentSessionId || !content.trim() || isAILoading) return;

      const displayContent = (options?.displayContent ?? content).trim();

      addMessage(currentSessionId, {
        role: "user",
        content: displayContent,
        attachments: attachmentsMeta,
      });

      // 如果是会话的第一条用户消息，更新会话标题
      const session = sessions.find((s) => s.id === currentSessionId);
      const isFirstUserMessage =
        session &&
        session.messages.filter((m) => m.role === "user").length === 0;

      // 构造云端保存内容：对用户消息用包装格式保留附件元信息（不保存大段文本）
      const buildCloudContent = (
        role: "user" | "assistant",
        display: string,
        atts?: AttachmentMeta[]
      ): string => {
        if (role !== "user") return display;
        try {
          return JSON.stringify({
            __type: "chatstudio.msg",
            v: 1,
            role,
            display,
            attachments: Array.isArray(atts) ? atts : [],
          });
        } catch {
          return display;
        }
      };

      if (isFirstUserMessage) {
        const newTitle = generateSessionTitle(displayContent);
        updateSessionTitle(currentSessionId, newTitle);

        // 如果用户已登录，同时保存标题到云端
        if (authState.isAuthenticated) {
          try {
            await chatSync.saveMessage(
              currentSessionId,
              "user",
              buildCloudContent("user", displayContent, attachmentsMeta),
              newTitle
            );
            console.log("用户消息和标题已保存到云端");
          } catch (error) {
            console.error("保存用户消息到云端失败:", error);
            // 不影响用户体验，消息已在本地保存
          }
        }
      } else {
        // 不是第一条消息，正常保存
        if (authState.isAuthenticated) {
          try {
            await chatSync.saveMessage(
              currentSessionId,
              "user",
              buildCloudContent("user", displayContent, attachmentsMeta)
            );
            console.log("用户消息已保存到云端");
          } catch (error) {
            console.error("保存用户消息到云端失败:", error);
            // 不影响用户体验，消息已在本地保存
          }
        }
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
        const chatMessages: ChatMessage[] =
          session?.messages
            .filter((m) => !m.isLoading && m.content && m.content.trim()) // 过滤掉加载中的消息和空内容消息
            .map((m) => ({
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
        // 标记是否发生错误，避免在错误后用空内容覆盖错误提示
        let errorOccurred = false;
        // 高频chunk合并相关变量
        let chunkBuffer = "";
        let chunkTimer: number | null = null;

        // 合并chunk更新的函数
        const flushChunkBuffer = () => {
          if (chunkBuffer) {
            accumulatedContent += chunkBuffer;
            updateMessage(currentSessionId, loadingMessage.id, {
              content: accumulatedContent,
              isLoading: true,
            });
            chunkBuffer = "";
          }
          chunkTimer = null;
        };

        // 调用流式AI接口
        await callAIChatStream(
          chatMessages,
          // onChunk: 接收到数据块时的回调
          (chunk: string) => {
            chunkBuffer += chunk;
            // 每15ms合并一次更新（兼顾实时性和性能）
            if (!chunkTimer) {
              chunkTimer = setTimeout(flushChunkBuffer, 15); // 15ms约为60fps的单帧时间，减少DOM更新频率
            }
          },
          // onError: 错误处理回调
          (error: string) => {
            // 清除pending的chunk更新
            if (chunkTimer) {
              clearTimeout(chunkTimer);
              chunkTimer = null;
            }
            // 确保最后一批chunk被更新
            if (chunkBuffer) {
              accumulatedContent += chunkBuffer;
              chunkBuffer = "";
            }
            
            console.error("AI流式回复失败:", error);
            // 以一条 AI 消息的形式展示友好错误提示，保留在对话历史
            updateMessage(currentSessionId, loadingMessage.id, {
              content: error,
              isLoading: false,
              // 标记为错误消息，用于 UI 层识别（样式保持与普通 AI 消息一致）
              isError: true,
            });
            errorOccurred = true;
            setSessionLoading(currentSessionId, false);
            abortControllersRef.current.delete(currentSessionId);
          },
          // onStats: 接收到统计信息时的回调
          (stats) => {
            // 将统计信息添加到消息中
            updateMessage(currentSessionId, loadingMessage.id, {
              stats: stats,
            });
          },
          currentModel, // 使用当前选中的模型
          {
            temperature,
            top_p: topP,
            abortController,
            user_system_prompt: systemPrompt,
            kb_enabled: kbEnabled,
            kb_collection_id: kbCollectionId,
            kb_top_k: 6,
          }
        );

        // 流式传输完成，清除加载状态（仅在未发生错误时更新最终内容）
        if (!errorOccurred) {
          // 清除pending的chunk更新并确保最后一批chunk被更新
          if (chunkTimer) {
            clearTimeout(chunkTimer);
            chunkTimer = null;
          }
          if (chunkBuffer) {
            accumulatedContent += chunkBuffer;
            chunkBuffer = "";
          }
          
          updateMessage(currentSessionId, loadingMessage.id, {
            content: accumulatedContent,
            isLoading: false,
          });

          // AI回复完成后，保存到云端
          if (authState.isAuthenticated && accumulatedContent.trim()) {
            try {
              await chatSync.saveMessage(
                currentSessionId,
                "assistant",
                accumulatedContent
              );
              console.log("AI消息已保存到云端");
            } catch (error) {
              console.error("保存AI消息到云端失败:", error);
              // 不影响用户体验，消息已在本地保存
            }
          }
        }
      } catch (error) {
        console.error("AI回复失败:", error);

        // 更新错误消息（统一为友好提示）
        updateMessage(currentSessionId, loadingMessage.id, {
          content: "🤖 AI 服务暂时不可用，请稍后重试。",
          isLoading: false,
          isError: true,
        });
      } finally {
        // 清除当前会话的加载状态和AbortController
        setSessionLoading(currentSessionId, false);
        abortControllersRef.current.delete(currentSessionId);
      }
    },
    [
      currentSessionId,
      isAILoading,
      sessions,
      addMessage,
      updateSessionTitle,
      updateMessage,
      setSessionLoading,
      currentModel,
      authState.isAuthenticated,
      chatSync,
    ]
  );

  // 智能新对话逻辑
  const handleNewChat = useCallback(() => {
    console.log("🔄 触发新对话逻辑");
    
    // 检查当前最新会话是否为空
    if (sessions.length > 0) {
      const latestSession = sessions.sort(
        (a, b) => b.updatedAt - a.updatedAt
      )[0];
      const hasUserMessages = latestSession.messages.some(
        (m) => m.role === "user"
      );

      if (!hasUserMessages) {
        // 如果最新会话没有用户消息，直接切换到该会话
        console.log("✅ 情况1：复用空会话 - 最新会话无用户消息，直接切换", {
          sessionId: latestSession.id,
          title: latestSession.title,
          messageCount: latestSession.messages.length
        });
        switchToSession(latestSession.id);
        return;
      }
    }

    // 否则创建新会话
    console.log("🆕 情况1：创建新会话 - 用户主动点击新对话按钮", {
      existingSessions: sessions.length,
      reason: sessions.length === 0 ? "无现有会话" : "最新会话已有用户消息"
    });
    createNewSession();
  }, [sessions, switchToSession, createNewSession]);

  // 处理用户登录后的数据同步
  useEffect(() => {
    const handleLoginSync = async () => {
      if (
        authState.isAuthenticated &&
        !hasSyncedAfterLogin &&
        !chatSync.isSyncing
      ) {
        console.log("用户登录成功，数据同步将自动进行");

        // 添加延迟确保cookie完全设置
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          // 获取本地游客数据
          const guestSessions = localStorage.getItem(
            STORAGE_KEYS.CHAT_SESSIONS
          );
          const parsedGuestSessions: ChatSession[] = guestSessions
            ? JSON.parse(guestSessions)
            : [];

          // 加载云端数据（带重试机制）
          const cloudSessions = await loadCloudDataWithRetry();

          if (parsedGuestSessions.length > 0) {
            console.log(`发现 ${parsedGuestSessions.length} 个游客会话，开始同步到云端`);
            // 有游客数据，需要同步到云端
            const syncSuccess = await syncGuestDataWithRetry(parsedGuestSessions);

            if (syncSuccess) {
              console.log("游客数据同步成功，重新加载云端数据");
              // 同步成功后，重新加载云端数据（包含刚同步的数据）
              const updatedCloudSessions = await loadCloudDataWithRetry();
              setSessions(updatedCloudSessions);
              console.log(`同步后加载到 ${updatedCloudSessions.length} 个云端会话`);

              // 设置当前会话为最新的会话
              if (updatedCloudSessions.length > 0) {
                const latestSession = updatedCloudSessions.sort(
                  (a, b) => b.updatedAt - a.updatedAt
                )[0];
                setCurrentSessionId(latestSession.id);
                console.log(`设置当前会话为: ${latestSession.title}`);
              }

              // 清空本地游客数据
              localStorage.removeItem(STORAGE_KEYS.CHAT_SESSIONS);
              localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION_ID);
              console.log("游客数据同步成功，本地数据已清空");
            } else {
              console.log("游客数据同步失败，使用现有云端数据");
              // 同步失败，但不清空游客数据，保留在本地
              // 合并游客数据和云端数据显示给用户
              const mergedSessions = [...parsedGuestSessions, ...cloudSessions];
              setSessions(mergedSessions);
              
              if (mergedSessions.length > 0) {
                const latestSession = mergedSessions.sort(
                  (a, b) => b.updatedAt - a.updatedAt
                )[0];
                setCurrentSessionId(latestSession.id);
              }
              console.log(`合并显示 ${mergedSessions.length} 个会话（游客+云端）`);
            }
          } else {
            console.log("没有游客数据，直接使用云端数据");
            // 没有游客数据，直接使用云端数据
            setSessions(cloudSessions);
            if (cloudSessions.length > 0) {
              const latestSession = cloudSessions.sort(
                (a, b) => b.updatedAt - a.updatedAt
              )[0];
              setCurrentSessionId(latestSession.id);
            }
            console.log(`加载 ${cloudSessions.length} 个云端会话`);
          }

          setHasSyncedAfterLogin(true);
        } catch (error) {
          console.error("登录后数据同步失败:", error);
          // 同步失败时，标记为已同步，避免无限重试
          setHasSyncedAfterLogin(true);
        }
      }
    };

    // 带重试机制的云端数据加载 - 限制最大重试次数
    const loadCloudDataWithRetry = async (maxRetries = 2): Promise<ChatSession[]> => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await chatSync.loadCloudData();
        } catch (error: any) {
          console.warn(`加载云端数据失败 (尝试 ${i + 1}/${maxRetries}):`, error.message);
          if (i === maxRetries - 1) {
            // 最后一次失败，返回空数组而不是抛出错误
            console.error("加载云端数据最终失败，使用空数据");
            return [];
          }
          // 等待后重试，使用固定延迟避免指数增长
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      return [];
    };

    // 带重试机制的游客数据同步 - 限制最大重试次数
    const syncGuestDataWithRetry = async (guestSessions: ChatSession[], maxRetries = 2): Promise<boolean> => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await chatSync.syncGuestData(guestSessions);
        } catch (error: any) {
          console.warn(`同步游客数据失败 (尝试 ${i + 1}/${maxRetries}):`, error.message);
          if (i === maxRetries - 1) {
            // 最后一次失败，返回false
            console.error("同步游客数据最终失败");
            return false;
          }
          // 等待后重试，使用固定延迟避免指数增长
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      return false;
    };

    // 只在认证状态变化且未同步时执行
    if (authState.isAuthenticated && !hasSyncedAfterLogin) {
      handleLoginSync();
    }
  }, [authState.isAuthenticated, hasSyncedAfterLogin]); // 移除chatSync依赖，避免循环

  // 处理用户登出后的状态重置
  useEffect(() => {
    if (!authState.isAuthenticated && hasSyncedAfterLogin) {
      console.log("👋 用户登出，重置状态...");
      setHasSyncedAfterLogin(false);
      setSessions([]);
      setCurrentSessionId(null);
      console.log("🔄 情况3：登出后重新加载游客数据，将触发初始会话创建");
      // 重新加载游客数据
      loadFromStorage();
    }
  }, [authState.isAuthenticated, hasSyncedAfterLogin, loadFromStorage]);

  // 如果没有会话，自动创建第一个（仅在游客模式或同步完成后）- 延时检测机制
  useEffect(() => {
    // 清除之前的定时器
    if (autoCreateTimeoutRef.current) {
      clearTimeout(autoCreateTimeoutRef.current);
      autoCreateTimeoutRef.current = undefined;
    }

    // 条件A：检查是否需要自动创建会话
    const conditionA = sessions.length === 0 && currentSessionId === null;
    
    if (conditionA) {
      // 游客模式或已完成登录同步的情况下才启动计时器
      if (!authState.isAuthenticated || hasSyncedAfterLogin) {
        console.log("⏰ 条件A满足，启动2秒延时检测", {
          mode: authState.isAuthenticated ? "登录模式" : "游客模式",
          hasSyncedAfterLogin,
          sessionsLength: sessions.length,
          currentSessionId
        });

        // 启动2秒计时器
        autoCreateTimeoutRef.current = window.setTimeout(() => {
          // 2秒后再次检测条件A
          const stillNeedCreate = sessions.length === 0 && currentSessionId === null;
          
          if (stillNeedCreate) {
            console.log("🚀 情况2：延时检测通过，自动创建初始会话", {
              mode: authState.isAuthenticated ? "登录模式" : "游客模式",
              hasSyncedAfterLogin,
              reason: "2秒延时后条件A仍然成立"
            });
            createNewSession();
          } else {
            console.log("⏹️ 延时检测未通过，取消自动创建", {
              sessionsLength: sessions.length,
              currentSessionId,
              reason: "2秒内条件A已不满足"
            });
          }
          
          autoCreateTimeoutRef.current = undefined;
        }, 2000);
      }
    }
  }, [
    sessions.length,
    currentSessionId,
    createNewSession,
    authState.isAuthenticated,
    hasSyncedAfterLogin,
  ]);

  // 组件挂载时加载游客数据（仅在游客模式下）
  useEffect(() => {
    if (!authState.isAuthenticated) {
      loadFromStorage();
    }
  }, [authState.isAuthenticated, loadFromStorage]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (autoCreateTimeoutRef.current) {
        clearTimeout(autoCreateTimeoutRef.current);
      }
    };
  }, []);

  return {
    sessions,
    currentSessionId,
    currentSession,
    isAILoading,
    currentModel,
    isSessionGenerating,
    createNewSession,
    switchToSession,
    deleteSession,
    updateSessionTitle,
    addMessage,
    updateMessage,
    sendMessage,
    stopGeneration,
    setCurrentModel: handleSetCurrentModel,
    handleNewChat,
    // 高级设置导出
    temperature,
    topP,
    systemPrompt,
    setTemperature,
    setTopP,
    setSystemPrompt,
    // RAG 设置导出
    kbEnabled,
    setKbEnabled,
    kbCollectionId,
    setKbCollectionId,
  };
};
