import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Mail,
  RefreshCw,
  ShieldAlert,
  TimerReset,
  Users,
} from 'lucide-react';
import { loadSiteHealth } from '../../../services/admin/siteHealthService.js';

function formatDateTime(value) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatAge(value, nowValue) {
  if (!value) return '无时间';
  const timestamp = new Date(value).getTime();
  const now = nowValue ? new Date(nowValue).getTime() : Date.now();
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return '时间异常';

  const diffMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  return `${days} 天前`;
}

function formatDurationMs(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 0) return '未记录';
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  const seconds = durationMs / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
}

function valueFromCounts(counts, key) {
  return Number(counts?.[key] || 0);
}

function countsToText(counts, labels) {
  if (!counts || typeof counts !== 'object') return '无';
  return labels
    .map(({ key, label }) => `${label} ${valueFromCounts(counts, key)}`)
    .join(' / ');
}

// 与服务端 getFreshnessLevel 的 24h / 72h 阈值保持一致
function getFreshnessTone(value, nowValue, { noticeAfterHours = 24, warningAfterHours = 72 } = {}) {
  if (!value) return 'unknown';
  const timestamp = new Date(value).getTime();
  const now = nowValue ? new Date(nowValue).getTime() : Date.now();
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return 'unknown';
  const hours = Math.max(0, now - timestamp) / 3600000;
  if (hours < noticeAfterHours) return 'ok';
  if (hours < warningAfterHours) return 'notice';
  return 'warning';
}

function getStatusMeta(level) {
  switch (level) {
    case 'ok':
      return {
        label: '运行正常',
        className: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
        accentClassName: 'border-l-emerald-500 dark:border-l-emerald-400',
        dotTone: 'ok',
        icon: CheckCircle2,
      };
    case 'notice':
      return {
        label: '有待处理事项',
        className: 'border-blue-300/70 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
        accentClassName: 'border-l-blue-500 dark:border-l-blue-400',
        dotTone: 'notice',
        icon: Activity,
      };
    default:
      return {
        label: '需要关注',
        className: 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
        accentClassName: 'border-l-amber-500 dark:border-l-amber-400',
        dotTone: 'warning',
        icon: AlertTriangle,
      };
  }
}

function getCronStatusMeta(status) {
  switch (status) {
    case 'ok':
      return { label: '已按预期执行', tone: 'default' };
    case 'pending':
      return { label: '等待执行', tone: 'notice' };
    case 'missed':
      return { label: '已错过预期时间', tone: 'warning' };
    default:
      return { label: '未记录', tone: 'default' };
  }
}

function getPublicAnalyticsStatusMeta(level) {
  switch (level) {
    case 'ok':
      return { label: '近期已刷新', tone: 'default' };
    case 'notice':
      return { label: '可能不是最新', tone: 'notice' };
    case 'warning':
      return { label: '需要刷新或检查', tone: 'warning' };
    default:
      return { label: '无法确认', tone: 'warning' };
  }
}

function getWorkbenchActionMeta(severity) {
  switch (severity) {
    case 'danger':
      return {
        label: '优先处理',
        className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
        iconClassName: 'text-red-500',
        icon: AlertTriangle,
      };
    case 'warning':
      return {
        label: '需要检查',
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200',
        iconClassName: 'text-amber-500',
        icon: ShieldAlert,
      };
    default:
      return {
        label: '待处理',
        className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
        iconClassName: 'text-blue-500',
        icon: Activity,
      };
  }
}

const DOT_TONE_CLASS = {
  ok: 'bg-emerald-500 dark:bg-emerald-400',
  notice: 'bg-blue-500 dark:bg-blue-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-500 dark:bg-red-400',
  unknown: 'bg-zinc-400 dark:bg-zinc-600',
};

function StatusDot({ tone = 'unknown', pulse = false, className = '' }) {
  return (
    <span className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`}>
      {pulse ? (
        <span className={`absolute inset-0 animate-ping opacity-60 motion-reduce:hidden ${DOT_TONE_CLASS[tone] || DOT_TONE_CLASS.unknown}`}></span>
      ) : null}
      <span className={`relative inline-flex h-2.5 w-2.5 ${DOT_TONE_CLASS[tone] || DOT_TONE_CLASS.unknown}`}></span>
    </span>
  );
}

function BooleanBadge({ value, label }) {
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

function Section({ title, icon: Icon, action, children, delay = 0 }) {
  return (
    <section
      className="animate-fade-in-up border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-200">
          <span className="h-3 w-1 bg-amber-500 dark:bg-endfield-yellow" aria-hidden="true"></span>
          {React.createElement(Icon, { size: 14, className: 'text-amber-500 dark:text-endfield-yellow' })}
          <span className="uppercase tracking-wider">{title}</span>
        </div>
        {action}
      </div>
      <div className="p-3">
        {children}
      </div>
    </section>
  );
}

function StatCard({ label, value, subtext, tone = 'default', onClick, delay = 0 }) {
  const toneClass = {
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
    notice: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
    default: 'border-zinc-200 bg-zinc-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200',
  }[tone];
  const accentClass = {
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    notice: 'bg-blue-500',
    default: 'bg-zinc-300 dark:bg-zinc-700',
  }[tone];
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group animate-fade-in-up-small relative overflow-hidden border p-2.5 text-left transition-all duration-200 ${toneClass} ${
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:brightness-[0.98] motion-reduce:hover:translate-y-0 dark:hover:brightness-110'
          : ''
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`absolute left-0 top-0 h-0.5 w-6 transition-all duration-300 group-hover:w-10 ${accentClass}`} aria-hidden="true"></span>
      <div className="flex items-center justify-between gap-2 text-[11px] text-current opacity-70">
        <span className="truncate">{label}</span>
        {onClick ? <ChevronRight size={11} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-70" /> : null}
      </div>
      <div className="mt-1.5 font-mono text-xl font-semibold leading-none tracking-tight">{value}</div>
      {subtext ? <div className="mt-1.5 text-[11px] leading-4 text-current opacity-75">{subtext}</div> : null}
    </Component>
  );
}

function WorkbenchActionList({ workbench, onNavigate, generatedAt }) {
  const actions = Array.isArray(workbench?.actions) ? workbench.actions : [];

  if (!actions.length) {
    return (
      <Section title="今日处理清单" icon={CheckCircle2} delay={60}>
        <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <StatusDot tone="ok" />
          当前没有需要立即处理的事项。可以继续查看下方更新时间、缓存和队列状态。
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="今日处理清单"
      icon={Bell}
      delay={60}
      action={(
        <div className="hidden items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 sm:flex">
          <span className="flex items-center gap-1.5"><StatusDot tone="danger" />优先 {workbench?.countsBySeverity?.danger || 0}</span>
          <span className="flex items-center gap-1.5"><StatusDot tone="warning" />检查 {workbench?.countsBySeverity?.warning || 0}</span>
          <span className="flex items-center gap-1.5"><StatusDot tone="notice" />待处理 {workbench?.countsBySeverity?.notice || 0}</span>
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {actions.map((action, index) => {
          const meta = getWorkbenchActionMeta(action.severity);
          const Icon = meta.icon;
          const canNavigate = Boolean(action.target && onNavigate);
          const Component = canNavigate ? 'button' : 'div';

          return (
            <Component
              key={action.id}
              type={canNavigate ? 'button' : undefined}
              onClick={canNavigate ? () => onNavigate(action.target) : undefined}
              className={`animate-fade-in-up-small w-full border p-2.5 text-left transition-all duration-200 ${meta.className} ${
                canNavigate
                  ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0'
                  : ''
              }`}
              style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  <Icon size={16} className={meta.iconClassName} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{action.title}</span>
                    <span className="border border-current/20 px-1.5 py-0.5 text-[10px] opacity-80">
                      {meta.label}
                    </span>
                    <span className="text-[11px] opacity-70">数量 {action.count}</span>
                    {action.updatedAt ? <span className="text-[11px] opacity-60">{formatAge(action.updatedAt, generatedAt)}</span> : null}
                  </div>
                  <div className="mt-1 text-xs leading-4 opacity-85">{action.description}</div>
                </div>
                {canNavigate ? <ChevronRight size={14} className="mt-0.5 shrink-0 opacity-60" /> : null}
              </div>
            </Component>
          );
        })}
      </div>
    </Section>
  );
}

function FreshnessRow({ item, generatedAt }) {
  const latest = item?.latest || {};
  const title = latest.title || latest.name || latest.label || latest.key || latest.poolId || latest.id || item?.table || '无记录';
  const time = item?.latestAt || latest.updatedAt || latest.publishedAt || latest.startTime || null;
  const tone = item?.ok === false ? 'danger' : getFreshnessTone(time, generatedAt);

  return (
    <div className="group flex items-start justify-between gap-3 border-b border-zinc-100 py-2 transition-colors last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/30">
      <div className="flex min-w-0 items-start gap-2.5">
        <StatusDot tone={tone} pulse={tone === 'warning' || tone === 'danger'} className="mt-1" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-700 dark:text-zinc-200">{item?.label || item?.key}</span>
            {item?.ok === false ? (
              <span className="border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">读取失败</span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">{item?.error || title}</div>
        </div>
      </div>
      <div className="shrink-0 text-right text-[11px] text-slate-400 dark:text-zinc-500">
        <div className="font-mono">{formatAge(time, generatedAt)}</div>
        <div className="mt-0.5">{formatDateTime(time)}</div>
      </div>
    </div>
  );
}

function JobHealthList({ jobs = [], generatedAt }) {
  if (!jobs.length) {
    return (
      <div className="border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
        暂无任务级健康采样。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job, index) => {
        const failing = Number(job.consecutiveFailureCount || 0) > 0;
        const tone = failing ? 'warning' : job.latestStatus === 'success' ? 'ok' : 'unknown';

        return (
          <div
            key={job.jobId}
            className="animate-fade-in-up-small grid grid-cols-1 gap-1.5 border border-zinc-100 px-2.5 py-1.5 text-[11px] transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700 md:grid-cols-[minmax(0,1fr)_auto]"
            style={{ animationDelay: `${Math.min(index, 5) * 40}ms` }}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusDot tone={tone} pulse={failing} />
                <span className="font-medium text-slate-700 dark:text-zinc-200">{job.jobLabel || job.jobId}</span>
                {failing ? (
                  <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                    连续失败 {job.consecutiveFailureCount}
                  </span>
                ) : null}
                {job.latestFailureType ? (
                  <span className="text-slate-400 dark:text-zinc-500">{job.latestFailureType}</span>
                ) : null}
                <span className="text-slate-400 dark:text-zinc-500">成功 {formatAge(job.latestSuccessAt, generatedAt)}</span>
                <span className="text-slate-400 dark:text-zinc-500">失败 {formatAge(job.latestFailureAt, generatedAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-slate-400 dark:text-zinc-500 md:justify-end">
              <span>p95 {formatDurationMs(job.p95DurationMs)}</span>
              <span>最近 {formatDurationMs(job.latestDurationMs)}</span>
              <span>采样 {job.sampled || 0}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WarningList({ warnings = [] }) {
  if (!warnings.length) return null;

  return (
    <div className="animate-fade-in-up border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle size={16} />
        检查告警
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {warnings.slice(0, 8).map((warning, index) => (
          <div key={`${warning}-${index}`} className="break-all">{warning}</div>
        ))}
      </div>
      {warnings.length > 8 ? (
        <div className="mt-2 text-xs">另有 {warnings.length - 8} 条告警已折叠。</div>
      ) : null}
    </div>
  );
}

export default function SiteHealthPanel({ showToast, onNavigate }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextHealth = await loadSiteHealth();
      setHealth(nextHealth);
    } catch (refreshError) {
      const message = refreshError?.message || '站点健康状态读取失败';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const statusMeta = getStatusMeta(health?.overall?.level);
  const StatusIcon = statusMeta.icon;
  const generatedAt = health?.generatedAt;
  const queueStats = useMemo(() => {
    const recovery = Number(health?.queues?.accountRecovery?.pending || 0);
    const developerApi = Number(health?.queues?.developerApi?.pending || 0);
    const tickets = Number(health?.queues?.tickets?.open || 0);
    const urgentTickets = Number(health?.queues?.tickets?.urgentOpen || 0);
    return { recovery, developerApi, tickets, urgentTickets };
  }, [health]);
  const officialIdStats = health?.dataReadiness?.officialId || {};
  const officialIdBacklog = Number(officialIdStats.total || 0);
  const mailConfig = health?.mail?.config || {};
  const mailFailed = valueFromCounts(health?.mail?.outbox?.countsByStatus, 'failed');
  const mailDue = Number(health?.mail?.outbox?.dueQueued || 0);
  const opsFailures = valueFromCounts(health?.ops?.countsByStatus, 'failure');
  const opsHealth = health?.ops?.health || {};
  const opsCron = health?.ops?.cron || {};
  const opsMissedSchedules = Number(opsCron.missedCount || 0);
  const opsMaxConsecutiveFailures = Number(opsHealth.maxConsecutiveFailures || 0);
  const publicAnalytics = health?.publicCache?.analytics || {};
  const publicAnalyticsMeta = getPublicAnalyticsStatusMeta(publicAnalytics.level);
  const attentionCount = Number(health?.overall?.attentionCount || 0);

  return (
    <div className="space-y-3">
      <div className={`animate-fade-in-up flex flex-wrap items-center justify-between gap-3 border border-l-4 bg-white px-3 py-2.5 shadow-sm dark:bg-zinc-900 ${statusMeta.accentClassName} ${statusMeta.className}`}>
        <div className="flex min-w-0 items-center gap-3">
          <StatusDot tone={statusMeta.dotTone} pulse={statusMeta.dotTone !== 'ok'} />
          <StatusIcon size={20} className="shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold leading-tight">{health?.overall?.label || statusMeta.label}</div>
            <div className="mt-0.5 truncate text-xs opacity-75">
              集中查看站点内容更新、公共缓存、自动化和邮件队列状态
              {generatedAt ? ` · 生成于 ${formatDateTime(generatedAt)}` : ''}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-sm">
            待关注 <span className="font-mono text-lg font-semibold">{attentionCount}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-current/30 bg-white/60 px-3 py-2 text-sm transition-all hover:bg-white disabled:opacity-50 dark:bg-zinc-900/60 dark:hover:bg-zinc-800"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </div>

      {error ? (
        <div className="animate-fade-in-up-small border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading && !health ? (
        <div className="flex flex-col items-center justify-center gap-3 border border-zinc-200 py-16 text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-xs uppercase tracking-widest">正在读取站点健康数据</span>
        </div>
      ) : health ? (
        <>
          <WorkbenchActionList
            workbench={health.workbench}
            onNavigate={onNavigate}
            generatedAt={generatedAt}
          />

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="自动化失败"
              value={opsFailures + opsMissedSchedules}
              subtext={opsMissedSchedules > 0
                ? `定时任务已错过 ${opsMissedSchedules} 项`
                : opsMaxConsecutiveFailures > 0
                ? `${opsHealth.worstJobLabel || opsHealth.worstJobId || '任务'} 连续失败 ${opsMaxConsecutiveFailures} 次`
                : countsToText(health?.ops?.countsByStatus, [
                  { key: 'success', label: '成功' },
                  { key: 'failure', label: '失败' },
                  { key: 'skipped', label: '跳过' },
                ])}
              tone={opsMissedSchedules > 0 || opsMaxConsecutiveFailures > 0 || opsFailures > 0 ? 'warning' : 'default'}
              onClick={onNavigate ? () => onNavigate('automation') : undefined}
              delay={0}
            />
            <StatCard
              label="待处理工单"
              value={queueStats.tickets}
              subtext={`紧急 ${queueStats.urgentTickets}`}
              tone={queueStats.urgentTickets > 0 ? 'danger' : queueStats.tickets > 0 ? 'notice' : 'default'}
              onClick={onNavigate ? () => onNavigate('tickets') : undefined}
              delay={40}
            />
            <StatCard
              label="账号恢复"
              value={queueStats.recovery}
              subtext="待人工核验 / 邮件失败回落"
              tone={queueStats.recovery > 0 ? 'notice' : 'default'}
              onClick={onNavigate ? () => onNavigate('accountRecovery') : undefined}
              delay={80}
            />
            <StatCard
              label="开发者 API"
              value={queueStats.developerApi}
              subtext="待审核申请"
              tone={queueStats.developerApi > 0 ? 'notice' : 'default'}
              onClick={onNavigate ? () => onNavigate('developerApi') : undefined}
              delay={120}
            />
            <StatCard
              label="邮件队列"
              value={mailDue + mailFailed}
              subtext={`到期 ${mailDue} / 失败 ${mailFailed}`}
              tone={mailFailed > 0 ? 'warning' : mailDue > 0 ? 'notice' : 'default'}
              onClick={onNavigate ? () => onNavigate('mailStatus') : undefined}
              delay={160}
            />
            <StatCard
              label="官方 ID 待处理"
              value={officialIdBacklog}
              subtext={`角色 ${officialIdStats.characterCount || 0} / 武器 ${officialIdStats.weaponCount || 0} / 卡池 ${officialIdStats.poolCount || 0}`}
              tone={officialIdBacklog > 0 ? 'warning' : 'default'}
              onClick={onNavigate ? () => onNavigate(Number(officialIdStats.poolCount || 0) > 0 ? 'pools' : 'characters') : undefined}
              delay={200}
            />
          </div>

          <WarningList warnings={health.warnings || []} />

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Section title="数据源新鲜度" icon={Bell} delay={100}>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(health.content?.items || []).map((item) => (
                  <FreshnessRow key={item.key || item.table} item={item} generatedAt={generatedAt} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 dark:text-zinc-500">
                {health.content?.latestAt ? (
                  <span>最近内容变更：{formatDateTime(health.content.latestAt)}</span>
                ) : <span></span>}
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5"><StatusDot tone="ok" />24h 内</span>
                  <span className="flex items-center gap-1.5"><StatusDot tone="notice" />72h 内</span>
                  <span className="flex items-center gap-1.5"><StatusDot tone="warning" />更早</span>
                </span>
              </div>
            </Section>

            <Section title="公共缓存与聚合" icon={Database} delay={140}>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <StatCard
                    label="公共统计状态"
                    value={publicAnalyticsMeta.label}
                    subtext={`最近刷新 ${formatAge(publicAnalytics.latestAt, generatedAt)}`}
                    tone={publicAnalyticsMeta.tone}
                  />
                  <StatCard
                    label="缓存采样行"
                    value={publicAnalytics.sampledRows || 0}
                    subtext={`卡池 ${publicAnalytics.analytics?.sampledRows || 0} / 趋势 ${publicAnalytics.trends?.sampledRows || 0}`}
                    tone={Number(publicAnalytics.sampledRows || 0) > 0 ? 'default' : 'notice'}
                  />
                  <StatCard
                    label="样本抽数"
                    value={Number(publicAnalytics.analytics?.totalPullsSample || 0).toLocaleString('zh-CN')}
                    subtext={(publicAnalytics.sourceVersions || []).slice(0, 2).join(', ') || '未记录 source version'}
                    tone="default"
                  />
                </div>
                <div className="border border-zinc-100 p-2.5 text-xs transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700 dark:text-zinc-200">公共缓存版本</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                      {health.publicCache?.epoch?.cacheVersion || '未记录'}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-1 gap-1 text-[11px] text-slate-500 dark:text-zinc-500 md:grid-cols-3">
                    <div>范围：{health.publicCache?.epoch?.scope || '未记录'}</div>
                    <div>原因：{health.publicCache?.epoch?.reason || '未记录'}</div>
                    <div>更新：{formatDateTime(health.publicCache?.epoch?.updatedAt)}</div>
                  </div>
                </div>
                {(publicAnalytics.warnings || []).length ? (
                  <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                    {(publicAnalytics.warnings || []).slice(0, 3).join(' / ')}
                  </div>
                ) : null}
                {(health.publicCache?.aggregates || []).map((item) => (
                  <div key={item.table || item.key || item.label} className="border border-zinc-100 p-2.5 text-xs transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-zinc-200">
                        <StatusDot tone={item.ok === false ? 'danger' : getFreshnessTone(item.latestAt, generatedAt)} />
                        {item.label || item.key}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">{formatAge(item.latestAt, generatedAt)}</span>
                    </div>
                    {item.ok === false ? (
                      <div className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">{item.error}</div>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
                        <span>{item.latest?.poolId || item.latest?.metric || 'latest'} · {formatDateTime(item.latestAt)}</span>
                        <span>采样 {item.sampledRows || 0} 行 · {(item.sourceVersions || []).slice(0, 2).join(', ') || '未记录版本'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="运营自动化"
              icon={Bot}
              delay={180}
              action={onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate('automation')}
                  className="text-xs text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  查看自动化
                </button>
              ) : null}
            >
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <StatCard label="成功" value={valueFromCounts(health.ops?.countsByStatus, 'success')} subtext="最近采样" />
                <StatCard
                  label="连续失败"
                  value={opsMaxConsecutiveFailures}
                  subtext={opsHealth.worstJobLabel || '按任务统计'}
                  tone={opsMaxConsecutiveFailures > 0 ? 'warning' : 'default'}
                />
                <StatCard
                  label="p95 耗时"
                  value={formatDurationMs(opsHealth.p95DurationMs)}
                  subtext={`样本 ${opsHealth.sampledDurations || 0}`}
                  tone={Number(opsHealth.p95DurationMs || 0) > 60000 ? 'warning' : 'default'}
                />
                <StatCard
                  label="定时错过"
                  value={opsMissedSchedules}
                  subtext={`下次定时 ${formatAge(opsCron.nextExpectedAt, generatedAt) === '无时间' ? '未记录' : formatDateTime(opsCron.nextExpectedAt)}`}
                  tone={opsMissedSchedules > 0 ? 'warning' : 'default'}
                />
              </div>

              <div className="mt-3 space-y-2 border border-zinc-100 px-3 py-2 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium uppercase tracking-wider">任务健康明细</span>
                  <span>
                    最近成功 {formatAge(opsHealth.latestSuccessAt, generatedAt)} · 最近失败 {formatAge(opsHealth.latestFailureAt, generatedAt)}
                  </span>
                </div>
                <JobHealthList jobs={opsHealth.jobs || []} generatedAt={generatedAt} />
              </div>

              {(opsCron.schedules || []).length ? (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">定时计划</div>
                  {opsCron.schedules.map((schedule) => {
                    const meta = getCronStatusMeta(schedule.status);
                    return (
                      <div
                        key={schedule.id}
                        className="grid grid-cols-1 gap-2 border border-zinc-100 px-3 py-2 text-xs transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700 md:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusDot tone={meta.tone === 'warning' ? 'warning' : meta.tone === 'notice' ? 'notice' : 'ok'} pulse={meta.tone === 'warning'} />
                            <span className="font-medium text-slate-700 dark:text-zinc-200">{schedule.label}</span>
                            <span className={`border px-1.5 py-0.5 ${
                              meta.tone === 'warning'
                                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200'
                                : meta.tone === 'notice'
                                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                                : 'border-zinc-200 bg-zinc-50 text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400'
                            }`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="mt-1 text-slate-500 dark:text-zinc-500">
                            {schedule.scheduleText}，宽限 {schedule.graceMinutes} 分钟
                          </div>
                        </div>
                        <div className="text-left text-slate-400 dark:text-zinc-500 md:text-right">
                          <div>上次预期：{formatDateTime(schedule.lastExpectedAt)}</div>
                          <div>最近执行：{formatDateTime(schedule.latestCronAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">最近运行</div>
                {(health.ops?.latestRuns || []).slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-start justify-between gap-3 border border-zinc-100 px-3 py-2 text-xs transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-zinc-200">
                        <StatusDot tone={run.presentationStatus === 'success' || run.status === 'success' ? 'ok' : run.presentationStatus === 'partial' ? 'notice' : 'warning'} />
                        {run.jobLabel || run.jobId}
                      </div>
                      <div className="mt-1 truncate text-slate-500 dark:text-zinc-500">
                        {run.error || run.failureType || run.triggerType || '无错误'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-slate-400 dark:text-zinc-500">
                      <div>{run.presentationStatus || run.status}</div>
                      <div className="font-mono">{formatDurationMs(run.durationMs)} · {formatAge(run.updatedAt, generatedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <div className="space-y-3">
              <Section
                title="新版本数据准备"
                icon={ShieldAlert}
                delay={220}
                action={onNavigate ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onNavigate('characters')}
                      className="text-xs text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                    >
                      角色管理
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('pools')}
                      className="text-xs text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                    >
                      卡池管理
                    </button>
                  </div>
                ) : null}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <StatCard
                    label="角色占位 ID"
                    value={officialIdStats.characterCount || 0}
                    subtext={`采样角色/武器 ${officialIdStats.sampledCharacters || 0}`}
                    tone={Number(officialIdStats.characterCount || 0) > 0 ? 'warning' : 'default'}
                    onClick={onNavigate ? () => onNavigate('characters') : undefined}
                  />
                  <StatCard
                    label="武器占位 ID"
                    value={officialIdStats.weaponCount || 0}
                    subtext="等待官方 ID 后回填"
                    tone={Number(officialIdStats.weaponCount || 0) > 0 ? 'warning' : 'default'}
                    onClick={onNavigate ? () => onNavigate('characters') : undefined}
                  />
                  <StatCard
                    label="卡池占位 ID"
                    value={officialIdStats.poolCount || 0}
                    subtext={`采样卡池 ${officialIdStats.sampledPools || 0}`}
                    tone={Number(officialIdStats.poolCount || 0) > 0 ? 'warning' : 'default'}
                    onClick={onNavigate ? () => onNavigate('pools') : undefined}
                  />
                </div>
                {officialIdBacklog > 0 ? (
                  <div className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                    仍有手动占位 ID 未回填。新版本数据上线前，先确认官方 ID 或在迁移计划里人工指定映射；不要直接删除占位行。
                  </div>
                ) : (
                  <div className="mt-4 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                    当前采样范围内没有手动占位 ID。
                  </div>
                )}
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="border border-zinc-100 p-3 text-xs dark:border-zinc-800">
                    <div className="mb-2 font-medium text-slate-700 dark:text-zinc-200">角色 / 武器样本</div>
                    {(officialIdStats.samples?.characters || []).length ? (
                      <div className="space-y-1">
                        {officialIdStats.samples.characters.slice(0, 4).map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 text-slate-500 dark:text-zinc-500">
                            <span className="min-w-0 truncate">{item.name || item.id}</span>
                            <span className="shrink-0 font-mono">{item.type}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 dark:text-zinc-500">暂无待处理样本</div>
                    )}
                  </div>
                  <div className="border border-zinc-100 p-3 text-xs dark:border-zinc-800">
                    <div className="mb-2 font-medium text-slate-700 dark:text-zinc-200">卡池样本</div>
                    {(officialIdStats.samples?.pools || []).length ? (
                      <div className="space-y-1">
                        {officialIdStats.samples.pools.slice(0, 4).map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 text-slate-500 dark:text-zinc-500">
                            <span className="min-w-0 truncate">{item.name || item.id}</span>
                            <span className="shrink-0 font-mono">{item.type || 'unknown'}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 dark:text-zinc-500">暂无待处理样本</div>
                    )}
                  </div>
                </div>
              </Section>

              <Section
                title="邮件与待处理队列"
                icon={Mail}
                delay={260}
                action={onNavigate ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('mailStatus')}
                    className="text-xs text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                  >
                    查看邮件状态
                  </button>
                ) : null}
              >
                <div className="flex flex-wrap gap-2">
                  <BooleanBadge value={mailConfig.workerEnabled === true} label="队列处理器" />
                  <BooleanBadge value={mailConfig.killSwitch === false} label="紧急停发已关闭" />
                  <BooleanBadge value={mailConfig.dryRun === false} label="真实发信" />
                  <BooleanBadge value={mailConfig.stalwartSmtpConfigured === true} label="Stalwart SMTP" />
                  <BooleanBadge value={mailConfig.deliveryFeedbackSecretConfigured === true} label="反馈 Secret" />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <StatCard
                    label="Outbox"
                    value={health.mail?.outbox?.sampled || 0}
                    subtext={`queued ${valueFromCounts(health.mail?.outbox?.countsByStatus, 'queued')} / sent ${valueFromCounts(health.mail?.outbox?.countsByStatus, 'sent')}`}
                    tone={mailFailed > 0 ? 'warning' : 'default'}
                  />
                  <StatCard
                    label="Suppression"
                    value={health.mail?.suppression?.active || 0}
                    subtext={(health.mail?.suppression?.domains || []).slice(0, 2).join(', ') || '无活跃域名暂停'}
                    tone={Number(health.mail?.suppression?.active || 0) > 0 ? 'warning' : 'default'}
                  />
                  <StatCard
                    label="Delivery events"
                    value={health.mail?.deliveryEvents?.sampled || 0}
                    subtext={`最近 ${formatAge(health.mail?.deliveryEvents?.latestAt, generatedAt)}`}
                  />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={onNavigate ? () => onNavigate('accountRecovery') : undefined}
                    className="border border-zinc-100 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <TimerReset size={14} className="mb-1 text-amber-500" />
                    账号恢复待处理：{queueStats.recovery}
                  </button>
                  <button
                    type="button"
                    onClick={onNavigate ? () => onNavigate('developerApi') : undefined}
                    className="border border-zinc-100 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <Users size={14} className="mb-1 text-blue-500" />
                    开发者 API 待审核：{queueStats.developerApi}
                  </button>
                  <div className="border border-zinc-100 px-3 py-2 text-xs text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
                    <Clock3 size={14} className="mb-1 text-red-500" />
                    工单待处理：{queueStats.tickets}，紧急 {queueStats.urgentTickets}
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
