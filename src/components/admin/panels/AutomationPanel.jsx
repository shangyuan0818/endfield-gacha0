import React, { useCallback, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Clock3,
  Database,
  Play,
  RefreshCw,
  X,
} from 'lucide-react';
import { useOpsAutomation } from '../../../hooks/admin';
import useSiteConfigStore from '../../../stores/useSiteConfigStore';
import VirtualizedList from '../VirtualizedList';

const JOB_FILTER_OPTIONS = [
  { value: 'all', label: '全部任务' },
  { value: 'official-announcements', label: '官方公告同步' },
  { value: 'pool-schedule', label: '卡池轮换同步' },
  { value: 'wiki-catalog', label: '图鉴巡检提醒' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'success', label: '成功' },
  { value: 'failure', label: '失败' },
  { value: 'skipped', label: '跳过' },
];

const TRIGGER_FILTER_OPTIONS = [
  { value: 'all', label: '全部来源' },
  { value: 'manual', label: '手动' },
  { value: 'cron', label: '定时' },
  { value: 'api', label: 'API' },
];

const FULL_REFRESH_LIMIT_OPTIONS = [10, 20, 50, 100];

function normalizeFullRefreshLimit(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 50;
  }

  return Math.min(100, Math.max(1, Math.floor(numericValue)));
}

function formatDateTime(value) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function getStatusMeta(status) {
  switch (status) {
    case 'success':
      return { label: '成功', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'failure':
      return { label: '失败', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    case 'skipped':
      return { label: '跳过', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    default:
      return { label: status || '未知', className: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400' };
  }
}

function formatRunSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return '';
  }

  const parts = [];
  if (summary.forceRefresh) {
    parts.push(summary.refreshMode === 'all' ? '强制刷新全部' : '强制刷新摘要');
  }
  if (summary.refreshMode === 'all' && summary.announcementLimit != null) {
    parts.push(`范围 ${summary.announcementLimit}`);
  }
  if (summary.total != null) {
    parts.push(`总数 ${summary.total}`);
  }
  if (summary.summarized != null) {
    parts.push(`重算 ${summary.summarized}`);
  }
  if (summary.summaryFailed) {
    parts.push(`摘要失败 ${summary.summaryFailed}`);
  }
  if (summary.synced != null) {
    parts.push(`写入 ${summary.synced}`);
  }
  if (summary.created != null) {
    parts.push(`新增 ${summary.created}`);
  }
  if (summary.updated != null) {
    parts.push(`更新 ${summary.updated}`);
  }
  if (summary.skipped != null) {
    parts.push(`跳过 ${summary.skipped}`);
  }

  return parts.join(' / ');
}

function normalizeSummaryErrors(summary) {
  if (!summary || !Array.isArray(summary.summaryErrors)) {
    return [];
  }

  return summary.summaryErrors
    .map((item) => ({
      sourceId: String(item?.source_id || '').trim(),
      title: String(item?.title || '').trim(),
      error: String(item?.error || '').trim(),
    }))
    .filter(item => item.title || item.error || item.sourceId);
}

function RunCard({ run }) {
  const statusMeta = getStatusMeta(run?.status);
  const summaryErrors = normalizeSummaryErrors(run?.summary);
  return (
    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              {run.job_label || run.job_id}
            </span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">
              {run.trigger_type}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
            <Clock3 size={12} />
            {formatDateTime(run.created_at)}
          </div>
          {run.error_message && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400 line-clamp-2">
              {run.error_message}
            </div>
          )}
          {formatRunSummary(run.summary) && (
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-500 line-clamp-2">
              {formatRunSummary(run.summary)}
            </div>
          )}
          {summaryErrors.length > 0 && (
            <div className="mt-3 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <div className="font-medium">摘要失败原因</div>
              <div className="mt-1 space-y-1">
                {summaryErrors.slice(0, 5).map((item, index) => (
                  <div key={`${item.sourceId || item.title || 'summary-error'}-${index}`} className="leading-relaxed">
                    <span className="font-medium">
                      {item.title || item.sourceId || `公告 ${index + 1}`}
                    </span>
                    {item.error && (
                      <span className="ml-1 break-all text-amber-700 dark:text-amber-300">
                        {item.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {summaryErrors.length > 5 && (
                <div className="mt-1 text-amber-700 dark:text-amber-300">
                  另有 {summaryErrors.length - 5} 条失败详情已截断。
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const AutomationPanel = ({ showToast, onNavigate }) => {
  const {
    filters,
    runs,
    loading,
    syncing,
    forceRefreshing,
    fullRefreshing,
    refreshRuns,
    setFilters,
    triggerSync,
    setupIssue,
  } = useOpsAutomation(showToast);

  const unregisteredRaw = useSiteConfigStore(s => s.config.unregistered_characters);
  const updateConfig = useSiteConfigStore(s => s.updateConfig);
  const [fullRefreshLimit, setFullRefreshLimit] = useState(50);

  let unregisteredList = [];
  try {
    const parsed = typeof unregisteredRaw === 'string' ? JSON.parse(unregisteredRaw) : unregisteredRaw;
    if (Array.isArray(parsed)) unregisteredList = parsed.filter(Boolean);
  } catch { /* ignore */ }

  const dismissAlert = async () => {
    const ok = await updateConfig('unregistered_characters', '[]');
    if (ok && showToast) showToast('已清除未收录提醒', 'success');
  };

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, [setFilters]);

  const updateFullRefreshLimit = useCallback((value) => {
    setFullRefreshLimit(normalizeFullRefreshLimit(value));
  }, []);

  return (
    <div className="space-y-4">
      {unregisteredList.length > 0 && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 dark:text-amber-200">
                检测到 <strong>{unregisteredList.length}</strong> 个公告中提到但未收录的角色/武器：
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-300 break-all">
                {unregisteredList.join('、')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('characters')}
                    className="text-xs px-2 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
                  >
                    前往角色管理
                  </button>
                )}
                <button
                  onClick={dismissAlert}
                  className="flex items-center gap-1 text-xs px-2 py-1 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                >
                  <X size={12} />
                  已处理，清除提醒
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
        <Bot size={16} />
        <span>运营自动化 —— 公告和卡池每日自动同步（Vercel Cron），也可手动触发</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => triggerSync()}
          disabled={syncing || forceRefreshing || fullRefreshing || loading}
          className="flex items-center gap-1 px-3 py-2 border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
        >
          {syncing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
          {syncing ? '同步中...' : '增量同步公告'}
        </button>
        <button
          onClick={() => triggerSync({ refreshMode: 'summary' })}
          disabled={syncing || forceRefreshing || fullRefreshing || loading}
          className="flex items-center gap-1 px-3 py-2 border border-red-300 dark:border-red-700 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          title="重新抓取公告，只对需要总结的长公告重新生成摘要并覆盖已有内容。"
        >
          <RefreshCw size={16} className={forceRefreshing ? 'animate-spin' : ''} />
          {forceRefreshing ? '刷新中...' : '强制刷新摘要'}
        </button>
        <button
          onClick={() => triggerSync({
            refreshMode: 'all',
            announcementLimit: fullRefreshLimit,
          })}
          disabled={syncing || forceRefreshing || fullRefreshing || loading}
          className="flex items-center gap-1 px-3 py-2 border border-purple-300 dark:border-purple-700 text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50"
          title={`重新抓取并覆盖最近 ${fullRefreshLimit} 条官方公告。长公告会调用 LLM，总结失败时保留官方原文。`}
        >
          <RefreshCw size={16} className={fullRefreshing ? 'animate-spin' : ''} />
          {fullRefreshing ? '刷新中...' : `强制刷新 ${fullRefreshLimit} 条公告`}
        </button>
        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-zinc-500">
          <span>范围</span>
          {FULL_REFRESH_LIMIT_OPTIONS.map(limit => (
            <button
              key={limit}
              type="button"
              onClick={() => updateFullRefreshLimit(limit)}
              disabled={syncing || forceRefreshing || fullRefreshing || loading}
              className={`px-2 py-1 border transition-colors disabled:opacity-50 ${
                fullRefreshLimit === limit
                  ? 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-600 dark:bg-purple-900/30 dark:text-purple-200'
                  : 'border-zinc-200 text-slate-500 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {limit}
            </button>
          ))}
          <input
            type="number"
            min="1"
            max="100"
            value={fullRefreshLimit}
            onChange={(event) => updateFullRefreshLimit(event.target.value)}
            disabled={syncing || forceRefreshing || fullRefreshing || loading}
            className="w-20 px-2 py-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 disabled:opacity-50"
            aria-label="强制刷新全部公告条数"
          />
          <span>条</span>
        </div>
        <button
          onClick={refreshRuns}
          disabled={loading || syncing || forceRefreshing || fullRefreshing}
          className="flex items-center gap-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 text-sm text-slate-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          刷新记录
        </button>
        <span className="text-xs text-slate-500 dark:text-zinc-500">
          当前展示 {runs.length} 条最近执行记录
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs text-slate-500 dark:text-zinc-400">
          <span className="block mb-1">任务</span>
          <select
            value={filters.jobId}
            onChange={(event) => updateFilter('jobId', event.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-200"
          >
            {JOB_FILTER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500 dark:text-zinc-400">
          <span className="block mb-1">状态</span>
          <select
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-200"
          >
            {STATUS_FILTER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500 dark:text-zinc-400">
          <span className="block mb-1">来源</span>
          <select
            value={filters.triggerType}
            onChange={(event) => updateFilter('triggerType', event.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-200"
          >
            {TRIGGER_FILTER_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {setupIssue && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-4 text-sm text-amber-800 dark:text-amber-200">
          {setupIssue.message}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900">
        {loading ? (
          <div className="flex items-center justify-center py-16 border border-zinc-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500">
            <RefreshCw size={18} className="animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="p-10 border border-zinc-200 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-500">
            <Database size={42} className="mx-auto mb-3 opacity-50" />
            <p>暂无自动化执行记录</p>
          </div>
        ) : (
          <VirtualizedList
            items={runs}
            getKey={(run) => run.id}
            itemHeight={126}
            maxHeight={560}
            className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            renderItem={(run) => <RunCard run={run} />}
          />
        )}
      </div>
    </div>
  );
};

export default AutomationPanel;
