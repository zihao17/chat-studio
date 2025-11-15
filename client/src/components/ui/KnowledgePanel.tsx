import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Input,
  Upload,
  Empty,
  Spin,
  App as AntdApp,
  Popconfirm,
  Tooltip,
} from "antd";
import type { InputRef } from "antd";
import type { UploadProps } from "antd";
import {
  kbListCollectionsByGroup,
  kbCreateCollection,
  kbUploadFiles,
  kbIngestDocument,
  kbListDocuments,
  kbDeleteCollection,
  kbDeleteDocument,
  type KbDocument,
} from "../../utils/kbApi";
import { useChatContext } from "../../contexts/ChatContext";
import {
  DeleteOutlined,
  CheckCircleOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  LoadingOutlined,
  CheckOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";

const KnowledgePanel: React.FC = () => {
  // 使用 AntD App 上下文，保证 message 在 v5 下行为一致
  const { message } = AntdApp.useApp();
  const { kbCollectionId, setKbCollectionId } = useChatContext();
  const [list, setList] = useState<
    { id: number; name: string; group_id?: number | null }[]
  >([]);
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [docCache, setDocCache] = useState<
    Record<number, { loading: boolean; items: KbDocument[] }>
  >({});
  // 拖拽悬停反馈：当前悬停的集合ID + 深度计数，避免子元素抖动
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragDepthRef = useRef<Record<number, number>>({});
  const nameInputRef = useRef<InputRef>(null);

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

  // 展开创建表单时自动聚焦到输入框
  useEffect(() => {
    if (showCreate) {
      // 等待 Input 挂载后聚焦
      setTimeout(() => nameInputRef.current?.focus?.(), 0);
    }
  }, [showCreate]);

  // 监听知识库更新事件，实现跨组件同步
  useEffect(() => {
    const handleUpdate = async () => {
      // 先重新加载知识库列表
      const items = await kbListCollectionsByGroup().catch(() => []);
      setList(items);
      
      // 获取当前存在的知识库 ID 集合
      const existingIds = new Set(items.map(c => c.id));
      
      // 只刷新仍然存在且已展开的知识库
      const expandedIds = Array.from(expanded);
      for (const id of expandedIds) {
        if (existingIds.has(id)) {
          await refreshDocs(id);
        }
      }
      
      // 清理已删除知识库的展开状态
      const nextExpanded = new Set(expandedIds.filter(id => existingIds.has(id)));
      if (nextExpanded.size !== expanded.size) {
        setExpanded(nextExpanded);
      }
    };
    window.addEventListener('kb:collections-updated', handleUpdate);
    return () => {
      window.removeEventListener('kb:collections-updated', handleUpdate);
    };
  }, [expanded]);

  // 当窗口失焦、拖拽结束或文档不可见时，重置所有拖拽悬停状态
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
    window.addEventListener("blur", onBlur);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
      window.dispatchEvent(new CustomEvent("kb:collections-updated"));
    } catch (e: any) {
      message.error(e?.message || "创建失败");
    }
  };

  const makeUploadProps = (collectionId: number): UploadProps => ({
    multiple: true,
    beforeUpload: async (file) => {
      try {
        // 前置校验：空文件直接忽略并提示
        if ((file as any)?.size === 0) {
          message.warning('空文件不允许入库');
          return Upload.LIST_IGNORE;
        }
        setLoading(true);
        // 1. 先上传文件（不入库），立即显示文件信息
        const items = await kbUploadFiles(collectionId, [file as unknown as File]);
        await refreshDocs(collectionId);
        
        // 2. 异步入库（不阻塞 UI）
        if (items.length > 0) {
          const docId = items[0].docId;
          kbIngestDocument(docId)
            .then(async () => {
              message.success(`${file.name} 入库完成`);
              await refreshDocs(collectionId);
              window.dispatchEvent(new CustomEvent("kb:collections-updated"));
            })
            .catch(async (e: any) => {
              const msg = e?.response?.data?.message || e?.message || `${file.name} 入库失败`;
              message.error(msg);
              await refreshDocs(collectionId);
            });
        }
        return Upload.LIST_IGNORE;
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || `${file.name} 上传失败`;
        message.error(msg);
        await refreshDocs(collectionId);
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
    setDocCache((prev) => ({
      ...prev,
      [collectionId]: { loading: true, items: prev[collectionId]?.items || [] },
    }));
    try {
      const docs = await kbListDocuments(collectionId);
      setDocCache((prev) => ({
        ...prev,
        [collectionId]: { loading: false, items: docs },
      }));
    } catch (e: any) {
      // 404 错误静默处理（知识库可能已被删除）
      const is404 = e?.response?.status === 404 || e?.message?.includes('404');
      if (!is404) {
        message.error(e?.message || "加载文档失败");
      }
      setDocCache((prev) => ({
        ...prev,
        [collectionId]: {
          loading: false,
          items: prev[collectionId]?.items || [],
        },
      }));
    }
  };

  // 格式化文件大小（仅显示 KB/MB，向上取整更直观）
  const formatSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "-";
    const KB = 1024;
    const MB = KB * 1024;
    if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
    return `${Math.max(1, Math.ceil(bytes / KB))} KB`;
  };

  // 统一的黑底白字提示气泡
  const KbTip: React.FC<{
    title: React.ReactNode;
    children: React.ReactElement;
  }> = ({ title, children }) => (
    <Tooltip
      placement="top"
      overlayClassName="kb-tooltip"
      title={title}
      mouseEnterDelay={0.15}
    >
      {children}
    </Tooltip>
  );

  // 重命名与粘贴入库等功能暂时在此面板隐藏（后续可能在其他位置提供）

  const deleteCollection = async (cId: number) => {
    try {
      await kbDeleteCollection(cId);
      await load();
      if (kbCollectionId === cId) setKbCollectionId?.(undefined);
      message.success("已删除");
      window.dispatchEvent(new CustomEvent("kb:collections-updated"));
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  const onDropUpload = async (collectionId: number, files: File[]) => {
    if (!files.length) return;
    // 过滤空文件并给出提示
    const valid = files.filter((f) => (f as any).size > 0);
    const droppedEmptyCount = files.length - valid.length;
    if (droppedEmptyCount > 0) {
      message.warning(`已忽略 ${droppedEmptyCount} 个空文件`);
    }
    if (!valid.length) return;
    try {
      setLoading(true);
      // 1. 先上传文件（不入库），立即显示文件信息
      const items = await kbUploadFiles(collectionId, valid);
      await refreshDocs(collectionId);
      
      // 2. 异步入库所有文件
      if (items.length > 0) {
        Promise.all(items.map(it => kbIngestDocument(it.docId)))
          .then(async () => {
            message.success(`已入库 ${valid.length} 个文件`);
            await refreshDocs(collectionId);
            window.dispatchEvent(new CustomEvent("kb:collections-updated"));
          })
          .catch(async (e: any) => {
            const msg = e?.response?.data?.message || e?.message || "部分文件入库失败";
            message.error(msg);
            await refreshDocs(collectionId);
          });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "上传失败";
      message.error(msg);
      await refreshDocs(collectionId);
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
      window.dispatchEvent(new CustomEvent("kb:collections-updated"));
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  return (
    <div className="h-full flex flex-col p-3 text-sm text-foreground">
      {/* 顶部固定：提示 + 操作按钮 + 新建表单（折叠） */}
      <div className="sticky top-0 z-10 bg-panel pb-2">
        <div className="kb-header-actions flex gap-2 justify-center">
          <Button
            size="middle"
            shape="round"
            className="btn-kb-ghost"
            icon={<PlusCircleOutlined />}
            onClick={() => setShowCreate((v) => !v)}
          >
            新建知识库
          </Button>
          <Button
            size="middle"
            shape="round"
            className="btn-kb-ghost"
            icon={<SettingOutlined />}
            onClick={() =>
              window.dispatchEvent(new CustomEvent("kb:open-manager"))
            }
          >
            管理知识库
          </Button>
        </div>
        <div className="text-xs text-gray-500 mt-2 text-center">
          添加文件：拖放文件 或 点击+号
        </div>
        {showCreate && (
          <div className="kb-create flex gap-2 mt-2 justify-center">
            <Input
              size="middle"
              className="kb-input"
              placeholder="新知识库名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onPressEnter={onCreate}
              maxLength={30}
              showCount
              autoFocus
              ref={nameInputRef}
              allowClear
            />
            <Button
              size="middle"
              shape="round"
              className="btn-kb-minimal"
              onClick={onCreate}
            >
              创建
            </Button>
          </div>
        )}
      </div>
      <div className="mt-3 flex-1 min-h-0">
        {list.length === 0 ? (
          <div className="rounded-lg border border-surface bg-[var(--surface)] p-3">
            <Empty
              description={
                <span className="text-xs text-gray-500">
                  暂无知识库，创建一个吧
                </span>
              }
            />
          </div>
        ) : (
          <div className="h-full space-y-2 pr-1">
            {list.map((c) => {
              const isActive = kbCollectionId === c.id;
              const isOpen = expanded.has(c.id);
              const docs = docCache[c.id]?.items || [];
              const loadingDocs = docCache[c.id]?.loading;
              return (
                <div
                  key={c.id}
                  className={`rounded-xl overflow-hidden transition-all duration-200 ease-out ${
                    dragOverId === c.id
                      ? "border border-green-300 kb-drop-hover"
                      : isActive
                      ? "border border-accent bg-[var(--accent-bg)]"
                      : "border border-surface bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-accent"
                  }`}
                  onDragEnter={(e) => {
                    const hasFiles =
                      !!e.dataTransfer &&
                      Array.from(e.dataTransfer.types || []).includes("Files");
                    if (!hasFiles) return;
                    e.preventDefault();
                    dragDepthRef.current[c.id] =
                      (dragDepthRef.current[c.id] || 0) + 1;
                    setDragOverId(c.id);
                  }}
                  onDragOver={(e) => {
                    const hasFiles =
                      !!e.dataTransfer &&
                      Array.from(e.dataTransfer.types || []).includes("Files");
                    if (!hasFiles) return;
                    e.preventDefault();
                    // 明确设置 dropEffect，配合视觉反馈
                    e.dataTransfer.dropEffect = "copy";
                    if (dragOverId !== c.id) setDragOverId(c.id);
                  }}
                  onDragLeave={(e) => {
                    const hasFiles =
                      !!e.dataTransfer &&
                      Array.from(e.dataTransfer.types || []).includes("Files");
                    if (!hasFiles) return;
                    e.preventDefault();
                    const next = Math.max(
                      0,
                      (dragDepthRef.current[c.id] || 1) - 1
                    );
                    dragDepthRef.current[c.id] = next;
                    if (next === 0 && dragOverId === c.id) {
                      setDragOverId(null);
                    }
                  }}
                  onDrop={(e) => {
                    const files = e.dataTransfer?.files
                      ? Array.from(e.dataTransfer.files)
                      : [];
                    dragDepthRef.current[c.id] = 0;
                    setDragOverId(null);
                    if (files.length) onDropUpload(c.id, files as File[]);
                  }}
                >
                  {/* Header */}
                  <div
                    className={`flex items-center justify-between pl-3 pr-1 py-2 cursor-pointer ${
                      isActive ? "text-[var(--accent-text)]" : "text-foreground"
                    }`}
                    onClick={() => toggleExpand(c.id)}
                    title={c.name}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div
                      className="flex items-center gap-1 text-gray-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* 添加文档到此知识库 */}
                      <Upload
                        {...makeUploadProps(c.id)}
                        showUploadList={false}
                        disabled={loading}
                        className="cursor-pointer"
                      >
                        <KbTip title="添加文档">
                          <span
                            role="button"
                            aria-label="添加文档"
                            className="inline-flex items-center justify-center w-5 h-5 leading-none text-[16px] align-middle text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                          >
                            <PlusCircleOutlined />
                          </span>
                        </KbTip>
                      </Upload>
                      {/* 暂时隐藏：粘贴文本入库、编辑名称 */}
                      <KbTip title="删除知识库">
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
                            role="button"
                            aria-label="删除知识库"
                            className="inline-flex items-center justify-center w-5 h-5 leading-none text-[16px] align-middle cursor-pointer text-gray-500 hover:text-red-500 transition-colors"
                          >
                            <DeleteOutlined />
                          </span>
                        </Popconfirm>
                      </KbTip>
                      <KbTip title={isActive ? "当前知识库" : "设为当前知识库"}>
                        <span
                          role="button"
                          aria-label="设为当前知识库"
                          className={`inline-flex items-center justify-center w-5 h-5 leading-none text-[16px] align-middle ${
                            isActive
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-500 hover:text-green-600 dark:hover:text-green-400"
                          } transition-colors`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setKbCollectionId?.(c.id);
                          }}
                        >
                          <CheckCircleOutlined />
                        </span>
                      </KbTip>
                    </div>
                  </div>
                  {/* Body: docs list */}
                  {isOpen && (
                    <div className="pl-3 pr-1 pb-2">
                      {loadingDocs ? (
                        <div className="py-2">
                          <Spin size="small" />
                        </div>
                      ) : docs.length === 0 ? (
                        <div className="text-xs text-gray-500 py-2">
                          暂无文档，点击上方添加图标
                        </div>
                      ) : (
                        <div className="space-y-1 no-scrollbar">
                          {docs.map((d) => {
                            const status = (d.status || "").toLowerCase();
                            const isProcessing = status === "uploaded" || status === "processing";
                            const isReady = status === "ready";
                            const isError = status === "error" || status === "failed";
                            
                            return (
                              <div
                                key={d.docId}
                                className="grid grid-cols-[auto_1fr_auto_min-content] items-center text-xs text-foreground border-b border-surface py-1 gap-2"
                              >
                                {/* 状态图标 */}
                                <div className="flex items-center justify-center w-4">
                                  {isProcessing && (
                                    <LoadingOutlined className="text-blue-500 animate-spin" />
                                  )}
                                  {isReady && (
                                    <CheckOutlined className="text-green-500" />
                                  )}
                                  {isError && (
                                    <KbTip title={d.error || "入库失败"}>
                                      <CloseCircleOutlined className="text-red-500" />
                                    </KbTip>
                                  )}
                                </div>
                                {/* 文件名：左侧占满，超出省略（基于显示宽度） */}
                                <div className="min-w-0">
                                  <span
                                    className="block truncate text-gray-400 max-w-[6rem]"
                                    title={d.filename}
                                  >
                                    {d.filename}
                                  </span>
                                </div>
                                {/* 文件大小：固定宽度，右对齐，等宽数字 */}
                                <div className="text-right tabular-nums text-gray-500 whitespace-nowrap">
                                  {formatSize(d.size)}
                                </div>
                                {/* 操作图标：固定宽度靠右 */}
                                <div className="flex items-center justify-end whitespace-nowrap">
                                  <KbTip title="删除文件">
                                    <Popconfirm
                                      title="删除文件"
                                      description="确认删除该文件？"
                                      okText="删除"
                                      cancelText="取消"
                                      okButtonProps={{ danger: true }}
                                      placement="right"
                                      onConfirm={() =>
                                        handleDeleteDoc(d.docId, c.id)
                                      }
                                    >
                                      <span
                                        className="inline-flex items-center justify-center w-5 h-5 leading-none text-[16px] align-middle text-gray-400 hover:text-red-500 cursor-pointer"
                                      >
                                        <DeleteOutlined />
                                      </span>
                                    </Popconfirm>
                                  </KbTip>
                                </div>
                              </div>
                            );
                          })}
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
