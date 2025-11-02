import axios from "axios";
import type { Attachment } from "../types/chat";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export async function uploadFiles(
  files: File[],
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<Attachment[]> {
  const results: Attachment[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    const form = new FormData();
    form.append("files", file);

    try {
      const resp = await axios.post(`${API_BASE_URL}/api/files/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (!onProgress) return;
          const total = evt.total || 0;
          const loaded = evt.loaded || 0;
          const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
          onProgress(i, percent);
        },
      });

      const data = resp.data;
      if (data && data.success && Array.isArray(data.files) && data.files.length > 0) {
        const one = data.files[0];
        if (!one.error) {
          results.push(one as Attachment);
        } else {
          throw new Error(one.error);
        }
      } else {
        throw new Error(data?.message || "上传失败");
      }
      // ensure progress 100
      if (onProgress) onProgress(i, 100);
    } catch (e: any) {
      const msg = e?.message || "上传失败";
      throw new Error(`${file.name}: ${msg}`);
    }
  }

  return results;
}

export function validateLocalFiles(files: File[]): { ok: boolean; message?: string } {
  const MAX_COUNT = 3;
  const MAX_SINGLE = 10 * 1024 * 1024;
  const allowed = ["txt", "md", "docx"];

  if (files.length > MAX_COUNT) {
    return { ok: false, message: `单次最多上传 ${MAX_COUNT} 个文件` };
    }

  for (const f of files) {
    const name = f.name || "";
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (!allowed.includes(ext)) {
      return { ok: false, message: `不支持的文件类型: ${name}` };
    }
    if (f.size > MAX_SINGLE) {
      return { ok: false, message: `${name} 超过 10MB 限制` };
    }
  }
  return { ok: true };
}

