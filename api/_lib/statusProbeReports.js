const PROBE_LEVELS = ['ok', 'notice', 'warning', 'unknown'];
const MAX_CHECKS = 24;
const MAX_TEXT_LENGTH = 240;

function clampText(value, maxLength = MAX_TEXT_LENGTH) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function normalizeStatus(status, fallback = 'unknown') {
  const normalized = String(status || '').trim().toLowerCase();
  return PROBE_LEVELS.includes(normalized) ? normalized : fallback;
}

function toIsoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeMetric(metric) {
  const value = toNumber(metric?.value);
  return {
    id: clampText(metric?.id, 64),
    label: clampText(metric?.label || metric?.id, 80),
    value,
    unit: clampText(metric?.unit, 20),
    status: normalizeStatus(metric?.status),
    summary: clampText(metric?.summary, 120),
  };
}

function normalizeCheck(check) {
  return {
    id: clampText(check?.id, 64),
    label: clampText(check?.label || check?.id, 80),
    status: normalizeStatus(check?.status),
    summary: clampText(check?.summary, 160),
    latencyMs: toNumber(check?.latencyMs),
  };
}

export function normalizeProbeReport(input = {}, now = new Date()) {
  const probeId = clampText(input.probeId || input.id || input.hostname || 'unknown-probe', 80);
  const reportedAt = toIsoTimestamp(input.reportedAt || input.checkedAt || now);
  const checks = Array.isArray(input.checks)
    ? input.checks.slice(0, MAX_CHECKS).map(normalizeCheck).filter((item) => item.id)
    : [];
  const metrics = Array.isArray(input.metrics)
    ? input.metrics.slice(0, MAX_CHECKS).map(normalizeMetric).filter((item) => item.id)
    : [];

  const derivedStatus = checks.find((item) => item.status === 'warning')
    ? 'warning'
    : checks.find((item) => item.status === 'notice')
      ? 'notice'
      : checks.length > 0
        ? 'ok'
        : 'unknown';

  return {
    probe_id: probeId,
    label: clampText(input.label || input.name || probeId, 80),
    region: clampText(input.region || input.location, 80) || null,
    status: normalizeStatus(input.status, derivedStatus),
    summary: clampText(input.summary, 180) || null,
    reported_at: reportedAt,
    payload: {
      version: clampText(input.version, 40),
      checks,
      metrics,
    },
  };
}

export async function upsertProbeReport(supabase, reportInput, {
  now = new Date(),
} = {}) {
  if (!supabase) {
    throw new Error('status_probe_storage_unavailable');
  }

  const report = normalizeProbeReport(reportInput, now);
  const { data, error } = await supabase
    .from('status_probe_reports')
    .upsert(report, { onConflict: 'probe_id' })
    .select('probe_id,label,region,status,summary,reported_at,received_at,updated_at,payload')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || report;
}

export async function loadProbeReports(supabase, {
  limit = 20,
} = {}) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('status_probe_reports')
    .select('probe_id,label,region,status,summary,reported_at,received_at,updated_at,payload')
    .order('reported_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, Number(limit) || 20)));

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export function buildProbeSummary(reports = [], {
  now = new Date(),
  staleAfterMinutes = 10,
} = {}) {
  const nowMs = new Date(now).getTime();
  const staleMs = Math.max(1, Number(staleAfterMinutes) || 10) * 60000;

  return reports.map((report) => {
    const reportedMs = new Date(report.reported_at).getTime();
    const stale = !Number.isFinite(reportedMs) || nowMs - reportedMs > staleMs;
    return {
      id: report.probe_id,
      label: report.label,
      region: report.region || null,
      status: stale ? 'warning' : normalizeStatus(report.status),
      summary: stale ? '探针上报已超时。' : (report.summary || '探针最近上报正常。'),
      reportedAt: report.reported_at,
      receivedAt: report.received_at,
      updatedAt: report.updated_at,
      checks: Array.isArray(report.payload?.checks) ? report.payload.checks : [],
      metrics: Array.isArray(report.payload?.metrics) ? report.payload.metrics : [],
    };
  });
}

export const __internal = {
  clampText,
  normalizeStatus,
};
