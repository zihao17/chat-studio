import React, { useEffect, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button, Empty, Input, Modal, Popconfirm, Tag, Upload, Tooltip, Table } from "antd";
import type { UploadProps } from "antd";
import {
  kbListCollections,
  kbListDocuments,
  kbUploadFiles,
  kbDeleteCollection,
  kbDeleteDocument,
  kbUpdateCollection,
  kbPasteText,
  kbIngestDocument,
  kbSearch,
  kbGetDocumentProgress,
  type KbCollection,
  type KbDocument,
  type KbSearchItem,
} from "../utils/kbApi";
import { useChatContext } from "../contexts/ChatContext";
import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusCircleOutlined,
  SnippetsOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";

const KbManager: React.FC = () => {
  const { message } = AntdApp.useApp();
  const { kbCollectionId, setKbCollectionId } = useChatContext();
  const [, setLoading] = useState(false);
  const [collections, setCollections] = useState<KbCollection[]>([]);
  const [docsMap, setDocsMap] = useState<Record<number, { loading: boolean; items: KbDocument[] }>>({});
  // 拖拽悬停反馈（与侧边栏知识库保持一致）：当前悬停集合ID + 深度计数
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragDepthRef = useRef<Record<number, number>>({});

  // 行内重命名
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  // 粘贴文本入库弹窗
  const [pasteTarget, setPasteTarget] = useState<KbCollection | null>(null);
  const [pasteFilename, setPasteFilename] = useState("");
  const [pasteText, setPasteText] = useState("");
  // 搜索测试弹窗
  const [searchTarget, setSearchTarget] = useState<KbCollection | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KbSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // 进度轮询定时器
  const progressTimersRef = useRef<Record<number, number>>({});

  // 统一黑底白字提示
  const KbTip: React.FC<{ title: React.ReactNode; children: React.ReactElement }> = ({ title, children }) => (
    <Tooltip placement="top" overlayClassName="kb-tooltip" title={title} mouseEnterDelay={0.15}>
      {children}
    </Tooltip>
  );

  // 文件大小格式化（KB/MB）
  const formatSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "-";
    const KB = 1024;
    const MB = KB * 1024;
    if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
    return `${Math.max(1, Math.ceil(bytes / KB))} KB`;
  };

  const loadCollections = async () => {
    try {
      setLoading(true);
      const list = await kbListCollections();
      setCollections(list);
      // 预加载每个集合的文档
      const entries: [number, { loading: boolean; items: KbDocument[] } ][] = await Promise.all(
        list.map(async (c) => {
          try {
            const items = await kbListDocuments(c.id);
            return [c.id, { loading: false, items: items as KbDocument[] }];
          } catch {
            return [c.id, { loading: false, items: [] as KbDocument[] }];
          }
        })
      );
      const next: Record<number, { loading: boolean; items: KbDocument[] }> = {};
      for (const [k, v] of entries) next[k] = v;
      setDocsMap(next);
    } catch (e: any) {
      message.error(e?.message || "加载知识库失败");
    } finally {
      setLoading(false);
    }
  };

  const refreshDocs = async (collectionId: number) => {
    setDocsMap((m) => ({ ...m, [collectionId]: { loading: true, items: m[collectionId]?.items || [] } }));
    try {
      const items = await kbListDocuments(collectionId);
      setDocsMap((m) => ({ ...m, [collectionId]: { loading: false, items } }));
    } catch (e: any) {
      // 404 错误静默处理（知识库可能已被删除）
      const is404 = e?.response?.status === 404 || e?.message?.includes('404');
      if (!is404) {
        message.error(e?.message || "加载文档失败");
      }
      setDocsMap((m) => ({ ...m, [collectionId]: { loading: false, items: m[collectionId]?.items || [] } }));
    }
  };

  // 启动进度轮询
  const startProgressPolling = (docId: number, collectionId: number) => {
    // 清除旧定时器
    if (progressTimersRef.current[docId]) {
      clearInterval(progressTimersRef.current[docId]);
    }
    
    const poll = async () => {
      try {
        const doc = await kbGetDocumentProgress(docId);
        // 更新文档状态
        setDocsMap((m) => {
          const items = m[collectionId]?.items || [];
          const updated = items.map(d => d.docId === docId ? { ...d, status: doc.status, progress: doc.progress, error: doc.error } : d);
          return { ...m, [collectionId]: { ...m[collectionId], items: updated } };
        });
        
        // 如果完成或失败，停止轮询
        if (doc.status === 'ready' || doc.status === 'error') {
          stopProgressPolling(docId);
          await refreshDocs(collectionId);
        }
      } catch (e) {
        // 轮询失败静默处理
        console.warn('进度轮询失败', e);
      }
    };
    
    // 立即执行一次
    poll();
    // 每1.5秒轮询一次
    progressTimersRef.current[docId] = setInterval(poll, 1500) as unknown as number;
  };

  // 停止进度轮询
  const stopProgressPolling = (docId: number) => {
    if (progressTimersRef.current[docId]) {
      clearInterval(progressTimersRef.current[docId]);
      delete progressTimersRef.current[docId];
    }
  };

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      Object.values(progressTimersRef.current).forEach(timer => clearInterval(timer));
    };
  }, []);

  useEffect(() => {
    loadCollections();
  }, []);

  // 监听知识库更新事件，实现跨组件同步
  useEffect(() => {
    const handleUpdate = () => {
      loadCollections();
    };
    window.addEventListener('kb:collections-updated', handleUpdate);
    return () => {
      window.removeEventListener('kb:collections-updated', handleUpdate);
    };
  }, []);

  // 当窗口失焦、拖拽结束或文档不可见时，重置管理页内的拖拽悬停状态
  useEffect(() => {
    const resetDragState = () => {
      setDragOverId(null);
      dragDepthRef.current = {};
    };
    const onBlur = () => resetDragState();
    const onDrop = () => resetDragState();
    const onDragEnd = () => resetDragState();
    const onVisibility = () => {
      if (document.hidden) resetDragState();
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', onDragEnd);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', onDragEnd);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const makeUploadProps = (collectionId: number): UploadProps => ({
    multiple: true,
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        setLoading(true);
        // 1. 先上传文件（不入库），立即显示文件信息
        const items = await kbUploadFiles(collectionId, [file as unknown as File]);
        await refreshDocs(collectionId);
        
        // 2. 异步入库并启动进度轮询
        if (items.length > 0) {
          const docId = items[0].docId;
          startProgressPolling(docId, collectionId);
          kbIngestDocument(docId)
            .then(async () => {
              message.success(`${file.name} 入库完成`);
              stopProgressPolling(docId);
              await refreshDocs(collectionId);
              window.dispatchEvent(new CustomEvent('kb:collections-updated'));
            })
            .catch(async (e: any) => {
              message.error(e?.message || `${file.name} 入库失败`);
              stopProgressPolling(docId);
              await refreshDocs(collectionId);
            });
        }
        return Upload.LIST_IGNORE;
      } catch (e: any) {
        message.error(e?.message || `${file.name} 上传失败`);
        await refreshDocs(collectionId);
        return Upload.LIST_IGNORE;
      } finally {
        setLoading(false);
      }
    },
  });

  // 支持拖放至卡片直接入库
  const onDropUpload = async (collectionId: number, files: File[]) => {
    if (!files.length) return;
    try {
      setLoading(true);
      // 1. 先上传文件（不入库），立即显示文件信息
      const items = await kbUploadFiles(collectionId, files);
      await refreshDocs(collectionId);
      
      // 2. 异步入库所有文件并启动进度轮询
      if (items.length > 0) {
        items.forEach(it => startProgressPolling(it.docId, collectionId));
        Promise.all(items.map(it => kbIngestDocument(it.docId)))
          .then(async () => {
            message.success(`已入库 ${files.length} 个文件`);
            items.forEach(it => stopProgressPolling(it.docId));
            await refreshDocs(collectionId);
            window.dispatchEvent(new CustomEvent('kb:collections-updated'));
          })
          .catch(async (e: any) => {
            message.error(e?.message || "部分文件入库失败");
            items.forEach(it => stopProgressPolling(it.docId));
            await refreshDocs(collectionId);
          });
      }
    } catch (e: any) {
      message.error(e?.message || "上传失败");
      await refreshDocs(collectionId);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCollection = async (id: number) => {
    try {
      await kbDeleteCollection(id);
      if (kbCollectionId === id) setKbCollectionId?.(undefined);
      message.success("已删除知识库");
      await loadCollections();
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  const handleDeleteDoc = async (docId: number, collectionId: number) => {
    try {
      await kbDeleteDocument(docId);
      message.success("已删除文件");
      await refreshDocs(collectionId);
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  const handleRetryIngest = async (docId: number, collectionId: number) => {
    try {
      setLoading(true);
      startProgressPolling(docId, collectionId);
      await kbIngestDocument(docId);
      message.success("已重新开始入库");
      await refreshDocs(collectionId);
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "重新入库失败";
      message.error(msg);
      stopProgressPolling(docId);
    } finally {
      setLoading(false);
    }
  };

  const openRename = (c: KbCollection) => {
    setEditingId(c.id);
    setEditingValue(c.name || "");
  };
  const confirmRename = async () => {
    if (!editingId) return;
    const v = editingValue.trim();
    if (!v) return message.warning("名称不能为空");
    try {
      await kbUpdateCollection(editingId, { name: v });
      message.success("已更新名称");
      setEditingId(null);
      await loadCollections();
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      message.error(e?.message || "更新失败");
    }
  };

  const openPaste = (c: KbCollection) => {
    setPasteTarget(c);
    setPasteFilename("");
    setPasteText("");
  };
  const confirmPaste = async () => {
    if (!pasteTarget) return;
    const txt = pasteText.trim();
    if (!txt) return message.warning("请输入要入库的文本");
    try {
      await kbPasteText(pasteTarget.id, txt, pasteFilename.trim() || undefined);
      message.success("文本已入库");
      setPasteTarget(null);
      await refreshDocs(pasteTarget.id);
      window.dispatchEvent(new CustomEvent('kb:collections-updated'));
    } catch (e: any) {
      message.error(e?.message || "入库失败");
    }
  };

  const openSearch = (c: KbCollection) => {
    setSearchTarget(c);
    setSearchQuery("");
    setSearchResults([]);
  };
  const handleSearch = async () => {
    if (!searchTarget || !searchQuery.trim()) return message.warning("请输入搜索问题");
    try {
      setSearchLoading(true);
      const results = await kbSearch(searchTarget.id, searchQuery.trim(), 10);
      setSearchResults(results);
    } catch (e: any) {
      message.error(e?.message || "搜索失败");
    } finally {
      setSearchLoading(false);
    }
  };

  const statusTag = (s?: string, error?: string, progress?: number) => {
    const st = (s || "").toLowerCase();
    if (st === "ready") return <Tag className="kb-tag-compact" color="green">就绪</Tag>;
    if (st === "processing") {
      return (
        <div className="flex items-center gap-1">
          <Tag className="kb-tag-compact" color="orange">处理中</Tag>
          {typeof progress === 'number' && <span className="text-xs text-gray-500">{progress}%</span>}
        </div>
      );
    }
    if (st === "uploaded") return <Tag className="kb-tag-compact" color="blue">解析中</Tag>;
    if (st === "error" || st === "failed") {
      return (
        <Tooltip title={error || "入库失败"} placement="left">
          <Tag className="kb-tag-compact" color="red">失败</Tag>
        </Tooltip>
      );
    }
    return <Tag className="kb-tag-compact">{s || "-"}</Tag>;
  };

  const gridCols = useMemo(() => "grid grid-cols-1 md:grid-cols-2 gap-3", []);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部条：返回按钮 */}
      <div className="flex items-center px-3 py-2 border-b border-surface bg-panel">
        <Button
          type="text"
          size="middle"
          className="flex items-center gap-2 px-3 py-1 h-8 text-base hover:bg-[var(--surface-hover)] transition-colors"
          onClick={() => window.dispatchEvent(new CustomEvent('kb:close-manager'))}
          icon={<ArrowLeftOutlined className="text-lg" />}
        >
          返回
        </Button>
        <div className="flex-1 flex justify-center">
          <div className="text-lg font-medium text-foreground">知识库管理</div>
        </div>
        <div className="w-16"></div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-3">
        {collections.length === 0 ? (
          <div className="rounded-xl border border-surface bg-[var(--surface)] p-6">
            <Empty description={<span className="text-xs text-gray-500">暂无知识库，请在左侧创建</span>} />
          </div>
        ) : (
          <div className={gridCols}>
            {collections.map((c) => {
              const docs = docsMap[c.id]?.items || [];
              const loadingDocs = docsMap[c.id]?.loading;
              const isActive = kbCollectionId === c.id;
              return (
                <div
                  key={c.id}
                  className={`rounded-xl overflow-hidden transition-all duration-200 ease-out ${
                    dragOverId === c.id
                      ? 'border border-green-300 kb-drop-hover'
                      : isActive
                        ? 'border border-accent bg-[var(--accent-bg)]'
                        : 'border border-surface bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                  }`}
                  onDragEnter={(e) => {
                    const hasFiles = !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
                    if (!hasFiles) return;
                    e.preventDefault();
                    dragDepthRef.current[c.id] = (dragDepthRef.current[c.id] || 0) + 1;
                    setDragOverId(c.id);
                  }}
                  onDragOver={(e) => {
                    const hasFiles = !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
                    if (!hasFiles) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    if (dragOverId !== c.id) setDragOverId(c.id);
                  }}
                  onDragLeave={(e) => {
                    const hasFiles = !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
                    if (!hasFiles) return;
                    e.preventDefault();
                    const next = Math.max(0, (dragDepthRef.current[c.id] || 1) - 1);
                    dragDepthRef.current[c.id] = next;
                    if (next === 0 && dragOverId === c.id) {
                      setDragOverId(null);
                    }
                  }}
                  onDrop={(e) => {
                    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
                    dragDepthRef.current[c.id] = 0;
                    setDragOverId(null);
                    if (files.length) onDropUpload(c.id, files as File[]);
                  }}
                >
                  {/* 卡片头：名称 + 操作 */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="min-w-0 flex items-center gap-2">
                      {editingId === c.id ? (
                        <>
                          <Input
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onPressEnter={confirmRename}
                            onBlur={() => {/* 保留编辑态直到显式确认 */}}
                            className={`px-0 py-0 h-7 bg-transparent outline-none border-0 border-b-2 focus:border-b-2 ${isActive ? 'border-accent text-[var(--accent-text)]' : 'border-accent text-foreground'}`}
                          />
                          <KbTip title="确认">
                            <span
                              role="button"
                              className="inline-flex items-center justify-center w-5 h-5 text-green-600 hover:opacity-80 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); confirmRename(); }}
                            >
                              <CheckCircleOutlined />
                            </span>
                          </KbTip>
                        </>
                      ) : (
                        <div className={`truncate ${isActive? 'text-[var(--accent-text)]' : 'text-foreground'}`}>{c.name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                      {/* 编辑名称 */}
                      <KbTip title="编辑名称">
                        <span role="button" className="w-5 h-5 inline-flex items-center justify-center cursor-pointer hover:text-blue-500" onClick={() => openRename(c)}>
                          <EditOutlined />
                        </span>
                      </KbTip>
                      {/* 添加文件 */}
                      <Upload {...makeUploadProps(c.id)}>
                        <KbTip title="添加文件">
                          <span
                            role="button"
                            className="w-6 h-6 inline-flex items-center justify-center cursor-pointer text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 text-[18px] leading-none align-middle transition-colors"
                          >
                            <PlusCircleOutlined />
                          </span>
                        </KbTip>
                      </Upload>
                      {/* 粘贴文本入库 */}
                      <KbTip title="粘贴文本入库">
                        <span role="button" className="w-5 h-5 inline-flex items-center justify-center cursor-pointer hover:text-purple-500" onClick={() => openPaste(c)}>
                          <SnippetsOutlined />
                        </span>
                      </KbTip>
                      {/* 搜索测试 */}
                      <KbTip title="搜索测试">
                        <span role="button" className="w-5 h-5 inline-flex items-center justify-center cursor-pointer hover:text-blue-500" onClick={() => openSearch(c)}>
                          <SearchOutlined />
                        </span>
                      </KbTip>
                      {/* 删除知识库 */}
                      <KbTip title="删除知识库">
                        <Popconfirm
                          title="删除知识库"
                          description="将删除该知识库及其下全部文件，确认删除？"
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                          placement="topRight"
                          onConfirm={() => handleDeleteCollection(c.id)}
                        >
                          <span role="button" className="w-5 h-5 inline-flex items-center justify-center cursor-pointer hover:text-red-500">
                            <DeleteOutlined />
                          </span>
                        </Popconfirm>
                      </KbTip>
                      {/* 设为使用 */}
                      <KbTip title={isActive ? "当前知识库" : "设为当前知识库"}>
                        <span
                          role="button"
                          className={`w-5 h-5 inline-flex items-center justify-center cursor-pointer ${isActive? 'text-green-600' : 'hover:text-green-600'}`}
                          onClick={() => {
                          if (kbCollectionId === c.id) {
                            message.info("已是当前知识库");
                          } else {
                            setKbCollectionId?.(c.id);
                            message.success("已设为当前知识库");
                          }
                        }}
                        >
                          <CheckCircleOutlined />
                        </span>
                      </KbTip>
                    </div>
                  </div>

                  {/* 文档列表 */}
                  <div className="px-3 pb-3">
                    {loadingDocs ? (
                      <div className="text-xs text-gray-500 py-2">加载中...</div>
                    ) : docs.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2">暂无文件</div>
                    ) : (
                      <div className="space-y-1">
                        {docs.map((d) => (
                          <div
                            key={d.docId}
                            className="grid grid-cols-[1fr_auto_auto_min-content_min-content] items-center text-xs border-b border-surface py-1 gap-2"
                          >
                            {/* 文件名 */}
                            <div className="min-w-0"><span className="truncate" title={d.filename}>{d.filename}</span></div>
                            {/* 文件大小 */}
                            <div className="text-right tabular-nums text-gray-500 whitespace-nowrap">{formatSize(d.size)}</div>
                            {/* 块数 */}
                            <div className="text-right text-gray-500 whitespace-nowrap">{typeof d.chunk_count === 'number' ? `${d.chunk_count}块` : '0块'}</div>
                            {/* 状态 */}
                            <div className="flex justify-end whitespace-nowrap">{statusTag(d.status, d.error, (d as any).progress)}</div>
                            {/* 操作 */}
                            <div className="flex justify-end gap-1 whitespace-nowrap">
                              {d.status === 'error' && (
                                <KbTip title="重新入库">
                                  <span 
                                    className="w-5 h-5 inline-flex items-center justify-center cursor-pointer text-gray-400 hover:text-blue-500"
                                    onClick={() => handleRetryIngest(d.docId, c.id)}
                                  >
                                    <ReloadOutlined />
                                  </span>
                                </KbTip>
                              )}
                              <KbTip title="删除文件">
                                <Popconfirm
                                  title="删除文件"
                                  okText="删除"
                                  cancelText="取消"
                                  okButtonProps={{ danger: true }}
                                  placement="left"
                                  onConfirm={() => handleDeleteDoc(d.docId, c.id)}
                                >
                                  <span className="w-5 h-5 inline-flex items-center justify-center cursor-pointer text-gray-400 hover:text-red-500">
                                    <DeleteOutlined />
                                  </span>
                                </Popconfirm>
                              </KbTip>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 行内重命名不再使用弹窗 */}

      {/* 粘贴入库弹窗 */}
      <Modal
        title="粘贴文本入库"
        open={!!pasteTarget}
        onCancel={() => setPasteTarget(null)}
        onOk={confirmPaste}
        okText="入库"
        cancelText="取消"
        width={720}
      >
        <div className="space-y-2">
          <Input placeholder="可选：为该文本指定文件名，如 notes.txt" value={pasteFilename} onChange={(e) => setPasteFilename(e.target.value)} />
          <Input.TextArea placeholder="在此粘贴要入库的文本" value={pasteText} onChange={(e) => setPasteText(e.target.value)} autoSize={{ minRows: 8 }} />
        </div>
      </Modal>

      {/* 搜索测试弹窗 */}
      <Modal
        title={`搜索测试 - ${searchTarget?.name || ''}`}
        open={!!searchTarget}
        onCancel={() => setSearchTarget(null)}
        footer={null}
        width={900}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input 
              placeholder="输入测试问题" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Button type="primary" onClick={handleSearch} loading={searchLoading}>搜索</Button>
          </div>
          {searchResults.length > 0 && (
            <Table
              dataSource={searchResults}
              rowKey="chunkId"
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
              columns={[
                { title: '排名', width: 60, render: (_: any, __: any, idx: number) => idx + 1 },
                { title: '文档名', dataIndex: 'docName', width: 150, ellipsis: true },
                { title: '块索引', dataIndex: 'idx', width: 80 },
                { title: '内容预览', dataIndex: 'content', ellipsis: true, render: (text: string) => text.slice(0, 80) + (text.length > 80 ? '...' : '') },
                { title: '混合分数', dataIndex: 'score', width: 100, render: (v: number) => v.toFixed(4) },
                { title: '重排分数', dataIndex: 'rerankScore', width: 100, render: (v: number) => v?.toFixed(4) || '-' },
              ]}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default KbManager;
