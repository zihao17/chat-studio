import React, { useState, useEffect, useRef } from "react";
import { Input, Button, message } from "antd";
import { SendOutlined, LoadingOutlined } from "@ant-design/icons";
import MainLayout from "../components/layout/MainLayout";
import { useChatContext } from "../contexts/ChatContext";
import { DEFAULT_WELCOME_MESSAGE } from "../types/chat";

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
    isAILoading, 
    sendMessage 
  } = useChatContext();

  // 获取距离底部的像素距离
  const getDistanceFromBottom = () => {
    if (!messagesContainerRef.current) return 0;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
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

  // 智能滚动逻辑 - 支持吸附模式和流式输出跟随
  useEffect(() => {
    const currentMessageCount = currentSession?.messages?.length || 0;
    
    // 检测是否有新消息（消息数量增加）
    const hasNewMessage = currentMessageCount > lastMessageCount;
    
    // 检测是否有消息内容更新（AI流式输出）
    const hasContentUpdate = currentSession?.messages?.some(msg => 
      msg.role === "assistant" && msg.isLoading
    );
    
    if (hasNewMessage || hasContentUpdate) {
      // 决定是否自动滚动的条件：
      // 1. 用户刚发送消息 (shouldAutoScroll)
      // 2. 用户处于吸附模式 (isStickToBottom)
      // 3. 用户未手动滚动且接近底部 (!userHasScrolled && isNearBottom())
      const shouldScroll = shouldAutoScroll || 
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
    currentSession?.messages, // 监听消息内容变化（流式输出）
    shouldAutoScroll, 
    userHasScrolled, 
    isStickToBottom,
    lastMessageCount
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

  // 获取当前会话的消息列表，如果没有消息则显示欢迎语
  const displayMessages = currentSession?.messages || [];
  const showWelcome = displayMessages.length === 0;

  return (
    <MainLayout>
      {/* 主聊天区域 - 使用中间80%宽度 */}
      <div className="h-full flex justify-center bg-white">
        <div className="w-[80%] h-full flex flex-col">
          {/* 消息显示区域 */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
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
                  // AI消息 - 纯文本样式，左对齐，支持流式渲染
                  <div className="text-gray-800 text-left break-words whitespace-pre-wrap">
                    {message.isLoading ? (
                      <div className="flex items-start gap-2">
                        <LoadingOutlined className="text-blue-500 mt-1" />
                        <div>
                          {message.content ? (
                            // 流式渲染：显示已接收的内容 + 加载指示器
                            <div>
                              <span>{message.content}</span>
                              <span className="inline-block w-2 h-5 bg-blue-500 ml-1 animate-pulse"></span>
                            </div>
                          ) : (
                            // 初始加载状态
                            <span className="text-gray-500">AI正在思考中...</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      message.content
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

          {/* 输入区域 - 移除灰色分割线 */}
          <div className="p-4">
            <div className="flex gap-2">
              <Input.TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="输入您的消息..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                className="flex-1"
              />
              <Button
                type="primary"
                icon={isAILoading ? <LoadingOutlined /> : <SendOutlined />}
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isAILoading}
                loading={isAILoading}
                className="self-end"
              >
                {isAILoading ? "发送中" : "发送"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;
