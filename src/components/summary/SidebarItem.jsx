import React from 'react';

/**
 * 侧边栏选项组件
 * 用于数据源和卡池类型筛选的侧边栏按钮
 */
const SidebarItem = ({ label, icon: Icon, isActive, onClick, indent = false, count }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-3 text-sm transition-all flex items-center gap-3 relative group overflow-hidden ${
      indent ? 'pl-10' : ''
    } ${
      isActive
        ? 'bg-endfield-yellow text-black font-bold'
        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
    }`}
  >
    {/* 激活状态左侧装饰条 */}
    {isActive && (
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-black/20"></div>
    )}

    {/* 图标 */}
    {Icon && <Icon size={16} className={`transition-transform group-hover:scale-110 ${isActive ? 'text-black' : 'text-zinc-500 group-hover:text-zinc-300'}`} />}

    <span className="flex-1 tracking-wide">{label}</span>

    {/* 计数 */}
    {count !== undefined && (
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded-sm ${
        isActive
          ? 'bg-black/10 text-black/70'
          : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-400'
      }`}>
        {count.toLocaleString()}
      </span>
    )}

    {/* 悬停时的右侧箭头提示 */}
    {!isActive && (
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-endfield-yellow opacity-0 group-hover:opacity-100 transition-opacity"></div>
    )}
  </button>
);

export default SidebarItem;
