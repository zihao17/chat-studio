import React, { useState } from "react";
import {
  PlusOutlined,
  HistoryOutlined,
  BookOutlined,
  PartitionOutlined,
  MenuFoldOutlined,
} from "@ant-design/icons";

// 定义按钮类型
type ButtonType = "new-chat" | "history" | "knowledge" | "workflow";

// 模拟对话数据
const mockConversations = [
  "AI知识工作流平台设计方案",
  "Vue到React重构指南",
  "前端性能优化最佳实践",
  "TypeScript高级类型应用",
  "ai是一道光，如此美妙，直到我们想要的未来，侧边栏233",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
];

// 统一的按钮样式常量
const BUTTON_STYLES = {
  base: "w-full h-10 flex items-center px-4 rounded-xl border transition-all duration-200 cursor-pointer text-sm",
  active: "bg-white border-blue-200 text-blue-600 font-bold",
  inactive: "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200",
  newChat: "bg-blue-50 border-blue-200 font-bold hover:bg-blue-100 hover:border-blue-300",
};

// 可复用的侧边栏按钮组件
interface SidebarButtonProps {
  type: ButtonType;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isNewChat?: boolean;
  onClick: () => void;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({
  icon,
  label,
  isActive,
  isNewChat = false,
  onClick,
}) => {
  const buttonClasses = `${BUTTON_STYLES.base} ${
    isNewChat
      ? BUTTON_STYLES.newChat
      : isActive
      ? BUTTON_STYLES.active
      : BUTTON_STYLES.inactive
  } max-lg:justify-center max-lg:px-2`;

  const iconColor = isNewChat ? "rgb(0, 87, 255)" : undefined;

  return (
    <button
      onClick={onClick}
      className={buttonClasses}
      style={isNewChat ? { color: "rgb(0, 87, 255)" } : {}}
      title={label} // 添加 tooltip 提示
    >
      <span className="max-lg:mr-0 mr-3" style={iconColor ? { color: iconColor } : {}}>
        {icon}
      </span>
      <span className={`${isActive || isNewChat ? "font-bold" : ""} max-lg:hidden`}>
        {label}
      </span>
    </button>
  );
};

const Sidebar: React.FC = () => {
  const [activeButton, setActiveButton] = useState<ButtonType>("new-chat");

  // 处理按钮点击
  const handleButtonClick = (buttonType: ButtonType) => {
    setActiveButton(buttonType);
  };

  // 处理对话项点击
  const handleConversationClick = (conversation: string) => {
    console.log("打开对话:", conversation);
  };

  return (
    <div className="w-64 h-screen bg-gray-50 p-4 flex flex-col border-r border-gray-200
                    max-lg:w-20 max-lg:p-3 max-lg:items-center
                    max-md:w-16 max-md:p-2">
      {/* 1. 顶部品牌区 */}
      <div className="flex items-center justify-between mb-6
                      max-lg:justify-center max-lg:mb-4
                      max-md:mb-3">
        <h1 className="text-2xl font-black text-blue-600 font-sans tracking-tight
                       max-lg:hidden">
          Chat Studio
        </h1>
        <h1 className="text-xl font-black text-blue-600 font-sans tracking-tight hidden
                       max-lg:block max-lg:text-center">
          CS
        </h1>
        <button className="text-black hover:text-gray-600 transition-colors
                           max-lg:hidden">
          <MenuFoldOutlined className="text-lg" />
        </button>
      </div>

      {/* 2. 功能操作区 */}
      <div className="mb-8 flex flex-col gap-y-1 w-full
                      max-lg:mb-6 max-lg:gap-y-2
                      max-md:mb-4">
        {/* 新对话按钮 */}
        <SidebarButton
          type="new-chat"
          icon={<PlusOutlined />}
          label="新对话"
          isActive={activeButton === "new-chat"}
          isNewChat={true}
          onClick={() => handleButtonClick("new-chat")}
        />

        {/* 历史对话按钮 */}
        <SidebarButton
          type="history"
          icon={<HistoryOutlined />}
          label="历史对话"
          isActive={activeButton === "history"}
          onClick={() => handleButtonClick("history")}
        />

        {/* 知识库按钮 */}
        <SidebarButton
          type="knowledge"
          icon={<BookOutlined />}
          label="知识库"
          isActive={activeButton === "knowledge"}
          onClick={() => handleButtonClick("knowledge")}
        />

        {/* 工作流按钮 */}
        <SidebarButton
          type="workflow"
          icon={<PartitionOutlined />}
          label="工作流"
          isActive={activeButton === "workflow"}
          onClick={() => handleButtonClick("workflow")}
        />
      </div>

      {/* 4. 对话列表区 */}
      <div className="flex-1 overflow-y-auto border-t border-gray-200 w-full
                      max-lg:border-0 max-lg:flex-none max-lg:mb-4
                      max-md:mb-2">
        <div className="flex flex-col gap-y-1
                        max-lg:hidden">
          {mockConversations.map((conversation, index) => (
            <div
              key={index}
              onClick={() => handleConversationClick(conversation)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-black font-sans
                         hover:bg-gray-200 transition-colors duration-200
                         truncate cursor-pointer"
              title={conversation}
            >
              {conversation}
            </div>
          ))}
        </div>
      </div>

      {/* 5. 底部个人信息区 */}
      <div className="mt-4 pt-4 border-t border-gray-200 w-full
                      max-lg:pt-2 max-lg:border-0
                      max-md:pt-1">
        <div className="flex items-center
                        max-lg:justify-center">
          {/* 圆形头像 */}
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center
                          max-lg:mr-0 max-lg:w-6 max-lg:h-6
                          max-md:w-5 max-md:h-5">
            <span className="text-black font-bold text-sm
                             max-md:text-xs">用</span>
          </div>
          {/* 用户名 */}
          <span className="text-black font-bold text-sm font-sans
                           max-lg:hidden">
            用户名
          </span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
