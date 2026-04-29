import React from 'react';
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
    parts.push('强制刷新');
  }
  if (summary.total != null) {
    parts.push(`总数 ${summary.total}`);
  }
  if (summary.summarized != null) {
    parts.push(`重算 ${summary.summarized}`);
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

const AutomationPanel = ({ showToast, onNavigate }) => {
  const {
    runs,
    loading,
    syncing,
    forceRefreshing,
    refreshRuns,
    triggerSync,
    setupIssue,
  } = useOpsAutomation(showToast);

  const unregisteredRaw = useSiteConfigStore(s => s.config.unregistered_characters);
  const updateConfig = useSiteConfigStore(s => s.updateConfig);

  let unregisteredList = [];
  try {
    const parsed = typeof unregisteredRaw === 'string' ? JSON.parse(unregisteredRaw) : unregisteredRaw;
    if (Array.isArray(parsed)) unregisteredList = parsed.filter(Boolean);
  } catch { /* ignore */ }

  const dismissAlert = async () => {
    const ok = await updateConfig('unregistered_characters', '[]');
    if (ok && showToast) showToast('已清除未收录提醒', 'success');
  };

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
          disabled={syncing || forceRefreshing || loading}
          className="flex items-center gap-1 px-3 py-2 border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
        >
          {syncing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
          {syncing ? '同步中...' : '增量同步公告'}
        </button>
        <button
          onClick={() => triggerSync({ forceRefresh: true })}
          disabled={syncing || forceRefreshing || loading}
          className="flex items-center gap-1 px-3 py-2 border border-red-300 dark:border-red-700 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          title="重新生成已存在公告的摘要。会调用公告总结 LLM，仅在摘要异常或更换提示词后使用。"
        >
          <RefreshCw size={16} className={forceRefreshing ? 'animate-spin' : ''} />
          {forceRefreshing ? '刷新中...' : '强制刷新摘要'}
        </button>
        <button
          onClick={refreshRuns}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 text-sm text-slate-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          刷新记录
        </button>
        <span className="text-xs text-slate-500 dark:text-zinc-500">
          当前展示 {runs.length} 条最近执行记录
        </span>
      </div>

      {setupIssue && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-4 text-sm text-amber-800 dark:text-amber-200">
          {setupIssue.message}
        </div>
      )}

      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 dark:text-zinc-500">
            <RefreshCw size={18} className="animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 dark:text-zinc-500">
            <Database size={42} className="mx-auto mb-3 opacity-50" />
            <p>暂无自动化执行记录</p>
          </div>
        ) : (
          runs.map((run) => {
            const statusMeta = getStatusMeta(run?.status);
            return (
              <div key={run.id} className="p-4">
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
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                        {run.error_message}
                      </div>
                    )}
                    {formatRunSummary(run.summary) && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                        {formatRunSummary(run.summary)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AutomationPanel;
