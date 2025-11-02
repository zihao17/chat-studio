import React, { useEffect, useRef, useState } from "react";
import {
  PlusOutlined,
  HistoryOutlined,
  BookOutlined,
  PartitionOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useChatContext } from "../../contexts/ChatContext";
import { useAuth } from "../../contexts/AuthContext";
import { Avatar } from "antd";
import {
  UserOutlined,
  SettingOutlined,
  SlidersOutlined,
} from "@ant-design/icons";
import ChatAdvancedSettingsModal from "../ui/ChatAdvancedSettingsModal";

// 定义按钮类型
type ButtonType = "new-chat" | "history" | "knowledge" | "workflow";

// 统一的按钮样式常量
const BUTTON_STYLES = {
  base: "w-full h-10 flex items-center rounded-xl border transition-all duration-200 cursor-pointer text-sm",
  active:
    "bg-[var(--accent-bg)] border-accent text-[var(--accent-text)] font-bold",
  inactive:
    "bg-[var(--surface)] border-surface text-foreground hover:bg-[var(--surface-hover)]",
  newChat:
    "bg-[var(--accent-bg)] border-accent font-bold hover:bg-[var(--accent-bg)] text-[var(--accent-text)]",
};

// 可复用的侧边栏按钮组件
interface SidebarButtonProps {
  type: ButtonType;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isNewChat?: boolean;
  onClick: () => void;
  showLabel: boolean;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({
  icon,
  label,
  isActive,
  isNewChat = false,
  onClick,
  showLabel,
}) => {
  const paddingAndAlign = showLabel ? "px-4" : "px-2 justify-center";
  const buttonClasses = `${BUTTON_STYLES.base} ${paddingAndAlign} ${
    isNewChat
      ? BUTTON_STYLES.newChat
      : isActive
      ? BUTTON_STYLES.active
      : BUTTON_STYLES.inactive
  }`;

  return (
    <button
      onClick={onClick}
      className={`${buttonClasses}`}
      title={label} // 添加 tooltip 提示
    >
      <span className={showLabel ? "mr-3" : ""}>{icon}</span>
      <span
        className={`${isActive || isNewChat ? "font-bold" : ""} ${
          showLabel ? "" : "hidden"
        }`}
      >
        {label}
      </span>
    </button>
  );
};

interface SidebarProps {
  /** 是否折叠侧边栏（仅显示图标） */
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
  // 使用实际宽度判断是否显示文字，避免使用固定延时
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpandedReady, setIsExpandedReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const LABEL_SHOW_WIDTH = 100; // 当宽度达到该值后再显示文字

    const updateReady = () => {
      const width = el.clientWidth;
      setIsExpandedReady(!collapsed && width >= LABEL_SHOW_WIDTH);
    };

    // 初次更新一次
    updateReady();

    // 优先使用 ResizeObserver 监听宽度变化
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        updateReady();
      });
      ro.observe(el);
      return () => ro.disconnect();
    }

    // 回退：监听 width 过渡结束
    const onTransitionEnd = (e: any) => {
      if (e?.propertyName === "width") {
        updateReady();
      }
    };
    el.addEventListener("transitionend", onTransitionEnd);
    return () => el.removeEventListener("transitionend", onTransitionEnd);
  }, [collapsed]);
  const [activeButton, setActiveButton] = useState<ButtonType>("new-chat");
  const {
    sessions,
    currentSessionId,
    handleNewChat,
    switchToSession,
    deleteSession,
  } = useChatContext();
  const { state: authState } = useAuth();
  const [advModalOpen, setAdvModalOpen] = useState(false);

  // 处理按钮点击
  const handleButtonClick = (buttonType: ButtonType) => {
    setActiveButton(buttonType);

    // 如果点击新对话按钮，执行智能新对话逻辑
    if (buttonType === "new-chat") {
      handleNewChat();
    }
  };

  // 处理对话项点击
  const handleConversationClick = (sessionId: string) => {
    switchToSession(sessionId);
  };

  // 处理删除会话
  const handleDeleteSession = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止事件冒泡
    deleteSession(sessionId);
  };

  // 按创建时间倒序排列会话
  const sortedSessions = [...sessions].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  // 渲染内容区域 - 根据当前激活的按钮显示不同内容
  const renderContentArea = () => {
    switch (activeButton) {
      case "new-chat":
      case "history":
        // 历史对话内容
        return (
          <div className="flex flex-col gap-y-1 pt-2">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleConversationClick(session.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-sans
                           hover:bg-[var(--surface-hover)] transition-colors duration-200
                           truncate cursor-pointer flex items-center justify-between group
                           ${
                             session.id === currentSessionId
                               ? "bg-[var(--accent-bg)] text-[var(--accent-text)] border border-accent"
                               : "text-foreground"
                           }`}
                title={session.title}
              >
                <span className="flex-1 truncate">{session.title}</span>
                {/* 删除按钮 */}
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 ml-2 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 
                            text-gray-400 hover:text-red-500 transition-all duration-200"
                  title="删除对话"
                >
                  <DeleteOutlined className="text-xs" />
                </button>
              </div>
            ))}

            {/* 空状态提示 */}
            {sortedSessions.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-4">
                暂无对话历史
              </div>
            )}
          </div>
        );

      case "knowledge":
        // 知识库占位内容
        return (
          <div className="flex flex-col items-center justify-center h-full text-center max-lg:hidden">
            <BookOutlined className="text-4xl text-gray-300 mb-4" />
            <div className="text-gray-500 text-sm">知识库开发中...</div>
            <div className="text-gray-400 text-xs mt-2">敬请期待更多功能</div>
          </div>
        );

      case "workflow":
        // 工作流占位内容
        return (
          <div className="flex flex-col items-center justify-center h-full text-center max-lg:hidden">
            <PartitionOutlined className="text-4xl text-gray-300 mb-4" />
            <div className="text-gray-500 text-sm">工作流开发中...</div>
            <div className="text-gray-400 text-xs mt-2">敬请期待更多功能</div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${
        collapsed ? "w-16 p-2 items-center" : "w-64 p-4"
      } h-screen bg-panel flex flex-col border-r border-surface transition-all duration-300 ease-in-out overflow-hidden`}
    >
      {/* 1. 顶部品牌区 */}
      <div
        className={`flex items-center ${
          collapsed ? "justify-center mb-4" : "justify-between mb-6"
        }`}
      >
        {collapsed || !isExpandedReady ? (
          <h1 className="text-xl font-black text-foreground font-sans tracking-tight text-center whitespace-nowrap">
            Chat
          </h1>
        ) : (
          <h1 className="text-2xl font-black text-[var(--accent-text)] font-sans tracking-tight whitespace-nowrap">
            Chat Studio
          </h1>
        )}
      </div>

      {/* 2. 功能操作区 */}
      <div
        className={`mb-8 flex flex-col gap-y-1 w-full ${
          collapsed ? "mb-6" : ""
        }`}
      >
        {/* 新对话按钮 */}
        <SidebarButton
          type="new-chat"
          icon={<PlusOutlined />}
          label="新对话"
          isActive={activeButton === "new-chat"}
          isNewChat={true}
          onClick={() => handleButtonClick("new-chat")}
          showLabel={isExpandedReady}
        />

        {/* 历史对话按钮 */}
        <SidebarButton
          type="history"
          icon={<HistoryOutlined />}
          label="历史对话"
          isActive={activeButton === "history"}
          onClick={() => handleButtonClick("history")}
          showLabel={isExpandedReady}
        />

        {/* 知识库按钮 */}
        <SidebarButton
          type="knowledge"
          icon={<BookOutlined />}
          label="知识库"
          isActive={activeButton === "knowledge"}
          onClick={() => handleButtonClick("knowledge")}
          showLabel={isExpandedReady}
        />

        {/* 工作流按钮 */}
        <SidebarButton
          type="workflow"
          icon={<PartitionOutlined />}
          label="工作流"
          isActive={activeButton === "workflow"}
          onClick={() => handleButtonClick("workflow")}
          showLabel={isExpandedReady}
        />
      </div>

      {/* 4. 内容显示区 - 根据当前激活的按钮显示不同内容（折叠时保留不可见占位） */}
      {collapsed || !isExpandedReady ? (
        <div className="flex-1 w-full invisible" />
      ) : (
        <div className="flex-1 overflow-y-auto border-t border-surface w-full">
          {renderContentArea()}
        </div>
      )}

      {/* 5. 底部用户信息 + 悬停抽屉菜单 */}
      <div
        className={`mt-4 pt-4 border-t border-surface w-full ${
          collapsed ? "pt-2" : ""
        }`}
      >
        <div className="relative group">
          {/* 用户信息行（与 Header 风格一致） */}
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
              collapsed ? "justify-center" : ""
            } hover:bg-[var(--surface-hover)] cursor-pointer`}
            title={
              authState.isAuthenticated && authState.user
                ? authState.user.username
                : "游客"
            }
          >
            <Avatar size={32} icon={<UserOutlined />} className="bg-blue-500" />
            <span
              className={`${
                collapsed || !isExpandedReady ? "hidden" : "block"
              } text-foreground font-medium`}
            >
              {authState.isAuthenticated && authState.user
                ? authState.user.username
                : "游客"}
            </span>
          </div>

          {/* 悬停抽屉菜单：自底向上展开 */}
          <div
            className={`absolute left-0 right-0 bottom-12 overflow-hidden px-1 ${
              collapsed ? "hidden" : ""
            }`}
          >
            <div className="max-h-0 opacity-0 translate-y-2 transition-all duration-200 ease-out delay-150 group-hover:delay-0 group-hover:max-h-28 group-hover:opacity-100 group-hover:translate-y-0">
              <div className="bg-panel border border-surface rounded-lg shadow-sm py-1">
                {/* 设置 - 占位 */}
                <div
                  className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:bg-[var(--surface-hover)] dark:text-gray-500 cursor-not-allowed"
                  title="设置（即将推出）"
                >
                  <SettingOutlined />
                  <span className="text-sm">设置</span>
                </div>
                {/* 聊天高级设置 */}
                <button
                  onClick={() => setAdvModalOpen(true)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-[var(--surface-hover)] dark:text-gray-200 cursor-pointer"
                >
                  <SlidersOutlined />
                  <span className="text-sm">聊天高级设置</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 高级设置模态 */}
      <ChatAdvancedSettingsModal
        open={advModalOpen}
        onClose={() => setAdvModalOpen(false)}
      />
    </div>
  );
};

export default Sidebar;
