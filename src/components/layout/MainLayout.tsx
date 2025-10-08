import React from 'react'
import Sidebar from './Sidebar'

interface MainLayoutProps {
  children: React.ReactNode
}

/**
 * 主布局组件
 * 包含侧边栏和主内容区域
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <Sidebar />
      
      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export default MainLayout