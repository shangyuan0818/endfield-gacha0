import React from 'react';
import { MobileGlassPanel } from './ux/MobilePrimitives.jsx';

/**
 * 移动端保底进度条（纵向布局）
 */
function MobilePityProgress({ current, max, label, color = 'yellow', showPercentage = true }) {
  const percentage = Math.min((current / max) * 100, 100);

  const colorClasses = {
    yellow: 'bg-endfield-yellow',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    rainbow: 'rainbow-progress',
  };

  const bgClasses = {
    yellow: 'bg-endfield-yellow/20',
    blue: 'bg-blue-500/20',
    purple: 'bg-purple-500/20',
    rainbow: 'bg-zinc-300 dark:bg-zinc-700',
  };

  return (
    <MobileGlassPanel compact>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</span>
        <span className="text-sm text-slate-500 dark:text-zinc-500">
          {current} / {max}
        </span>
      </div>

      {/* 进度条 */}
      <div className={`h-3 ${bgClasses[color]} overflow-hidden rounded-full`}>
        <div
          className={`h-full transition-all duration-300 ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {showPercentage && (
        <p className="mt-1 text-right text-xs text-slate-500 dark:text-zinc-500">
          {percentage.toFixed(1)}%
        </p>
      )}
    </MobileGlassPanel>
  );
}

export default MobilePityProgress;
