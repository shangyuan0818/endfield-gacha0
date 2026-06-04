import { loadPublicAnalyticsHealth } from './publicAnalyticsHealth.js';
import { resolvePublicCacheVersion } from './publicCache.js';

const PUBLIC_LEVELS = ['ok', 'notice', 'warning', 'unknown'];

function readEnvironment() {
  return globalThis.process?.env || {};
}

function toIsoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeErrorCode(error) {
  const code = String(error?.code || '').trim();
  if (code) return code.slice(0, 40);

  const message = String(error?.message || error || '').toLowerCase();
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('failed to fetch') || message.includes('network')) return 'network';
  if (message.includes('permission') || message.includes('jwt')) return 'permission';
  if (message.includes('does not exist') || message.includes('schema')) return 'schema';
  return 'check_failed';
}

function normalizeLevel(level, fallback = 'unknown') {
  return PUBLIC_LEVELS.includes(level) ? level : fallback;
}

function toTimestampMs(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getFreshnessLevel(updatedAt, {
  noticeAfterHours = 24,
  warningAfterHours = 72,
} = {}) {
  const updatedMs = toTimestampMs(updatedAt);
  if (updatedMs == null) {
    return 'unknown';
  }

  const ageHours = Math.max(0, (Date.now() - updatedMs) / 3600000);
  if (ageHours >= warningAfterHours) return 'warning';
  if (ageHours >= noticeAfterHours) return 'notice';
  return 'ok';
}

function createService({
  id,
  label,
  status = 'unknown',
  summary,
  checkedAt,
  updatedAt = null,
  detail = null,
} = {}) {
  return {
    id,
    label,
    status: normalizeLevel(status),
    summary,
    checkedAt,
    ...(updatedAt ? { updatedAt } : {}),
    ...(detail ? { detail } : {}),
  };
}

async function safeSection(name, loader) {
  try {
    return {
      name,
      ok: true,
      value: await loader(),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      errorCode: normalizeErrorCode(error),
    };
  }
}

async function loadPublicSignals(supabase, now = new Date()) {
  if (!supabase) {
    return {
      cacheVersion: {
        name: 'cacheVersion',
        ok: true,
        value: '0',
      },
      analyticsHealth: {
        name: 'analyticsHealth',
        ok: true,
        value: null,
      },
    };
  }

  const [cacheVersion, analyticsHealth] = await Promise.all([
    safeSection('cacheVersion', () => resolvePublicCacheVersion(supabase)),
    safeSection('analyticsHealth', () => loadPublicAnalyticsHealth(supabase, { now })),
  ]);

  return {
    cacheVersion,
    analyticsHealth,
  };
}

function isEnabledValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
}

function isDisabledValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['0', 'false', 'no', 'off', 'disabled'].includes(normalized);
}

function buildMailService(env, checkedAt) {
  const workerEnabled = isEnabledValue(env.MAIL_OUTBOX_WORKER_ENABLED || env.MAIL_WORKER_ENABLED);
  const actionEnabled = !isDisabledValue(env.AUTH_MAIL_ACTIONS_ENABLED);
  const stopped = isEnabledValue(env.MAIL_OUTBOX_GLOBAL_KILL_SWITCH || env.MAIL_GLOBAL_KILL_SWITCH);

  if (stopped) {
    return createService({
      id: 'mail',
      label: '邮件通知',
      status: 'warning',
      summary: '邮件发送当前处于紧急停发状态。',
      checkedAt,
      detail: '站内功能可继续使用，但注册验证、重置密码或通知邮件可能延迟。',
    });
  }

  if (!workerEnabled || !actionEnabled) {
    return createService({
      id: 'mail',
      label: '邮件通知',
      status: 'notice',
      summary: '邮件通知入口未完全开放。',
      checkedAt,
      detail: '部分邮件相关操作可能改用站内提示或人工处理。',
    });
  }

  return createService({
    id: 'mail',
    label: '邮件通知',
    status: 'ok',
    summary: '邮件通知入口已启用。',
    checkedAt,
  });
}

function buildCaptchaService(env, checkedAt) {
  const mode = String(
    env.AUTH_CAPTCHA_MODE
    || env.VITE_AUTH_CAPTCHA_MODE
    || env.CAPTCHA_MODE
    || ''
  ).trim().toLowerCase();

  if (!mode) {
    return createService({
      id: 'captcha',
      label: '验证服务',
      status: 'unknown',
      summary: '公开状态页无法确认当前验证策略。',
      checkedAt,
    });
  }

  if (['disabled', 'off', 'none'].includes(mode)) {
    return createService({
      id: 'captcha',
      label: '验证服务',
      status: 'notice',
      summary: '验证服务未作为强制入口启用。',
      checkedAt,
    });
  }

  return createService({
    id: 'captcha',
    label: '验证服务',
    status: 'ok',
    summary: mode.includes('turnstile')
      ? '验证服务已启用，异常时会按站点策略降级。'
      : '验证服务已启用。',
    checkedAt,
  });
}

function buildDataService(supabase, signals, checkedAt) {
  if (!supabase) {
    return createService({
      id: 'data',
      label: '数据服务',
      status: 'unknown',
      summary: '当前环境未配置公开数据检查。',
      checkedAt,
    });
  }

  if (signals.analyticsHealth.ok && signals.analyticsHealth.value?.level !== 'warning') {
    return createService({
      id: 'data',
      label: '数据服务',
      status: 'ok',
      summary: '公开数据读取入口可用。',
      checkedAt,
    });
  }

  return createService({
    id: 'data',
    label: '数据服务',
    status: 'warning',
    summary: '公开数据读取入口检查失败。',
    checkedAt,
    detail: '请稍后重试；如果持续出现，请提交工单并附上检查时间。',
  });
}

function buildPublicStatsService(signals, checkedAt) {
  const health = signals.analyticsHealth.ok ? signals.analyticsHealth.value : null;

  if (!signals.analyticsHealth.ok) {
    return createService({
      id: 'public-stats',
      label: '公共统计',
      status: 'warning',
      summary: '公共统计缓存当前不可确认。',
      checkedAt,
      detail: `检查失败：${signals.analyticsHealth.errorCode || 'unknown'}`,
    });
  }

  if (!health) {
    return createService({
      id: 'public-stats',
      label: '公共统计',
      status: 'notice',
      summary: '公共统计缓存暂无可展示数据。',
      checkedAt,
    });
  }

  if (health.level === 'warning' && (!health.analytics?.available || !health.trends?.available)) {
    return createService({
      id: 'public-stats',
      label: '公共统计',
      status: 'warning',
      summary: '公共统计缓存当前不可确认。',
      checkedAt,
      updatedAt: health.latestAt,
      detail: '统计页面可能会使用降级数据，请稍后重试。',
    });
  }

  if (health.sampledRows === 0) {
    return createService({
      id: 'public-stats',
      label: '公共统计',
      status: 'notice',
      summary: '公共统计缓存暂无可展示数据。',
      checkedAt,
    });
  }

  return createService({
    id: 'public-stats',
    label: '公共统计',
    status: health.level,
    summary: health.level === 'ok'
      ? '公共统计缓存近期已更新。'
      : health.level === 'notice'
        ? '公共统计缓存可能不是最新。'
        : health.level === 'warning'
          ? '公共统计缓存较久未更新。'
          : '公共统计缓存更新时间未知。',
    checkedAt,
    updatedAt: health.latestAt,
    detail: [
      health.analytics?.latest?.totalPulls != null
        ? `最近样本池约 ${Number(health.analytics.latest.totalPulls || 0).toLocaleString('zh-CN')} 抽`
        : null,
      health.analytics?.sampledRows != null || health.trends?.sampledRows != null
        ? `采样缓存行 ${Number(health.sampledRows || 0).toLocaleString('zh-CN')}`
        : null,
    ].filter(Boolean).join('；') || null,
  });
}

function buildImportService(checkedAt) {
  return createService({
    id: 'import',
    label: '数据导入',
    status: 'unknown',
    summary: '导入后端暂未开放公开检查。',
    checkedAt,
    detail: '导入失败时，请优先查看页面内错误摘要或提交工单。',
  });
}

function deriveOverall(services) {
  const warningCount = services.filter(item => item.status === 'warning').length;
  const noticeCount = services.filter(item => item.status === 'notice').length;
  const unknownCount = services.filter(item => item.status === 'unknown').length;

  if (warningCount > 0) {
    return {
      level: 'warning',
      label: '部分服务需要关注',
      affectedCount: warningCount,
    };
  }

  if (noticeCount > 0) {
    return {
      level: 'notice',
      label: '有服务处于提示状态',
      affectedCount: noticeCount,
    };
  }

  if (unknownCount > 0) {
    return {
      level: 'notice',
      label: '部分检查不可确认',
      affectedCount: unknownCount,
    };
  }

  return {
    level: 'ok',
    label: '服务运行正常',
    affectedCount: 0,
  };
}

export async function buildPublicSiteStatus({
  supabase = null,
  env = readEnvironment(),
  now = new Date(),
} = {}) {
  const checkedAt = toIsoTimestamp(now);
  const signals = await loadPublicSignals(supabase, now);

  const services = [
    createService({
      id: 'site',
      label: '主站',
      status: 'ok',
      summary: '状态页和静态资源可访问。',
      checkedAt,
    }),
    buildDataService(supabase, signals, checkedAt),
    buildPublicStatsService(signals, checkedAt),
    buildMailService(env, checkedAt),
    buildImportService(checkedAt),
    buildCaptchaService(env, checkedAt),
  ];

  const cacheVersion = signals.cacheVersion.ok ? signals.cacheVersion.value : '0';
  const incidents = services
    .filter(item => item.status === 'warning')
    .map(item => ({
      serviceId: item.id,
      label: item.label,
      status: item.status,
      summary: item.summary,
    }));

  return {
    generatedAt: checkedAt,
    overall: deriveOverall(services),
    services,
    incidents,
    meta: {
      cacheVersion,
      source: supabase ? 'public-checks' : 'default',
      generatedAt: checkedAt,
    },
  };
}

export const __internal = {
  buildCaptchaService,
  buildMailService,
  deriveOverall,
  getFreshnessLevel,
  normalizeErrorCode,
};
