/**
 * Markdown 工具函数
 * 提供流式语法修复和内容处理功能
 */

/**
 * 修复流式输出中未闭合的代码块
 * 极简策略：仅修复代码块，忽略行内代码（AI几乎不会中断行内代码）
 */
export const fixStreamingMarkdown = (content: string): string => {
  if (!content || typeof content !== 'string') {
    return content || '';
  }

  // 仅修复代码块（```）
  const codeBlockCount = (content.match(/```/g) || []).length;
  return codeBlockCount % 2 === 1 ? content + '\n```' : content;
};

/**
 * 检查内容是否包含Markdown语法
 * 简化检测：仅检查语法标记存在性，避免复杂结构验证
 */
export const hasMarkdownSyntax = (content: string): boolean => {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // 简化的语法标记检测，避免回溯爆炸
  return /(```|`|#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\*\*|\*|\[.*\]\(.*\)|\|.*\|)/.test(content);
};

/**
 * 清理多余的空行（可选功能）
 */
export const cleanExtraNewlines = (content: string): string => {
  if (!content || typeof content !== 'string') {
    return content || '';
  }

  // 将连续的3个以上换行符替换为2个
  return content.replace(/\n{3,}/g, '\n\n');
};