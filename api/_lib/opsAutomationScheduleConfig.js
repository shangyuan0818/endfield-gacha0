const OPS_AUTOMATION_JOB_IDS = ['official-announcements', 'pool-schedule', 'wiki-catalog'];
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const SCHEDULE_TIMEZONE_OFFSET_MINUTES = 480;

export const OPS_AUTOMATION_SCHEDULE_CONFIG_KEY = 'ops_automation_schedule_config';

function normalizeWeekdays(value) {
  if (!Array.isArray(value)) return [...ALL_WEEKDAYS];
  const weekdays = [...new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
  )].sort((left, right) => left - right);
  return weekdays.length ? weekdays : [...ALL_WEEKDAYS];
}

function normalizeJobConfig(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    enabled: raw.enabled !== false,
    weekdays: normalizeWeekdays(raw.weekdays),
  };
}

export function normalizeOpsAutomationScheduleConfig(rawValue) {
  let parsed = rawValue;
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      parsed = null;
    }
  }
  const raw = parsed && typeof parsed === 'object' ? parsed : {};
  const rawJobs = raw.jobs && typeof raw.jobs === 'object' ? raw.jobs : {};

  const jobs = {};
  for (const jobId of OPS_AUTOMATION_JOB_IDS) {
    jobs[jobId] = normalizeJobConfig(rawJobs[jobId]);
  }

  const graceMinutes = Number(raw.graceMinutes);

  return {
    jobs,
    graceMinutes: Number.isFinite(graceMinutes) && graceMinutes >= 0 && graceMinutes <= 24 * 60
      ? Math.round(graceMinutes)
      : 90,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 200) : '',
  };
}

export async function loadOpsAutomationScheduleConfig(supabase) {
  if (!supabase) {
    return normalizeOpsAutomationScheduleConfig(null);
  }

  try {
    const { data, error } = await supabase
      .from('site_config')
      .select('value')
      .eq('key', OPS_AUTOMATION_SCHEDULE_CONFIG_KEY)
      .maybeSingle();

    if (error) {
      return normalizeOpsAutomationScheduleConfig(null);
    }

    return normalizeOpsAutomationScheduleConfig(data?.value ?? null);
  } catch {
    return normalizeOpsAutomationScheduleConfig(null);
  }
}

// 执行时机按北京时间（UTC+8）的星期判定
export function getScheduleWeekday(now = new Date()) {
  const shifted = new Date(now.getTime() + SCHEDULE_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  return shifted.getUTCDay();
}

export function filterJobIdsBySchedule(jobIds, config, now = new Date()) {
  const normalized = config && typeof config === 'object' && config.jobs
    ? config
    : normalizeOpsAutomationScheduleConfig(config);
  const weekday = getScheduleWeekday(now);
  const allowed = [];
  const skipped = [];

  for (const jobId of jobIds) {
    const jobConfig = normalized.jobs[jobId] || normalizeJobConfig(null);
    if (!jobConfig.enabled) {
      skipped.push({ jobId, reason: 'disabled_by_schedule_config' });
      continue;
    }
    if (!jobConfig.weekdays.includes(weekday)) {
      skipped.push({ jobId, reason: 'weekday_not_scheduled' });
      continue;
    }
    allowed.push(jobId);
  }

  return { allowed, skipped, weekday };
}

export const __internal = {
  normalizeJobConfig,
  normalizeWeekdays,
  OPS_AUTOMATION_JOB_IDS,
};
