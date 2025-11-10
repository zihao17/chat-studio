import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export interface KbCollection {
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
  created_at?: string;
  chunk_count?: number;
}

export async function kbListCollections(): Promise<KbCollection[]> {
  const resp = await axios.get(`${API_BASE_URL}/api/kb/collections`);
  return resp.data?.items || [];
}

export async function kbCreateCollection(name: string, description?: string): Promise<KbCollection> {
  const resp = await axios.post(`${API_BASE_URL}/api/kb/collections`, { name, description });
  return { id: resp.data?.id, name, description } as KbCollection;
}

export async function kbDeleteCollection(id: number): Promise<void> {
  await axios.delete(`${API_BASE_URL}/api/kb/collections/${id}`);
}

export async function kbUploadAndIngest(collectionId: number, files: File[], onProgress?: (index: number, percent: number) => void): Promise<void> {
  if (!files.length) return;
  const form = new FormData();
  for (const f of files) form.append("files", f);
  await axios.post(`${API_BASE_URL}/api/kb/documents/upload?collection_id=${collectionId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (!onProgress) return;
      const total = e.total || 0;
      const loaded = e.loaded || 0;
      const p = total > 0 ? Math.round((loaded / total) * 100) : 0;
      onProgress(0, p);
    },
  }).then(async (resp) => {
    const items = resp.data?.items || [];
    for (const it of items) {
      await axios.post(`${API_BASE_URL}/api/kb/documents/${it.docId}/ingest`);
    }
  });
}

export async function kbListDocuments(collectionId: number): Promise<KbDocument[]> {
  const resp = await axios.get(`${API_BASE_URL}/api/kb/collections/${collectionId}/documents`);
  return resp.data?.items || [];
}

export interface KbSearchItem { chunkId: number; docId: number; content: string; score: number; rerankScore: number; }

export async function kbSearch(collectionId: number, query: string, topK = 10): Promise<KbSearchItem[]> {
  const resp = await axios.post(`${API_BASE_URL}/api/kb/search`, { collection_id: collectionId, query, top_k: topK });
  return resp.data?.items || [];
}
