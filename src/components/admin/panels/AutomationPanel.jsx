import React from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Play,
  RefreshCw,
  ShieldAlert,
  Square,
  CheckSquare,
  Database,
} from 'lucide-react';
import { useOpsAutomation } from '../../../hooks/admin';

const JOB_OPTIONS = [
  { id: 'all', label: '全部任务' },
  { id: 'official-announcements', label: '官方公告同步' },
  { id: 'pool-schedule', label: '卡池轮换同步' },
  { id: 'wiki-catalog', label: '图鉴巡检' },
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(item => normalizeText(item))
      .filter(Boolean)
  ));
}

function formatDateTime(value) {
  if (!value) {
    return '未记录';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

function getStatusMeta(status) {
  switch (status) {
    case 'success':
      return {
        label: '成功',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      };
    case 'failure':
      return {
        label: '失败',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      };
    case 'skipped':
      return {
        label: '跳过',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      };
    default:
      return {
        label: status || '未知',
        className: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
      };
  }
}

function getReviewStatusMeta(status) {
  switch (status) {
    case 'applied':
      return {
        label: '已全部发布',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      };
    case 'partially_applied':
      return {
        label: '部分发布',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      };
    case 'apply_failed':
      return {
        label: '发布失败',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      };
    case 'pending_manual_review':
      return {
        label: '待人工审核',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      };
    default:
      return {
        label: status || '未设置',
        className: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
      };
  }
}

function getSummaryValue(summary, key) {
  const value = Number(summary?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function getRunReviewRecords(run) {
  return Array.isArray(run?.review_bundle?.snapshots?.incoming)
    ? run.review_bundle.snapshots.incoming
    : [];
}

function getRunRecordKey(run) {
  if (run?.job_id === 'official-announcements') {
    return 'source_id';
  }

  if (run?.job_id === 'pool-schedule') {
    return 'pool_id';
  }

  return 'id';
}

function getRunAppliedIds(run) {
  if (run?.job_id === 'official-announcements') {
    return normalizeStringArray(run?.review_bundle?.review?.appliedSourceIds);
  }

  if (run?.job_id === 'pool-schedule') {
    return normalizeStringArray(run?.review_bundle?.review?.appliedPoolIds);
  }

  return [];
}

function getRunBlockedIds(run) {
  if (run?.job_id === 'official-announcements') {
    return normalizeStringArray(run?.review_bundle?.review?.blockedSourceIds);
  }

  if (run?.job_id === 'pool-schedule') {
    return normalizeStringArray(run?.review_bundle?.review?.blockedPoolIds);
  }

  return [];
}

function getRunPendingCount(run) {
  const keyField = getRunRecordKey(run);
  const appliedIdSet = new Set(getRunAppliedIds(run));
  const blockedIdSet = new Set(getRunBlockedIds(run));

  return getRunReviewRecords(run)
    .map(record => normalizeText(record?.[keyField] || record?.id))
    .filter(recordId => recordId && !appliedIdSet.has(recordId) && !blockedIdSet.has(recordId))
    .length;
}

function getRecordId(run, record) {
  const keyField = getRunRecordKey(run);
  return normalizeText(record?.[keyField] || record?.id);
}

function getRecordTitle(run, record) {
  if (run?.job_id === 'official-announcements') {
    return normalizeText(record?.title) || getRecordId(run, record);
  }

  if (run?.job_id === 'pool-schedule') {
    return normalizeText(record?.name) || normalizeText(record?.pool_title) || getRecordId(run, record);
  }

  return normalizeText(record?.name) || normalizeText(record?.title) || getRecordId(run, record);
}

function getRecordMeta(run, record) {
  if (run?.job_id === 'official-announcements') {
    return [
      normalizeText(record?.source_id),
      normalizeText(record?.published_at) ? formatDateTime(record?.published_at) : '',
      normalizeText(record?.version),
    ].filter(Boolean).join(' · ');
  }

  if (run?.job_id === 'pool-schedule') {
    return [
      normalizeText(record?.pool_id),
      normalizeText(record?.type),
      normalizeText(record?.start_time) ? formatDateTime(record?.start_time) : '',
      normalizeText(record?.end_time) ? formatDateTime(record?.end_time) : '',
    ].filter(Boolean).join(' · ');
  }

  return [
    normalizeText(record?.id),
    normalizeText(record?.type),
    record?.rarity ? `${record.rarity}★` : '',
  ].filter(Boolean).join(' · ');
}

function getRecordDescription(run, record) {
  if (run?.job_id === 'official-announcements') {
    return normalizeText(record?.summary) || normalizeText(record?.content?.replace(/<[^>]+>/g, ' ')).slice(0, 140);
  }

  if (run?.job_id === 'pool-schedule') {
    const featuredNames = Array.isArray(record?.featured_character_names) && record.featured_character_names.length > 0
      ? record.featured_character_names.join(' / ')
      : Array.isArray(record?.featured_characters) && record.featured_characters.length > 0
        ? record.featured_characters.join(' / ')
        : '';

    return [
      normalizeText(record?.up_character) ? `UP：${record.up_character}` : '',
      featuredNames ? `名单：${featuredNames}` : '',
    ].filter(Boolean).join(' · ');
  }

  return normalizeText(record?.avatar_url);
}

function isRunApplySupported(run) {
  return run?.job_id === 'official-announcements' || run?.job_id === 'pool-schedule';
}

function PreviewSection({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <details className="border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950">
        {title}（{items.length}）
      </summary>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((item) => (
          <div key={`${title}-${item.key}`} className="px-4 py-3 text-sm">
            <div className="font-medium text-slate-700 dark:text-zinc-300">{item.key}</div>
            {Array.isArray(item.changedFields) && item.changedFields.length > 0 && (
              <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                变化字段：{item.changedFields.join(' / ')}
              </div>
            )}
            <pre className="mt-2 overflow-x-auto bg-zinc-50 dark:bg-zinc-950 p-3 text-xs text-slate-600 dark:text-zinc-400 whitespace-pre-wrap break-all">
              {JSON.stringify(item.next || item.current || item, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}

const AutomationPanel = ({ showToast }) => {
  const {
    jobFilter,
    setJobFilter,
    runs,
    loading,
    actionLoading,
    selectedRunId,
    selectedRun,
    selectedRecordIds,
    reviewNote,
    setReviewNote,
    lastApplyResult,
    setupIssue,
    refreshRuns,
    triggerRuns,
    selectRun,
    toggleRecordSelection,
    selectPendingRecords,
    clearSelectedRecords,
    applySelectedRecords,
  } = useOpsAutomation(showToast);

  const summary = selectedRun?.summary || {};
  const reviewRecords = getRunReviewRecords(selectedRun);
  const appliedIdSet = new Set(getRunAppliedIds(selectedRun));
  const blockedIdSet = new Set(getRunBlockedIds(selectedRun));
  const selectedIdSet = new Set(selectedRecordIds);
  const applySupported = isRunApplySupported(selectedRun);
  const blockedRecords = Array.isArray(lastApplyResult?.plan?.blocked_records)
    ? lastApplyResult.plan.blocked_records
    : [];
  const controlsDisabled = Boolean(setupIssue);

  return (
    <div className="space-y-4">
      {setupIssue && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            <ShieldAlert size={16} />
            自动化审计表尚未就绪
          </div>
          <div className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            {setupIssue.message}。请先在当前数据库执行迁移 <code>089_create_ops_automation_runs_and_announcement_source_fields.sql</code>，确认
            <code> public.ops_automation_runs </code>
            已创建并刷新 PostgREST schema cache，再返回此页刷新。
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-slate-400 dark:text-zinc-500" />
          <select
            value={jobFilter}
            onChange={(event) => setJobFilter(event.target.value)}
            disabled={controlsDisabled}
            className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          >
            {JOB_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={refreshRuns}
          disabled={loading || actionLoading === 'trigger'}
          className="flex items-center gap-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 text-sm text-slate-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          刷新记录
        </button>

        <button
          onClick={() => triggerRuns(jobFilter)}
          disabled={controlsDisabled || actionLoading === 'trigger'}
          className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Play size={16} />
          {actionLoading === 'trigger' ? '执行中...' : '手动 dry-run'}
        </button>

        <span className="text-xs text-slate-500 dark:text-zinc-500">
          当前展示 {runs.length} 条最近审计记录
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
        <div className="border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 dark:text-zinc-500">
              <RefreshCw size={18} className="animate-spin" />
            </div>
          ) : setupIssue ? (
            <div className="p-10 text-center text-slate-500 dark:text-zinc-400 space-y-3">
              <ShieldAlert size={42} className="mx-auto opacity-60 text-amber-500" />
              <p>当前环境缺少自动化审计表，无法读取或创建运行记录。</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500">
                先执行迁移并刷新 schema cache，再重新进入该页面。
              </p>
            </div>
          ) : runs.length === 0 ? (
            <div className="p-10 text-center text-slate-400 dark:text-zinc-500">
              <Database size={42} className="mx-auto mb-3 opacity-50" />
              <p>暂无自动化审计记录</p>
              <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">
                可先点击上方“手动 dry-run”生成第一条审计记录。
              </p>
            </div>
          ) : (
            runs.map((run) => {
              const statusMeta = getStatusMeta(run.status);
              const reviewStatusMeta = getReviewStatusMeta(run.review_bundle?.review?.status);
              const isActive = run.id === selectedRunId;

              return (
                <button
                  key={run.id}
                  onClick={() => selectRun(run.id)}
                  className={`w-full p-4 text-left transition-colors ${
                    isActive
                      ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-700 dark:text-zinc-300 truncate">
                        {run.job_label}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={`px-1.5 py-0.5 rounded ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${reviewStatusMeta.className}`}>
                          {reviewStatusMeta.label}
                        </span>
                        <span className="text-slate-500 dark:text-zinc-500">
                          {run.trigger_type}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                        {formatDateTime(run.created_at)}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                        新增 {getSummaryValue(run.summary, 'added')} · 更新 {getSummaryValue(run.summary, 'updated')} · 删除 {getSummaryValue(run.summary, 'removed')}
                      </div>
                      {run.status === 'success' && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                          待处理 {getRunPendingCount(run)} 条
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} className={`shrink-0 mt-1 ${isActive ? 'text-red-500' : 'text-slate-300 dark:text-zinc-700'}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 min-w-0">
          {setupIssue ? (
            <div className="p-10 text-center text-slate-500 dark:text-zinc-400 space-y-3">
              <ShieldAlert size={44} className="mx-auto opacity-60 text-amber-500" />
              <p>自动化面板已降级为部署提示模式。</p>
              <p className="text-sm leading-relaxed">
                迁移完成前，这里不会显示审计详情，也不会允许手动 dry-run 或发布。
              </p>
            </div>
          ) : !selectedRun ? (
            <div className="p-10 text-center text-slate-400 dark:text-zinc-500">
              <Bot size={44} className="mx-auto mb-3 opacity-50" />
              <p>请选择左侧审计记录查看详情</p>
            </div>
          ) : (
            <div className="space-y-5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-bold text-slate-700 dark:text-zinc-300">
                      {selectedRun.job_label}
                    </h4>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusMeta(selectedRun.status).className}`}>
                      {getStatusMeta(selectedRun.status).label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getReviewStatusMeta(selectedRun.review_bundle?.review?.status).className}`}>
                      {getReviewStatusMeta(selectedRun.review_bundle?.review?.status).label}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 dark:text-zinc-500 space-y-1">
                    <div>运行时间：{formatDateTime(selectedRun.created_at)}</div>
                    <div>触发方式：{selectedRun.trigger_type} · 模式：{selectedRun.dry_run ? 'dry-run' : 'apply'}</div>
                    <div>Run ID：{selectedRun.id}</div>
                    {selectedRun.source_tag && <div>来源标签：{selectedRun.source_tag}</div>}
                  </div>
                </div>

                {selectedRun.source_url && (
                  <a
                    href={selectedRun.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 text-sm text-slate-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ExternalLink size={14} />
                    查看源地址
                  </a>
                )}
              </div>

              {selectedRun.error_message && (
                <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {selectedRun.error_message}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-zinc-500">当前记录</div>
                  <div className="mt-1 text-lg font-semibold text-slate-700 dark:text-zinc-300">{getSummaryValue(summary, 'current')}</div>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-zinc-500">输入记录</div>
                  <div className="mt-1 text-lg font-semibold text-slate-700 dark:text-zinc-300">{getSummaryValue(summary, 'incoming')}</div>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-zinc-500">新增</div>
                  <div className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">{getSummaryValue(summary, 'added')}</div>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-zinc-500">更新</div>
                  <div className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-400">{getSummaryValue(summary, 'updated')}</div>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-zinc-500">删除</div>
                  <div className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">{getSummaryValue(summary, 'removed')}</div>
                </div>
              </div>

              {Array.isArray(selectedRun.top_changed_fields) && selectedRun.top_changed_fields.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700 dark:text-zinc-300">主要变化字段</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRun.top_changed_fields.map((item) => (
                      <span
                        key={`${selectedRun.id}-${item.field}`}
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                      >
                        {item.field} × {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {applySupported ? (
                <div className="space-y-3 border border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-zinc-300">人工审核与发布</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                        共 {reviewRecords.length} 条记录，已发布 {appliedIdSet.size} 条，待处理 {getRunPendingCount(selectedRun)} 条
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={selectPendingRecords}
                        className="px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        全选待发布
                      </button>
                      <button
                        onClick={clearSelectedRecords}
                        className="px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        清空选择
                      </button>
                      <button
                        onClick={applySelectedRecords}
                        disabled={actionLoading === `apply:${selectedRun.job_id}` || selectedRecordIds.length === 0}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        {actionLoading === `apply:${selectedRun.job_id}` ? '发布中...' : `发布选中（${selectedRecordIds.length}）`}
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    rows={3}
                    placeholder="可选：记录本次审核备注，发布成功后会写入 review_bundle.review.note"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />

                  <div className="space-y-2 max-h-[420px] overflow-y-auto border border-zinc-200 dark:border-zinc-800">
                    {reviewRecords.map((record) => {
                      const recordId = getRecordId(selectedRun, record);
                      const isApplied = appliedIdSet.has(recordId);
                      const isBlocked = blockedIdSet.has(recordId);
                      const isSelected = selectedIdSet.has(recordId);

                      return (
                        <div
                          key={`${selectedRun.id}-${recordId}`}
                          className={`flex items-start gap-3 p-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${
                            isApplied ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => !isApplied && !isBlocked && toggleRecordSelection(recordId)}
                            disabled={isApplied || isBlocked}
                            className={`mt-0.5 shrink-0 ${
                              isApplied
                                ? 'text-emerald-500'
                                : isBlocked
                                  ? 'text-amber-500'
                                : isSelected
                                  ? 'text-red-500'
                                  : 'text-slate-300 dark:text-zinc-700'
                            }`}
                          >
                            {isApplied
                              ? <CheckCircle2 size={16} />
                              : isBlocked
                                ? <ShieldAlert size={16} />
                              : isSelected
                                ? <CheckSquare size={16} />
                                : <Square size={16} />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium text-slate-700 dark:text-zinc-300">
                                {getRecordTitle(selectedRun, record)}
                              </div>
                              {isApplied && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded">
                                  已发布
                                </span>
                              )}
                              {isBlocked && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                                  需人工修订
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                              {getRecordMeta(selectedRun, record)}
                            </div>

                            {getRecordDescription(selectedRun, record) && (
                              <div className="mt-2 text-sm text-slate-600 dark:text-zinc-400 break-words">
                                {getRecordDescription(selectedRun, record)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {blockedRecords.length > 0 && (
                    <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                        <ShieldAlert size={16} />
                        最近一次发布尝试中的阻塞项
                      </div>
                      {blockedRecords.map((record) => (
                        <div key={`${selectedRun.id}-blocked-${record.source_id || record.pool_id || record.name}`} className="text-sm text-amber-900 dark:text-amber-200">
                          <div className="font-medium">{record.title || record.name || record.source_id || record.pool_id}</div>
                          <ul className="mt-1 text-xs space-y-1 list-disc list-inside">
                            {Array.isArray(record.issues) && record.issues.map((issue) => (
                              <li key={`${record.source_id || record.pool_id}-${issue.code}`}>{issue.message}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 p-4 text-sm text-slate-600 dark:text-zinc-400">
                  当前任务仅提供差异巡检与审计记录，不提供一键发布入口。
                </div>
              )}

              <div className="space-y-3">
                <PreviewSection title="新增预览" items={selectedRun.preview?.added} />
                <PreviewSection title="更新预览" items={selectedRun.preview?.updated} />
                <PreviewSection title="删除预览" items={selectedRun.preview?.removed} />
              </div>

              {selectedRun.review_bundle?.review?.lastAttemptedAt && (
                <div className="text-xs text-slate-500 dark:text-zinc-500 flex items-center gap-2">
                  <Clock3 size={14} />
                  最近审核尝试：{formatDateTime(selectedRun.review_bundle.review.lastAttemptedAt)}
                  {selectedRun.review_bundle.review.note ? ` · 备注：${selectedRun.review_bundle.review.note}` : ''}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutomationPanel;
