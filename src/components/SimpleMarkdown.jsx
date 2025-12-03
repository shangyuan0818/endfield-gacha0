import React from 'react';

/**
 * 简单的 Markdown 渲染组件
 * 支持: 标题(##), 粗体(**), 斜体(*), 代码(`), 引用(>), 列表(-), 链接([]()), 换行
 */
const SimpleMarkdown = ({ content, className = '' }) => {
  if (!content) return null;

  const renderMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let inList = false;
    let listItems = [];

    const processInline = (line) => {
      // 处理行内元素
      let result = line;

      // 链接 [text](url)
      result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline">$1</a>');

      // 粗体 **text**
      result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');

      // 斜体 *text*
      result = result.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

      // 行内代码 `code`
      result = result.replace(/`([^`]+)`/g, '<code class="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>');

      return result;
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
            {listItems.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: processInline(item) }} />
            ))}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // 空行
      if (trimmedLine === '') {
        flushList();
        return;
      }

      // 标题 ##
      if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h3 key={index} className="font-bold text-lg mt-4 mb-2 text-slate-800 dark:text-zinc-200">
            {trimmedLine.slice(3)}
          </h3>
        );
        return;
      }

      // 标题 ###
      if (trimmedLine.startsWith('### ')) {
        flushList();
        elements.push(
          <h4 key={index} className="font-bold mt-3 mb-1 text-slate-700 dark:text-zinc-300">
            {trimmedLine.slice(4)}
          </h4>
        );
        return;
      }

      // 引用 >
      if (trimmedLine.startsWith('> ')) {
        flushList();
        elements.push(
          <blockquote
            key={index}
            className="border-l-4 border-amber-400 dark:border-amber-600 pl-4 py-1 my-2 text-slate-600 dark:text-zinc-400 bg-amber-50/50 dark:bg-amber-900/10"
            dangerouslySetInnerHTML={{ __html: processInline(trimmedLine.slice(2)) }}
          />
        );
        return;
      }

      // 列表 - 或 *
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        inList = true;
        listItems.push(trimmedLine.slice(2));
        return;
      }

      // 普通段落
      flushList();
      elements.push(
        <p
          key={index}
          className="my-1"
          dangerouslySetInnerHTML={{ __html: processInline(trimmedLine) }}
        />
      );
    });

    // 处理最后的列表
    flushList();

    return elements;
  };

  return (
    <div className={`prose-sm ${className}`}>
      {renderMarkdown(content)}
    </div>
  );
};

export default SimpleMarkdown;
