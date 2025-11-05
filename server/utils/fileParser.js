// 文件文本提取工具：txt、md、docx、css、html、js、py
const mammoth = require("mammoth");

function sanitizeText(input, maxLen = 200000) {
  if (!input) return { text: "", snippet: "" };
  let text = String(input)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?|\u2028|\u2029/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\n{3,}/g, "\n\n");
  if (text.length > maxLen) text = text.slice(0, maxLen);
  const snippet = text.length > 800 ? text.slice(0, 800) : text;
  return { text, snippet };
}

async function extractText({ buffer, mime, ext }) {
  const lowerExt = (ext || "").toLowerCase();
  if (
    lowerExt === "txt" ||
    lowerExt === "md" ||
    lowerExt === "css" ||
    lowerExt === "html" ||
    lowerExt === "js" ||
    lowerExt === "py" ||
    (mime && (mime === "text/plain" || mime.startsWith("text/") ||
      mime === "application/javascript" || mime === "text/javascript"))
  ) {
    return sanitizeText(Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer));
  }
  if (
    lowerExt === "docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return sanitizeText(value || "");
  }
  throw new Error("不支持的文件类型");
}

module.exports = { extractText };
