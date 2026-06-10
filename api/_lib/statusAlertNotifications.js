import { sendTelegramMessage } from '../../bots/official/adapters/telegram.js';

const ALERT_LEVELS = ['ok', 'notice', 'warning', 'unknown'];

function readEnvironment() {
  return globalThis.process?.env || {};
}

function normalizeStatus(status, fallback = 'unknown') {
  const normalized = String(status || '').trim().toLowerCase();
  return ALERT_LEVELS.includes(normalized) ? normalized : fallback;
}

function toIsoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function clampText(value, maxLength = 240) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function getTelegramConfig(env = readEnvironment()) {
  const token = String(
    env.STATUS_ALERT_TELEGRAM_BOT_TOKEN
    || env.TELEGRAM_STATUS_BOT_TOKEN
    || env.TG_BOT_TOKEN
    || ''
  ).trim();
  const chatId = String(
    env.STATUS_ALERT_TELEGRAM_CHAT_ID
    || env.TELEGRAM_STATUS_CHAT_ID
    || env.TG_CHAT_ID
    || ''
  ).trim();

  if (!token || !chatId) {
    return null;
  }

  return {
    token,
    chatId,
    proxyUrl: String(
      env.STATUS_ALERT_TELEGRAM_PROXY_URL
      || env.TELEGRAM_OFFICIAL_BOT_PROXY_URL
      || ''
    ).trim(),
  };
}

function shouldNotify(previous, nextStatus) {
  const previousStatus = previous?.status ? normalizeStatus(previous.status) : null;
  if (!previousStatus) {
    return nextStatus !== 'ok';
  }

  if (previousStatus === nextStatus) {
    return false;
  }

  return previousStatus !== 'ok' || nextStatus !== 'ok';
}

function getStatusText(status) {
  if (status === 'ok') return '已恢复';
  if (status === 'notice') return '需要关注';
  if (status === 'warning') return '需要处理';
  return '无法确认';
}

function buildTelegramText(target, previousStatus, nextStatus, now) {
  const title = nextStatus === 'ok' ? '服务状态恢复' : '服务状态告警';
  return [
    title,
    '━━━━━━━━━━━━━━━',
    `对象: ${target.label}`,
    `类型: ${target.type === 'probe' ? 'VPS 探针' : '网站端点'}`,
    `状态: ${previousStatus ? `${getStatusText(previousStatus)} -> ` : ''}${getStatusText(nextStatus)}`,
    target.summary ? `摘要: ${target.summary}` : null,
    `时间: ${toIsoTimestamp(now)}`,
  ].filter(Boolean).join('\n');
}

async function readPreviousState(supabase, target) {
  const { data, error } = await supabase
    .from('status_alert_state')
    .select('target_type,target_id,label,status,summary,last_notified_status,last_changed_at,last_notified_at,updated_at')
    .eq('target_type', target.type)
    .eq('target_id', target.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function writeAlertState(supabase, target, {
  previous = null,
  notified = false,
  now = new Date(),
} = {}) {
  const nextStatus = normalizeStatus(target.status);
  const previousStatus = previous?.status ? normalizeStatus(previous.status) : null;
  const changed = previousStatus !== nextStatus;
  const nowIso = toIsoTimestamp(now);

  const row = {
    target_type: target.type,
    target_id: target.id,
    label: target.label,
    status: nextStatus,
    summary: target.summary || null,
    last_notified_status: notified ? nextStatus : previous?.last_notified_status || null,
    last_changed_at: changed ? nowIso : previous?.last_changed_at || nowIso,
    last_notified_at: notified ? nowIso : previous?.last_notified_at || null,
    updated_at: nowIso,
  };

  const { error } = await supabase
    .from('status_alert_state')
    .upsert(row, { onConflict: 'target_type,target_id' });

  if (error) {
    throw error;
  }
}

export async function processStatusAlert(supabase, targetInput, {
  env = readEnvironment(),
  now = new Date(),
} = {}) {
  if (!supabase) {
    return { notified: false, reason: 'storage_unavailable' };
  }

  const target = {
    type: clampText(targetInput?.type || 'endpoint', 40),
    id: clampText(targetInput?.id || targetInput?.label || 'unknown', 100),
    label: clampText(targetInput?.label || targetInput?.id || '未命名项目', 120),
    status: normalizeStatus(targetInput?.status),
    summary: clampText(targetInput?.summary, 220),
  };

  if (!target.id) {
    return { notified: false, reason: 'invalid_target' };
  }

  const previous = await readPreviousState(supabase, target);
  const nextStatus = normalizeStatus(target.status);
  const notify = shouldNotify(previous, nextStatus);
  let notified = false;

  if (notify) {
    const telegram = getTelegramConfig(env);
    if (telegram) {
      await sendTelegramMessage({
        token: telegram.token,
        chatId: telegram.chatId,
        proxyUrl: telegram.proxyUrl,
        text: buildTelegramText(target, previous?.status ? normalizeStatus(previous.status) : null, nextStatus, now),
      });
      notified = true;
    }
  }

  await writeAlertState(supabase, target, {
    previous,
    notified,
    now,
  });

  return { notified, reason: notified ? 'sent' : notify ? 'telegram_not_configured' : 'unchanged' };
}

export const __internal = {
  buildTelegramText,
  getTelegramConfig,
  shouldNotify,
};
