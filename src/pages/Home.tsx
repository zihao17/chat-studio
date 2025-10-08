import React from 'react'
import MainLayout from '../components/layout/MainLayout'

/**
 * 主页组件
 * Chat Studio 的主要界面
 */
const Home: React.FC = () => {
  return (
    <MainLayout>
      {/* 主聊天区域 */}
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            欢迎使用 Chat Studio
          </h2>
          <p className="text-gray-600">
            AI 对话 + 知识库平台
          </p>
          <p className="text-sm text-gray-500 mt-2">
            点击左侧"新对话"开始您的 AI 对话之旅
          </p>
        </div>
      </div>
    </MainLayout>
  )
}

export default Home