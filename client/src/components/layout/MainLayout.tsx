import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * 主布局组件
 * 包含侧边栏和主内容区域
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // 侧边栏折叠状态：默认在较小屏幕（<=1024px）折叠
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    // 根据屏幕宽度动态设置初始折叠状态，并在尺寸变化时更新
    const mq = window.matchMedia("(max-width: 1024px)");
    const apply = (matches: boolean) => setIsSidebarCollapsed(matches);
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <Sidebar collapsed={isSidebarCollapsed} />

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
        {/* 头部 */}
        <Header
          collapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        {/* 聊天内容区域 */}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
};

export default MainLayout;
