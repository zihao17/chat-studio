import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "antd";
import {
  SendOutlined,
  LoadingOutlined,
  PaperClipOutlined,
  BookOutlined,
  BranchesOutlined,
  CloseOutlined,
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
      {/* 附件区域（横向卡片，无预览） */}
      {attachments && attachments.length > 0 && (
        <div className="px-4 pt-4">
          <div className="flex flex-nowrap items-stretch gap-3 overflow-x-auto">
            {attachments.map((f) => {
              const formatBytes = (bytes: number) => {
                if (bytes < 1024) return `${bytes}B`;
                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
                return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
              };
              const extLower = (f.ext || '').toLowerCase();
              const displayType = extLower === 'docx' ? 'word' : 'txt';
              const charCount = typeof f.charCount === 'number' ? f.charCount : undefined;
              const displayChars = (() => {
                if (charCount === undefined) return '';
                if (charCount < 10000) return `${charCount}字`;
                const w = (charCount / 10000);
                // 保留一位小数，去尾
                return `约 ${Math.floor(w * 10) / 10} 万字`;
              })();
              const infoLine = [displayType, formatBytes(f.size), displayChars].filter(Boolean).join(' · ');
              const progress = typeof (progressMap?.[f.id]) === 'number' ? progressMap[f.id] : undefined;
              const iconSrc = (() => {
                if (extLower === 'docx') return '/icons/word-icon.svg';
                // md 也归为 txt 风格
                if (extLower === 'txt' || extLower === 'md') return '/icons/txt-icon.svg';
                return '/icons/txt-icon.svg';
              })();

              return (
                <div
                  key={f.id}
                  className="group relative min-w-[220px] max-w-[280px] p-3 rounded-lg border border-surface bg-attachment flex items-start gap-3 transition-colors"
                >
                  {/* 左侧文件类型图标 */}
                  <img src={iconSrc} alt={displayType} className="w-8 h-8 mt-0 select-none" />

                  {/* 右侧文字区域 */}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-attachment text-sm font-normal">
                      {f.name}
                    </div>
                    <div className="mt-1 text-[12px] text-attachment-meta">
                      {infoLine}
                      {isUploading && progress !== undefined && (
                        <span className="ml-2 text-attachment-progress">{progress}%</span>
                      )}
                    </div>
                  </div>

                  {/* 右上角 hover 显示的关闭按钮 */}
                  {onRemoveAttachment && (
                    <button
                      aria-label="移除附件"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 w-5 h-5 flex items-center justify-center rounded"
                      onClick={() => onRemoveAttachment(f.id)}
                      title="移除"
                    >
                      <CloseOutlined style={{ fontSize: 12 }} />
                    </button>
                  )}
                </div>
              );
            })}
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
