import React from 'react';
import { MobileGlassPanel } from './ux/MobilePrimitives.jsx';

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
    <MobileGlassPanel compact className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-1 text-sm text-slate-500 dark:text-zinc-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`rounded-[0.9rem] p-2 border ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </MobileGlassPanel>
  );
}

export default MobileStatsCard;
