import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * 移动端图表容器（可折叠）
 */
function MobileChartContainer({ title, children, defaultExpanded = true, className = '' }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${className}`}>
      {/* 标题栏 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-4 py-3 touch-feedback"
      >
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {/* 图表内容 */}
      {isExpanded && (
        <div className="px-4 pb-4 animate-fade-in-fast">
          {children}
        </div>
      )}
    </div>
  );
}

export default MobileChartContainer;
