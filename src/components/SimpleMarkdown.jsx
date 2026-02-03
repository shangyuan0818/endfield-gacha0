import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

/**
 * Markdown 渲染组件 - Endfield 风格定制版
 * 基于 react-markdown + remark-gfm
 * 特点: 直角设计, 高对比度, 工业/科技感, Endfield Yellow (#FFFA00) 点缀
 */
const SimpleMarkdown = ({ content, className = '' }) => {
  if (!content) return null;

  // 自定义组件样式
  const components = {
    // 标题
    h1: ({ children }) => (
      <h1 className="font-black text-2xl mt-5 mb-2 text-white flex items-center gap-3 uppercase tracking-tight">
        <span className="w-1.5 h-7 bg-endfield-yellow inline-block"></span>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-black text-xl mt-4 mb-2 text-white flex items-center gap-3 uppercase tracking-tight">
        <span className="w-1.5 h-6 bg-endfield-yellow inline-block"></span>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-bold text-lg mt-3 mb-1.5 text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-1.5">
        <span className="w-1 h-1 bg-endfield-yellow inline-block"></span>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="font-bold text-base mt-2.5 mb-1 text-zinc-200 pl-2 border-l-2 border-zinc-700">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="font-semibold text-sm mt-2 mb-0.5 text-zinc-300">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="font-medium text-xs mt-1.5 mb-0.5 text-zinc-400 uppercase tracking-wider">
        {children}
      </h6>
    ),

    // 段落
    p: ({ children }) => (
      <p className="my-1 text-sm leading-6 text-zinc-300">
        {children}
      </p>
    ),

    // 链接
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-endfield-yellow hover:text-white hover:underline decoration-2 underline-offset-4 transition-colors duration-200"
      >
        {children}
      </a>
    ),

    // 图片 - 支持尺寸调整
    // 语法: ![alt](url "title =宽x高") 或 ![alt](url "=宽") 或 ![alt](url "=宽x高")
    // 示例: ![图片](url "=300") 宽300px, ![图片](url "=300x200") 宽300高200, ![图片](url "说明 =50%") 宽50%
    img: ({ src, alt, title }) => {
      let width, height, actualTitle;

      if (title) {
        // 解析尺寸: 支持 "=300", "=300x200", "=50%", "=50%x30%", "标题 =300"
        const sizeMatch = title.match(/=(\d+%?)(x(\d+%?))?$/);
        if (sizeMatch) {
          width = sizeMatch[1];
          height = sizeMatch[3];
          // 提取实际标题（去掉尺寸部分）
          actualTitle = title.replace(/\s*=\d+%?(x\d+%?)?$/, '').trim() || undefined;
        } else {
          actualTitle = title;
        }
      }

      // 构建样式
      const style = {};
      if (width) {
        style.width = width.includes('%') ? width : `${width}px`;
      }
      if (height) {
        style.height = height.includes('%') ? height : `${height}px`;
      }

      return (
        <img
          src={src}
          alt={alt}
          title={actualTitle}
          style={style}
          className={`${width ? '' : 'max-w-full'} h-auto rounded-none my-2 border border-zinc-700 bg-zinc-950`}
        />
      );
    },

    // 粗体
    strong: ({ children }) => (
      <strong className="font-bold text-zinc-100">{children}</strong>
    ),

    // 斜体
    em: ({ children }) => (
      <em className="italic text-zinc-400">{children}</em>
    ),

    // 删除线
    del: ({ children }) => (
      <del className="line-through text-zinc-500 decoration-zinc-600">{children}</del>
    ),

    // 行内代码
    code: ({ inline, className, children }) => {
      if (inline) {
        return (
          <code className="bg-[#1a1a1a] border border-zinc-700 px-1.5 py-0.5 rounded-none text-xs font-mono text-zinc-200">
            {children}
          </code>
        );
      }
      // 代码块内的 code 标签
      return (
        <code className="text-zinc-300 font-mono text-xs">
          {children}
        </code>
      );
    },

    // 代码块
    pre: ({ children }) => (
      <div className="relative my-4 group">
        <div className="relative border-l-2 border-endfield-yellow bg-[#0F0F0F] border-y border-r border-zinc-800 overflow-hidden">
          <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {children}
          </pre>
        </div>
      </div>
    ),

    // 引用
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-endfield-yellow pl-4 py-1 my-4 text-sm text-zinc-400 italic bg-transparent">
        {children}
      </blockquote>
    ),

    // 无序列表
    ul: ({ children }) => (
      <ul className="list-none space-y-2 my-3 ml-1">
        {children}
      </ul>
    ),

    // 有序列表
    ol: ({ children }) => (
      <ol className="list-decimal list-inside space-y-1 my-3 ml-2 text-zinc-300 marker:text-endfield-yellow/70 marker:font-mono marker:font-bold">
        {children}
      </ol>
    ),

    // 列表项
    li: ({ children, checked, ordered }) => {
      // 任务列表项
      if (checked !== null && checked !== undefined) {
        return (
          <li className="flex items-start gap-3 text-zinc-300 text-sm leading-relaxed group list-none">
            <span className={`flex items-center justify-center w-4 h-4 mt-0.5 border flex-shrink-0 transition-colors ${
              checked
                ? 'bg-endfield-yellow border-endfield-yellow text-black'
                : 'bg-transparent border-zinc-600 group-hover:border-zinc-500'
            }`}>
              {checked && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className={checked ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-300'}>
              {children}
            </span>
          </li>
        );
      }

      // 普通无序列表项
      if (!ordered) {
        return (
          <li className="flex items-start gap-2.5 text-zinc-300 text-sm leading-relaxed">
            <span className="w-1.5 h-1.5 bg-endfield-yellow mt-2 shrink-0 opacity-80"></span>
            <span>{children}</span>
          </li>
        );
      }

      // 有序列表项
      return (
        <li className="text-sm leading-relaxed pl-1">
          {children}
        </li>
      );
    },

    // 水平线
    hr: () => (
      <hr className="my-6 border-t border-zinc-800" />
    ),

    // 表格
    table: ({ children }) => (
      <div className="my-5 overflow-x-auto border border-zinc-800 bg-[#0F0F0F]">
        <table className="w-full border-collapse text-sm">
          {children}
        </table>
      </div>
    ),

    thead: ({ children }) => (
      <thead className="bg-zinc-900 border-b border-zinc-700">
        {children}
      </thead>
    ),

    tbody: ({ children }) => (
      <tbody>{children}</tbody>
    ),

    tr: ({ children }) => (
      <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
        {children}
      </tr>
    ),

    th: ({ children, style }) => {
      const align = style?.textAlign || 'left';
      return (
        <th className={`px-4 py-3 font-bold text-zinc-100 uppercase tracking-wider text-xs text-${align}`}>
          {children}
        </th>
      );
    },

    td: ({ children, style }) => {
      const align = style?.textAlign || 'left';
      return (
        <td className={`px-4 py-2.5 text-zinc-300 text-${align}`}>
          {children}
        </td>
      );
    },

    // 输入框（用于任务列表的复选框）
    input: ({ type, checked }) => {
      if (type === 'checkbox') {
        return null; // 我们在 li 中自定义渲染复选框
      }
      return <input type={type} checked={checked} readOnly />;
    },
  };

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default SimpleMarkdown;
