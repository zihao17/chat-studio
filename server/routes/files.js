/**
 * 文件上传与解析路由
 * POST /api/files/upload
 */
const express = require("express");
const multer = require("multer");
const path = require("path");
const { extractText } = require("../utils/fileParser");

const router = express.Router();

function decodeFilename(name) {
  try {
    // 处理部分浏览器/代理以 latin1 传输文件名导致的乱码问题
    const decoded = Buffer.from(name || "", "latin1").toString("utf8");
    return decoded || name || "unnamed";
  } catch {
    return name || "unnamed";
  }
}

// 单文件最大 10MB，总数量建议 <=10
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

const ALLOWED_EXTS = new Set(["txt", "md", "docx", "css", "html", "js", "py"]);

function genId() {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

router.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "未收到文件" });
    }

    if (files.length > 10) {
      return res
        .status(400)
        .json({ success: false, message: "单次最多上传 10 个文件" });
    }

    const results = [];
    for (const f of files) {
      const name = decodeFilename(f.originalname || "unnamed");
      const ext = (path.extname(name).replace(".", "") || "").toLowerCase();
      const mime = f.mimetype || "";
      const size = f.size || 0;

      if (!ALLOWED_EXTS.has(ext)) {
        results.push({
          id: genId(),
          name,
          size,
          mime,
          ext,
          error: "不支持的文件类型",
        });
        continue;
      }

      try {
        const { text, snippet } = await extractText({
          buffer: f.buffer,
          mime,
          ext,
        });
        results.push({ id: genId(), name, size, mime, ext, text, snippet });
      } catch (e) {
        results.push({
          id: genId(),
          name,
          size,
          mime,
          ext,
          error: e && e.message ? e.message : "解析失败",
        });
      }
    }

    res.json({ success: true, files: results });
  } catch (err) {
    console.error("文件上传解析失败:", err);
    res.status(500).json({ success: false, message: "服务器处理失败" });
  }
});

module.exports = router;
