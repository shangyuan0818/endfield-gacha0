import React from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function MobilePage({ children, animation = 'up', className = '', contentClassName = '' }) {
  return (
    <div className={cx('mobile-ux-page', animation === 'right' ? 'mobile-ux-page--right' : 'mobile-ux-page--up', className)}>
      <div className={cx('mobile-ux-page-content', contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function MobileStickyHeader({
  title,
  subtitle = '',
  actions = null,
  eyebrow = '',
  icon: Icon = null,
  leading = null,
  className = ''
}) {
  return (
    <div className={cx('mobile-ux-sticky', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
          <div className="min-w-0">
          {eyebrow ? (
            <div className="mobile-ux-eyebrow">
              {Icon ? <Icon size={12} className="shrink-0" /> : null}
              <span>{eyebrow}</span>
            </div>
          ) : null}
          <h1 className="mobile-ux-title">{title}</h1>
          {subtitle ? <p className="mobile-ux-subtitle">{subtitle}</p> : null}
        </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function MobileGlassPanel({
  children,
  className = '',
  accent = '',
  compact = false
}) {
  return (
    <div className={cx('mobile-glass-panel', compact ? 'p-4' : 'p-5', accent, className)}>
      {children}
    </div>
  );
}

export function MobileSectionTitle({
  title,
  subtitle = '',
  icon: Icon = null,
  trailing = null,
  className = ''
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon ? <Icon size={14} className="text-slate-500 dark:text-zinc-500" /> : null}
          <h2 className="text-sm font-black tracking-wide text-slate-900 dark:text-white">{title}</h2>
        </div>
        {subtitle ? <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function MobileMetricCard({
  label,
  value,
  hint = '',
  accent = 'text-slate-900 dark:text-white',
  icon: Icon = null,
  className = '',
  valueClassName = ''
}) {
  return (
    <MobileGlassPanel className={cx('relative overflow-hidden', className)} compact>
      {Icon ? <Icon size={40} className="absolute -right-3 -bottom-3 text-slate-300/40 dark:text-white/5" /> : null}
      <div className="relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">{label}</div>
        <div className={cx('mt-2 text-3xl font-black tracking-tight tabular-nums', accent, valueClassName)}>
          {value}
        </div>
        {hint ? <div className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">{hint}</div> : null}
      </div>
    </MobileGlassPanel>
  );
}

export function MobileActionButton({
  children,
  onClick,
  active = false,
  className = '',
  tone = 'default',
  type = 'button'
}) {
  const toneClass = tone === 'primary'
    ? 'bg-endfield-yellow text-black hover:bg-yellow-300'
    : 'mobile-ux-card-chip text-slate-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10';

  return (
    <button
      type={type}
      onClick={onClick}
      className={cx(
        'mobile-action-button touch-feedback',
        toneClass,
        active ? 'border-endfield-yellow/40 text-endfield-yellow' : '',
        className
      )}
    >
      {children}
    </button>
  );
}

export function MobileStatusBadge({ children, tone = 'default', className = '' }) {
  const toneClass = {
    default: 'border-zinc-200 bg-zinc-50 text-slate-600 dark:border-white/8 dark:bg-white/6 dark:text-zinc-300',
    warning: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
    danger: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
    accent: 'border-endfield-yellow/30 bg-endfield-yellow/10 text-endfield-yellow'
  }[tone] || 'border-zinc-200 bg-zinc-50 text-slate-600 dark:border-white/8 dark:bg-white/6 dark:text-zinc-300';

  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]', toneClass, className)}>
      {children}
    </span>
  );
}

export function MobilePillTabs({ options, value, onChange, className = '', compact = false }) {
  return (
    <div className={cx('mobile-pill-tabs', compact ? 'mobile-pill-tabs--compact' : '', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx('mobile-pill-tab', active ? 'mobile-pill-tab--active' : '')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function MobileChipRow({ children, className = '' }) {
  return (
    <div className={cx('mobile-chip-row', className)}>
      {children}
    </div>
  );
}

export function MobileDrawerSection({ title, children, className = '' }) {
  return (
    <div className={cx('space-y-2', className)}>
      <div className="px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default {
  MobileActionButton,
  MobileChipRow,
  MobileDrawerSection,
  MobileGlassPanel,
  MobileMetricCard,
  MobilePage,
  MobilePillTabs,
  MobileSectionTitle,
  MobileStatusBadge,
  MobileStickyHeader
};
