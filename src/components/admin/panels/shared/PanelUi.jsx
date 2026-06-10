import React from 'react';
import { CheckCircle2, ChevronRight, ShieldAlert } from 'lucide-react';

/**
 * 后台面板共享 UI 原语：与站点健康面板一致的现代工业风
 * （直角、左侧黄方块标题、状态点、入场动画、高信息密度）。
 */

const DOT_TONE_CLASS = {
  ok: 'bg-emerald-500 dark:bg-emerald-400',
  notice: 'bg-blue-500 dark:bg-blue-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-500 dark:bg-red-400',
  unknown: 'bg-zinc-400 dark:bg-zinc-600',
};

export function StatusDot({ tone = 'unknown', pulse = false, className = '' }) {
  return (
    <span className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`}>
      {pulse ? (
        <span className={`absolute inset-0 animate-ping opacity-60 motion-reduce:hidden ${DOT_TONE_CLASS[tone] || DOT_TONE_CLASS.unknown}`}></span>
      ) : null}
      <span className={`relative inline-flex h-2.5 w-2.5 ${DOT_TONE_CLASS[tone] || DOT_TONE_CLASS.unknown}`}></span>
    </span>
  );
}

export function BooleanBadge({ value, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs transition-colors ${
      value
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
        : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400'
    }`}
    >
      {value ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
      {label}
    </span>
  );
}

export function PanelSection({ title, icon: Icon, action, children, delay = 0, bodyClassName = 'p-3' }) {
  return (
    <section
      className="animate-fade-in-up border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-200">
          <span className="h-3 w-1 bg-amber-500 dark:bg-endfield-yellow" aria-hidden="true"></span>
          {Icon ? React.createElement(Icon, { size: 14, className: 'text-amber-500 dark:text-endfield-yellow' }) : null}
          <span className="uppercase tracking-wider">{title}</span>
        </div>
        {action}
      </div>
      <div className={bodyClassName}>
        {children}
      </div>
    </section>
  );
}

const STAT_TONE_CLASS = {
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
  notice: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
  default: 'border-zinc-200 bg-zinc-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200',
};

const STAT_ACCENT_CLASS = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  notice: 'bg-blue-500',
  default: 'bg-zinc-300 dark:bg-zinc-700',
};

export function StatCard({ label, value, subtext, tone = 'default', onClick, delay = 0 }) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group animate-fade-in-up-small relative overflow-hidden border p-2.5 text-left transition-all duration-200 ${STAT_TONE_CLASS[tone] || STAT_TONE_CLASS.default} ${
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:brightness-[0.98] motion-reduce:hover:translate-y-0 dark:hover:brightness-110'
          : ''
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`absolute left-0 top-0 h-0.5 w-6 transition-all duration-300 group-hover:w-10 ${STAT_ACCENT_CLASS[tone] || STAT_ACCENT_CLASS.default}`} aria-hidden="true"></span>
      <div className="flex items-center justify-between gap-2 text-[11px] text-current opacity-70">
        <span className="truncate">{label}</span>
        {onClick ? <ChevronRight size={11} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-70" /> : null}
      </div>
      <div className="mt-1.5 font-mono text-xl font-semibold leading-none tracking-tight">{value}</div>
      {subtext ? <div className="mt-1.5 text-[11px] leading-4 text-current opacity-75">{subtext}</div> : null}
    </Component>
  );
}

export function PanelToolbarButton({ children, onClick, disabled, tone = 'default', type = 'button', className = '', ...rest }) {
  const toneClass = tone === 'primary'
    ? 'border-transparent bg-slate-900 text-white hover:bg-black dark:bg-endfield-yellow dark:text-black dark:hover:bg-yellow-300'
    : tone === 'danger'
      ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30'
      : 'border-zinc-300 text-slate-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${toneClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
