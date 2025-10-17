/**
 * Markdown渲染组件
 * 集成react-markdown、remark-gfm和rehype-highlight
 * 支持流式渲染、代码高亮和GFM语法
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import hljs from '../../utils/highlightConfig';
import { fixStreamingMarkdown, hasMarkdownSyntax } from '../../utils/markdownUtils';

interface MarkdownRendererProps {
  /** Markdown内容 */
  content: string;
  /** 是否为流式渲染（用于语法修复） */
  isStreaming?: boolean;
  /** 自定义CSS类名 */
  className?: string;
}

/**
 * 表格组件类型定义
 */
interface TableProps {
  children?: React.ReactNode;
}

/**
 * 自定义表格渲染组件
 */
const Table: React.FC<TableProps> = ({ children }) => (
  <div className="overflow-x-auto my-4">
    <table className="min-w-full border-collapse border border-gray-300">
      {children}
    </table>
  </div>
);

const TableHead: React.FC<TableProps> = ({ children }) => (
  <thead className="bg-gray-50">
    {children}
  </thead>
);

const TableRow: React.FC<TableProps> = ({ children }) => (
  <tr className="border-b border-gray-200">
    {children}
  </tr>
);

const TableCell: React.FC<TableProps> = ({ children }) => (
  <td className="border border-gray-300 px-4 py-2">
    {children}
  </td>
);

const TableHeaderCell: React.FC<TableProps> = ({ children }) => (
  <th className="border border-gray-300 px-4 py-2 font-semibold text-left">
    {children}
  </th>
);

/**
 * MarkdownRenderer组件
 * 使用React.memo优化性能，避免流式更新时不必要的重渲染
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({
  content,
  isStreaming = false,
  className = '',
}) => {
  // 如果内容为空，返回空
  if (!content || typeof content !== 'string') {
    return null;
  }

  // 检查是否包含Markdown语法，如果没有则直接显示纯文本
  if (!hasMarkdownSyntax(content)) {
    return (
      <div className={`whitespace-pre-wrap break-words ${className}`}>
        {content}
      </div>
    );
  }

  // 流式渲染时修复语法
  const processedContent = isStreaming ? fixStreamingMarkdown(content) : content;

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeHighlight, { 
            highlight: hljs.highlight
          }]
        ]}
        components={{
          // 表格组件
          table: Table,
          thead: TableHead,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: TableRow,
          td: TableCell,
          th: TableHeaderCell,
          
          // 列表样式
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="ml-4">
              {children}
            </li>
          ),
          
          // 标题样式
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-3 mb-2 text-gray-900">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold mt-2 mb-1 text-gray-900">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-semibold mt-2 mb-1 text-gray-900">
              {children}
            </h6>
          ),
          
          // 引用样式
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 italic">
              {children}
            </blockquote>
          ),
          
          // 段落样式
          p: ({ children }) => (
            <p className="my-2 leading-relaxed">
              {children}
            </p>
          ),
          
          // 链接样式
          a: ({ children, href }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {children}
            </a>
          ),
          
          // 强调样式
          strong: ({ children }) => (
            <strong className="font-bold text-gray-900">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-700">
              {children}
            </em>
          ),
          
          // 删除线
          del: ({ children }) => (
            <del className="line-through text-gray-500">
              {children}
            </del>
          ),
          
          // 水平分割线
          hr: () => (
            <hr className="my-6 border-t border-gray-300" />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

export default MarkdownRenderer;