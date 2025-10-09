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
  
  // 从Context获取会话状态和方法
  const { 
    currentSession, 
    isAILoading, 
    sendMessage 
  } = useChatContext();

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  // 发送消息处理函数
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isAILoading) return;

    const userContent = inputValue.trim();
    
    // 清空输入框
    setInputValue("");

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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  // AI消息 - 纯文本样式，左对齐
                  <div className="text-gray-800 text-left break-words whitespace-pre-wrap">
                    {message.isLoading ? (
                      <div className="flex items-center gap-2">
                        <LoadingOutlined className="text-blue-500" />
                        <span className="text-gray-500">AI正在思考中...</span>
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
