import React, { useEffect, useState } from "react";
import { Button, Input, Upload, Empty, Spin, App as AntdApp, Popconfirm } from "antd";
import type { UploadProps } from "antd";
import { kbListCollectionsByGroup, kbCreateCollection, kbUploadAndIngest, kbListDocuments, kbDeleteCollection, kbDeleteDocument, type KbDocument } from "../../utils/kbApi";
import { useChatContext } from "../../contexts/ChatContext";
import { DeleteOutlined, CheckCircleOutlined, PlusCircleOutlined } from "@ant-design/icons";

const KnowledgePanel: React.FC = () => {
  // 使用 AntD App 上下文，保证 message 在 v5 下行为一致
  const { message } = AntdApp.useApp();
  const { kbCollectionId, setKbCollectionId } = useChatContext();
  const [list, setList] = useState<{ id: number; name: string; group_id?: number | null }[]>([]);
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [docCache, setDocCache] = useState<Record<number, { loading: boolean; items: KbDocument[] }>>({});

  const load = async () => {
    try {
      const items = await kbListCollectionsByGroup();
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
      setShowCreate(false);
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

  // 重命名与粘贴入库等功能暂时在此面板隐藏（后续可能在其他位置提供）

  const deleteCollection = async (cId: number) => {
    try {
      await kbDeleteCollection(cId);
      await load();
      if (kbCollectionId === cId) setKbCollectionId?.(undefined);
      message.success("已删除");
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  const onDropUpload = async (collectionId: number, files: File[]) => {
    if (!files.length) return;
    try {
      setLoading(true);
      await kbUploadAndIngest(collectionId, files);
      await refreshDocs(collectionId);
      message.success(`已入库 ${files.length} 个文件`);
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      message.error(e?.message || "入库失败");
    } finally {
      setLoading(false);
    }
  };

  // 粘贴文本入库流程移除 UI 入口，保留后端能力

  const handleDeleteDoc = async (docId: number, collectionId: number) => {
    try {
      await kbDeleteDocument(docId);
      await refreshDocs(collectionId);
      message.success("已删除文件");
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  return (
    <div className="h-full flex flex-col p-3 text-sm text-foreground">
      {/* 顶部固定：提示 + 操作按钮 + 新建表单（折叠） */}
      <div className="sticky top-0 z-10 bg-panel pb-2 border-b border-surface">
        <div className="text-xs text-gray-500 mb-2">可拖放或点击“+”添加文件</div>
        <div className="flex gap-2">
          <Button size="small" onClick={() => setShowCreate((v) => !v)}>新建知识库</Button>
          <Button size="small" disabled>管理</Button>
        </div>
        {showCreate && (
          <div className="flex gap-2 mt-2">
            <Input size="small" placeholder="新知识库名称" value={name} onChange={(e) => setName(e.target.value)} />
            <Button size="small" type="primary" onClick={onCreate}>创建</Button>
          </div>
        )}
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
                <div key={c.id} className={`rounded-xl border overflow-hidden transition ${isActive? 'border-accent bg-[var(--accent-bg)]' : 'border-surface bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-accent'}`}
                  onDragOver={(e) => {
                    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
                    if (files.length) onDropUpload(c.id, files as File[]);
                  }}
                >
                  {/* Header */}
                  <div
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer ${isActive? 'text-[var(--accent-text)]' : 'text-foreground'}`}
                    onClick={() => toggleExpand(c.id)}
                    title={c.name}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500" onClick={(e) => e.stopPropagation()}>
                      {/* 添加文档到此知识库 */}
                      <Upload
                        {...makeUploadProps(c.id)}
                        showUploadList={false}
                        disabled={loading}
                        className="cursor-pointer"
                      >
                        <span
                          title="添加文档"
                          role="button"
                          aria-label="添加文档"
                          className="inline-flex items-center justify-center w-5 h-5 leading-none text-[16px] align-middle text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        >
                          <PlusCircleOutlined />
                        </span>
                      </Upload>
                      {/* 暂时隐藏：粘贴文本入库、编辑名称 */}
                      <Popconfirm
                        title="删除知识库"
                        description="将删除该知识库及其下的所有文档，确认删除？"
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        placement="topRight"
                        onConfirm={() => deleteCollection(c.id)}
                      >
                        <span
                          title="删除知识库"
                          role="button"
                          aria-label="删除知识库"
                          className="inline-flex items-center justify-center w-5 h-5 leading-none text-[16px] align-middle cursor-pointer text-gray-500 hover:text-red-500 transition-colors"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          <DeleteOutlined />
                        </span>
                      </Popconfirm>
                      <span
                        title="设为当前知识库"
                        role="button"
                        aria-label="设为当前知识库"
                        className={`inline-flex items-center justify-center w-5 h-5 leading-none text-[16px] align-middle ${isActive? 'text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-green-600 dark:hover:text-green-400'} transition-colors`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setKbCollectionId?.(c.id); }}
                      >
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
                                <span className="truncate" title={d.filename}>{d.filename}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Popconfirm
                                  title="删除文件"
                                  description="确认删除该文件？"
                                  okText="删除"
                                  cancelText="取消"
                                  okButtonProps={{ danger: true }}
                                  placement="right"
                                  onConfirm={() => handleDeleteDoc(d.docId, c.id)}
                                >
                                  <span
                                    title="删除文件"
                                    className="inline-flex items-center justify-center w-5 h-5 leading-none text-[16px] align-middle text-gray-400 hover:text-red-500 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); }}
                                  >
                                    <DeleteOutlined />
                                  </span>
                                </Popconfirm>
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
