import { buildPublicSiteStatus } from './publicSiteStatus.js';
import { loadEndpointHeartbeatHistory } from './statusEndpointHeartbeats.js';
import { getStatusEndpointTargets } from './statusEndpointProbe.js';
import { buildProbeSummary, loadProbeHeartbeatHistory, loadProbeReports } from './statusProbeReports.js';

function readEnvironment() {
  return globalThis.process?.env || {};
}

function toIsoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeStatus(status) {
  return ['ok', 'notice', 'warning', 'unknown'].includes(status) ? status : 'unknown';
}

function deriveOverall(publicStatus, probes, endpointServices = []) {
  const statuses = [
    ...(publicStatus?.services || []).map((item) => normalizeStatus(item.status)),
    ...endpointServices.map((item) => normalizeStatus(item.status)),
    ...probes.map((item) => normalizeStatus(item.status)),
  ];

  const warningCount = statuses.filter((status) => status === 'warning').length;
  const noticeCount = statuses.filter((status) => status === 'notice').length;
  const unknownCount = statuses.filter((status) => status === 'unknown').length;

  if (warningCount > 0) {
    return {
      level: 'warning',
      label: '有服务需要处理',
      affectedCount: warningCount,
    };
  }

  if (noticeCount > 0 || unknownCount > 0) {
    return {
      level: 'notice',
      label: '有服务需要关注',
      affectedCount: noticeCount + unknownCount,
    };
  }

  return {
    level: 'ok',
    label: '服务运行正常',
    affectedCount: 0,
  };
}

function buildRuntimeSummary(env = readEnvironment()) {
  return {
    deployment: {
      environment: env.VERCEL_ENV || env.NODE_ENV || 'unknown',
      region: env.VERCEL_REGION || null,
      gitCommit: env.VERCEL_GIT_COMMIT_SHA
        ? String(env.VERCEL_GIT_COMMIT_SHA).slice(0, 12)
        : null,
    },
    config: {
      mailWorkerEnabled: Boolean(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED),
      captchaMode: env.AUTH_CAPTCHA_MODE || env.VITE_AUTH_CAPTCHA_MODE || env.CAPTCHA_MODE || null,
      probeConfigured: Boolean(env.STATUS_PROBE_TOKEN || env.STATUS_ADMIN_TOKEN),
    },
  };
}

async function safeLoad(loader, fallback) {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function attachServiceHistories(publicStatus, histories = new Map()) {
  return {
    ...publicStatus,
    services: (publicStatus?.services || []).map((service) => ({
      ...service,
      history: histories.get(service.id) || service.history || [],
    })),
  };
}

function buildEndpointServices(histories = new Map(), env = readEnvironment(), {
  excludeIds = new Set(),
} = {}) {
  const configuredTargets = getStatusEndpointTargets(env);
  const configuredIds = new Set(configuredTargets.map((target) => target.id));
  const services = configuredTargets.map((target) => {
    const history = histories.get(target.id) || [];
    const latest = history[history.length - 1] || null;
    return {
      id: target.id,
      label: target.label,
      status: latest?.level || latest?.status || 'unknown',
      summary: latest?.summary || '尚无定时检测记录。',
      detail: target.url,
      checkedAt: latest?.time || latest?.checkedAt || null,
      responseMs: latest?.responseMs ?? null,
      history,
    };
  });

  for (const [id, history] of histories) {
    if (configuredIds.has(id) || excludeIds.has(id)) continue;
    const latest = history[history.length - 1] || null;
    services.push({
      id,
      label: latest?.label || id,
      status: latest?.level || latest?.status || 'unknown',
      summary: latest?.summary || '历史检测记录。',
      detail: latest?.detail || null,
      checkedAt: latest?.time || latest?.checkedAt || null,
      responseMs: latest?.responseMs ?? null,
      history,
    });
  }

  return services;
}

export async function buildStatusAdminOverview({
  supabase = null,
  env = readEnvironment(),
  now = new Date(),
} = {}) {
  const generatedAt = toIsoTimestamp(now);
  const [publicStatusRaw, endpointHistories, probeResult, probeHistories] = await Promise.all([
    buildPublicSiteStatus({ supabase, env, now }),
    safeLoad(() => loadEndpointHeartbeatHistory(supabase), new Map()),
    loadProbeReports(supabase).then(
      (reports) => ({ ok: true, reports }),
      (error) => ({ ok: false, error })
    ),
    safeLoad(() => loadProbeHeartbeatHistory(supabase), new Map()),
  ]);
  const publicStatus = attachServiceHistories(publicStatusRaw, endpointHistories);
  const publicServiceIds = new Set((publicStatus.services || []).map((service) => service.id));
  const endpointServices = buildEndpointServices(endpointHistories, env, {
    excludeIds: publicServiceIds,
  });
  const probes = probeResult.ok
    ? buildProbeSummary(probeResult.reports, { now, histories: probeHistories })
    : [{
        id: 'probe-storage',
        label: 'VPS 探针存储',
        region: null,
        status: 'warning',
        summary: '探针报告暂时无法读取。',
        reportedAt: generatedAt,
        receivedAt: generatedAt,
        updatedAt: generatedAt,
        checks: [{
          id: 'probe-storage-read',
          label: '探针报告读取',
          status: 'warning',
          summary: String(probeResult.error?.code || probeResult.error?.message || 'read_failed').slice(0, 120),
        }],
        metrics: [],
      }];

  return {
    generatedAt,
    overall: deriveOverall(publicStatus, probes, endpointServices),
    publicStatus: {
      overall: publicStatus.overall,
      services: publicStatus.services,
      incidents: publicStatus.incidents,
      meta: publicStatus.meta,
    },
    endpointServices,
    probes,
    runtime: buildRuntimeSummary(env),
  };
}

export const __internal = {
  buildEndpointServices,
  buildRuntimeSummary,
  deriveOverall,
};
