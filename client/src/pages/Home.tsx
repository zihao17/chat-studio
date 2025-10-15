import React, { useState, useEffect, useRef } from "react";
import { message } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import MainLayout from "../components/layout/MainLayout";
import { useChatContext } from "../contexts/ChatContext";
import { DEFAULT_WELCOME_MESSAGE } from "../types/chat";
import StopGenerationButton from "../components/ui/StopGenerationButton";
import MarkdownRenderer from "../components/ui/MarkdownRenderer";
import ChatInputPanel from "../components/ui/ChatInputPanel";

/**
 * 主页组件
 * Chat Studio 的主要界面
 */
const Home: React.FC = () => {
  // 用户输入内容
  const [inputValue, setInputValue] = useState("");
  // 消息容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 消息容器的滚动容器引用
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // 用户是否手动滚动的状态
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  // 上次消息数量，用于检测新消息
  const [lastMessageCount, setLastMessageCount] = useState(0);
  // 是否应该自动滚动（仅在用户发送消息时为true）
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  // 智能吸附状态：用户是否希望跟随最新消息
  const [isStickToBottom, setIsStickToBottom] = useState(true);

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
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight;
  };

  // 检查是否接近底部（≤100px为吸附区域）
  const isNearBottom = () => {
    return getDistanceFromBottom() <= 100;
  };

  // 滚动到底部的函数
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 处理用户滚动事件 - 智能吸附逻辑
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const distanceFromBottom = getDistanceFromBottom();

    // 智能吸附逻辑
    if (distanceFromBottom <= 100) {
      // 用户滚动到接近底部（≤100px），启用吸附模式
      setIsStickToBottom(true);
      setUserHasScrolled(false);
    } else if (distanceFromBottom > 150) {
      // 用户向上滚动超过150px，取消吸附模式
      setIsStickToBottom(false);
      setUserHasScrolled(true);
    }
    // 在100px-150px之间保持当前状态，避免频繁切换
  };

  // 智能滚动逻辑 - 支持吸附模式、流式输出跟随，并在错误消息出现时强制滚动到底部
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
        // 对于流式输出，使用更短的延迟以保持跟随效果
        const delay = hasContentUpdate && !hasNewMessage ? 10 : 50;

        const timeoutId = setTimeout(() => {
          scrollToBottom();
          // 仅在用户发送消息后重置标志
          if (shouldAutoScroll) {
            setShouldAutoScroll(false);
          }
        }, delay);

        return () => clearTimeout(timeoutId);
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
  ]);

  // 发送消息处理函数
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isAILoading) return;

    const userContent = inputValue.trim();

    // 清空输入框
    setInputValue("");

    // 标记应该自动滚动（用户发送消息时）
    setShouldAutoScroll(true);
    // 重置用户滚动状态，启用吸附模式
    setUserHasScrolled(false);
    setIsStickToBottom(true);

    try {
      // 使用Context中的sendMessage方法
      await sendMessage(userContent);
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

  // 处理文件上传
  const handleFileUpload = () => {
    // TODO: 实现文件上传功能
    message.info("文件上传功能即将上线");
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
      {/* 主聊天区域 - 全宽滚动容器 + 视觉内容居中 80% */}
      <div className="h-full flex flex-col bg-white">
        {/* 消息滚动容器：全宽，允许在左右 10% 空白区域滚动 */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {/* 视觉内容区：80% 宽度、居中 */}
          <div className="w-[80%] mx-auto p-4 space-y-4">
            {/* 欢迎消息 - 仅在没有消息时显示 */}
            {showWelcome && (
              <div className="w-full">
                <div className="text-gray-800 text-left break-words whitespace-pre-wrap">
                  {DEFAULT_WELCOME_MESSAGE}
                </div>
              </div>
            )}

            {/* 会话消息列表 */}
            {displayMessages.map((message) => (
              <div key={message.id} className="w-full">
                {message.role === "assistant" ? (
                  // AI消息 - 使用MarkdownRenderer渲染，支持流式渲染
                  <div className="text-gray-800 text-left break-words">
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
                            <span className="text-gray-500">
                              AI正在思考中...
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <MarkdownRenderer
                        content={message.content}
                        isStreaming={false}
                      />
                    )}
                  </div>
                ) : (
                  // 用户消息 - 气泡样式，右对齐
                  <div className="flex justify-end">
                    <div className="max-w-[70%] bg-blue-500 text-white px-4 py-2 rounded-l-2xl rounded-tr-2xl rounded-br-sm break-words whitespace-pre-wrap">
                      {message.content}
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
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              onKeyDown={handleKeyPress}
              placeholder="输入您的消息..."
              loading={isAILoading}
              onFileUpload={handleFileUpload}
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
