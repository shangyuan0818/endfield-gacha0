import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
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

function valueFromCounts(counts, key) {
  return Number(counts?.[key] || 0);
}

function countsToText(counts, labels) {
  if (!counts || typeof counts !== 'object') return '无';
  return labels
    .map(({ key, label }) => `${label} ${valueFromCounts(counts, key)}`)
    .join(' / ');
}

function getStatusMeta(level) {
  switch (level) {
    case 'ok':
      return {
        label: '运行正常',
        className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
        icon: CheckCircle2,
      };
    case 'notice':
      return {
        label: '有待处理事项',
        className: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
        icon: Activity,
      };
    default:
      return {
        label: '需要关注',
        className: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
        icon: AlertTriangle,
      };
  }
}

function BooleanBadge({ value, label }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-1 text-xs ${
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

function Section({ title, icon: Icon, action, children }) {
  return (
    <section className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
          {React.createElement(Icon, { size: 16, className: 'text-amber-500' })}
          {title}
        </div>
        {action}
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function StatCard({ label, value, subtext, tone = 'default', onClick }) {
  const toneClass = {
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
    notice: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
    default: 'border-zinc-200 bg-zinc-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200',
  }[tone];
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`min-h-[92px] border p-3 text-left ${toneClass} ${onClick ? 'transition-colors hover:brightness-95 dark:hover:brightness-125' : ''}`}
    >
      <div className="text-xs text-current opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold leading-none">{value}</div>
      {subtext ? <div className="mt-2 text-xs text-current opacity-75">{subtext}</div> : null}
    </Component>
  );
}

function ContentRow({ item, generatedAt }) {
  const latest = item?.latest || {};
  const title = latest.title || latest.name || latest.label || latest.key || latest.poolId || latest.id || item?.table || '无记录';
  const time = item?.latestAt || latest.updatedAt || latest.publishedAt || latest.startTime || null;

  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-800">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{item?.label || item?.key}</span>
          {item?.ok === false ? (
            <span className="border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">读取失败</span>
          ) : null}
        </div>
        <div className="mt-1 truncate text-sm text-slate-500 dark:text-zinc-400">{item?.error || title}</div>
      </div>
      <div className="shrink-0 text-right text-xs text-slate-400 dark:text-zinc-500">
        <div>{formatAge(time, generatedAt)}</div>
        <div className="mt-0.5">{formatDateTime(time)}</div>
      </div>
    </div>
  );
}

function WarningList({ warnings = [] }) {
  if (!warnings.length) return null;

  return (
    <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
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
  const mailConfig = health?.mail?.config || {};
  const mailFailed = valueFromCounts(health?.mail?.outbox?.countsByStatus, 'failed');
  const mailDue = Number(health?.mail?.outbox?.dueQueued || 0);
  const opsFailures = valueFromCounts(health?.ops?.countsByStatus, 'failure');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
            <Activity size={16} />
            <span>集中查看站点内容是否更新、公共缓存是否刷新、自动化和邮件队列是否需要处理。</span>
          </div>
          {generatedAt ? (
            <div className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
              生成时间：{formatDateTime(generatedAt)}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-3 border px-4 py-3 ${statusMeta.className}`}>
        <div className="flex items-center gap-2">
          <StatusIcon size={18} />
          <span className="font-semibold">{health?.overall?.label || statusMeta.label}</span>
        </div>
        <div className="text-sm">
          待关注：{Number(health?.overall?.attentionCount || 0)}
        </div>
      </div>

      {error ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading && !health ? (
        <div className="flex items-center justify-center border border-zinc-200 py-16 text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
          <RefreshCw size={20} className="animate-spin" />
        </div>
      ) : health ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="自动化失败"
              value={opsFailures}
              subtext={countsToText(health?.ops?.countsByStatus, [
                { key: 'success', label: '成功' },
                { key: 'failure', label: '失败' },
                { key: 'skipped', label: '跳过' },
              ])}
              tone={opsFailures > 0 ? 'warning' : 'default'}
              onClick={onNavigate ? () => onNavigate('automation') : undefined}
            />
            <StatCard
              label="待处理工单"
              value={queueStats.tickets}
              subtext={`紧急 ${queueStats.urgentTickets}`}
              tone={queueStats.urgentTickets > 0 ? 'danger' : queueStats.tickets > 0 ? 'notice' : 'default'}
            />
            <StatCard
              label="账号恢复"
              value={queueStats.recovery}
              subtext="待人工核验 / 邮件失败回落"
              tone={queueStats.recovery > 0 ? 'notice' : 'default'}
              onClick={onNavigate ? () => onNavigate('accountRecovery') : undefined}
            />
            <StatCard
              label="开发者 API"
              value={queueStats.developerApi}
              subtext="待审核申请"
              tone={queueStats.developerApi > 0 ? 'notice' : 'default'}
              onClick={onNavigate ? () => onNavigate('developerApi') : undefined}
            />
            <StatCard
              label="邮件队列"
              value={mailDue + mailFailed}
              subtext={`到期 ${mailDue} / 失败 ${mailFailed}`}
              tone={mailFailed > 0 ? 'warning' : mailDue > 0 ? 'notice' : 'default'}
              onClick={onNavigate ? () => onNavigate('mailStatus') : undefined}
            />
          </div>

          <WarningList warnings={health.warnings || []} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Section title="内容更新时间" icon={Bell}>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(health.content?.items || []).map((item) => (
                  <ContentRow key={item.key || item.table} item={item} generatedAt={generatedAt} />
                ))}
              </div>
              {health.content?.latestAt ? (
                <div className="mt-3 text-xs text-slate-400 dark:text-zinc-500">
                  最近内容变更：{formatDateTime(health.content.latestAt)}
                </div>
              ) : null}
            </Section>

            <Section title="公共缓存与聚合" icon={Database}>
              <div className="space-y-3">
                <div className="border border-zinc-100 p-3 text-sm dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700 dark:text-zinc-200">公共缓存版本</span>
                    <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">
                      {health.publicCache?.epoch?.cacheVersion || '未记录'}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 dark:text-zinc-500 md:grid-cols-2">
                    <div>范围：{health.publicCache?.epoch?.scope || '未记录'}</div>
                    <div>原因：{health.publicCache?.epoch?.reason || '未记录'}</div>
                    <div className="md:col-span-2">更新时间：{formatDateTime(health.publicCache?.epoch?.updatedAt)}</div>
                  </div>
                </div>
                {(health.publicCache?.aggregates || []).map((item) => (
                  <div key={item.table || item.key || item.label} className="border border-zinc-100 p-3 text-sm dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-700 dark:text-zinc-200">{item.label || item.key}</span>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">{formatAge(item.latestAt, generatedAt)}</span>
                    </div>
                    {item.ok === false ? (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400">{item.error}</div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                        {item.latest?.poolId || item.latest?.metric || 'latest'} · {formatDateTime(item.latestAt)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="运营自动化"
              icon={Bot}
              action={onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate('automation')}
                  className="text-xs text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  查看自动化
                </button>
              ) : null}
            >
              <div className="grid grid-cols-3 gap-2 text-xs">
                <StatCard label="成功" value={valueFromCounts(health.ops?.countsByStatus, 'success')} subtext="最近采样" />
                <StatCard label="失败" value={opsFailures} subtext="需排查" tone={opsFailures > 0 ? 'warning' : 'default'} />
                <StatCard label="跳过" value={valueFromCounts(health.ops?.countsByStatus, 'skipped')} subtext="去重 / 条件不满足" />
              </div>
              <div className="mt-4 space-y-2">
                {(health.ops?.latestRuns || []).slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-start justify-between gap-3 border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-700 dark:text-zinc-200">{run.jobLabel || run.jobId}</div>
                      <div className="mt-1 truncate text-slate-500 dark:text-zinc-500">{run.error || run.triggerType || '无错误'}</div>
                    </div>
                    <div className="shrink-0 text-right text-slate-400 dark:text-zinc-500">
                      <div>{run.presentationStatus || run.status}</div>
                      <div>{formatAge(run.updatedAt, generatedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="邮件与待处理队列"
              icon={Mail}
              action={onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate('mailStatus')}
                  className="text-xs text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
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
                  className="border border-zinc-100 px-3 py-2 text-left text-xs text-slate-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <TimerReset size={14} className="mb-1 text-amber-500" />
                  账号恢复待处理：{queueStats.recovery}
                </button>
                <button
                  type="button"
                  onClick={onNavigate ? () => onNavigate('developerApi') : undefined}
                  className="border border-zinc-100 px-3 py-2 text-left text-xs text-slate-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
        </>
      ) : null}
    </div>
  );
}
