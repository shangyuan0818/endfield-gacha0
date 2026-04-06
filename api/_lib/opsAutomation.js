const OPS_AUTOMATION_JOB_IDS = Object.freeze([
  'official-announcements',
  'pool-schedule',
  'wiki-catalog',
]);

const OPS_AUTOMATION_SOURCE_ENV_KEYS = Object.freeze({
  'official-announcements': {
    url: 'OPS_AUTOMATION_ANNOUNCEMENTS_URL',
    tag: 'OPS_AUTOMATION_ANNOUNCEMENTS_TAG',
    defaultPath: '/api/automation-feed?job=official-announcements',
    defaultTag: 'official-announcements-feed',
  },
  'pool-schedule': {
    url: 'OPS_AUTOMATION_POOL_SCHEDULE_URL',
    tag: 'OPS_AUTOMATION_POOL_SCHEDULE_TAG',
    defaultPath: '/api/automation-feed?job=pool-schedule',
    defaultTag: 'pool-schedule-feed',
  },
  'wiki-catalog': {
    url: 'OPS_AUTOMATION_WIKI_CATALOG_URL',
    tag: 'OPS_AUTOMATION_WIKI_CATALOG_TAG',
    defaultPath: '',
    defaultTag: 'passive-detection',
  },
});

function ensureKnownJobId(jobId) {
  if (!OPS_AUTOMATION_JOB_IDS.includes(jobId)) {
    throw new Error(`Unknown ops automation job: ${jobId}`);
  }
  return jobId;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function readArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload.records)) {
    return payload.records;
  }
  return [];
}

function buildAbsoluteUrl(baseUrl, path) {
  if (!baseUrl || !path) return '';
  return `${String(baseUrl).replace(/\/$/, '')}${path}`;
}

function parseMaintenanceTimes(content) {
  const matches = Array.from(
    String(content || '').matchAll(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/g)
  );

  if (matches.length < 2) {
    return null;
  }

  const toIso = (match) => (
    new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+08:00`).toISOString()
  );

  return {
    start_time: toIso(matches[0]),
    end_time: toIso(matches[1]),
  };
}

export function parseRequestedJobIds(rawValue) {
  const normalizedValue = Array.isArray(rawValue)
    ? rawValue.join(',')
    : normalizeText(rawValue || 'all');

  if (!normalizedValue || normalizedValue === 'all') {
    return [...OPS_AUTOMATION_JOB_IDS];
  }

  const requestedJobIds = [...new Set(
    normalizedValue
      .split(',')
      .map(item => normalizeText(item))
      .filter(Boolean)
  )];

  requestedJobIds.forEach(ensureKnownJobId);
  return requestedJobIds;
}

export function getDefaultRunnableJobIds() {
  return [...OPS_AUTOMATION_JOB_IDS];
}

export function authorizeOpsAutomationRequest(req, env = process.env) {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) return { ok: true };

  const bearer = String(req.headers?.authorization || req.headers?.Authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (bearer === cronSecret) {
    return { ok: true };
  }

  return { ok: false, status: 401, error: 'Unauthorized' };
}

export function buildOpsAutomationDedupeKey(jobId, triggerType, now = new Date()) {
  const normalizedJobId = ensureKnownJobId(jobId);
  if (triggerType !== 'cron') return null;

  const currentDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(currentDate.getTime())) return null;
  return `cron:${normalizedJobId}:${currentDate.toISOString().slice(0, 10)}`;
}

export function getOpsAutomationSourceConfig(jobId, env = process.env, { baseUrl = '' } = {}) {
  const normalizedJobId = ensureKnownJobId(jobId);
  const sourceMeta = OPS_AUTOMATION_SOURCE_ENV_KEYS[normalizedJobId];
  const configuredUrl = normalizeText(env[sourceMeta.url]);
  const configuredTag = normalizeText(env[sourceMeta.tag]);

  return {
    url: configuredUrl || buildAbsoluteUrl(baseUrl, sourceMeta.defaultPath),
    tag: configuredTag || sourceMeta.defaultTag,
  };
}

export function normalizeOpsAutomationSourceRecords(jobId, payload) {
  const normalizedJobId = ensureKnownJobId(jobId);
  const records = readArrayPayload(payload);

  if (normalizedJobId !== 'official-announcements') {
    return records;
  }

  return records
    .filter(record => record)
    .map((record) => {
      if (record.source_id && record.title) {
        return record;
      }

      return {
        source_id: normalizeText(record.source_id || record.id),
        title: normalizeText(record.title),
        summary: normalizeText(record.summary || record.excerpt) || null,
        content: record.content || record.body || '',
        published_at: normalizeText(record.published_at || record.date) || null,
        source_url: normalizeText(record.source_url || record.url) || null,
        is_active: record.is_active ?? true,
      };
    })
    .filter(record => record.source_id && record.title);
}

export function getLatestVersionMaintenanceWindow(records) {
  const maintenanceWindows = normalizeOpsAutomationSourceRecords('official-announcements', records)
    .filter(record => String(record.title || '').includes('版本更新说明'))
    .map((record) => {
      const times = parseMaintenanceTimes(record.content || record.raw_content || '');
      if (!times?.end_time) {
        return null;
      }

      return {
        source_id: record.source_id,
        source_url: record.source_url || null,
        title: record.title,
        published_at: record.published_at || null,
        ...times,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = new Date(left.published_at || left.end_time).getTime();
      const rightTime = new Date(right.published_at || right.end_time).getTime();
      return rightTime - leftTime;
    });

  return maintenanceWindows[0] || null;
}

export async function getOpsAutomationMaintenanceGate(jobId, {
  env = process.env,
  sourceBaseUrl = '',
  fetchImpl = globalThis.fetch,
  now = new Date(),
} = {}) {
  const normalizedJobId = ensureKnownJobId(jobId);
  if (normalizedJobId !== 'wiki-catalog') {
    return { blocked: false, reason: null, source: null };
  }

  const announcementSource = getOpsAutomationSourceConfig('official-announcements', env, {
    baseUrl: sourceBaseUrl,
  });

  if (!announcementSource.url || typeof fetchImpl !== 'function') {
    return { blocked: false, reason: null, source: null };
  }

  const response = await fetchImpl(announcementSource.url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch announcement source: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const maintenanceWindow = getLatestVersionMaintenanceWindow(payload?.records || payload);
  if (!maintenanceWindow?.end_time) {
    return { blocked: false, reason: null, source: null };
  }

  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const endTime = new Date(maintenanceWindow.end_time).getTime();
  if (Number.isNaN(currentTime) || Number.isNaN(endTime) || currentTime >= endTime) {
    return { blocked: false, reason: null, source: maintenanceWindow };
  }

  return {
    blocked: true,
    source: maintenanceWindow,
    reason: `检测到最新版本维护尚未结束，需等待维护结束后才开始更新图鉴与卡池数据（预计 ${maintenanceWindow.end_time} 后）`,
  };
}

export const __internal = {
  OPS_AUTOMATION_JOB_IDS,
  parseMaintenanceTimes,
};
