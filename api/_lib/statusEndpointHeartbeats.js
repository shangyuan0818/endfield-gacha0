const STATUS_LEVELS = ['ok', 'notice', 'warning', 'unknown'];
const MAX_HISTORY_ROWS = 600;
const MAX_TEXT_LENGTH = 240;

function clampText(value, maxLength = MAX_TEXT_LENGTH) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function normalizeStatus(status, fallback = 'unknown') {
  const normalized = String(status || '').trim().toLowerCase();
  return STATUS_LEVELS.includes(normalized) ? normalized : fallback;
}

function toIsoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function toInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

function normalizeEndpointHeartbeat(service = {}, {
  checkedAt = new Date(),
  responseMs = null,
} = {}) {
  const endpointId = clampText(service.id || service.endpointId || service.label || 'unknown-endpoint', 80);
  return {
    endpoint_id: endpointId,
    label: clampText(service.label || service.name || endpointId, 80),
    status: normalizeStatus(service.status),
    summary: clampText(service.summary, 180) || null,
    checked_at: toIsoTimestamp(service.checkedAt || checkedAt),
    response_ms: toInteger(service.responseMs ?? responseMs),
    payload: {
      detail: clampText(service.detail, 240),
      updatedAt: service.updatedAt ? toIsoTimestamp(service.updatedAt) : null,
    },
  };
}

export async function recordEndpointHeartbeats(supabase, services = [], {
  checkedAt = new Date(),
  responseMs = null,
} = {}) {
  if (!supabase || !Array.isArray(services) || services.length === 0) {
    return [];
  }

  const rows = services
    .map((service) => normalizeEndpointHeartbeat(service, { checkedAt, responseMs }))
    .filter((row) => row.endpoint_id);

  if (!rows.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('status_endpoint_heartbeats')
    .insert(rows)
    .select('endpoint_id,label,status,summary,checked_at,response_ms,payload');

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : rows;
}

export async function loadEndpointHeartbeatHistory(supabase, {
  limit = MAX_HISTORY_ROWS,
} = {}) {
  if (!supabase) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('status_endpoint_heartbeats')
    .select('endpoint_id,label,status,summary,checked_at,response_ms,payload')
    .order('checked_at', { ascending: false })
    .limit(Math.max(1, Math.min(MAX_HISTORY_ROWS, Number(limit) || MAX_HISTORY_ROWS)));

  if (error) {
    throw error;
  }

  const histories = new Map();
  for (const row of Array.isArray(data) ? data : []) {
    const key = row.endpoint_id;
    if (!key) continue;
    const entries = histories.get(key) || [];
    entries.push({
      status: normalizeStatus(row.status),
      level: normalizeStatus(row.status),
      time: row.checked_at,
      checkedAt: row.checked_at,
      label: row.label || key,
      responseMs: toInteger(row.response_ms),
      summary: row.summary || '',
      detail: row.payload?.detail || '',
    });
    histories.set(key, entries);
  }

  for (const [key, entries] of histories) {
    histories.set(key, entries.reverse());
  }

  return histories;
}

export async function pruneEndpointHeartbeatHistory(supabase, {
  before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
} = {}) {
  if (!supabase) {
    return { deleted: false, reason: 'storage_unavailable' };
  }

  const { error } = await supabase
    .from('status_endpoint_heartbeats')
    .delete()
    .lt('checked_at', toIsoTimestamp(before));

  if (error) {
    throw error;
  }

  return { deleted: true };
}

export const __internal = {
  clampText,
  normalizeEndpointHeartbeat,
  normalizeStatus,
};
