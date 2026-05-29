export const MAIL_RUNTIME_CONFIG_KEY = 'mail_runtime_config';

const DEFAULT_EVENT_FLAGS = Object.freeze({
  authMailActions: null,
  accountRecoveryOutbox: null,
  developerApiReview: null,
  ticketReply: null,
  adminAlert: null,
});

function readEnvironment() {
  return globalThis.process?.env || {};
}

function parseBoolean(value, defaultValue = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function parseNullableBoolean(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value === true || value === false) {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === 'inherit') return null;
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return null;
}

function splitList(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function normalizeStringList(value, { lowercase = false, maxItems = 40 } = {}) {
  const source = Array.isArray(value) ? value : splitList(value);
  return Array.from(new Set(
    source
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .map(item => (lowercase ? item.toLowerCase() : item))
  )).slice(0, maxItems);
}

function parseJsonValue(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRuntimeConfig(rawValue) {
  const parsed = parseJsonValue(rawValue);
  const events = parsed.events && typeof parsed.events === 'object' ? parsed.events : {};
  const controls = parsed.controls && typeof parsed.controls === 'object' ? parsed.controls : {};

  return {
    version: 1,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : null,
    note: String(parsed.note || '').slice(0, 240),
    events: Object.fromEntries(
      Object.keys(DEFAULT_EVENT_FLAGS).map(key => [key, parseNullableBoolean(events[key])])
    ),
    controls: {
      killSwitch: parseNullableBoolean(controls.killSwitch),
      disabledEvents: normalizeStringList(controls.disabledEvents),
      pausedDomains: normalizeStringList(controls.pausedDomains, { lowercase: true }),
    },
  };
}

function boolStatus(value) {
  if (value === null || value === undefined) return 'inherit';
  return value ? 'enabled' : 'disabled';
}

function resolveFlag(runtimeFlag, envFlag) {
  const envEnabled = Boolean(envFlag);
  return {
    enabled: envEnabled && runtimeFlag !== false && (runtimeFlag === true || runtimeFlag === null),
    envEnabled,
    runtime: boolStatus(runtimeFlag),
    effective: envEnabled && runtimeFlag !== false,
  };
}

async function maybeSingle(query) {
  if (typeof query?.maybeSingle === 'function') {
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data || null;
  }
  if (typeof query?.single === 'function') {
    const { data, error } = await query.single();
    if (error) throw error;
    return data || null;
  }
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function loadMailRuntimeConfig(adminClient) {
  if (!adminClient?.from) {
    return normalizeRuntimeConfig({});
  }

  const query = adminClient
    .from('site_config')
    .select('key, value, updated_at, updated_by')
    .eq('key', MAIL_RUNTIME_CONFIG_KEY)
    .limit(1);

  const row = await maybeSingle(query);
  return normalizeRuntimeConfig({
    ...(parseJsonValue(row?.value) || {}),
    updatedAt: row?.updated_at || null,
    updatedBy: row?.updated_by || null,
  });
}

export async function saveMailRuntimeConfig(adminClient, nextConfig, {
  actorUserId = null,
  now = new Date(),
} = {}) {
  if (!adminClient?.from) {
    throw new Error('Supabase admin client is not configured');
  }

  const normalized = normalizeRuntimeConfig({
    ...nextConfig,
    updatedAt: now.toISOString(),
    updatedBy: actorUserId || null,
  });
  const value = JSON.stringify(normalized);
  const payload = {
    key: MAIL_RUNTIME_CONFIG_KEY,
    value,
    label: '邮件运行期开关',
    category: 'system',
    updated_at: now.toISOString(),
    updated_by: actorUserId || null,
  };

  const { error } = await adminClient
    .from('site_config')
    .upsert(payload, { onConflict: 'key' });

  if (error) {
    throw error;
  }

  return normalized;
}

export function getMailEnvFlags(env = readEnvironment()) {
  const workerEnabled = parseBoolean(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED, false);
  return {
    authMailActions: parseBoolean(env.AUTH_MAIL_ACTIONS_ENABLED || env.AUTH_EMAIL_ACTIONS_ENABLED, false) && workerEnabled,
    accountRecoveryOutbox: parseBoolean(env.ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED, false) && workerEnabled,
    developerApiReview: parseBoolean(env.DEVELOPER_API_REVIEW_MAIL_OUTBOX_ENABLED, false) && workerEnabled,
    ticketReply: parseBoolean(env.TICKET_REPLY_MAIL_OUTBOX_ENABLED, false) && workerEnabled,
    adminAlert: parseBoolean(env.ADMIN_ALERT_MAIL_OUTBOX_ENABLED, false) && workerEnabled,
    workerEnabled,
    killSwitch: parseBoolean(env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH, false),
    disabledEvents: splitList(env.MAIL_OUTBOX_DISABLED_EVENTS),
    pausedDomains: splitList(env.MAIL_OUTBOX_PAUSED_DOMAINS).map(domain => domain.toLowerCase()),
  };
}

export function resolveMailRuntimeState(runtimeConfig = normalizeRuntimeConfig({}), env = readEnvironment()) {
  const normalized = normalizeRuntimeConfig(runtimeConfig);
  const envFlags = getMailEnvFlags(env);
  const runtimeKillSwitch = normalized.controls.killSwitch;
  const effectiveKillSwitch = Boolean(envFlags.killSwitch || runtimeKillSwitch === true);
  const disabledEvents = normalizeStringList([
    ...envFlags.disabledEvents,
    ...normalized.controls.disabledEvents,
  ]);
  const pausedDomains = normalizeStringList([
    ...envFlags.pausedDomains,
    ...normalized.controls.pausedDomains,
  ], { lowercase: true });

  return {
    config: normalized,
    hardLimits: {
      envKillSwitch: envFlags.killSwitch,
      workerEnabled: envFlags.workerEnabled,
    },
    controls: {
      killSwitch: effectiveKillSwitch,
      envKillSwitch: envFlags.killSwitch,
      runtimeKillSwitch: boolStatus(runtimeKillSwitch),
      disabledEvents,
      pausedDomains,
    },
    events: {
      authMailActions: resolveFlag(normalized.events.authMailActions, envFlags.authMailActions),
      accountRecoveryOutbox: resolveFlag(normalized.events.accountRecoveryOutbox, envFlags.accountRecoveryOutbox),
      developerApiReview: resolveFlag(normalized.events.developerApiReview, envFlags.developerApiReview),
      ticketReply: resolveFlag(normalized.events.ticketReply, envFlags.ticketReply),
      adminAlert: resolveFlag(normalized.events.adminAlert, envFlags.adminAlert),
    },
  };
}

export async function loadMailRuntimeState(adminClient, env = readEnvironment()) {
  const config = await loadMailRuntimeConfig(adminClient);
  return resolveMailRuntimeState(config, env);
}

export function buildMailRuntimeControls(runtimeState, eventKey) {
  return {
    killSwitch: Boolean(runtimeState?.controls?.killSwitch),
    disabledEvents: runtimeState?.controls?.disabledEvents || [],
    pausedDomains: runtimeState?.controls?.pausedDomains || [],
    runtimeEventKey: eventKey || '',
  };
}

export function isRuntimeEventEnabled(runtimeState, eventKey) {
  return Boolean(runtimeState?.events?.[eventKey]?.effective);
}

export function sanitizeMailRuntimeUpdate(input = {}) {
  const config = normalizeRuntimeConfig(input);
  return {
    ...config,
    controls: {
      killSwitch: config.controls.killSwitch,
      disabledEvents: config.controls.disabledEvents,
      pausedDomains: config.controls.pausedDomains,
    },
  };
}

export const __internal = {
  normalizeRuntimeConfig,
  parseNullableBoolean,
  resolveFlag,
};
