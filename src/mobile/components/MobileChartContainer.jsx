import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * 移动端图表容器（可折叠）
 */
function MobileChartContainer({ title, children, defaultExpanded = true, className = '', headerRight = null }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`mobile-ux-card overflow-hidden ${className}`}>
      {/* 标题栏 */}
      <div className="flex items-center w-full px-4 py-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex min-h-7 items-center justify-between flex-1 touch-feedback"
        >
          <span className="text-[12px] font-black tracking-[0.08em] text-slate-700 dark:text-zinc-300">{title}</span>
        </button>
        <div className="flex items-center gap-2">
          {headerRight}
          <button onClick={() => setIsExpanded(!isExpanded)} className="touch-feedback rounded-full p-1 text-slate-500 transition-colors hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-200">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 图表内容 */}
      {isExpanded && (
        <div className="border-t border-zinc-200 px-4 pb-4 animate-fade-in-fast dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}

export default MobileChartContainer;
