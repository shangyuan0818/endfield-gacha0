import React from 'react';
import DOMPurify from 'dompurify';

/**
 * 增强版 Markdown 渲染组件
 * 支持: 标题(#/##/###), 粗体(**), 斜体(*), 删除线(~~), 代码(`), 代码块(```),
 *       引用(>), 无序列表(-/*), 有序列表(1.), 链接([]()), 水平线(---), 换行
 * 使用 DOMPurify 防止 XSS 攻击
 */
const SimpleMarkdown = ({ content, className = '' }) => {
  if (!content) return null;

  // 配置 DOMPurify 允许的标签和属性
  const purifyConfig = {
    ALLOWED_TAGS: ['a', 'strong', 'em', 'code', 'br', 'del', 's'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  };

  // 安全地渲染 HTML
  const sanitizeHTML = (html) => DOMPurify.sanitize(html, purifyConfig);

  const renderMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let inUnorderedList = false;
    let inOrderedList = false;
    let inCodeBlock = false;
    let codeBlockContent = [];
    let codeBlockLang = '';
    let unorderedListItems = [];
    let orderedListItems = [];

    const processInline = (line) => {
      // 处理行内元素
      let result = line;

      // 先转义 HTML 特殊字符防止注入
      result = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // 链接 [text](url)
      result = result.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="font-bold text-amber-600 dark:text-yellow-400 border-b border-dashed border-amber-400 dark:border-yellow-400/50 hover:bg-amber-100 dark:hover:bg-yellow-400/10 transition-colors pb-0.5">$1</a>'
      );

      // 粗体 **text** 或 __text__
      result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-black text-slate-900 dark:text-zinc-100">$1</strong>');
      result = result.replace(/__([^_]+)__/g, '<strong class="font-black text-slate-900 dark:text-zinc-100">$1</strong>');

      // 删除线 ~~text~~
      result = result.replace(/~~([^~]+)~~/g, '<del class="line-through text-slate-400 dark:text-zinc-500">$1</del>');

      // 斜体 *text* 或 _text_
      result = result.replace(/\*([^*]+)\*/g, '<em class="italic text-slate-600 dark:text-zinc-400">$1</em>');
      result = result.replace(/_([^_]+)_/g, '<em class="italic text-slate-600 dark:text-zinc-400">$1</em>');

      // 行内代码 `code`
      result = result.replace(
        /`([^`]+)`/g,
        '<code class="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded-none text-xs font-mono text-pink-600 dark:text-pink-400">$1</code>'
      );

      return result;
    };

    const flushUnorderedList = () => {
      if (unorderedListItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-0.5 my-2 ml-2 marker:text-zinc-400 dark:marker:text-zinc-600">
            {unorderedListItems.map((item, i) => (
              <li key={i} className="text-slate-700 dark:text-zinc-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHTML(processInline(item)) }} />
            ))}
          </ul>
        );
        unorderedListItems = [];
      }
      inUnorderedList = false;
    };

    const flushOrderedList = () => {
      if (orderedListItems.length > 0) {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-0.5 my-2 ml-2 marker:text-zinc-400 dark:marker:text-zinc-600 marker:font-mono">
            {orderedListItems.map((item, i) => (
              <li key={i} className="text-slate-700 dark:text-zinc-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHTML(processInline(item)) }} />
            ))}
          </ol>
        );
        orderedListItems = [];
      }
      inOrderedList = false;
    };

    const flushCodeBlock = () => {
      if (codeBlockContent.length > 0) {
        elements.push(
          <pre key={`code-${elements.length}`} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 p-3 rounded-none my-2 overflow-x-auto text-xs font-mono">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        codeBlockLang = '';
      }
      inCodeBlock = false;
    };

    lines.forEach((line, index) => {
      // 代码块处理
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock();
        } else {
          flushUnorderedList();
          flushOrderedList();
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3);
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      const trimmedLine = line.trim();

      // 空行
      if (trimmedLine === '') {
        flushUnorderedList();
        flushOrderedList();
        return;
      }

      // 水平线 --- 或 ***
      if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
        flushUnorderedList();
        flushOrderedList();
        elements.push(
          <hr key={index} className="my-3 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
        );
        return;
      }

      // 一级标题 #
      if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('## ')) {
        flushUnorderedList();
        flushOrderedList();
        elements.push(
          <h2 key={index} className="font-black text-lg mt-4 mb-2 text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <span className="w-1 h-4 bg-endfield-yellow inline-block"></span>
            {trimmedLine.slice(2)}
          </h2>
        );
        return;
      }

      // 二级标题 ##
      if (trimmedLine.startsWith('## ')) {
        flushUnorderedList();
        flushOrderedList();
        elements.push(
          <h3 key={index} className="font-bold text-base mt-3 mb-1.5 text-slate-800 dark:text-zinc-200">
            {trimmedLine.slice(3)}
          </h3>
        );
        return;
      }

      // 三级标题 ###
      if (trimmedLine.startsWith('### ')) {
        flushUnorderedList();
        flushOrderedList();
        elements.push(
          <h4 key={index} className="font-bold text-sm mt-2 mb-1 text-slate-700 dark:text-zinc-300 uppercase tracking-wide opacity-90">
            {trimmedLine.slice(4)}
          </h4>
        );
        return;
      }

      // 四级标题 ####
      if (trimmedLine.startsWith('#### ')) {
        flushUnorderedList();
        flushOrderedList();
        elements.push(
          <h5 key={index} className="font-semibold mt-2 mb-1 text-slate-600 dark:text-zinc-400 text-xs">
            {trimmedLine.slice(5)}
          </h5>
        );
        return;
      }

      // 引用 >
      if (trimmedLine.startsWith('> ')) {
        flushUnorderedList();
        flushOrderedList();
        elements.push(
          <blockquote
            key={index}
            className="border-l-2 border-amber-400 dark:border-amber-600 pl-3 py-1.5 my-2 text-sm text-slate-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(processInline(trimmedLine.slice(2))) }}
          />
        );
        return;
      }

      // 无序列表 - 或 *
      if (trimmedLine.startsWith('- ') || (trimmedLine.startsWith('* ') && !trimmedLine.startsWith('**'))) {
        flushOrderedList();
        inUnorderedList = true;
        unorderedListItems.push(trimmedLine.slice(2));
        return;
      }

      // 有序列表 1. 2. 等
      const orderedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      if (orderedMatch) {
        flushUnorderedList();
        inOrderedList = true;
        orderedListItems.push(orderedMatch[2]);
        return;
      }

      // 普通段落
      flushUnorderedList();
      flushOrderedList();
      elements.push(
        <p
          key={index}
          className="my-1 text-sm leading-normal text-slate-700 dark:text-zinc-300"
          dangerouslySetInnerHTML={{ __html: sanitizeHTML(processInline(trimmedLine)) }}
        />
      );
    });

    // 处理最后的列表和代码块
    flushUnorderedList();
    flushOrderedList();
    flushCodeBlock();

    return elements;
  };

  return (
    <div className={`prose-sm ${className}`}>
      {renderMarkdown(content)}
    </div>
  );
};

export default SimpleMarkdown;
