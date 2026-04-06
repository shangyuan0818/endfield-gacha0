import React from 'react';
import { AlertCircle, CheckCircle2, Copy, Download, Loader2, Share2 } from 'lucide-react';

const ACTION_LABELS = {
  share: '系统分享',
  download: '下载长图',
  'copy-image': '复制图片',
  'copy-text': '复制文本',
};

const ACTION_ICONS = {
  share: Share2,
  download: Download,
  'copy-image': Copy,
  'copy-text': Copy,
};

const PHASE_META = {
  running: {
    label: '处理中',
    containerClass:
      'border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100',
    iconBoxClass: 'border-amber-200 text-amber-700 dark:border-amber-500/40 dark:text-amber-200',
    badgeClass: 'text-amber-700/80 dark:text-amber-200/80',
    messageClass: 'text-amber-800 dark:text-amber-100',
    trackClass: 'bg-amber-200/60 dark:bg-amber-500/10',
    barClass: 'bg-amber-500 dark:bg-amber-300',
  },
  success: {
    label: '已完成',
    containerClass:
      'border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100',
    iconBoxClass: 'border-emerald-200 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-200',
    badgeClass: 'text-emerald-700/80 dark:text-emerald-200/80',
    messageClass: 'text-emerald-800 dark:text-emerald-100',
    trackClass: 'bg-emerald-200/60 dark:bg-emerald-500/10',
    barClass: 'bg-emerald-500 dark:bg-emerald-300',
  },
  error: {
    label: '失败',
    containerClass:
      'border-rose-200 bg-rose-50/90 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100',
    iconBoxClass: 'border-rose-200 text-rose-700 dark:border-rose-500/40 dark:text-rose-200',
    badgeClass: 'text-rose-700/80 dark:text-rose-200/80',
    messageClass: 'text-rose-800 dark:text-rose-100',
    trackClass: 'bg-rose-200/60 dark:bg-rose-500/10',
    barClass: 'bg-rose-500 dark:bg-rose-300',
  },
};

function ActionBadgeIcon({ action }) {
  const Icon = ACTION_ICONS[action] || Share2;
  return <Icon size={12} />;
}

function PhaseStatusIcon({ phase, size }) {
  if (phase === 'success') {
    return <CheckCircle2 size={size} />;
  }

  if (phase === 'error') {
    return <AlertCircle size={size} />;
  }

  return <Loader2 size={size} className="animate-spin" />;
}

const ShareActionStatus = ({ feedback, compact = false, className = '' }) => {
  if (!feedback || feedback.phase === 'idle' || !feedback.message) {
    return null;
  }

  const phaseMeta = PHASE_META[feedback.phase] || PHASE_META.running;
  const actionLabel = ACTION_LABELS[feedback.action] || '分享处理';
  const containerClassName = [
    'rounded-none border shadow-sm',
    compact ? 'px-3 py-2' : 'px-3 py-2.5',
    phaseMeta.containerClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="status" aria-live={feedback.phase === 'error' ? 'assertive' : 'polite'} className={containerClassName}>
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-none border ${phaseMeta.iconBoxClass}`}
        >
          <PhaseStatusIcon phase={feedback.phase} size={compact ? 14 : 16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] ${phaseMeta.badgeClass}`}
            >
              <ActionBadgeIcon action={feedback.action} />
              {actionLabel}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${phaseMeta.badgeClass}`}>
              {phaseMeta.label}
            </span>
          </div>
          <div className={`mt-1 text-xs font-medium leading-5 ${phaseMeta.messageClass}`}>{feedback.message}</div>
          <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${phaseMeta.trackClass}`}>
            {feedback.phase === 'running' ? (
              <div className={`h-full w-2/5 rounded-full ${phaseMeta.barClass} animate-pulse`} />
            ) : (
              <div className={`h-full w-full rounded-full ${phaseMeta.barClass}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareActionStatus;
