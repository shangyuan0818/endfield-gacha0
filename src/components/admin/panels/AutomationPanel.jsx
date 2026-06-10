import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Clock3,
  Database,
  GitBranch,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useOpsAutomation } from '../../../hooks/admin';
import useSiteConfigStore from '../../../stores/useSiteConfigStore';
import {
  formatOpsAutomationDuration,
  formatOpsAutomationRunSummary,
  getOpsAutomationFailureLabel,
  getOpsAutomationJobLabel,
  getOpsAutomationNode,
  getOpsAutomationPresentationStatus,
  getOpsAutomationStatusLabel,
  normalizeOpsAutomationAttempts,
  normalizeOpsAutomationWarnings,
} from '../../../utils/opsAutomationRunSummary';
import VirtualizedList from '../VirtualizedList';
import {
  PanelSection,
  PanelToolbarButton,
  StatusDot,
} from './shared/PanelUi.jsx';

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

const SCHEDULE_CONFIG_KEY = 'ops_automation_schedule_config';
const SCHEDULE_JOB_IDS = ['official-announcements', 'pool-schedule', 'wiki-catalog'];
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const FIELD_CLASS = 'border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition-colors focus:border-amber-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-endfield-yellow';

function normalizeScheduleWeekdays(value) {
  if (!Array.isArray(value)) return [...ALL_WEEKDAYS];
  const weekdays = [...new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
  )].sort((left, right) => left - right);
  return weekdays.length ? weekdays : [...ALL_WEEKDAYS];
}

// 与 api/_lib/opsAutomationScheduleConfig.js 的结构保持一致
function normalizeScheduleConfig(rawValue) {
  let parsed = rawValue;
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      parsed = null;
    }
  }
  const raw = parsed && typeof parsed === 'object' ? parsed : {};
  const rawJobs = raw.jobs && typeof raw.jobs === 'object' ? raw.jobs : {};

  const jobs = {};
  for (const jobId of SCHEDULE_JOB_IDS) {
    const jobRaw = rawJobs[jobId] && typeof rawJobs[jobId] === 'object' ? rawJobs[jobId] : {};
    jobs[jobId] = {
      enabled: jobRaw.enabled !== false,
      weekdays: normalizeScheduleWeekdays(jobRaw.weekdays),
    };
  }

  const graceMinutes = Number(raw.graceMinutes);

  return {
    jobs,
    graceMinutes: Number.isFinite(graceMinutes) && graceMinutes >= 0 && graceMinutes <= 24 * 60
      ? Math.round(graceMinutes)
      : 90,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 200) : '',
  };
}

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

function getStatusMeta(run) {
  const status = getOpsAutomationPresentationStatus(run);
  switch (status) {
    case 'success':
      return {
        label: '成功',
        dotTone: 'ok',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
      };
    case 'partial':
      return {
        label: '部分成功',
        dotTone: 'notice',
        className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300',
      };
    case 'failure':
      return {
        label: '失败',
        dotTone: 'danger',
        className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
      };
    case 'skipped':
      return {
        label: '跳过',
        dotTone: 'warning',
        className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
      };
    default:
      return {
        label: status || '未知',
        dotTone: 'unknown',
        className: 'border-zinc-200 bg-zinc-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400',
      };
  }
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

function KeyValueList({ data }) {
  const entries = Object.entries(data || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== false);

  if (entries.length === 0) {
    return <span className="text-[11px] text-slate-400 dark:text-zinc-600">无</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span key={key} className="border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] text-slate-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          <span className="text-slate-400 dark:text-zinc-500">{key}</span>
          <span className="ml-1 font-mono">{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

function ScheduleSettingsSection({ showToast, delay = 0 }) {
  const scheduleRaw = useSiteConfigStore(s => s.config[SCHEDULE_CONFIG_KEY]);
  const updateConfig = useSiteConfigStore(s => s.updateConfig);
  const [draft, setDraft] = useState(() => normalizeScheduleConfig(scheduleRaw));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setDraft(normalizeScheduleConfig(scheduleRaw));
    }
  }, [scheduleRaw, dirty]);

  const updateJob = useCallback((jobId, patch) => {
    setDraft((prev) => ({
      ...prev,
      jobs: {
        ...prev.jobs,
        [jobId]: { ...prev.jobs[jobId], ...patch },
      },
    }));
    setDirty(true);
  }, []);

  const toggleWeekday = useCallback((jobId, weekday) => {
    setDraft((prev) => {
      const current = prev.jobs[jobId]?.weekdays || [];
      const next = current.includes(weekday)
        ? current.filter((item) => item !== weekday)
        : [...current, weekday].sort((left, right) => left - right);
      return {
        ...prev,
        jobs: {
          ...prev.jobs,
          [jobId]: { ...prev.jobs[jobId], weekdays: next },
        },
      };
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const normalized = normalizeScheduleConfig(draft);
      const emptyWeekdayJob = SCHEDULE_JOB_IDS.find((jobId) => (
        draft.jobs[jobId]?.enabled !== false
        && Array.isArray(draft.jobs[jobId]?.weekdays)
        && draft.jobs[jobId].weekdays.length === 0
      ));
      if (emptyWeekdayJob) {
        showToast?.('启用中的任务至少需要选择一个执行日；如需停用请直接关闭该任务。', 'error');
        return;
      }
      const ok = await updateConfig(SCHEDULE_CONFIG_KEY, JSON.stringify(normalized));
      if (ok) {
        setDraft(normalized);
        setDirty(false);
        showToast?.('执行时机设置已保存，下次定时触发开始生效', 'success');
      } else {
        showToast?.('执行时机设置保存失败', 'error');
      }
    } finally {
      setSaving(false);
    }
  }, [draft, showToast, updateConfig]);

  return (
    <PanelSection
      title="执行时机设置"
      icon={CalendarClock}
      delay={delay}
      action={(
        <PanelToolbarButton
          tone="primary"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          <Save size={13} />
          {saving ? '保存中...' : dirty ? '保存设置' : '已保存'}
        </PanelToolbarButton>
      )}
    >
      <div className="text-[11px] leading-4 text-slate-500 dark:text-zinc-500">
        Vercel Cron 每天北京时间 10:00 触发一次自动化。此处控制定时触发时每个任务是否执行、在周几执行；
        手动触发和重跑不受此设置限制。改动保存到站点配置后即对下一次定时触发生效。
      </div>

      <div className="mt-3 space-y-2">
        {SCHEDULE_JOB_IDS.map((jobId, index) => {
          const jobConfig = draft.jobs[jobId];
          const enabled = jobConfig?.enabled !== false;
          const weekdays = jobConfig?.weekdays || [];
          return (
            <div
              key={jobId}
              className="animate-fade-in-up-small flex flex-wrap items-center gap-x-4 gap-y-2 border border-zinc-100 px-2.5 py-2 transition-colors hover:border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <label className="flex min-w-[170px] cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => updateJob(jobId, { enabled: event.target.checked })}
                  className="accent-amber-500"
                />
                <StatusDot tone={enabled ? 'ok' : 'unknown'} />
                {getOpsAutomationJobLabel(jobId)}
              </label>
              <div className={`flex items-center gap-1 ${enabled ? '' : 'pointer-events-none opacity-40'}`}>
                <span className="mr-1 text-[11px] text-slate-400 dark:text-zinc-500">执行日</span>
                {WEEKDAY_LABELS.map((label, weekday) => {
                  const active = weekdays.includes(weekday);
                  return (
                    <button
                      key={weekday}
                      type="button"
                      onClick={() => toggleWeekday(jobId, weekday)}
                      className={`h-6 w-6 border text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-endfield-yellow/60 dark:bg-endfield-yellow/10 dark:text-endfield-yellow'
                          : 'border-zinc-200 text-slate-400 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-500 dark:hover:border-zinc-700'
                      }`}
                      aria-pressed={active}
                      aria-label={`周${label}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                {enabled
                  ? weekdays.length === 7 ? '每天执行' : weekdays.length === 0 ? '未选择执行日' : `每周 ${weekdays.map((item) => WEEKDAY_LABELS[item]).join('、')} 执行`
                  : '定时触发时跳过'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-zinc-400">
        <label className="flex items-center gap-2">
          <span>错过判定宽限</span>
          <input
            type="number"
            min="0"
            max="1440"
            value={draft.graceMinutes}
            onChange={(event) => {
              const value = Number(event.target.value);
              setDraft((prev) => ({ ...prev, graceMinutes: Number.isFinite(value) ? value : prev.graceMinutes }));
              setDirty(true);
            }}
            className={`w-20 ${FIELD_CLASS}`}
            aria-label="错过判定宽限分钟"
          />
          <span>分钟</span>
        </label>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0">备注</span>
          <input
            type="text"
            value={draft.note}
            maxLength={200}
            onChange={(event) => {
              const value = event.target.value;
              setDraft((prev) => ({ ...prev, note: value }));
              setDirty(true);
            }}
            placeholder="可选：记录调整原因"
            className={`min-w-0 flex-1 ${FIELD_CLASS}`}
            aria-label="执行时机备注"
          />
        </label>
      </div>
    </PanelSection>
  );
}

function RunCard({ run, selected = false, onSelect, onRerun, rerunning = false, index = 0 }) {
  const statusMeta = getStatusMeta(run);
  const summaryErrors = normalizeSummaryErrors(run?.summary);
  const summaryText = formatOpsAutomationRunSummary(run);
  const node = getOpsAutomationNode(run);
  return (
    <div
      className={`animate-fade-in-up-small border-b border-zinc-100 bg-white p-2.5 transition-colors hover:bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/30 ${
        selected ? 'border-l-2 border-l-amber-500 dark:border-l-endfield-yellow' : ''
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot tone={statusMeta.dotTone} pulse={statusMeta.dotTone === 'danger'} />
            <span className="text-xs font-medium text-slate-700 dark:text-zinc-200">
              {run.job_label || getOpsAutomationJobLabel(run.job_id)}
            </span>
            <span className={`border px-1.5 py-0.5 text-[10px] ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500">
              {run.trigger_type}
            </span>
            {node?.retryCount > 0 && (
              <span className="text-[10px] text-orange-600 dark:text-orange-300">
                重试 {node.retryCount}
              </span>
            )}
            <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400 dark:text-zinc-500">
              <Clock3 size={10} />
              {formatDateTime(run.created_at)}
            </span>
          </div>
          {run.error_message && (
            <div className="mt-1 line-clamp-2 text-[11px] text-red-600 dark:text-red-400">
              {run.error_message}
            </div>
          )}
          {summaryText && (
            <div className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-zinc-500">
              {summaryText}
            </div>
          )}
          {summaryErrors.length > 0 && (
            <div className="mt-2 border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="font-medium">摘要失败原因</div>
              <div className="mt-1 space-y-0.5">
                {summaryErrors.slice(0, 5).map((item, errorIndex) => (
                  <div key={`${item.sourceId || item.title || 'summary-error'}-${errorIndex}`} className="leading-relaxed">
                    <span className="font-medium">
                      {item.title || item.sourceId || `公告 ${errorIndex + 1}`}
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
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onSelect?.(run)}
            className="p-1.5 text-slate-500 transition-colors hover:bg-zinc-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="查看详情"
          >
            <Info size={14} />
          </button>
          <button
            type="button"
            onClick={() => onRerun?.(run)}
            disabled={rerunning}
            className="p-1.5 text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-900/20"
            title="重跑此任务"
          >
            <RotateCcw size={14} className={rerunning ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RunDetailPanel({ run, onRerun, rerunning = false }) {
  const node = getOpsAutomationNode(run);
  const attempts = normalizeOpsAutomationAttempts(run);
  const warnings = normalizeOpsAutomationWarnings(run);
  const statusMeta = getStatusMeta(run);
  const review = run?.review_bundle?.review || {};

  if (!run) {
    return null;
  }

  return (
    <PanelSection
      title="运行详情"
      icon={GitBranch}
      delay={120}
      bodyClassName="p-0"
      action={(
        <PanelToolbarButton onClick={() => onRerun?.(run)} disabled={rerunning}>
          <RotateCcw size={13} className={rerunning ? 'animate-spin' : ''} />
          {rerunning ? '重跑中...' : '重跑此任务'}
        </PanelToolbarButton>
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <StatusDot tone={statusMeta.dotTone} pulse={statusMeta.dotTone === 'danger'} />
        <span className="text-xs font-medium text-slate-700 dark:text-zinc-200">
          {run.job_label || getOpsAutomationJobLabel(run.job_id)}
        </span>
        <span className={`border px-1.5 py-0.5 text-[10px] ${statusMeta.className}`}>
          {getOpsAutomationStatusLabel(run)}
        </span>
        <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500">{run.trigger_type}</span>
        <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
          {formatDateTime(run.started_at || run.created_at)} → {formatDateTime(run.finished_at)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 text-xs md:grid-cols-4">
        <div className="border border-zinc-100 p-2.5 dark:border-zinc-800">
          <div className="text-[11px] text-slate-400 dark:text-zinc-500">耗时</div>
          <div className="mt-1 font-mono text-slate-700 dark:text-zinc-200">
            {formatOpsAutomationDuration(node?.durationMs)}
          </div>
        </div>
        <div className="border border-zinc-100 p-2.5 dark:border-zinc-800">
          <div className="text-[11px] text-slate-400 dark:text-zinc-500">重试</div>
          <div className="mt-1 font-mono text-slate-700 dark:text-zinc-200">
            {node?.retryCount || 0}/{node?.maxAttempts || attempts.length || 1}
          </div>
        </div>
        <div className="border border-zinc-100 p-2.5 dark:border-zinc-800">
          <div className="text-[11px] text-slate-400 dark:text-zinc-500">失败分类</div>
          <div className="mt-1 text-slate-700 dark:text-zinc-200">
            {getOpsAutomationFailureLabel(node?.failureType)}
          </div>
        </div>
        <div className="border border-zinc-100 p-2.5 dark:border-zinc-800">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500">
            <ShieldCheck size={12} />
            发布状态
          </div>
          <div className="mt-1 text-slate-700 dark:text-zinc-200">
            {review.published || node?.published ? '已发布' : '未产生发布写入'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 px-3 pb-3 xl:grid-cols-2">
        <div className="space-y-2.5">
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">输入源</div>
            <KeyValueList data={node?.input || { sourceTag: run.source_tag, sourceUrl: run.source_url }} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">输出摘要</div>
            <KeyValueList data={node?.output || run.summary} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">缓存失效</div>
            <KeyValueList data={node?.cacheInvalidation || { ok: false }} />
          </div>
        </div>
        <div className="space-y-2.5">
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">重试记录</div>
            {attempts.length === 0 ? (
              <div className="text-[11px] text-slate-400 dark:text-zinc-600">无重试记录</div>
            ) : (
              <div className="space-y-1.5">
                {attempts.map((attempt) => (
                  <div key={attempt.attempt} className="border border-zinc-100 px-2.5 py-1.5 text-[11px] dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-slate-700 dark:text-zinc-200">#{attempt.attempt}</span>
                      <span className="text-slate-500 dark:text-zinc-500">{attempt.status}</span>
                      <span className="font-mono text-slate-400 dark:text-zinc-600">{formatOpsAutomationDuration(attempt.durationMs)}</span>
                      {attempt.nextDelayMs ? (
                        <span className="text-orange-600 dark:text-orange-300">退避 {attempt.nextDelayMs}ms</span>
                      ) : null}
                    </div>
                    {attempt.errorMessage ? (
                      <div className="mt-1 break-all text-red-600 dark:text-red-400">{attempt.errorMessage}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          {warnings.length > 0 ? (
            <div className="border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200">
              <div className="font-medium">告警</div>
              <div className="mt-1 space-y-0.5">
                {warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`} className="break-all">{warning}</div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PanelSection>
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
    runningJobId,
    refreshRuns,
    setFilters,
    triggerJob,
    rerunRun,
    triggerSync,
    setupIssue,
  } = useOpsAutomation(showToast);

  const unregisteredRaw = useSiteConfigStore(s => s.config.unregistered_characters);
  const updateConfig = useSiteConfigStore(s => s.updateConfig);
  const [fullRefreshLimit, setFullRefreshLimit] = useState(50);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const runningAny = syncing || forceRefreshing || fullRefreshing || Boolean(runningJobId);
  const selectedRun = useMemo(() => (
    runs.find(run => run.id === selectedRunId) || runs[0] || null
  ), [runs, selectedRunId]);

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

  const handleSelectRun = useCallback((run) => {
    setSelectedRunId(run?.id || null);
  }, []);

  const handleRerunRun = useCallback(async (run) => {
    setSelectedRunId(run?.id || null);
    await rerunRun(run);
  }, [rerunRun]);

  return (
    <div className="space-y-3">
      <div className="animate-fade-in-up flex flex-wrap items-center justify-between gap-3 border border-l-4 border-zinc-200 border-l-amber-500 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:border-l-endfield-yellow dark:bg-zinc-900">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
          <Bot size={15} className="shrink-0 text-amber-500 dark:text-endfield-yellow" />
          <span>运营自动化 —— 公告和卡池每日自动同步（Vercel Cron），也可手动触发。</span>
        </div>
        <span className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
          展示最近 {runs.length} 条执行记录
        </span>
      </div>

      {unregisteredList.length > 0 && (
        <div className="animate-fade-in-up-small border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-amber-800 dark:text-amber-200">
                检测到 <strong>{unregisteredList.length}</strong> 个公告中提到但未收录的角色/武器：
              </p>
              <p className="mt-1 break-all text-amber-700 dark:text-amber-300">
                {unregisteredList.join('、')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('characters')}
                    className="border border-amber-300 bg-amber-200 px-2 py-1 text-[11px] text-amber-800 transition-colors hover:bg-amber-300 dark:border-amber-700 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
                  >
                    前往角色管理
                  </button>
                )}
                <button
                  onClick={dismissAlert}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-amber-600 transition-colors hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
                >
                  <X size={11} />
                  已处理，清除提醒
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PanelSection title="手动触发" icon={Play} delay={40}>
        <div className="flex flex-wrap items-center gap-2">
          <PanelToolbarButton tone="primary" onClick={() => triggerSync()} disabled={runningAny || loading}>
            {syncing ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
            {syncing ? '同步中...' : '增量同步公告'}
          </PanelToolbarButton>
          <PanelToolbarButton
            tone="danger"
            onClick={() => triggerSync({ refreshMode: 'summary' })}
            disabled={runningAny || loading}
            title="重新抓取公告，只对需要总结的长公告重新生成摘要并覆盖已有内容。"
          >
            <RefreshCw size={13} className={forceRefreshing ? 'animate-spin' : ''} />
            {forceRefreshing ? '刷新中...' : '强制刷新摘要'}
          </PanelToolbarButton>
          <button
            onClick={() => triggerSync({
              refreshMode: 'all',
              announcementLimit: fullRefreshLimit,
            })}
            disabled={runningAny || loading}
            className="inline-flex items-center gap-2 border border-purple-300 px-3 py-1.5 text-xs font-semibold text-purple-700 transition-all hover:bg-purple-50 disabled:opacity-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20"
            title={`重新抓取并覆盖最近 ${fullRefreshLimit} 条官方公告。长公告会调用 LLM，总结失败时保留官方原文。`}
          >
            <RefreshCw size={13} className={fullRefreshing ? 'animate-spin' : ''} />
            {fullRefreshing ? '刷新中...' : `强制刷新 ${fullRefreshLimit} 条公告`}
          </button>
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-500">
            <span>范围</span>
            {FULL_REFRESH_LIMIT_OPTIONS.map(limit => (
              <button
                key={limit}
                type="button"
                onClick={() => updateFullRefreshLimit(limit)}
                disabled={runningAny || loading}
                className={`border px-2 py-1 font-mono transition-colors disabled:opacity-50 ${
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
              disabled={runningAny || loading}
              className={`w-16 font-mono ${FIELD_CLASS}`}
              aria-label="强制刷新全部公告条数"
            />
            <span>条</span>
          </div>
          <PanelToolbarButton onClick={() => triggerJob('all')} disabled={runningAny || loading}>
            <GitBranch size={13} className={runningJobId === 'all' ? 'animate-pulse' : ''} />
            全链路同步
          </PanelToolbarButton>
          <PanelToolbarButton onClick={() => triggerJob('pool-schedule')} disabled={runningAny || loading}>
            <RefreshCw size={13} className={runningJobId === 'pool-schedule' ? 'animate-spin' : ''} />
            同步卡池
          </PanelToolbarButton>
          <PanelToolbarButton onClick={() => triggerJob('wiki-catalog')} disabled={runningAny || loading}>
            <AlertTriangle size={13} className={runningJobId === 'wiki-catalog' ? 'animate-pulse' : ''} />
            图鉴巡检
          </PanelToolbarButton>
          <PanelToolbarButton onClick={refreshRuns} disabled={loading || runningAny}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            刷新记录
          </PanelToolbarButton>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <label className="text-[11px] text-slate-500 dark:text-zinc-400">
            <span className="mb-1 block">任务</span>
            <select
              value={filters.jobId}
              onChange={(event) => updateFilter('jobId', event.target.value)}
              className={`w-full ${FIELD_CLASS}`}
            >
              {JOB_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-slate-500 dark:text-zinc-400">
            <span className="mb-1 block">状态</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
              className={`w-full ${FIELD_CLASS}`}
            >
              {STATUS_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-slate-500 dark:text-zinc-400">
            <span className="mb-1 block">来源</span>
            <select
              value={filters.triggerType}
              onChange={(event) => updateFilter('triggerType', event.target.value)}
              className={`w-full ${FIELD_CLASS}`}
            >
              {TRIGGER_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </PanelSection>

      <ScheduleSettingsSection showToast={showToast} delay={80} />

      {setupIssue && (
        <div className="animate-fade-in-up-small border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          {setupIssue.message}
        </div>
      )}

      {selectedRun && (
        <RunDetailPanel
          run={selectedRun}
          onRerun={handleRerunRun}
          rerunning={runningJobId === selectedRun.job_id}
        />
      )}

      <PanelSection title="执行记录" icon={Database} delay={160} bodyClassName="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400 dark:text-zinc-500">
            <RefreshCw size={18} className="animate-spin" />
            <span className="text-[11px] uppercase tracking-widest">正在读取执行记录</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 dark:text-zinc-500">
            <Database size={36} className="mx-auto mb-3 opacity-50" />
            <p className="text-xs">暂无自动化执行记录</p>
          </div>
        ) : (
          <VirtualizedList
            items={runs}
            getKey={(run) => run.id}
            itemHeight={126}
            maxHeight={560}
            className="bg-white dark:bg-zinc-900"
            renderItem={(run, index) => (
              <RunCard
                run={run}
                index={index}
                selected={selectedRun?.id === run.id}
                onSelect={handleSelectRun}
                onRerun={handleRerunRun}
                rerunning={runningJobId === run.job_id}
              />
            )}
          />
        )}
      </PanelSection>
    </div>
  );
};

export default AutomationPanel;
