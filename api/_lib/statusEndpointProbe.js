const DEFAULT_TARGETS = Object.freeze([
  {
    id: 'main-site',
    label: '主站首页',
    url: 'https://ef-gacha.mogujun.icu/',
  },
  {
    id: 'site-status-api',
    label: '公开状态接口',
    url: 'https://ef-gacha.mogujun.icu/api/site-status',
    expectJsonSuccess: true,
  },
]);

const MAX_TARGETS = 20;
const DEFAULT_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

function readEnvironment() {
  return globalThis.process?.env || {};
}

function clampText(value, maxLength = 240) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function slugifyId(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
}

function toIsoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.round(parsed)));
}

function tryParseUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeTarget(input, index = 0) {
  const raw = typeof input === 'string' ? { url: input } : (input || {});
  const parsedUrl = tryParseUrl(raw.url || raw.endpoint || raw.href);
  if (!parsedUrl) {
    return null;
  }

  const id = slugifyId(raw.id || raw.endpointId || raw.label || parsedUrl.hostname, `endpoint-${index + 1}`);
  return {
    id,
    label: clampText(raw.label || raw.name || id, 80),
    url: parsedUrl.toString(),
    method: String(raw.method || 'GET').trim().toUpperCase() === 'HEAD' ? 'HEAD' : 'GET',
    expectJsonSuccess: raw.expectJsonSuccess === true || raw.expect === 'json-success',
    timeoutMs: normalizeTimeoutMs(raw.timeoutMs || raw.timeout || raw.timeoutMilliseconds),
  };
}

function parseTargets(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return [];
  }

  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getStatusEndpointTargets(env = readEnvironment()) {
  let configuredTargets = [];
  try {
    configuredTargets = parseTargets(env.STATUS_ENDPOINT_TARGETS || env.STATUS_PROBE_ENDPOINT_TARGETS);
  } catch {
    configuredTargets = [];
  }

  const rawTargets = configuredTargets.length ? configuredTargets : DEFAULT_TARGETS;
  const seen = new Set();
  return rawTargets
    .map((target, index) => normalizeTarget(target, index))
    .filter(Boolean)
    .filter((target) => {
      if (seen.has(target.id)) return false;
      seen.add(target.id);
      return true;
    })
    .slice(0, MAX_TARGETS);
}

async function readJsonIfPossible(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return null;
  }
  return response.json().catch(() => null);
}

export async function checkStatusEndpointTarget(targetInput, {
  now = new Date(),
} = {}) {
  const target = normalizeTarget(targetInput);
  if (!target) {
    return null;
  }

  const checkedAt = toIsoTimestamp(now);
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), target.timeoutMs);

  try {
    const response = await fetch(target.url, {
      method: target.method,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        Accept: target.expectJsonSuccess ? 'application/json' : '*/*',
      },
    });
    const responseMs = Date.now() - startedAt;
    const json = target.expectJsonSuccess ? await readJsonIfPossible(response) : null;
    const jsonOk = !target.expectJsonSuccess || json?.success === true;
    const ok = response.ok && jsonOk;

    return {
      id: target.id,
      label: target.label,
      status: ok ? 'ok' : 'warning',
      summary: ok
        ? `HTTP ${response.status}`
        : target.expectJsonSuccess && !jsonOk
          ? `HTTP ${response.status}，接口响应异常`
          : `HTTP ${response.status}`,
      detail: target.url,
      checkedAt,
      responseMs,
      endpointUrl: target.url,
    };
  } catch (error) {
    return {
      id: target.id,
      label: target.label,
      status: 'warning',
      summary: error?.name === 'AbortError' ? '请求超时' : clampText(error?.message || '请求失败', 160),
      detail: target.url,
      checkedAt,
      responseMs: Date.now() - startedAt,
      endpointUrl: target.url,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runStatusEndpointProbe({
  targets = null,
  env = readEnvironment(),
  now = new Date(),
} = {}) {
  const normalizedTargets = Array.isArray(targets) && targets.length
    ? targets.slice(0, MAX_TARGETS).map((target, index) => normalizeTarget(target, index)).filter(Boolean)
    : getStatusEndpointTargets(env);
  const checkedAt = toIsoTimestamp(now);
  const services = (await Promise.all(
    normalizedTargets.map((target) => checkStatusEndpointTarget(target, { now }))
  )).filter(Boolean);
  const warningCount = services.filter((service) => service.status === 'warning').length;
  const noticeCount = services.filter((service) => service.status === 'notice').length;

  return {
    checkedAt,
    services,
    overall: {
      level: warningCount > 0 ? 'warning' : noticeCount > 0 ? 'notice' : 'ok',
      affectedCount: warningCount || noticeCount,
    },
  };
}

export const __internal = {
  normalizeTarget,
  parseTargets,
};
