import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export interface KbCollection {
  id: number;
  name: string;
  description?: string;
  group_id?: number | null;
}

export interface KbGroup {
  id: number;
  name: string;
  description?: string;
}

export interface KbDocument {
  docId: number;
  filename: string;
  ext?: string;
  mime?: string;
  size?: number;
  status?: string;
  error?: string;
  created_at?: string;
  chunk_count?: number;
}

export async function kbListCollections(): Promise<KbCollection[]> {
  const resp = await axios.get(`${API_BASE_URL}/api/kb/collections`);
  return resp.data?.items || [];
}

export async function kbListCollectionsByGroup(groupId?: number): Promise<KbCollection[]> {
  const url = groupId ? `${API_BASE_URL}/api/kb/collections?group_id=${groupId}` : `${API_BASE_URL}/api/kb/collections`;
  const resp = await axios.get(url);
  return resp.data?.items || [];
}

export async function kbCreateCollection(name: string, description?: string, groupId?: number): Promise<KbCollection> {
  const resp = await axios.post(`${API_BASE_URL}/api/kb/collections`, { name, description, group_id: groupId });
  return { id: resp.data?.id, name, description, group_id: groupId } as KbCollection;
}

export async function kbDeleteCollection(id: number): Promise<void> {
  await axios.delete(`${API_BASE_URL}/api/kb/collections/${id}`);
}

export async function kbUpdateCollection(id: number, payload: Partial<{ name: string; description: string; group_id: number | null; }>): Promise<void> {
  await axios.put(`${API_BASE_URL}/api/kb/collections/${id}`, payload);
}

/**
 * 仅上传文件，不进行入库（返回文档 ID 列表）
 */
export async function kbUploadFiles(collectionId: number, files: File[], onProgress?: (index: number, percent: number) => void): Promise<{ docId: number; filename: string; size: number }[]> {
  if (!files.length) return [];
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const resp = await axios.post(`${API_BASE_URL}/api/kb/documents/upload?collection_id=${collectionId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (!onProgress) return;
      const total = e.total || 0;
      const loaded = e.loaded || 0;
      const p = total > 0 ? Math.round((loaded / total) * 100) : 0;
      onProgress(0, p);
    },
  });
  return resp.data?.items || [];
}

/**
 * 上传文件并自动入库（旧版本，保持兼容性）
 */
export async function kbUploadAndIngest(collectionId: number, files: File[], onProgress?: (index: number, percent: number) => void): Promise<void> {
  const items = await kbUploadFiles(collectionId, files, onProgress);
  // 逐个入库
  for (const it of items) {
    await axios.post(`${API_BASE_URL}/api/kb/documents/${it.docId}/ingest`);
  }
}

export async function kbListDocuments(collectionId: number): Promise<KbDocument[]> {
  const resp = await axios.get(`${API_BASE_URL}/api/kb/collections/${collectionId}/documents`);
  return resp.data?.items || [];
}

export interface KbSearchItem { 
  chunkId: number; 
  docId: number; 
  docName: string;
  idx: number;
  content: string; 
  score: number; 
  rerankScore: number; 
}

export async function kbSearch(collectionId: number, query: string, topK = 10): Promise<KbSearchItem[]> {
  const resp = await axios.post(`${API_BASE_URL}/api/kb/search`, { collection_id: collectionId, query, top_k: topK });
  return resp.data?.items || [];
}

export interface KbChunk {
  chunkId: number;
  docId: number;
  docName: string;
  idx: number;
  content: string;
  tokens: number;
  ext?: string;
  mime?: string;
}

export async function kbGetChunk(chunkId: number): Promise<KbChunk> {
  const resp = await axios.get(`${API_BASE_URL}/api/kb/chunks/${chunkId}`);
  return resp.data?.item;
}

export async function kbGetDocumentProgress(docId: number): Promise<{ docId: number; filename: string; status: string; progress: number; error?: string }> {
  const resp = await axios.get(`${API_BASE_URL}/api/kb/documents/${docId}`);
  return resp.data?.item;
}

export async function kbDeleteDocument(docId: number): Promise<void> {
  await axios.delete(`${API_BASE_URL}/api/kb/documents/${docId}`);
}

export async function kbPasteText(collectionId: number, text: string, filename?: string): Promise<{ docId: number }> {
  const resp = await axios.post(`${API_BASE_URL}/api/kb/documents/paste`, { collection_id: collectionId, text, filename });
  return { docId: resp.data?.docId };
}

export async function kbListGroups(): Promise<KbGroup[]> {
  const resp = await axios.get(`${API_BASE_URL}/api/kb/groups`);
  return resp.data?.items || [];
}

export async function kbCreateGroup(name: string, description?: string): Promise<KbGroup> {
  const resp = await axios.post(`${API_BASE_URL}/api/kb/groups`, { name, description });
  return { id: resp.data?.id, name, description } as KbGroup;
}

export async function kbDeleteGroup(id: number): Promise<void> {
  await axios.delete(`${API_BASE_URL}/api/kb/groups/${id}`);
}

/**
 * 重新入库文档（用于失败重试）
 */
export async function kbIngestDocument(docId: number): Promise<void> {
  const resp = await axios.post(`${API_BASE_URL}/api/kb/documents/${docId}/ingest`);
  if (!resp.data?.success) {
    throw new Error(resp.data?.message || '入库失败');
  }
}
