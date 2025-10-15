import React from "react";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";

interface HeaderProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

/**
 * 头部组件
 * 左侧为侧边栏折叠/展开按钮，右侧显示虚拟时间
 */
const Header: React.FC<HeaderProps> = ({ collapsed, onToggleSidebar }) => {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* 折叠/展开按钮 */}
        <button
          onClick={onToggleSidebar}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          className="flex items-center justify-center h-9 w-9 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
        >
          {collapsed ? (
            <MenuUnfoldOutlined className="text-lg" />
          ) : (
            <MenuFoldOutlined className="text-lg" />
          )}
        </button>

        {/* 右侧时间显示 */}
        <div className="text-gray-600 text-sm font-medium ml-auto">
          2025.10.8 | pzh
        </div>
      </div>
    </header>
  );
};

export default Header;
