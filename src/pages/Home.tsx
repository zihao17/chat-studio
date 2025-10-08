import React, { useState, useEffect, useRef } from 'react'
import { Input, Button } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import MainLayout from '../components/layout/MainLayout'

// 消息类型定义
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/**
 * 主页组件
 * Chat Studio 的主要界面
 */
const Home: React.FC = () => {
  // 消息列表状态管理
  const [messages, setMessages] = useState<Message[]>([])
  // 用户输入内容
  const [inputValue, setInputValue] = useState('')
  // 消息容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 组件挂载时添加AI初始消息
  useEffect(() => {
    const initialMessage: Message = {
      id: 'initial-' + Date.now(),
      role: 'assistant',
      content: '你好！',
      timestamp: Date.now()
    }
    setMessages([initialMessage])
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息处理函数
  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    // 创建用户消息
    const userMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    }

    // 添加用户消息到列表
    setMessages(prev => [...prev, userMessage])

    // 清空输入框
    setInputValue('')

    // 模拟AI回复（延迟500ms）
    setTimeout(() => {
      const aiMessage: Message = {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        content: 'thank you！',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, aiMessage])
    }, 500)
  }

  // 处理Enter键发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <MainLayout>
      {/* 主聊天区域 - 使用中间80%宽度 */}
      <div className="h-full flex justify-center bg-white">
        <div className="w-[80%] h-full flex flex-col">
          {/* 消息显示区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="w-full">
                {message.role === 'assistant' ? (
                  // AI消息 - 纯文本样式，左对齐
                  <div className="text-gray-800 text-left">
                    {message.content}
                  </div>
                ) : (
                  // 用户消息 - 气泡样式，右对齐
                  <div className="flex justify-end">
                    <div className="max-w-[70%] bg-blue-500 text-white px-4 py-2 rounded-l-2xl rounded-tr-2xl rounded-br-sm">
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
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                className="self-end"
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

export default Home