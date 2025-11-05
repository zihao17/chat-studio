import React, { useState, useEffect, useRef } from "react";
import { App } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import MainLayout from "../components/layout/MainLayout";
import { useChatContext } from "../contexts/ChatContext";
import { DEFAULT_WELCOME_MESSAGE, type Attachment, type AttachmentMeta } from "../types/chat";
import StopGenerationButton from "../components/ui/StopGenerationButton";
import MarkdownRenderer from "../components/ui/MarkdownRenderer";
import ChatInputPanel from "../components/ui/ChatInputPanel";
import type { ChatInputPanelRef } from "../components/ui/ChatInputPanel";
import DropOverlay from "../components/ui/DropOverlay";
import { uploadFiles, validateLocalFiles } from "../utils/fileApi";

/**
 * 主页组件
 * Chat Studio 的主要界面
 */
const Home: React.FC = () => {
  // 使用 App.useApp() 获取 message 实例
  const { message } = App.useApp();
  // 用户输入内容
  const [inputValue, setInputValue] = useState("");
  // 消息容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 消息容器的滚动容器引用
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // 聊天输入框引用，用于自动聚焦
  const chatInputRef = useRef<ChatInputPanelRef>(null);
  // 用户是否手动滚动的状态
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  // 上次消息数量，用于检测新消息
  const [lastMessageCount, setLastMessageCount] = useState(0);
  // 是否应该自动滚动（仅在用户发送消息时为true）
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  // 智能吸附状态：用户是否希望跟随最新消息
  const [isStickToBottom, setIsStickToBottom] = useState(true);
  // 滚动锁：防抖延迟滚动的 timeout ID
  const scrollTimeoutRef = useRef<number | null>(null);
  // 流式输出状态：标记是否正在接收流式数据
  const [isStreaming, setIsStreaming] = useState(false);
  // 保底滚动定时器：极端情况下的兜底机制
  const fallbackScrollTimeoutRef = useRef<number | null>(null);
  // 滚动状态标记：避免同一帧内多次触发滚动
  const isScrollingRef = useRef<boolean>(false);

  // 附件上传与拖拽状态
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [isDragging, setIsDragging] = useState(false);
  // 拖拽进入/离开计数，避免子元素触发抖动
  const dragCounterRef = useRef<number>(0);
  // 全局兜底：防止覆盖层在极端情况下卡住或浏览器打开文件
  useEffect(() => {
    const onWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) {
        e.preventDefault();
      }
    };
    const onWindowDrop = (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) {
        e.preventDefault();
      }
      dragCounterRef.current = 0;
      setIsDragging(false);
    };
    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("drop", onWindowDrop);
    window.addEventListener("dragend", onWindowDrop);
    return () => {
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("drop", onWindowDrop);
      window.removeEventListener("dragend", onWindowDrop);
    };
  }, []);

  // 附件大小格式化（用于消息内附件元信息展示）
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // 从Context获取会话状态和方法
  const {
    currentSession,
    currentSessionId,
    isAILoading,
    isSessionGenerating,
    sendMessage,
    stopGeneration,
  } = useChatContext();

  // 获取距离底部的像素距离
  const getDistanceFromBottom = () => {
    if (!messagesContainerRef.current) return 0;
    const container = messagesContainerRef.current;
    // 精确计算距离底部的距离（clientHeight已扣除padding，更准确）
    const distanceFromBottom = 
      container.scrollHeight - 
      container.scrollTop - 
      container.clientHeight; // clientHeight不包含滚动条，更精确
    return distanceFromBottom;
  };

  // 检查是否接近底部（≤80px为吸附区域，缩小缓冲区间提高灵敏度）
  const isNearBottom = () => {
    return getDistanceFromBottom() <= 80;
  };

  // 滚动到底部的函数 - 使用帧率节流 + scrollIntoView 确保准确滚动
  const scrollToBottom = () => {
    // 避免同一帧内多次触发滚动
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;

    // 使用微任务确保 React 状态已提交，在当前宏任务结束后、浏览器渲染前执行
    queueMicrotask(() => {
      // 单次 rAF：确保 DOM 更新和布局计算完成
      requestAnimationFrame(() => {
        if (messagesContainerRef.current && messagesEndRef.current) {
          const container = messagesContainerRef.current;
          // 强制触发浏览器重排，确保获取最新布局（关键！）
          void container.offsetHeight; // 强制更新布局计算
          
          // 改用消息末尾的空div定位，比scrollHeight更可靠
          messagesEndRef.current.scrollIntoView({
            block: 'end', // 精确对齐底部
            behavior: 'auto' // 所有情况下都直接跳转，无动画
          });
        }
        isScrollingRef.current = false;
      });
    });
  };

  // 移除原有的防抖滚动函数，直接使用scrollToBottom
  // const debouncedScrollToBottom = () => { ... } // 已删除

  // 启动保底滚动定时器 - 极端情况兜底机制
  // 保底滚动机制 - 确保在极端情况下也能滚动到底部
  const startFallbackScrollTimer = () => {
    // 清除旧定时器
    if (fallbackScrollTimeoutRef.current) {
      clearTimeout(fallbackScrollTimeoutRef.current);
    }
  
    // 流式输出时缩短保底时间（300ms→100ms），并连续检查3次
    let checkCount = 0;
    const checkScroll = () => {
      scrollToBottom(); // 强制滚动
      checkCount++;
      if (isStreaming && checkCount < 3) { // 连续检查3次
        fallbackScrollTimeoutRef.current = setTimeout(checkScroll, 100);
      } else {
        fallbackScrollTimeoutRef.current = null;
      }
    };
  
    fallbackScrollTimeoutRef.current = setTimeout(checkScroll, 100);
  };

  // 清除保底滚动定时器
  const clearFallbackScrollTimer = () => {
    if (fallbackScrollTimeoutRef.current) {
      clearTimeout(fallbackScrollTimeoutRef.current);
      fallbackScrollTimeoutRef.current = null;
    }
  };

  // 处理用户滚动事件 - 智能吸附逻辑
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const distanceFromBottom = getDistanceFromBottom();

    // 用户主动滚动时，清除保底定时器（用户已经看到内容）
    clearFallbackScrollTimer();

    // 智能吸附逻辑 - 缩小缓冲区间（80-120px），减少状态频繁切换的同时提高灵敏度
    if (distanceFromBottom <= 80) {
      // 用户滚动到接近底部（≤80px），启用吸附模式
      setIsStickToBottom(true);
      setUserHasScrolled(false);
    } else if (distanceFromBottom > 120) {
      // 用户向上滚动超过120px，取消吸附模式
      setIsStickToBottom(false);
      setUserHasScrolled(true);
    }
    // 在80px-120px之间保持当前状态，避免频繁切换
  };

  // 智能滚动逻辑 - 支持吸附模式、流式输出跟随，使用滚动锁防抖机制 + 保底兜底
  useEffect(() => {
    const currentMessageCount = currentSession?.messages?.length || 0;

    // 最新一条消息（用于检测错误消息）
    const latestMessage = currentSession?.messages?.[currentMessageCount - 1];

    // 检测是否有新消息（消息数量增加）
    const hasNewMessage = currentMessageCount > lastMessageCount;

    // 检测是否有消息内容更新（AI流式输出）
    const hasContentUpdate = currentSession?.messages?.some(
      (msg) => msg.role === "assistant" && msg.isLoading
    );

    // 更新流式输出状态
    const wasStreaming = isStreaming;
    setIsStreaming(!!hasContentUpdate);

    // 流式输出状态变化处理
    if (!wasStreaming && hasContentUpdate) {
      // 开始流式输出：启动保底定时器
      startFallbackScrollTimer();
    } else if (wasStreaming && !hasContentUpdate) {
      // 流式输出结束：清除保底定时器
      clearFallbackScrollTimer();
    }

    // 当最新消息是错误消息时，强制滚动到底部
    const hasErrorUpdate =
      !!latestMessage &&
      latestMessage.role === "assistant" &&
      latestMessage.isError === true;

    if (hasNewMessage || hasContentUpdate || hasErrorUpdate) {
      // 决定是否自动滚动的条件：
      // 1. 用户刚发送消息 (shouldAutoScroll)
      // 2. 用户处于吸附模式 (isStickToBottom)
      // 3. 用户未手动滚动且接近底部 (!userHasScrolled && isNearBottom())
      // 4. 最新消息为错误消息 (hasErrorUpdate) → 强制滚动
      const shouldScroll =
        hasErrorUpdate ||
        shouldAutoScroll ||
        isStickToBottom ||
        (!userHasScrolled && isNearBottom());

      if (shouldScroll) {
        // 对于流式输出，直接使用scrollToBottom（已优化为帧率节流）
        if (hasContentUpdate && !hasNewMessage) {
          // 流式输出中：使用优化后的滚动
          scrollToBottom();
        } else {
          // 新消息或错误消息：立即滚动
          scrollToBottom();
        }

        // 仅在用户发送消息后重置标志
        if (shouldAutoScroll) {
          setShouldAutoScroll(false);
        }
      }
    }

    // 更新消息数量记录
    setLastMessageCount(currentMessageCount);
  }, [
    currentSession?.messages?.length,
    currentSession?.messages, // 监听消息内容变化（流式输出/错误消息）
    shouldAutoScroll,
    userHasScrolled,
    isStickToBottom,
    lastMessageCount,
    isStreaming, // 添加 isStreaming 依赖以监听流式状态变化
  ]);

  // 组件清理：清除滚动锁的 timeout 和保底定时器
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (fallbackScrollTimeoutRef.current) {
        clearTimeout(fallbackScrollTimeoutRef.current);
      }
    };
  }, []);

  // 监听会话切换，自动聚焦输入框
  useEffect(() => {
    // 当会话ID发生变化时，延迟聚焦输入框
    // 使用setTimeout确保新会话的DOM已完全渲染
    if (currentSessionId) {
      const focusTimer = setTimeout(() => {
        if (chatInputRef.current) {
          chatInputRef.current.focus();
        }
      }, 100); // 100ms延迟确保DOM渲染完成

      return () => clearTimeout(focusTimer);
    }
  }, [currentSessionId]);

  // 发送消息处理函数
  const handleSendMessage = async () => {
    const hasText = !!inputValue.trim();
    if ((!hasText && attachments.length === 0) || isAILoading || isUploading) return;

    const userContent = inputValue.trim();

    // 清空输入框
    setInputValue("");

    // 标记应该自动滚动（用户发送消息时）
    setShouldAutoScroll(true);
    // 重置用户滚动状态，启用吸附模式
    setUserHasScrolled(false);
    setIsStickToBottom(true);

    // 构造附件上下文提示
    const buildAttachmentsPrompt = (files: Attachment[]): string => {
      if (!files || files.length === 0) return "";
      const MAX_TOTAL = 50000; // 50k 字符
      const per = Math.max(1, Math.floor(MAX_TOTAL / files.length));
      const blocks = files.map((f) => {
        const text = f.text || "";
        const content = text.length > per ? text.slice(0, per) : text;
        return [
          `--- 文件: ${f.name} (type=${f.ext}, chars=${content.length}) START ---`,
          content,
          `--- 文件: ${f.name} END ---`,
        ].join("\n");
      });
      return [
        "以下为用户上传的文件内容（可能已截断），回答可引用并标注文件名：",
        ...blocks,
      ].join("\n\n");
    };

    const attachmentsPrompt = buildAttachmentsPrompt(attachments);
    const finalUserContent = attachments.length > 0
      ? `${attachmentsPrompt}\n\n我的问题：\n${userContent || "(基于以上文件，请给出总结/见解)"}`
      : userContent;
    const displayContent = userContent || (attachments.length > 0 ? "（已发送附件）" : "");

    try {
      const attachmentsMeta: AttachmentMeta[] = attachments.map((a) => ({
        id: a.id,
        name: a.name,
        size: a.size,
        mime: a.mime,
        ext: a.ext,
        snippet: a.snippet,
      }));
      // 用户点击发送后，立即清空输入面板中的待发送附件区
      setAttachments([]);
      setProgressMap({});

      await sendMessage(finalUserContent, attachmentsMeta, { displayContent });
    } catch (error) {
      console.error("发送消息失败:", error);
      message.error("发送消息失败，请稍后重试");
    }
  };

  // 处理Enter键发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 处理停止生成
  const handleStopGeneration = () => {
    if (currentSessionId) {
      stopGeneration(currentSessionId);
    }
  };

  // 处理文件选择/上传
  const handleAttachFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 3) {
      message.error("单次最多 3 个附件");
      return;
    }

    const v = validateLocalFiles(files);
    if (!v.ok) {
      message.error(v.message || "文件不合法");
      return;
    }

    // 先添加临时项以显示解析中
    const tempItems: Attachment[] = files.map((f) => {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      return {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        name: f.name,
        size: f.size,
        mime: f.type || "",
        ext,
        text: "",
        snippet: "",
      } as Attachment;
    });

    setAttachments((prev) => [...prev, ...tempItems]);
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = tempItems[i].id;
      try {
        const [res] = await uploadFiles([file], (_i, p) => {
          setProgressMap((pm) => ({ ...pm, [tempId]: p }));
        });
        setAttachments((prev) => prev.map((a) => (a.id === tempId ? res : a)));
      } catch (e: any) {
        message.error(e?.message || `${file.name} 上传失败`);
        setAttachments((prev) => prev.filter((a) => a.id !== tempId));
      }
    }

    setIsUploading(false);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setProgressMap((pm) => {
      const n = { ...pm } as any;
      delete n[id];
      return n;
    });
  };

  // 处理知识库
  const handleKnowledgeBase = () => {
    // TODO: 实现知识库功能
    message.info("知识库功能即将上线");
  };

  // 处理工作流
  const handleWorkflow = () => {
    // TODO: 实现工作流功能
    message.info("工作流功能即将上线");
  };

  // 获取当前会话的消息列表，如果没有消息则显示欢迎语
  const displayMessages = currentSession?.messages || [];
  const showWelcome = displayMessages.length === 0;

  // 判断当前会话是否正在生成
  const isCurrentSessionGenerating = currentSessionId
    ? isSessionGenerating(currentSessionId)
    : false;

  return (
    <MainLayout>
      {/* 拖拽覆盖层 */}
      <DropOverlay visible={isDragging} />
      {/* 主聊天区域 - 全宽滚动容器 + 视觉内容居中 80% */}
      <div className="h-full flex flex-col bg-panel transition-colors">
        {/* 消息滚动容器：全宽，允许在左右 10% 空白区域滚动 */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          onDragEnter={(e) => {
            e.preventDefault();
            // 仅处理文件拖拽
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
            dragCounterRef.current += 1;
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
            // 明确设置 dropEffect，提升一致性
            e.dataTransfer.dropEffect = "copy";
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
            // 只有当所有 dragenter 都离开后才隐藏覆盖层
            dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
            if (dragCounterRef.current === 0) {
              setIsDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
            dragCounterRef.current = 0;
            setIsDragging(false);
            if (files.length) handleAttachFiles(files as File[]);
          }}
          className="flex-1 overflow-y-auto"
        >
          {/* 视觉内容区：80% 宽度、居中 */}
          <div className="w-[80%] mx-auto p-4 space-y-4">
            {/* 欢迎消息 - 仅在没有消息时显示 */}
            {showWelcome && (
              <div className="w-full">
                <div className="text-foreground text-left break-words whitespace-pre-wrap">
                  {DEFAULT_WELCOME_MESSAGE}
                </div>
              </div>
            )}

            {/* 会话消息列表 */}
            {displayMessages.map((message) => (
              <div key={message.id} className="w-full">
                {message.role === "assistant" ? (
                  // AI消息 - 使用MarkdownRenderer渲染，支持流式渲染
                  <div className="text-foreground text-left break-words">
                    {message.isLoading ? (
                      <div className="flex items-start gap-2">
                        <LoadingOutlined className="text-blue-500 mt-1" />
                        <div className="flex-1">
                          {message.content ? (
                            // 流式渲染：显示已接收的内容 + 加载指示器
                            <div>
                              <MarkdownRenderer
                                content={message.content}
                                isStreaming={true}
                              />
                              <span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse"></span>
                            </div>
                          ) : (
                            // 初始加载状态
                            <span className="text-gray-500 dark:text-gray-400">
                              AI正在思考中...
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <MarkdownRenderer
                          content={message.content}
                          isStreaming={false}
                        />
                        {/* AI回复统计信息 */}
                        {message.stats && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-mono">
                            {message.stats.model} | {message.stats.responseTime} | {message.stats.totalTokens} tokens
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  // 用户消息 - 气泡样式，右对齐
                  <div className="flex justify-end">
                    <div className="max-w-[70%]">
                      <div className="bg-blue-500 text-white px-4 py-2 rounded-l-2xl rounded-tr-2xl rounded-br-sm break-words whitespace-pre-wrap">
                        {message.content}
                      </div>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.attachments.map((att) => (
                            <div key={att.id} className="p-2 rounded border border-surface bg-panel text-foreground">
                              <div className="text-xs text-gray-500">{att.name} · {att.ext.toUpperCase()} · {formatSize(att.size)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 用于自动滚动的空div */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区域：视觉内容宽度仍为 80%，居中 */}
        <div className="p-6">
          <div className="w-[80%] mx-auto">
            {/* 停止生成按钮 - 仅在AI正在生成时显示 */}
            {isCurrentSessionGenerating && (
              <div className="mb-4 flex justify-center">
                <StopGenerationButton
                  visible={isCurrentSessionGenerating}
                  onStop={handleStopGeneration}
                />
              </div>
            )}

            {/* 一体化聊天输入面板 */}
            <ChatInputPanel
              ref={chatInputRef}
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              onKeyDown={handleKeyPress}
              placeholder="输入您的消息..."
              loading={isAILoading}
              attachments={attachments.map((a) => ({ id: a.id, name: a.name, size: a.size, mime: a.mime, ext: a.ext, snippet: a.snippet }))}
              isUploading={isUploading}
              progressMap={progressMap}
              onAttachFiles={handleAttachFiles}
              onRemoveAttachment={handleRemoveAttachment}
              onKnowledgeBase={handleKnowledgeBase}
              onWorkflow={handleWorkflow}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;
