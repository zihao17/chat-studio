import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "antd";
import {
  SendOutlined,
  LoadingOutlined,
  PaperClipOutlined,
  BookOutlined,
  BranchesOutlined,
} from "@ant-design/icons";

// 定义暴露给父组件的方法接口
export interface ChatInputPanelRef {
  focus: () => void;
}

interface ChatInputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  onFileUpload?: () => void;
  onKnowledgeBase?: () => void;
  onWorkflow?: () => void;
}

const ChatInputPanel = forwardRef<ChatInputPanelRef, ChatInputPanelProps>(({
  value,
  onChange,
  onSend,
  onKeyDown,
  placeholder = "输入您的消息...",
  disabled = false,
  loading = false,
  onFileUpload,
  onKnowledgeBase,
  onWorkflow,
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 暴露聚焦方法给父组件
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }), []);

  // 自动调整textarea高度，支持过渡动画
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // 保存当前高度
      const currentHeight = textarea.style.height;

      // 临时移除过渡效果以获取准确的scrollHeight
      textarea.style.transition = "none";
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 192; // 最大高度192px（8行）
      const newHeight = Math.min(scrollHeight, maxHeight);

      // 设置回当前高度（如果有的话）
      if (currentHeight) {
        textarea.style.height = currentHeight;
      }

      // 使用setTimeout确保DOM更新完成后再应用过渡
      setTimeout(() => {
        textarea.style.transition = "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        textarea.style.height = `${newHeight}px`;
      }, 0);
    }
  };

  // 组件挂载时初始化textarea高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // 初始化时不需要过渡动画
      textarea.style.transition = "none";
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120;
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;

      // 设置过渡动画，为后续变化做准备
      requestAnimationFrame(() => {
        textarea.style.transition = "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      });
    }
  }, []);

  // 当输入内容变化时调整高度
  useEffect(() => {
    adjustTextareaHeight();
  }, [value]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 如果正在加载中，阻止Enter键发送
    if (loading && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      return;
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <div
      className={`
        relative bg-panel rounded-xl border transition-all duration-200 shadow-sm
        ${
          isFocused
            ? "border-[var(--focus-border)] shadow-md"
            : "border-surface hover:border-surface"
        }
      `}
    >
      {/* 文本输入区域 */}
      <div className="px-4 pt-4 pb-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="
            w-full resize-none border-none outline-none bg-transparent
            text-base leading-6 placeholder-gray-400 dark:placeholder-gray-500
            min-h-[24px]
          "
          style={{
            fontSize: "16px",
            lineHeight: "1.5",
            fontFamily: "inherit",
            transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>

      {/* 底部操作按钮栏 */}
      <div className="flex items-center justify-between px-4 pb-3 h-10">
        {/* 左侧工具按钮 */}
        <div className="flex items-center gap-2">
          <Button
            type="text"
            size="small"
            icon={<PaperClipOutlined />}
            onClick={onFileUpload}
            className="
              flex items-center justify-center w-8 h-8 rounded-lg
              text-gray-500 hover:text-blue-500 hover:bg-[var(--surface-hover)]
              dark:text-gray-300
              transition-all duration-200
            "
            title="上传文件"
          />
          <Button
            type="text"
            size="small"
            icon={<BookOutlined />}
            onClick={onKnowledgeBase}
            className="
              flex items-center justify-center w-8 h-8 rounded-lg
              text-gray-500 hover:text-blue-500 hover:bg-[var(--surface-hover)]
              dark:text-gray-300
              transition-all duration-200
            "
            title="知识库"
          />
          <Button
            type="text"
            size="small"
            icon={<BranchesOutlined />}
            onClick={onWorkflow}
            className="
              flex items-center justify-center w-8 h-8 rounded-lg
              text-gray-500 hover:text-blue-500 hover:bg-[var(--surface-hover)]
              dark:text-gray-300
              transition-all duration-200
            "
            title="工作流"
          />
        </div>

        {/* 右侧发送按钮 */}
        <Button
          type="primary"
          size="small"
          icon={loading ? <LoadingOutlined /> : <SendOutlined />}
          onClick={onSend}
          disabled={disabled || !value.trim() || loading}
          loading={loading}
          className="
            flex items-center justify-center h-8 px-4 rounded-lg
            bg-blue-500 hover:bg-blue-600 border-blue-500 hover:border-blue-600
            disabled:bg-gray-300 disabled:border-surface
            transition-all duration-200
          "
        >
          {loading ? "发送中" : "发送"}
        </Button>
      </div>
    </div>
  );
});

// 设置displayName以便调试
ChatInputPanel.displayName = 'ChatInputPanel';

export default ChatInputPanel;
