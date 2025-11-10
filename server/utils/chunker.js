/**
 * 文本切分工具：约 800 tokens，重叠 150（以字符近似估算）。
 * 说明：为降低依赖，MVP 采用字符级近似估算（中文约 1 字 ~ 1 token，英文约 4 字符 ~ 1 token），
 * 目标长度按 3200 字符近似 800 token，可通过入参调节。
 */

'use strict';

/**
 * 简单段落分割：按空行 / 标题 / 代码块标记分割。
 */
function splitParagraphs(text) {
  const blocks = [];
  const lines = String(text).split(/\n/);
  let buf = [];
  let inCode = false;
  for (const line of lines) {
    const isFence = /^\s*```/.test(line);
    if (isFence) {
      inCode = !inCode;
    }
    buf.push(line);
    const isTitle = /^\s*#{1,6}\s+/.test(line);
    const isSeparator = /^\s*$/.test(line) && !inCode;
    if (!inCode && (isTitle || isSeparator)) {
      blocks.push(buf.join('\n'));
      buf = [];
    }
  }
  if (buf.length) blocks.push(buf.join('\n'));
  return blocks.filter(Boolean);
}

/**
 * 切分为近似 token 大小的块，并保留重叠
 * @param {string} text
 * @param {object} opts
 * @param {number} opts.targetChars 每块目标字符数（默认 3200 ~ 800 tokens）
 * @param {number} opts.overlapChars 重叠字符数（默认 600 ~ 150 tokens）
 */
function chunkText(text, opts = {}) {
  const targetChars = opts.targetChars ?? 3200;
  const overlapChars = opts.overlapChars ?? 600;
  const paragraphs = splitParagraphs(text);

  const result = [];
  let cursor = 0;
  let buf = '';
  let start = 0;

  for (const p of paragraphs) {
    if (buf.length + p.length + 1 <= targetChars) {
      if (!buf) start = cursor;
      buf += (buf ? '\n' : '') + p;
      cursor += p.length + 1;
      continue;
    }

    if (buf) {
      result.push({ content: buf, start_pos: start, end_pos: start + buf.length });
      // 准备重叠
      const overlapStart = Math.max(0, buf.length - overlapChars);
      const overlap = buf.slice(overlapStart);
      start = start + overlapStart;
      buf = overlap + '\n' + p;
      cursor += p.length + 1;
      if (buf.length >= targetChars) {
        result.push({ content: buf, start_pos: start, end_pos: start + buf.length });
        const ovStart = Math.max(0, buf.length - overlapChars);
        start = start + ovStart;
        buf = buf.slice(ovStart);
      }
    } else {
      // 单段过大，强制切
      let s = 0;
      while (s < p.length) {
        const e = Math.min(p.length, s + targetChars);
        const part = p.slice(s, e);
        const posStart = cursor + s;
        result.push({ content: part, start_pos: posStart, end_pos: posStart + part.length });
        s = e - overlapChars > s ? e - overlapChars : e;
      }
      cursor += p.length + 1;
    }
  }

  if (buf) {
    result.push({ content: buf, start_pos: start, end_pos: start + buf.length });
  }

  // 添加 idx 与 tokens 近似值
  return result.map((r, i) => ({
    idx: i,
    tokens: Math.ceil(r.content.length / 4),
    ...r,
  }));
}

module.exports = { chunkText };

