import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Play,
  Mail,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import {
  drainMailOutbox,
  loadSiteHealth,
  sendAdminAlertMail,
  sendMailSmokeTest,
  updateMailBudgetConfig,
  updateMailRuntimeConfig,
} from '../../../services/admin/siteHealthService.js';

const MAIL_RUNTIME_EVENTS = [
  { key: 'authMailActions', label: '认证邮件' },
  { key: 'accountRecoveryOutbox', label: '账号恢复 outbox' },
  { key: 'developerApiReview', label: '开发者 API 审核' },
  { key: 'ticketReply', label: '工单 staff 回复' },
  { key: 'adminAlert', label: '管理员告警' },
];

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

function countValue(counts, key) {
  return Number(counts?.[key] || 0);
}

function formatPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  return `${Math.round(number * 100)}%`;
}

function formatWindow(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '未配置';
  if (total % 86400 === 0) return `${total / 86400} 天`;
  if (total % 3600 === 0) return `${total / 3600} 小时`;
  if (total % 60 === 0) return `${total / 60} 分钟`;
  return `${total} 秒`;
}

function runtimeSelectValue(value) {
  if (value === true) return 'enabled';
  if (value === false) return 'disabled';
  return 'inherit';
}

function runtimeSelectToValue(value) {
  if (value === 'enabled') return true;
  if (value === 'disabled') return false;
  return null;
}

function listToText(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join(', ');
}

function textToList(value, { lowercase = false } = {}) {
  return Array.from(new Set(
    String(value || '')
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => (lowercase ? item.toLowerCase() : item))
  ));
}

function buildRuntimeDraft(runtime) {
  const config = runtime?.config || {};
  const events = config.events || {};
  const controls = config.controls || {};
  return {
    events: Object.fromEntries(
      MAIL_RUNTIME_EVENTS.map(({ key }) => [key, runtimeSelectValue(events[key])])
    ),
    killSwitch: runtimeSelectValue(controls.killSwitch),
    disabledEvents: listToText(controls.disabledEvents),
    pausedDomains: listToText(controls.pausedDomains),
    note: config.note || '',
  };
}

function buildBudgetDrafts(items = []) {
  return Object.fromEntries(
    (Array.isArray(items) ? items : []).map((item) => [
      `${item.scope}:${item.eventType}`,
      {
        windowSeconds: String(item.windowSeconds || ''),
        maxAttempts: String(item.maxAttempts || ''),
        enabled: item.enabled !== false,
      },
    ])
  );
}

function summarizeRedactedError(error) {
  if (!error || typeof error !== 'object') return '';
  const parts = [
    error.code ? `code=${error.code}` : '',
    error.reason ? `reason=${error.reason}` : '',
    error.retryable !== undefined ? `retryable=${error.retryable ? 'yes' : 'no'}` : '',
    error.dryRun !== undefined ? `演练模式=${error.dryRun ? '是' : '否'}` : '',
  ].filter(Boolean);
  return parts.join(' / ');
}

function runtimeStatusLabel(status) {
  if (status === 'enabled') return '运行期允许';
  if (status === 'disabled') return '运行期关闭';
  return '继承环境变量';
}

function effectiveEventLabel(eventState) {
  if (!eventState?.envEnabled) return '环境变量关闭';
  if (!eventState?.effective) return '运行期关闭';
  return '可用';
}

function BooleanBadge({ value, label, falseLabel }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-1 text-xs ${
      value
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
        : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400'
    }`}
    >
      {value ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
      {value ? label : (falseLabel || label)}
    </span>
  );
}

function formatProviderKey(providerKey, dryRun) {
  const raw = String(providerKey || '').trim();
  const base = raw.replace(/:dry-run$/i, '') || '未配置';
  return dryRun ? `${base}（演练模式）` : base;
}

function RiskBadge({ risk }) {
  const styles = {
    exceeded: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
    notice: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
    disabled: 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  };
  const labels = {
    exceeded: '超限',
    warning: '高水位',
    notice: '观察',
    disabled: '停用',
    ok: '正常',
  };

  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[11px] ${styles[risk] || styles.ok}`}>
      {labels[risk] || risk || '正常'}
    </span>
  );
}

function MetricCard({ label, value, detail, tone = 'default' }) {
  const toneClass = {
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
    notice: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
    default: 'border-zinc-200 bg-zinc-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200',
  }[tone];

  return (
    <div className={`min-h-[94px] border p-3 ${toneClass}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold leading-none">{value}</div>
      {detail ? <div className="mt-2 text-xs opacity-75">{detail}</div> : null}
    </div>
  );
}

function CountList({ counts, labels }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {labels.map(({ key, label }) => (
        <div key={key} className="border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
          <div className="text-slate-400 dark:text-zinc-500">{label}</div>
          <div className="mt-1 font-mono text-lg text-slate-700 dark:text-zinc-200">{countValue(counts, key)}</div>
        </div>
      ))}
    </div>
  );
}

export default function MailStatusPanel({ showToast }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draining, setDraining] = useState(false);
  const [smokeTesting, setSmokeTesting] = useState(false);
  const [smokeRecipient, setSmokeRecipient] = useState('');
  const [alertSending, setAlertSending] = useState(false);
  const [alertSummary, setAlertSummary] = useState('');
  const [error, setError] = useState('');
  const [drainResult, setDrainResult] = useState(null);
  const [smokeResult, setSmokeResult] = useState(null);
  const [alertResult, setAlertResult] = useState(null);
  const [runtimeDraft, setRuntimeDraft] = useState(buildRuntimeDraft(null));
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [budgetDrafts, setBudgetDrafts] = useState({});
  const [budgetSavingKey, setBudgetSavingKey] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setHealth(await loadSiteHealth());
    } catch (refreshError) {
      const message = refreshError?.message || '邮件状态读取失败';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setRuntimeDraft(buildRuntimeDraft(health?.mail?.runtime || null));
  }, [health?.mail?.runtime]);

  useEffect(() => {
    setBudgetDrafts(buildBudgetDrafts(health?.mail?.budgets?.items || health?.mail?.budgets?.topItems || []));
  }, [health?.mail?.budgets?.items, health?.mail?.budgets?.topItems]);

  const handleDrain = useCallback(async () => {
    setDraining(true);
    setError('');
    setDrainResult(null);
    try {
      const result = await drainMailOutbox();
      setDrainResult(result);
      const stats = result?.stats || {};
      showToast?.(
        result?.skipped
          ? `邮件队列未处理：${result.code || 'skipped'}`
          : `邮件队列处理完成：真实发送 ${stats.sent || 0}，演练 ${stats.dryRun || 0}，失败 ${stats.failed || 0}`,
        result?.ok ? 'success' : 'warning'
      );
      await refresh();
    } catch (drainError) {
      const message = drainError?.message || '邮件队列处理失败';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setDraining(false);
    }
  }, [refresh, showToast]);

  const handleSmokeTest = useCallback(async (event) => {
    event.preventDefault();
    const recipientEmail = smokeRecipient.trim();
    if (!recipientEmail) {
      const message = '请先填写测试收件邮箱';
      setError(message);
      showToast?.(message, 'warning');
      return;
    }

    setSmokeTesting(true);
    setError('');
    setSmokeResult(null);
    try {
      const result = await sendMailSmokeTest({
        recipientEmail,
        locale: 'zh-CN',
      });
      setSmokeResult(result);
      const text = result?.skipped
        ? `测试邮件未发送：${result.reason || result.code || 'skipped'}`
        : (result?.dryRun
          ? `测试邮件演练通过：${result.code || '演练模式'}`
          : `测试邮件已提交：${result.code || 'accepted'}`);
      showToast?.(text, result?.ok ? 'success' : 'warning');
      await refresh();
    } catch (smokeError) {
      const message = smokeError?.message || '测试邮件发送失败';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setSmokeTesting(false);
    }
  }, [refresh, showToast, smokeRecipient]);

  const handleAdminAlert = useCallback(async (event) => {
    event.preventDefault();
    const summary = alertSummary.trim();

    setAlertSending(true);
    setError('');
    setAlertResult(null);
    try {
      const result = await sendAdminAlertMail({
        summary: summary || undefined,
        locale: 'zh-CN',
      });
      setAlertResult(result);
      const status = result?.status || 'unknown';
      const code = result?.code || 'admin_alert_mail_result';
      showToast?.(
        `管理员告警邮件：${status} / ${code}`,
        ['queued', 'deduped'].includes(status) ? 'success' : 'warning'
      );
      await refresh();
    } catch (alertError) {
      const message = alertError?.message || '管理员告警邮件入队失败';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setAlertSending(false);
    }
  }, [alertSummary, refresh, showToast]);

  const handleRuntimeEventChange = useCallback((key, value) => {
    setRuntimeDraft((current) => ({
      ...current,
      events: {
        ...current.events,
        [key]: value,
      },
    }));
  }, []);

  const handleRuntimeFieldChange = useCallback((key, value) => {
    setRuntimeDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const handleRuntimeSave = useCallback(async (event) => {
    event.preventDefault();
    setRuntimeSaving(true);
    setError('');
    try {
      await updateMailRuntimeConfig({
        events: Object.fromEntries(
          MAIL_RUNTIME_EVENTS.map(({ key }) => [key, runtimeSelectToValue(runtimeDraft.events?.[key])])
        ),
        controls: {
          killSwitch: runtimeSelectToValue(runtimeDraft.killSwitch),
          disabledEvents: textToList(runtimeDraft.disabledEvents),
          pausedDomains: textToList(runtimeDraft.pausedDomains, { lowercase: true }),
        },
        note: runtimeDraft.note,
      });
      showToast?.('邮件运行期开关已保存', 'success');
      await refresh();
    } catch (saveError) {
      const message = saveError?.message || '邮件运行期开关保存失败';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setRuntimeSaving(false);
    }
  }, [refresh, runtimeDraft, showToast]);

  const handleBudgetDraftChange = useCallback((item, key, value) => {
    const draftKey = `${item.scope}:${item.eventType}`;
    setBudgetDrafts((current) => ({
      ...current,
      [draftKey]: {
        ...current[draftKey],
        [key]: value,
      },
    }));
  }, []);

  const handleBudgetSave = useCallback(async (item) => {
    const draftKey = `${item.scope}:${item.eventType}`;
    const draft = budgetDrafts[draftKey] || {};
    const windowSeconds = Number.parseInt(draft.windowSeconds, 10);
    const maxAttempts = Number.parseInt(draft.maxAttempts, 10);

    if (!Number.isFinite(windowSeconds) || windowSeconds < 60) {
      showToast?.('邮件预算窗口至少需要 60 秒', 'warning');
      return;
    }
    if (!Number.isFinite(maxAttempts) || maxAttempts < 1) {
      showToast?.('邮件预算上限至少需要 1 次', 'warning');
      return;
    }

    setBudgetSavingKey(draftKey);
    setError('');
    try {
      await updateMailBudgetConfig({
        item: {
          scope: item.scope,
          eventType: item.eventType,
          windowSeconds,
          maxAttempts,
          enabled: draft.enabled !== false,
        },
      });
      showToast?.(`邮件预算已保存：${item.scope} / ${item.eventType}`, 'success');
      await refresh();
    } catch (saveError) {
      const message = saveError?.message || '邮件预算配置保存失败';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setBudgetSavingKey('');
    }
  }, [budgetDrafts, refresh, showToast]);

  const mail = health?.mail || {};
  const config = mail.config || {};
  const runtime = mail.runtime || {};
  const outbox = mail.outbox || {};
  const suppression = mail.suppression || {};
  const deliveryEvents = mail.deliveryEvents || {};
  const budgets = mail.budgets || {};
  const budgetItems = budgets.items || budgets.topItems || [];
  const generatedAt = health?.generatedAt;
  const warnings = useMemo(() => [
    ...(mail.warnings || []),
    ...((health?.warnings || []).filter(item => String(item).toLowerCase().includes('mail'))),
  ], [health?.warnings, mail.warnings]);
  const queued = countValue(outbox.countsByStatus, 'queued');
  const failed = countValue(outbox.countsByStatus, 'failed');
  const suppressed = countValue(outbox.countsByStatus, 'suppressed');
  const dueQueued = Number(outbox.dueQueued || 0);
  const inboundCount = Number(deliveryEvents.inboundCount || 0);
  const highWaterBudgetCount = Number(budgets.highWaterCount || 0);
  const canDrain = !loading && !draining;
  const canSmokeTest = !loading && !smokeTesting;
  const canSendAlert = !loading && !alertSending;
  const canSaveRuntime = !loading && !runtimeSaving;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
            <Mail size={16} />
            <span>查看邮件 outbox、投递事件、suppression 和发信开关。这里不显示原始邮箱或密钥。</span>
          </div>
          {generatedAt ? (
            <div className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
              生成时间：{formatDateTime(generatedAt)}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDrain}
            disabled={!canDrain}
            className="inline-flex items-center gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
          >
            {draining ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
            处理到期队列
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={loading || draining}
            className="inline-flex items-center gap-2 border border-zinc-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
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
      ) : (
        <>
          <div className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-zinc-200">发信开关</div>
            <div className="flex flex-wrap gap-2">
              <BooleanBadge value={config.workerEnabled === true} label="队列处理器已启用" falseLabel="队列处理器未启用" />
              <BooleanBadge value={config.killSwitch === false} label="环境紧急停发已关闭" falseLabel="环境紧急停发已开启" />
              <BooleanBadge value={config.effectiveKillSwitch === false} label="最终紧急停发已关闭" falseLabel="最终紧急停发已开启" />
              <BooleanBadge value={config.dryRun === false} label="真实发信模式" falseLabel="演练模式" />
              <BooleanBadge value={config.stalwartSmtpConfigured === true} label="Stalwart SMTP 已配置" falseLabel="Stalwart SMTP 未配置" />
              <BooleanBadge value={config.deliveryFeedbackSecretConfigured === true} label="投递反馈 Secret 已配置" falseLabel="投递反馈 Secret 未配置" />
              <BooleanBadge value={config.inboundWebhookSecretConfigured === true} label="入站 Webhook Secret 已配置" falseLabel="入站 Webhook Secret 未配置" />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 dark:text-zinc-500 md:grid-cols-3">
              <div>Provider：{config.provider || '未配置'}</div>
              <div>服务标识：{formatProviderKey(config.providerKey, config.dryRun)}</div>
              <div>发信域：{config.sendingDomain || config.fromDomain || '未配置'}</div>
            </div>
          </div>

          <section className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
              <SlidersHorizontal size={16} className="text-blue-500" />
              运行期开关
            </div>
            <div className="mb-3 text-xs text-slate-500 dark:text-zinc-500">
              运行期开关只会进一步收紧发信范围；环境变量关闭时，这里选择“允许”也不会绕过硬闸门。此处不保存 SMTP 密码、Webhook Secret 或任何 Vercel 环境变量。
            </div>
            <form onSubmit={handleRuntimeSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-500 dark:text-zinc-500">
                  <span>运行期紧急停发</span>
                  <select
                    value={runtimeDraft.killSwitch}
                    onChange={(event) => handleRuntimeFieldChange('killSwitch', event.target.value)}
                    className="min-h-10 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  >
                    <option value="inherit">继承环境变量</option>
                    <option value="enabled">开启紧急停发</option>
                    <option value="disabled">关闭运行期紧急停发</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-slate-500 dark:text-zinc-500">
                  <span>备注</span>
                  <input
                    value={runtimeDraft.note}
                    onChange={(event) => handleRuntimeFieldChange('note', event.target.value)}
                    maxLength={240}
                    placeholder="可选：记录本次调整原因"
                    className="min-h-10 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                {MAIL_RUNTIME_EVENTS.map(({ key, label }) => {
                  const eventState = runtime?.events?.[key] || {};
                  return (
                    <label key={key} className="space-y-1 text-xs text-slate-500 dark:text-zinc-500">
                      <span>{label}</span>
                      <select
                        value={runtimeDraft.events?.[key] || 'inherit'}
                        onChange={(event) => handleRuntimeEventChange(key, event.target.value)}
                        className="min-h-10 w-full border border-zinc-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                      >
                        <option value="inherit">继承</option>
                        <option value="enabled">允许</option>
                        <option value="disabled">关闭</option>
                      </select>
                      <span className="block text-[11px] text-slate-400 dark:text-zinc-600">
                        {runtimeStatusLabel(eventState.runtime)} / {effectiveEventLabel(eventState)}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-500 dark:text-zinc-500">
                  <span>运行期禁用事件</span>
                  <input
                    value={runtimeDraft.disabledEvents}
                    onChange={(event) => handleRuntimeFieldChange('disabledEvents', event.target.value)}
                    placeholder="password_reset, ticket_reply"
                    className="min-h-10 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-500 dark:text-zinc-500">
                  <span>运行期暂停域名</span>
                  <input
                    value={runtimeDraft.pausedDomains}
                    onChange={(event) => handleRuntimeFieldChange('pausedDomains', event.target.value)}
                    placeholder="example.com, blocked.example"
                    className="min-h-10 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-500">
                <span>
                  环境硬闸门：队列处理器 {runtime?.hardLimits?.workerEnabled ? '开启' : '关闭'} / 环境紧急停发 {runtime?.hardLimits?.envKillSwitch ? '开启' : '关闭'} / 运行期紧急停发 {runtime?.controls?.runtimeKillSwitch || 'inherit'}
                </span>
                <button
                  type="submit"
                  disabled={!canSaveRuntime}
                  className="inline-flex min-h-10 items-center justify-center gap-2 border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50"
                >
                  {runtimeSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  保存运行期开关
                </button>
              </div>
            </form>
          </section>

          {warnings.length > 0 ? (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle size={16} />
                邮件检查告警
              </div>
              <div className="mt-2 space-y-1 text-xs">
                {warnings.slice(0, 8).map((warning, index) => (
                  <div key={`${warning}-${index}`} className="break-all">{warning}</div>
                ))}
              </div>
            </div>
          ) : null}

          {drainResult ? (
            <div className="border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <div className="font-medium">最近一次队列处理：{drainResult.code || 'unknown'}</div>
              <div className="mt-1 text-xs">
                读取 {drainResult.stats?.loaded || 0} / 真实发送 {drainResult.stats?.sent || 0} / 演练 {drainResult.stats?.dryRun || 0} / 失败 {drainResult.stats?.failed || 0} / 重试 {drainResult.stats?.retried || 0}
              </div>
            </div>
          ) : null}

          <section className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
              <Send size={16} className="text-blue-500" />
              测试邮件
            </div>
            <form onSubmit={handleSmokeTest} className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                type="email"
                value={smokeRecipient}
                onChange={(event) => setSmokeRecipient(event.target.value)}
                placeholder="测试收件邮箱"
                className="min-h-10 border border-zinc-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              />
              <button
                type="submit"
                disabled={!canSmokeTest}
                className="inline-flex min-h-10 items-center justify-center gap-2 border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50"
              >
                {smokeTesting ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                发送测试
              </button>
            </form>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
              测试邮件会写入脱敏投递事件；如果当前是演练模式或队列处理器未启用，页面只显示配置结果，不会伪装成真实投递。
            </div>
            {smokeResult ? (
              <div className={`mt-3 border px-3 py-2 text-xs ${
                smokeResult.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
              }`}
              >
                <div className="font-medium">{smokeResult.code || 'mail_smoke_test_result'}</div>
                <div className="mt-1">
                  服务 {formatProviderKey(smokeResult.providerKey, smokeResult.dryRun)} / 模式 {smokeResult.dryRun ? '演练' : '真实发信'} / 收件人 {smokeResult.recipient?.redacted || 'redacted'}
                </div>
                {smokeResult.reason ? <div className="mt-1 break-all opacity-80">{smokeResult.reason}</div> : null}
                {Array.isArray(smokeResult.requiredEnv) && smokeResult.requiredEnv.length > 0 ? (
                  <div className="mt-1 opacity-80">
                    需要配置：{smokeResult.requiredEnv.map(item => `${item.name}=${item.expected}`).join('，')}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
              <ShieldAlert size={16} className="text-amber-500" />
              管理员告警邮件
            </div>
            <form onSubmit={handleAdminAlert} className="space-y-3">
              <textarea
                value={alertSummary}
                onChange={(event) => setAlertSummary(event.target.value)}
                rows={3}
                maxLength={240}
                placeholder="可选：填写一条脱敏告警摘要"
                className="w-full resize-y border border-zinc-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-zinc-500">
                  只会入队发给当前超级管理员自己的账号邮箱，用于验证 admin.alert 链路；不支持任意收件人或批量发送。
                </div>
                <button
                  type="submit"
                  disabled={!canSendAlert}
                  className="inline-flex min-h-10 items-center justify-center gap-2 border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
                >
                  {alertSending ? <RefreshCw size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
                  入队告警
                </button>
              </div>
            </form>
            {alertResult ? (
              <div className={`mt-3 border px-3 py-2 text-xs ${
                ['queued', 'deduped'].includes(alertResult.status)
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
              }`}
              >
                <div className="font-medium">{alertResult.status || 'unknown'} / {alertResult.code || 'admin_alert_mail_result'}</div>
                <div className="mt-1">
                  enabled {alertResult.enabled ? 'yes' : 'no'} / attempted {alertResult.attempted ? 'yes' : 'no'} / outbox {alertResult.outboxId || 'n/a'}
                </div>
              </div>
            ) : null}
          </section>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <MetricCard label="待发送总数" value={queued} detail="当前 queued outbox 总数" tone={queued > 0 ? 'notice' : 'default'} />
            <MetricCard label="到期队列" value={dueQueued} detail="queued 且已到 next_attempt_at" tone={dueQueued > 0 ? 'notice' : 'default'} />
            <MetricCard label="失败" value={failed} detail="需要人工排查或等待重试" tone={failed > 0 ? 'warning' : 'default'} />
            <MetricCard label="Suppressed" value={suppressed} detail="已被退信 / 投诉 / 暂停拦截" tone={suppressed > 0 ? 'warning' : 'default'} />
            <MetricCard label="活跃 suppression" value={suppression.active || 0} detail="邮箱 hash 或域名停发规则" tone={Number(suppression.active || 0) > 0 ? 'warning' : 'default'} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard label="入站事件" value={inboundCount} detail="由 /api/mail-inbound 脱敏记录" tone={inboundCount > 0 ? 'notice' : 'default'} />
            <MetricCard label="投递事件样本" value={deliveryEvents.sampled || 0} detail="最近 mail_delivery_events 采样数" />
            <MetricCard label="预算高水位" value={highWaterBudgetCount} detail="warning / exceeded 配置项" tone={highWaterBudgetCount > 0 ? 'warning' : 'default'} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                <Clock3 size={16} className="text-amber-500" />
                Outbox 状态
              </div>
              <CountList
                counts={outbox.countsByStatus}
                labels={[
                  { key: 'queued', label: 'Queued' },
                  { key: 'sending', label: 'Sending' },
                  { key: 'sent', label: 'Sent' },
                  { key: 'failed', label: 'Failed' },
                  { key: 'suppressed', label: 'Suppressed' },
                  { key: 'cancelled', label: 'Cancelled' },
                ]}
              />
              <div className="mt-3 text-xs text-slate-400 dark:text-zinc-500">
                最近更新时间：{formatDateTime(outbox.latestAt)}（{formatAge(outbox.latestAt, generatedAt)}）
              </div>
            </section>

            <section className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                <ShieldAlert size={16} className="text-amber-500" />
                Suppression
              </div>
              <CountList
                counts={suppression.countsByReason}
                labels={[
                  { key: 'hard_bounce', label: 'Hard bounce' },
                  { key: 'complaint', label: 'Complaint' },
                  { key: 'invalid_recipient', label: 'Invalid recipient' },
                  { key: 'domain_pause', label: 'Domain pause' },
                ]}
              />
              <div className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
                活跃域名：{(suppression.domains || []).join('、') || '无'}
              </div>
            </section>
          </div>

          <section className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                <ShieldAlert size={16} className="text-blue-500" />
                邮件发送预算
              </div>
              <div className="text-xs text-slate-400 dark:text-zinc-500">
                配置 {budgets.sampledConfig || 0} 项 / 活跃计数桶 {budgets.activeCounters || 0} / 最近更新 {formatDateTime(budgets.latestAt)}
              </div>
            </div>
            {budgetItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-zinc-500">
                暂无预算计数。真实入队后会显示各事件类型的使用率。
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {budgetItems.map((item) => {
                  const draftKey = `${item.scope}:${item.eventType}`;
                  const draft = budgetDrafts[draftKey] || {
                    windowSeconds: String(item.windowSeconds || ''),
                    maxAttempts: String(item.maxAttempts || ''),
                    enabled: item.enabled !== false,
                  };
                  const saving = budgetSavingKey === draftKey;
                  return (
                  <div key={draftKey} className="grid grid-cols-1 gap-3 py-3 text-xs md:grid-cols-[1.1fr_0.9fr_1.1fr_1.4fr]">
                    <div className="min-w-0">
                      <div className="font-mono text-slate-700 dark:text-zinc-200">{item.scope} / {item.eventType}</div>
                      <div className="mt-1 text-slate-400 dark:text-zinc-500">当前窗口 {formatWindow(item.windowSeconds)} · buckets {item.activeBuckets || 0}</div>
                    </div>
                    <div>
                      <RiskBadge risk={item.risk} />
                      <div className="mt-1 text-slate-400 dark:text-zinc-500">重置：{formatDateTime(item.resetAt)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="h-2 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={`h-full ${
                            item.risk === 'exceeded'
                              ? 'bg-red-500'
                              : item.risk === 'warning'
                                ? 'bg-amber-500'
                                : item.risk === 'notice'
                                  ? 'bg-blue-500'
                                  : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, Number(item.usageRatio || 0) * 100))}%` }}
                        />
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-zinc-400">
                        {formatPercent(item.usageRatio)} · 已用 {item.maxUsed || 0} / 上限 {item.maxAttempts || 0}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-[0.9fr_0.9fr_0.8fr_auto]">
                      <label className="space-y-1 text-[11px] text-slate-400 dark:text-zinc-500">
                        <span>窗口秒</span>
                        <input
                          type="number"
                          min="60"
                          max="31536000"
                          value={draft.windowSeconds}
                          onChange={(event) => handleBudgetDraftChange(item, 'windowSeconds', event.target.value)}
                          className="min-h-9 w-full border border-zinc-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] text-slate-400 dark:text-zinc-500">
                        <span>上限</span>
                        <input
                          type="number"
                          min="1"
                          max="1000000"
                          value={draft.maxAttempts}
                          onChange={(event) => handleBudgetDraftChange(item, 'maxAttempts', event.target.value)}
                          className="min-h-9 w-full border border-zinc-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                        />
                      </label>
                      <label className="flex min-h-9 items-end gap-2 text-[11px] text-slate-500 dark:text-zinc-500">
                        <input
                          type="checkbox"
                          checked={draft.enabled !== false}
                          onChange={(event) => handleBudgetDraftChange(item, 'enabled', event.target.checked)}
                          className="mb-1"
                        />
                        启用
                      </label>
                      <button
                        type="button"
                        onClick={() => handleBudgetSave(item)}
                        disabled={Boolean(budgetSavingKey)}
                        className="inline-flex min-h-9 items-center justify-center gap-1 border border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
                      >
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        保存
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-zinc-200">最近失败 / Suppressed outbox</div>
            {(outbox.latestFailures || []).length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-zinc-500">暂无失败记录</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {outbox.latestFailures.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 gap-2 py-3 text-xs md:grid-cols-[1.1fr_0.9fr_0.9fr_1.4fr]">
                    <div className="min-w-0">
                      <div className="font-mono text-slate-600 dark:text-zinc-300 break-all">{row.id}</div>
                      <div className="mt-1 text-slate-400 dark:text-zinc-500">{formatDateTime(row.updatedAt)}</div>
                    </div>
                    <div>{row.eventType || 'unknown'} / {row.status || 'unknown'}</div>
                    <div>{row.recipientDomain || '无域名'} / attempts {row.attemptCount || 0}</div>
                    <div className="min-w-0 text-slate-400 dark:text-zinc-500">
                      <div>{row.lastErrorCode || '无错误码'}</div>
                      {summarizeRedactedError(row.lastError) ? (
                        <div className="mt-1 break-all text-[11px] text-slate-500 dark:text-zinc-400">
                          {summarizeRedactedError(row.lastError)}
                        </div>
                      ) : null}
                      {row.lastError?.diagnostics ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] text-blue-500">脱敏诊断</summary>
                          <pre className="mt-1 max-h-28 overflow-auto bg-zinc-50 p-2 text-[10px] leading-relaxed text-slate-500 dark:bg-zinc-950 dark:text-zinc-400">
                            {JSON.stringify(row.lastError.diagnostics, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-zinc-200">最近投递事件</div>
            {(deliveryEvents.latestEvents || []).length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-zinc-500">暂无投递事件</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {deliveryEvents.latestEvents.map((event) => (
                  <div key={event.id} className="grid grid-cols-1 gap-2 py-3 text-xs md:grid-cols-[1.2fr_1fr_1fr]">
                    <div className="font-mono text-slate-600 dark:text-zinc-300">{event.id}</div>
                    <div>{event.providerKey || 'unknown'} / {event.eventType || 'unknown'}</div>
                    <div className="text-slate-400 dark:text-zinc-500">{formatDateTime(event.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
