import React, { useState, useEffect, useRef } from "react";
import { Input, Button, message } from "antd";
import { SendOutlined, LoadingOutlined } from "@ant-design/icons";
import MainLayout from "../components/layout/MainLayout";
import { callAIChat, type ChatMessage } from "../utils/aiApi";

// 消息类型定义
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isLoading?: boolean;
}

/**
 * 主页组件
 * Chat Studio 的主要界面
 */
const Home: React.FC = () => {
  // 消息列表状态管理
  const [messages, setMessages] = useState<Message[]>([]);
  // 用户输入内容
  const [inputValue, setInputValue] = useState("");
  // AI回复加载状态
  const [isAILoading, setIsAILoading] = useState(false);
  // 消息容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 组件挂载时添加AI初始消息
  useEffect(() => {
    const initialMessage: Message = {
      id: "initial-" + Date.now(),
      role: "assistant",
      content: "你好！",
      timestamp: Date.now(),
    };
    setMessages([initialMessage]);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送消息处理函数
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isAILoading) return;

    const userContent = inputValue.trim();

    // 创建用户消息
    const userMessage: Message = {
      id: "user-" + Date.now(),
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    };

    // 添加用户消息到列表
    setMessages((prev) => [...prev, userMessage]);

    // 清空输入框
    setInputValue("");

    // 设置AI加载状态
    setIsAILoading(true);

    try {
      // 准备发送给AI的消息历史（只包含用户消息，不包括系统初始消息）
      const chatHistory: ChatMessage[] = messages
        .filter((msg) => msg.role !== "assistant" || msg.content !== "你好！") // 过滤掉初始欢迎消息
        .map((msg) => ({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        }));

      // 添加当前用户消息
      chatHistory.push({
        role: "user",
        content: userContent,
      });

      // 调用AI接口
      const aiResponse = await callAIChat(chatHistory);

      if (aiResponse.error) {
        // 显示错误消息
        message.error(aiResponse.error);

        // 添加错误提示消息
        const errorMessage: Message = {
          id: "error-" + Date.now(),
          role: "assistant",
          content: aiResponse.error,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        // 添加AI回复消息
        const aiMessage: Message = {
          id: "ai-" + Date.now(),
          role: "assistant",
          content: aiResponse.content || "抱歉，我没有收到有效的回复。",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error("发送消息失败:", error);
      message.error("发送消息失败，请稍后重试");

      // 添加错误提示消息
      const errorMessage: Message = {
        id: "error-" + Date.now(),
        role: "assistant",
        content: "抱歉，发送消息失败，请稍后重试。",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      // 清除加载状态
      setIsAILoading(false);
    }
  };

  // 处理Enter键发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <MainLayout>
      {/* 主聊天区域 - 使用中间80%宽度 */}
      <div className="h-full flex justify-center bg-white">
        <div className="w-[80%] h-full flex flex-col">
          {/* 消息显示区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="w-full">
                {message.role === "assistant" ? (
                  // AI消息 - 纯文本样式，左对齐
                  // break-words: 长单词会被截断并换行；whitespace-pre-wrap: 保留空格和换行符
                  <div className="text-gray-800 text-left break-words whitespace-pre-wrap">
                    {message.content}
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

            {/* AI加载状态显示 */}
            {isAILoading && (
              <div className="w-full">
                <div className="text-gray-800 text-left flex items-center gap-2">
                  <LoadingOutlined className="text-blue-500" />
                  <span className="text-gray-500">AI正在思考中...</span>
                </div>
              </div>
            )}

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
