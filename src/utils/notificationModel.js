import {
  buildImportResultDiagnostic,
  buildImportResultMessage,
  buildImportResultSummary,
} from './importResultSummary.js';

const VALID_NOTIFICATION_TYPES = new Set(['success', 'error', 'warning', 'info']);
const VALID_DURABLE_CATEGORIES = new Set(['account', 'import', 'developer-api', 'ticket', 'cache', 'ops', 'system']);
const VALID_NOTIFICATION_PRIORITIES = new Set(['low', 'normal', 'high']);
const DEFAULT_TOAST_DURATION_MS = 4000;
const ACTIONABLE_TOAST_DURATION_MS = 0;
const MAX_DURABLE_NOTIFICATIONS = 30;
const DEFAULT_DURABLE_NOTIFICATION_TTL_DAYS = 45;

const SENSITIVE_KEY_PATTERN = /(?:token|password|secret|api[_-]?key|authorization|email|user[_-]?id|game[_-]?uid|platform[_-]?user[_-]?id|history[_-]?id|record[_-]?id|session)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_PATTERN = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
const KEY_VALUE_SECRET_PATTERN = /\b(token|access_token|refresh_token|api[_-]?key|secret|password|authorization|user[_-]?id|game[_-]?uid|platform[_-]?user[_-]?id|history[_-]?id|record[_-]?id)=([^&\s]+)/gi;
const JSONISH_SECRET_PATTERN = /\b(token|accessToken|refreshToken|apiKey|secret|password|email|userId|user_id|gameUid|game_uid|platformUserId|platform_user_id|historyId|history_id|recordId|record_id)\s*:\s*["']?([^"',&\s}]+)/gi;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const API_KEY_PATTERN = /\b(?:sk|efg|sbp|eyJ)[A-Za-z0-9._-]{16,}\b/g;

function toText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Error) {
    return value.message || value.name || fallback;
  }

  return fallback;
}

export function normalizeNotificationType(type) {
  const normalized = String(type || '').toLowerCase();
  return VALID_NOTIFICATION_TYPES.has(normalized) ? normalized : 'info';
}

export function normalizeDurableNotificationCategory(category) {
  const normalized = String(category || '').toLowerCase();
  return VALID_DURABLE_CATEGORIES.has(normalized) ? normalized : 'system';
}

export function normalizeNotificationPriority(priority) {
  const normalized = String(priority || '').toLowerCase();
  return VALID_NOTIFICATION_PRIORITIES.has(normalized) ? normalized : 'normal';
}

export function redactSensitiveText(value) {
  const input = toText(value);
  if (!input) {
    return input;
  }

  return input
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(BEARER_PATTERN, '$1[redacted-token]')
    .replace(KEY_VALUE_SECRET_PATTERN, '$1=[redacted]')
    .replace(JSONISH_SECRET_PATTERN, '$1: [redacted]')
    .replace(UUID_PATTERN, '[redacted-id]')
    .replace(API_KEY_PATTERN, '[redacted-token]');
}

export function redactSensitiveDiagnostics(value, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: redactSensitiveText(value.name),
      message: redactSensitiveText(value.message),
      stack: value.stack ? redactSensitiveText(value.stack) : undefined,
    };
  }

  if (typeof value !== 'object') {
    return redactSensitiveText(String(value));
  }

  if (seen.has(value)) {
    return '[circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => redactSensitiveDiagnostics(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? '[redacted]'
        : redactSensitiveDiagnostics(item, seen),
    ]),
  );
}

export function buildCopyableDiagnostic(diagnostic) {
  if (!diagnostic) {
    return null;
  }

  const redacted = redactSensitiveDiagnostics(diagnostic);
  if (typeof redacted === 'string') {
    return redacted;
  }

  try {
    return JSON.stringify(redacted, null, 2);
  } catch {
    return redactSensitiveText(String(redacted));
  }
}

function normalizeNotificationActions(actions) {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map(action => {
      const label = toText(action?.label).trim();
      if (!label) {
        return null;
      }

      return {
        label,
        onClick: typeof action?.onClick === 'function' ? action.onClick : null,
        href: typeof action?.href === 'string' && action.href ? action.href : null,
        variant: action?.variant === 'primary' ? 'primary' : 'secondary',
        dismissOnClick: action?.dismissOnClick !== false,
      };
    })
    .filter(Boolean);
}

export function normalizeNotification(input, legacy = {}) {
  const isObjectInput = input && typeof input === 'object' && !(input instanceof Error) && !Array.isArray(input);
  const source = isObjectInput ? input : {};
  const type = normalizeNotificationType(source.type || source.severity || legacy.type);
  const title = toText(source.title, legacy.title || null);
  const message = redactSensitiveText(toText(source.message, toText(input)));
  const actions = normalizeNotificationActions(source.actions);
  const diagnosticText = source.diagnosticText
    ? redactSensitiveText(source.diagnosticText)
    : buildCopyableDiagnostic(source.diagnostic || source.diagnostics || null);
  const persistent = Boolean(source.persistent || source.sticky || diagnosticText || actions.length > 0);
  const hasExplicitDuration = source.duration != null || legacy.duration != null;
  const duration = hasExplicitDuration
    ? Number(source.duration ?? legacy.duration)
    : persistent
      ? ACTIONABLE_TOAST_DURATION_MS
      : DEFAULT_TOAST_DURATION_MS;

  return {
    id: source.id || legacy.id || null,
    type,
    title: title || null,
    message,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    persistent,
    createdAt: source.createdAt || legacy.createdAt || new Date().toISOString(),
    source: toText(source.source, legacy.source || null) || null,
    actions,
    diagnosticText,
    copyDiagnosticLabel: toText(source.copyDiagnosticLabel, legacy.copyDiagnosticLabel || '复制诊断'),
    copiedDiagnosticLabel: toText(source.copiedDiagnosticLabel, legacy.copiedDiagnosticLabel || '已复制'),
  };
}

export function createNotificationId(prefix = 'notification') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toIsoTimestamp(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  if (Number.isNaN(date.getTime())) {
    return (fallback instanceof Date ? fallback : new Date(fallback)).toISOString();
  }
  return date.toISOString();
}

function addDays(timestamp, days) {
  const base = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const normalizedBase = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(normalizedBase.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeDurableActions(actions) {
  return (Array.isArray(actions) ? actions : [])
    .map((action) => {
      const label = toText(action?.label).trim();
      const href = toText(action?.href).trim();
      if (!label || !href) {
        return null;
      }

      return {
        label,
        href,
        variant: action?.variant === 'primary' ? 'primary' : 'secondary',
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function sortDurableNotifications(notifications) {
  return [...notifications].sort((a, b) => (
    new Date(b.updatedAt || b.createdAt || 0).getTime()
    - new Date(a.updatedAt || a.createdAt || 0).getTime()
  ));
}

export function createDurableNotification(input, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const source = input && typeof input === 'object' && !(input instanceof Error) && !Array.isArray(input)
    ? input
    : {};
  const normalized = normalizeNotification(input, {
    id: source.id || createNotificationId('durable'),
    type: source.type,
    title: source.title,
    duration: 0,
  });
  const createdAt = toIsoTimestamp(source.createdAt || normalized.createdAt, now);
  const updatedAt = toIsoTimestamp(source.updatedAt || now, now);
  const expiresAt = source.expiresAt
    ? toIsoTimestamp(source.expiresAt, addDays(createdAt, DEFAULT_DURABLE_NOTIFICATION_TTL_DAYS))
    : addDays(createdAt, Number.isFinite(Number(source.ttlDays)) ? Number(source.ttlDays) : DEFAULT_DURABLE_NOTIFICATION_TTL_DAYS);
  const dedupeKey = redactSensitiveText(toText(source.dedupeKey || source.dedupe_key || source.source || normalized.source || '').trim());

  return {
    id: normalized.id || createNotificationId('durable'),
    type: normalized.type,
    category: normalizeDurableNotificationCategory(source.category),
    priority: normalizeNotificationPriority(source.priority),
    title: normalized.title,
    message: normalized.message,
    source: normalized.source,
    dedupeKey: dedupeKey || null,
    createdAt,
    updatedAt,
    readAt: source.readAt ? toIsoTimestamp(source.readAt, now) : null,
    expiresAt,
    durable: true,
    persistent: true,
    diagnosticText: normalized.diagnosticText,
    copyDiagnosticLabel: normalized.copyDiagnosticLabel,
    copiedDiagnosticLabel: normalized.copiedDiagnosticLabel,
    actions: normalizeDurableActions(source.actions || normalized.actions),
  };
}

export function serializeDurableNotification(notification) {
  const normalized = createDurableNotification(notification);
  return {
    id: normalized.id,
    type: normalized.type,
    category: normalized.category,
    priority: normalized.priority,
    title: normalized.title,
    message: normalized.message,
    source: normalized.source,
    dedupeKey: normalized.dedupeKey,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    readAt: normalized.readAt,
    expiresAt: normalized.expiresAt,
    durable: true,
    persistent: true,
    diagnosticText: normalized.diagnosticText,
    copyDiagnosticLabel: normalized.copyDiagnosticLabel,
    copiedDiagnosticLabel: normalized.copiedDiagnosticLabel,
    actions: normalizeDurableActions(normalized.actions),
  };
}

export function parseStoredDurableNotifications(rawValue, options = {}) {
  const nowMs = new Date(options.now || Date.now()).getTime();
  let rows = rawValue;

  if (typeof rawValue === 'string') {
    try {
      rows = JSON.parse(rawValue);
    } catch {
      rows = [];
    }
  }

  return sortDurableNotifications(
    (Array.isArray(rows) ? rows : [])
      .map((row) => {
        try {
          return serializeDurableNotification(row);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((row) => {
        if (!row.expiresAt) {
          return true;
        }
        const expiresAtMs = new Date(row.expiresAt).getTime();
        return Number.isNaN(expiresAtMs) || expiresAtMs > nowMs;
      })
  ).slice(0, MAX_DURABLE_NOTIFICATIONS);
}

export function upsertDurableNotification(list, input, options = {}) {
  const nextNotification = createDurableNotification(input, options);
  const previousList = parseStoredDurableNotifications(list, options);
  const matchIndex = previousList.findIndex((item) => (
    nextNotification.dedupeKey
      ? item.dedupeKey === nextNotification.dedupeKey
      : item.id === nextNotification.id
  ));

  if (matchIndex === -1) {
    return sortDurableNotifications([nextNotification, ...previousList]).slice(0, MAX_DURABLE_NOTIFICATIONS);
  }

  const previous = previousList[matchIndex];
  const merged = {
    ...previous,
    ...nextNotification,
    id: previous.id,
    createdAt: previous.createdAt,
    readAt: nextNotification.readAt || null,
  };
  const mergedList = [...previousList];
  mergedList[matchIndex] = merged;
  return sortDurableNotifications(mergedList).slice(0, MAX_DURABLE_NOTIFICATIONS);
}

export function markDurableNotificationRead(list, id, options = {}) {
  const readAt = toIsoTimestamp(options.now || new Date());
  return parseStoredDurableNotifications(list, options).map((notification) => (
    notification.id === id
      ? { ...notification, readAt, updatedAt: readAt }
      : notification
  ));
}

export function markAllDurableNotificationsRead(list, options = {}) {
  const readAt = toIsoTimestamp(options.now || new Date());
  return parseStoredDurableNotifications(list, options).map((notification) => (
    notification.readAt
      ? notification
      : { ...notification, readAt, updatedAt: readAt }
  ));
}

export function dismissDurableNotification(list, id, options = {}) {
  return parseStoredDurableNotifications(list, options).filter((notification) => notification.id !== id);
}

export function clearReadDurableNotifications(list, options = {}) {
  return parseStoredDurableNotifications(list, options).filter((notification) => !notification.readAt);
}

export function getUnreadDurableNotificationCount(list, options = {}) {
  return parseStoredDurableNotifications(list, options).filter((notification) => !notification.readAt).length;
}

function isEnglishLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('en');
}

export function buildAccountRecoveryNotification(result = {}, options = {}) {
  const english = isEnglishLocale(options.locale);
  const requestType = String(options.requestType || result.requestType || '').trim();
  const nextStep = String(result.nextStep || result.next_step || '').trim();
  const deliveryChannel = String(result.deliveryChannel || result.delivery_channel || '').trim();
  const isDeleteRequest = requestType === 'delete_account';
  const isMailQueued = nextStep === 'mail_reset_queued' || deliveryChannel === 'mail_outbox';

  return createDurableNotification({
    type: isMailQueued ? 'info' : 'success',
    category: 'account',
    priority: 'high',
    source: 'account.recovery',
    dedupeKey: `account-recovery:${requestType || 'request'}:${nextStep || 'received'}`,
    title: english
      ? (isDeleteRequest ? 'Account deletion request received' : 'Account recovery request received')
      : (isDeleteRequest ? '旧账号注销申请已接收' : '账号恢复申请已接收'),
    message: english
      ? (
        isMailQueued
          ? 'If this request matches a recoverable account, the reset email will be handled by the mail queue. Manual review remains available if delivery fails.'
          : 'The request is now in the manual review flow. The response does not confirm whether the email exists.'
      )
      : (
        isMailQueued
          ? '如果该邮箱匹配可恢复账号，重置邮件会进入发信队列；若投递失败，仍会回退到人工恢复。'
          : '申请已进入人工核验流程。此提示不会确认邮箱是否存在。'
      ),
    diagnostic: {
      phase: 'account_recovery',
      requestType,
      deliveryChannel,
      nextStep,
      status: result.status || 'received',
    },
  }, options);
}

export function buildImportResultNotification(summary = {}, options = {}) {
  const english = isEnglishLocale(options.locale);
  const resultSummary = buildImportResultSummary(summary, options);
  const partial = resultSummary.partial;

  return createDurableNotification({
    type: partial ? 'warning' : 'success',
    category: 'import',
    priority: partial ? 'high' : 'normal',
    source: summary.source || 'import.confirm',
    dedupeKey: summary.dedupeKey || `import:${summary.sourceFormatId || 'file'}:${summary.completedAt || summary.createdAt || Date.now()}`,
    title: english
      ? (partial ? 'Import partially completed' : 'Import completed')
      : (partial ? '导入部分成功' : '导入完成'),
    message: buildImportResultMessage(resultSummary, options.locale),
    diagnostic: {
      ...buildImportResultDiagnostic(resultSummary),
      sourceFormatId: summary.sourceFormatId,
      error: summary.error || null,
    },
    actions: [
      {
        label: english ? 'View imported data' : '查看已导入数据',
        href: resultSummary.actionHref,
        variant: 'primary',
      },
    ],
  }, options);
}

export function buildDeveloperApiReviewNotification(review = {}, options = {}) {
  const english = isEnglishLocale(options.locale);
  const status = String(review.status || '').trim();
  const active = status === 'active';
  const rejected = status === 'rejected';
  const revoked = status === 'revoked';

  return createDurableNotification({
    type: active ? 'success' : rejected || revoked ? 'warning' : 'info',
    category: 'developer-api',
    priority: rejected || revoked ? 'high' : 'normal',
    source: 'admin.developer-api.review',
    dedupeKey: `developer-api-review:${status || 'updated'}:${review.clientName || review.clientType || 'client'}`,
    title: english ? 'Developer API review updated' : '开发者 API 审核已更新',
    message: english
      ? (
        active
          ? 'The application was approved. Store any one-time key output through a trusted channel.'
          : rejected
            ? 'The application was rejected. The applicant can review the status from Settings.'
            : revoked
              ? 'The application was revoked. Existing keys should stop working after the backend update.'
              : 'The application review state was updated.'
      )
      : (
        active
          ? '申请已通过。若产生一次性 Key，请通过可信渠道保存和交接。'
          : rejected
            ? '申请已拒绝。申请者可在设置页查看当前状态。'
            : revoked
              ? '应用已撤销。后端更新后现有 Key 应停止可用。'
              : '申请审核状态已更新。'
      ),
    diagnostic: {
      phase: 'developer_api_review',
      status,
      clientType: review.clientType,
      hasBootstrapKey: Boolean(review.hasBootstrapKey),
      hasReviewNote: Boolean(review.reviewNote),
    },
  }, options);
}

export function buildTicketReplyNotification(reply = {}, options = {}) {
  const english = isEnglishLocale(options.locale);
  const authorRole = String(reply.authorRole || '').trim();
  const isStaffReply = authorRole === 'admin' || authorRole === 'super_admin';

  return createDurableNotification({
    type: 'success',
    category: 'ticket',
    priority: isStaffReply ? 'high' : 'normal',
    source: 'ticket.reply',
    dedupeKey: reply.dedupeKey || `ticket-reply:${reply.createdAt || Date.now()}`,
    title: english ? 'Ticket reply sent' : '工单回复已发送',
    message: english
      ? (
        isStaffReply
          ? 'The staff reply was saved to the ticket thread. Users can review it from the ticket page.'
          : 'Your reply was saved to the ticket thread.'
      )
      : (
        isStaffReply
          ? '管理员回复已保存到工单线程，用户可在工单页查看。'
          : '你的回复已保存到工单线程。'
      ),
    diagnostic: {
      phase: 'ticket_reply',
      authorRole,
      ticketStatus: reply.ticketStatus || null,
    },
  }, options);
}

export function buildPublicCacheWarningNotification(event = {}, options = {}) {
  const english = isEnglishLocale(options.locale);
  const scope = String(event.scope || 'public').trim() || 'public';
  const reason = String(event.reason || 'admin').trim() || 'admin';
  const analyticsRefresh = event.analyticsRefresh && typeof event.analyticsRefresh === 'object'
    ? {
      ok: event.analyticsRefresh.ok === true,
      partial: event.analyticsRefresh.partial === true,
      warning: event.analyticsRefresh.warning || event.analyticsRefresh.error || null,
    }
    : null;

  return createDurableNotification({
    type: 'warning',
    category: 'cache',
    priority: 'high',
    source: 'admin.public-cache',
    dedupeKey: `public-cache-warning:${scope}:${reason}`,
    title: english ? 'Public cache refresh warning' : '公共缓存刷新警告',
    message: english
      ? 'The write operation completed, but public cache invalidation or aggregate refresh reported a warning. Public pages may keep older snapshots until the next successful refresh.'
      : '写入操作已完成，但公共缓存失效或聚合刷新出现警告。公共页面可能会继续使用旧快照，直到下一次刷新成功。',
    diagnostic: {
      phase: 'public_cache_warning',
      scope,
      reason,
      error: event.error || null,
      analyticsRefresh,
    },
  }, options);
}

export {
  DEFAULT_TOAST_DURATION_MS,
  ACTIONABLE_TOAST_DURATION_MS,
  MAX_DURABLE_NOTIFICATIONS,
};
