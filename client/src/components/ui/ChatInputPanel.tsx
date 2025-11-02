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

import type { AttachmentMeta } from "../../types/chat";

interface ChatInputPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  // 旧接口（回退）：点击回形针时触发
  onFileUpload?: () => void;
  // 新增：附件相关
  attachments?: AttachmentMeta[];
  isUploading?: boolean;
  progressMap?: Record<string, number>;
  onAttachFiles?: (files: File[]) => void;
  onRemoveAttachment?: (id: string) => void;
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
  attachments = [],
  isUploading = false,
  progressMap = {},
  onAttachFiles,
  onRemoveAttachment,
  onKnowledgeBase,
  onWorkflow,
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
      return;
    }
    if (onFileUpload) onFileUpload();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length && onAttachFiles) {
      onAttachFiles(files);
    }
  };

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
      {/* 附件区域 */}
      {attachments && attachments.length > 0 && (
        <div className="px-4 pt-4">
          <div className="flex flex-col gap-2">
            {attachments.map((f) => (
              <div key={f.id} className="w-full">
                {/* 内联简版附件卡片，展示snippet */}
                <div className="p-3 rounded-lg bg-[var(--surface-hover)] border border-surface">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-foreground">
                      <span className="font-medium mr-2">{f.name}</span>
                      <span className="text-gray-400 mr-2">{f.ext.toUpperCase()}</span>
                      {isUploading ? (
                        <span className="text-blue-500">{typeof (progressMap?.[f.id]) === 'number' ? `${progressMap[f.id]}%` : '解析中'}</span>
                      ) : null}
                    </div>
                    {onRemoveAttachment && (
                      <button
                        className="text-gray-400 hover:text-red-500 transition"
                        onClick={() => onRemoveAttachment(f.id)}
                        title="移除附件"
                      >
                        移除
                      </button>
                    )}
                  </div>
                  {f.snippet && (
                    <div className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">
                      {f.snippet.length > 200 ? `${f.snippet.slice(0,200)}...` : f.snippet}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        {/* 隐藏文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileInputChange}
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
            onClick={handleFileButtonClick}
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
          disabled={
            disabled ||
            loading ||
            isUploading ||
            (!value.trim() && (!attachments || attachments.length === 0))
          }
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
