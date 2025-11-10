import React, { useEffect, useState } from "react";
import { Button, Input, Upload, message, Empty, Tag, Spin } from "antd";
import type { UploadProps } from "antd";
import { kbListCollections, kbCreateCollection, kbUploadAndIngest, kbListDocuments, type KbDocument } from "../../utils/kbApi";
import { useChatContext } from "../../contexts/ChatContext";
import { DownOutlined, RightOutlined, FileTextOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, PlusCircleOutlined } from "@ant-design/icons";

const KnowledgePanel: React.FC = () => {
  const { kbCollectionId, setKbCollectionId } = useChatContext();
  const [list, setList] = useState<{ id: number; name: string }[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [docCache, setDocCache] = useState<Record<number, { loading: boolean; items: KbDocument[] }>>({});

  const load = async () => {
    try {
      const items = await kbListCollections();
      setList(items);
    } catch (e: any) {
      message.error(e?.message || "加载知识库失败");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      const c = await kbCreateCollection(name.trim());
      setName("");
      await load();
      setKbCollectionId?.(c.id);
      message.success("已创建知识库");
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      message.error(e?.message || "创建失败");
    }
  };

  const makeUploadProps = (collectionId: number): UploadProps => ({
    multiple: true,
    beforeUpload: async (file) => {
      try {
        setLoading(true);
        await kbUploadAndIngest(collectionId, [file as unknown as File]);
        message.success(`${file.name} 入库完成`);
        window.dispatchEvent(new CustomEvent('kb:collections-updated'));
        await refreshDocs(collectionId);
        return Upload.LIST_IGNORE;
      } catch (e: any) {
        message.error(e?.message || `${file.name} 入库失败`);
        return Upload.LIST_IGNORE;
      } finally {
        setLoading(false);
      }
    },
  });

  const toggleExpand = async (collectionId: number) => {
    const next = new Set(expanded);
    if (next.has(collectionId)) {
      next.delete(collectionId);
      setExpanded(next);
      return;
    }
    next.add(collectionId);
    setExpanded(next);
    await refreshDocs(collectionId);
  };

  const refreshDocs = async (collectionId: number) => {
    setDocCache((prev) => ({ ...prev, [collectionId]: { loading: true, items: prev[collectionId]?.items || [] } }));
    try {
      const docs = await kbListDocuments(collectionId);
      setDocCache((prev) => ({ ...prev, [collectionId]: { loading: false, items: docs } }));
    } catch (e: any) {
      message.error(e?.message || "加载文档失败");
      setDocCache((prev) => ({ ...prev, [collectionId]: { loading: false, items: prev[collectionId]?.items || [] } }));
    }
  };

  return (
    <div className="h-full flex flex-col p-3 text-sm text-foreground">
      {/* 顶部固定：标题 + 新建 */}
      <div className="sticky top-0 z-10 bg-panel pb-2 border-b border-surface">
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold">知识库</div>
        </div>
        <div className="flex gap-2">
          <Input size="small" placeholder="新知识库名称" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="small" type="primary" onClick={onCreate}>创建</Button>
        </div>
      </div>
      <div className="mt-3 flex-1 min-h-0">
        {list.length === 0 ? (
          <div className="rounded-lg border border-surface bg-[var(--surface)] p-3">
            <Empty description={<span className="text-xs text-gray-500">暂无知识库，创建一个吧</span>} />
          </div>
        ) : (
          <div className="h-full space-y-2 pr-1">
            {list.map((c) => {
              const isActive = kbCollectionId === c.id;
              const isOpen = expanded.has(c.id);
              const docs = docCache[c.id]?.items || [];
              const loadingDocs = docCache[c.id]?.loading;
              return (
                <div key={c.id} className={`rounded-xl border transition ${isActive? 'border-accent bg-[var(--accent-bg)]' : 'border-surface bg-[var(--surface)]'}`}>
                  {/* Header */}
                  <div
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer ${isActive? 'text-[var(--accent-text)]' : 'text-foreground hover:bg-[var(--surface-hover)]'}`}
                    onClick={() => toggleExpand(c.id)}
                    title={c.name}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <DownOutlined /> : <RightOutlined />}
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500" onClick={(e) => e.stopPropagation()}>
                      {/* 添加文档到此知识库 */}
                      <Upload {...makeUploadProps(c.id)} showUploadList={false} disabled={loading}>
                        <span title="添加文档"><PlusCircleOutlined className="hover:text-blue-500" /></span>
                      </Upload>
                      <span title="编辑名称"><EditOutlined /></span>
                      <span title="删除知识库"><DeleteOutlined /></span>
                      <span title="设为当前知识库" className={`${isActive? 'text-green-500' : 'hover:text-green-500'}`} onClick={() => setKbCollectionId?.(c.id)}>
                        <CheckCircleOutlined />
                      </span>
                    </div>
                  </div>
                  {/* Body: docs list */}
                  {isOpen && (
                    <div className="px-3 pb-2">
                      {loadingDocs ? (
                        <div className="py-2"><Spin size="small" /></div>
                      ) : docs.length === 0 ? (
                        <div className="text-xs text-gray-500 py-2">暂无文档，点击上方添加图标</div>
                      ) : (
                        <div className="space-y-1 no-scrollbar">
                          {docs.map((d) => (
                            <div key={d.docId} className="flex items-center justify-between text-xs text-foreground border-b border-surface py-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileTextOutlined />
                                <span className="truncate" title={d.filename}>{d.filename}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {typeof d.chunk_count === 'number' && <Tag color="blue">{d.chunk_count} 块</Tag>}
                                {d.status && <Tag>{d.status}</Tag>}
                                <span title="删除文件（暂未实现）" className="text-gray-400 hover:text-red-500 cursor-not-allowed"><DeleteOutlined /></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgePanel;
