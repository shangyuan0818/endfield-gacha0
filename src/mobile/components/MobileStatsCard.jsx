import React from 'react';

/**
 * 移动端统计卡片
 */
function MobileStatsCard({ title, value, subtitle, icon: Icon, color = 'yellow', className = '' }) {
  const colorClasses = {
    yellow: 'bg-endfield-yellow/10 text-endfield-yellow border-endfield-yellow/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  };

  return (
    <div className={`p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
          {subtitle && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 border ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileStatsCard;
