import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Database,
  HelpCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/index.js';
import { loadPublicSiteStatus } from '../../services/siteStatusService.js';

function getLevelMeta(level, isEnglish) {
  switch (level) {
    case 'ok':
      return {
        label: isEnglish ? 'Operational' : '运行正常',
        icon: CheckCircle2,
        className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
        dotClassName: 'bg-emerald-500',
      };
    case 'notice':
      return {
        label: isEnglish ? 'Notice' : '提示',
        icon: Activity,
        className: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300',
        dotClassName: 'bg-blue-500',
      };
    case 'warning':
      return {
        label: isEnglish ? 'Needs Attention' : '需要关注',
        icon: AlertTriangle,
        className: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
        dotClassName: 'bg-amber-500',
      };
    default:
      return {
        label: isEnglish ? 'Unknown' : '无法确认',
        icon: HelpCircle,
        className: 'border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
        dotClassName: 'bg-zinc-400',
      };
  }
}

function ServiceIcon({ serviceId }) {
  switch (serviceId) {
    case 'data':
    case 'public-stats':
      return <Database size={18} />;
    case 'mail':
      return <Mail size={18} />;
    case 'import':
      return <UploadCloud size={18} />;
    case 'captcha':
      return <ShieldCheck size={18} />;
    case 'site':
    default:
      return <Activity size={18} />;
  }
}

function formatDateTime(value, isEnglish) {
  if (!value) {
    return isEnglish ? 'Unknown' : '未知';
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(isEnglish ? 'en-US' : 'zh-CN', {
    hour12: false,
  });
}

function getStatusCopy(isEnglish) {
  if (isEnglish) {
    return {
      title: 'Service Status',
      subtitle: 'A public view for checking whether the site, public data, mail notifications, import flow, and verification service are broadly available.',
      backHome: 'Back to Home',
      refresh: 'Refresh',
      refreshing: 'Refreshing...',
      lastChecked: 'Last checked',
      affectedServices: 'Affected Services',
      noIncidents: 'No public incidents are currently reported.',
      details: 'Details',
      updatedAt: 'Updated',
      unavailableTitle: 'Status page could not load',
      unavailableBody: 'The status endpoint did not respond. This may be a local network problem or a temporary site issue.',
      retry: 'Retry',
      privacyNote: 'This page only shows public service summaries. It does not expose internal endpoints, user counts, email addresses, tokens, or database details.',
    };
  }

  return {
    title: '服务状态',
    subtitle: '公开查看主站、公开数据、邮件通知、导入流程和验证服务是否大体可用。',
    backHome: '返回首页',
    refresh: '刷新',
    refreshing: '刷新中...',
    lastChecked: '最近检查',
    affectedServices: '受影响服务',
    noIncidents: '当前没有公开故障记录。',
    details: '说明',
    updatedAt: '更新时间',
    unavailableTitle: '状态页读取失败',
    unavailableBody: '状态接口没有正常响应，可能是本地网络问题，也可能是站点短暂异常。',
    retry: '重试',
    privacyNote: '本页面只展示公开服务摘要，不展示内部接口、用户数量、邮箱、Token 或数据库细节。',
  };
}

function ServiceRow({ service, isEnglish }) {
  const meta = getLevelMeta(service.status, isEnglish);

  return (
    <article className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <ServiceIcon serviceId={service.id} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{service.label}</h2>
              <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-xs ${meta.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
                {meta.label}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">{service.summary}</p>
            {service.detail ? (
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-zinc-500">{service.detail}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400 dark:text-zinc-500">
        <span>{getStatusCopy(isEnglish).lastChecked}: {formatDateTime(service.checkedAt, isEnglish)}</span>
        {service.updatedAt ? (
          <span>{getStatusCopy(isEnglish).updatedAt}: {formatDateTime(service.updatedAt, isEnglish)}</span>
        ) : null}
      </div>
    </article>
  );
}

export default function SiteStatusPage() {
  const { isEnglish, t } = useI18n();
  const copy = useMemo(() => getStatusCopy(isEnglish), [isEnglish]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextStatus = await loadPublicSiteStatus();
      setStatus(nextStatus);
    } catch (statusError) {
      setError(statusError?.message || copy.unavailableBody);
    } finally {
      setLoading(false);
    }
  }, [copy.unavailableBody]);

  useEffect(() => {
    document.title = isEnglish
      ? 'Service Status | Endfield Gacha Analyzer'
      : '服务状态 | 终末地抽卡分析器';

    loadStatus();

    return () => {
      document.title = t('app.documentTitle');
    };
  }, [isEnglish, loadStatus, t]);

  const overallMeta = getLevelMeta(status?.overall?.level, isEnglish);
  const OverallIcon = overallMeta.icon;
  const incidents = status?.incidents || [];

  return (
    <main className="min-h-screen bg-zinc-100 text-slate-800 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-endfield-yellow dark:text-zinc-400"
          >
            <ArrowLeft size={16} />
            {copy.backHome}
          </Link>
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-zinc-300 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? copy.refreshing : copy.refresh}
          </button>
        </div>

        <header className="border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-bold tracking-wide">{copy.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-400">{copy.subtitle}</p>
            </div>
            <div className={`min-w-[220px] border px-4 py-3 ${overallMeta.className}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <OverallIcon size={18} />
                {status?.overall?.label || overallMeta.label}
              </div>
              <div className="mt-2 text-xs opacity-80">
                {copy.lastChecked}: {formatDateTime(status?.generatedAt || status?.meta?.generatedAt, isEnglish)}
              </div>
            </div>
          </div>
        </header>

        <p className="mt-4 border border-zinc-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {copy.privacyNote}
        </p>

        {error ? (
          <section className="mt-6 border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={18} />
              {copy.unavailableTitle}
            </div>
            <p className="mt-2 text-sm leading-6">{error || copy.unavailableBody}</p>
            <button
              type="button"
              onClick={loadStatus}
              className="mt-4 border border-red-300 px-3 py-2 text-sm transition-colors hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950"
            >
              {copy.retry}
            </button>
          </section>
        ) : null}

        {loading && !status ? (
          <section className="mt-6 flex min-h-[220px] items-center justify-center border border-zinc-200 bg-white text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
            <RefreshCw size={22} className="animate-spin" />
          </section>
        ) : null}

        {status ? (
          <>
            <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                  <Clock3 size={16} className="text-amber-500" />
                  {copy.lastChecked}
                </div>
                <div className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                  {formatDateTime(status.generatedAt, isEnglish)}
                </div>
              </div>
              <div className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{copy.affectedServices}</div>
                <div className="mt-2 text-2xl font-semibold">{status.overall?.affectedCount || incidents.length || 0}</div>
              </div>
              <div className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Cache</div>
                <div className="mt-2 truncate font-mono text-sm text-slate-500 dark:text-zinc-400">
                  {status.meta?.cacheVersion || '0'}
                </div>
              </div>
            </section>

            <section className="mt-6 space-y-3">
              {(status.services || []).map((service) => (
                <ServiceRow key={service.id} service={service} isEnglish={isEnglish} />
              ))}
            </section>

            <section className="mt-6 border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                <AlertTriangle size={16} className="text-amber-500" />
                {copy.affectedServices}
              </div>
              {incidents.length ? (
                <div className="mt-3 space-y-2">
                  {incidents.map((incident) => (
                    <div key={incident.serviceId} className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                      <div className="font-semibold">{incident.label}</div>
                      <div className="mt-1 text-xs leading-5">{incident.summary}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">{copy.noIncidents}</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
