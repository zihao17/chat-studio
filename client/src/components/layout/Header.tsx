import React from "react";

/**
 * 头部组件
 * 显示虚拟时间，文字居右对齐
 */
const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex justify-end">
        <div className="text-gray-600 text-sm font-medium">2025.10.8 | pzh</div>
      </div>
    </header>
  );
};

export default Header;
