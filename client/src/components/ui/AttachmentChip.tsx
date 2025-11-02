import React, { useState } from "react";
import { CloseOutlined, FileTextOutlined, FileWordOutlined } from "@ant-design/icons";
import type { AttachmentMeta } from "../../types/chat";

interface Props {
  file: AttachmentMeta;
  progress?: number; // 0-100
  uploading?: boolean;
  error?: string;
  onRemove?: (id: string) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const AttachmentChip: React.FC<Props> = ({ file, progress, uploading, error, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const isWord = file.ext === "docx";
  const icon = isWord ? <FileWordOutlined /> : <FileTextOutlined />;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-surface bg-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded bg-[var(--surface-hover)] ${isWord ? "text-blue-600" : "text-gray-600"}`}>{icon}</span>
          <span className="font-medium">{file.name}</span>
          <span className="text-gray-400">{file.ext.toUpperCase()}</span>
          <span className="text-gray-400">{formatSize(file.size)}</span>
          {uploading && (
            <span className="text-blue-500">{typeof progress === "number" ? `${progress}%` : "解析中"}</span>
          )}
          {error && (
            <span className="text-red-500">{error}</span>
          )}
        </div>
        {onRemove && (
          <button
            className="text-gray-400 hover:text-red-500 transition"
            onClick={() => onRemove(file.id)}
            title="移除附件"
          >
            <CloseOutlined />
          </button>
        )}
      </div>
      {file.snippet && (
        <div className="text-sm text-foreground bg-[var(--surface-hover)] rounded p-2 whitespace-pre-wrap break-words">
          {expanded ? file.snippet : (file.snippet.length > 200 ? `${file.snippet.slice(0, 200)}...` : file.snippet)}
          {file.snippet.length > 200 && (
            <button
              className="ml-2 text-blue-500 hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "收起" : "展开"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AttachmentChip;

