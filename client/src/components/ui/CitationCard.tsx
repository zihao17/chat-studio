import React, { useState } from "react";
import { Modal } from "antd";
import { kbGetChunk, type KbChunk } from "../../utils/kbApi";
import MarkdownRenderer from "./MarkdownRenderer";

interface CitationCardProps {
  citation: {
    chunkId: number;
    docId: number;
    idx: number;
    title?: string;
    preview?: string;
    score?: number;
  };
  index: number;
}

/**
 * 引用卡片组件 - 可点击展开查看完整原文
 */
const CitationCard: React.FC<CitationCardProps> = ({ citation, index }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [chunkData, setChunkData] = useState<KbChunk | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setModalOpen(true);
    if (!chunkData) {
      try {
        setLoading(true);
        const data = await kbGetChunk(citation.chunkId);
        setChunkData(data);
      } catch (e) {
        console.error("加载chunk失败", e);
      } finally {
        setLoading(false);
      }
    }
  };

  const displayTitle = citation.title || `doc-${citation.docId}`;

  return (
    <>
      <span
        className="text-xs px-2 py-1 rounded-full border border-surface bg-[var(--surface)] text-foreground hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
        title={`${displayTitle} | #${citation.idx}\n${citation.preview || ''}`}
        onClick={handleClick}
      >
        引用 {index + 1} · {displayTitle}
      </span>

      <Modal
        title="引用原文"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={800}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : chunkData ? (
          <div className="space-y-3">
            {/* 文档信息 */}
            <div className="p-3 rounded border border-surface bg-[var(--surface)] space-y-1">
              <div className="text-sm">
                <span className="text-gray-500">文档：</span>
                <span className="font-medium">{chunkData.docName}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">块索引：</span>
                <span>#{chunkData.idx}</span>
                <span className="ml-4 text-gray-500">Token数：</span>
                <span>{chunkData.tokens}</span>
              </div>
              {typeof citation.score === 'number' && (
                <div className="text-sm">
                  <span className="text-gray-500">相关度分数：</span>
                  <span>{citation.score.toFixed(4)}</span>
                </div>
              )}
            </div>

            {/* 完整内容 */}
            <div className="p-4 rounded border border-surface bg-panel max-h-[500px] overflow-y-auto">
              <MarkdownRenderer content={chunkData.content} isStreaming={false} />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">加载失败</div>
        )}
      </Modal>
    </>
  );
};

export default CitationCard;
