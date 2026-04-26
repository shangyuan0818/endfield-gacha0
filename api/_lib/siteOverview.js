import { fetchVisiblePools } from './publicCatalog.js';

const HOME_NEXT_VERSION_TARGET_CONFIG_KEY = 'home_next_version_target_at';
const DEFAULT_HOME_NEXT_VERSION_TARGET_DATE = '2026-06-04T12:00:00+08:00';

function normalizePoolType(type) {
  if (type === 'limited_character' || type === 'limited') return 'limited';
  if (type === 'limited_weapon' || type === 'weapon') return 'weapon';
  if (type === 'beginner') return 'standard';
  return type || 'standard';
}

function parseDateMs(value) {
  if (!value) {
    return NaN;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getPoolStatus(pool, nowMs) {
  const startMs = parseDateMs(pool?.start_time);
  const endMs = parseDateMs(pool?.end_time);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 'permanent';
  }

  if (nowMs < startMs) {
    return 'upcoming';
  }

  if (nowMs >= endMs) {
    return 'ended';
  }

  return 'active';
}

function buildCountdownParts(targetMs, nowMs) {
  const diff = Math.max(0, targetMs - nowMs);
  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return {
    milliseconds: diff,
    days,
    hours,
    minutes,
    has_started: diff <= 0,
  };
}

function simplifyPool(pool, nowMs) {
  if (!pool) {
    return null;
  }

  const startMs = parseDateMs(pool.start_time);
  const endMs = parseDateMs(pool.end_time);
  const status = getPoolStatus(pool, nowMs);
  const countdownTargetMs = status === 'upcoming' ? startMs : endMs;
  const countdown = Number.isFinite(countdownTargetMs)
    ? buildCountdownParts(countdownTargetMs, nowMs)
    : null;

  return {
    pool_id: pool.id || pool.pool_id,
    name: pool.name || '',
    name_en: pool.name_en || null,
    type: normalizePoolType(pool.type),
    status,
    start_time: pool.start_time || null,
    end_time: pool.end_time || null,
    up_character: pool.up_character || null,
    featured_characters: Array.isArray(pool.featured_characters) ? pool.featured_characters : null,
    countdown,
  };
}

export async function fetchSiteOverview(adminClient, { siteUrl = '' } = {}) {
  const [siteConfigResult, pools] = await Promise.all([
    adminClient
      .from('site_config')
      .select('key, value')
      .in('key', [HOME_NEXT_VERSION_TARGET_CONFIG_KEY]),
    fetchVisiblePools(adminClient),
  ]);

  if (siteConfigResult.error) {
    throw siteConfigResult.error;
  }

  const siteConfigMap = new Map((siteConfigResult.data || []).map((row) => [row.key, row.value]));
  const nextVersionTargetAt = String(
    siteConfigMap.get(HOME_NEXT_VERSION_TARGET_CONFIG_KEY) || DEFAULT_HOME_NEXT_VERSION_TARGET_DATE
  );

  const nowMs = Date.now();
  const visiblePools = Array.isArray(pools) ? pools : [];
  const activePools = visiblePools
    .filter((pool) => getPoolStatus(pool, nowMs) === 'active')
    .map((pool) => simplifyPool(pool, nowMs));
  const upcomingPools = visiblePools
    .filter((pool) => getPoolStatus(pool, nowMs) === 'upcoming')
    .sort((left, right) => parseDateMs(left.start_time) - parseDateMs(right.start_time));
  const limitedPools = visiblePools
    .filter((pool) => normalizePoolType(pool.type) === 'limited')
    .sort((left, right) => parseDateMs(left.start_time) - parseDateMs(right.start_time));
  const activeLimitedPools = limitedPools.filter((pool) => getPoolStatus(pool, nowMs) === 'active');
  const currentLimitedPool = activeLimitedPools.length > 0
    ? activeLimitedPools.sort((left, right) => parseDateMs(right.start_time) - parseDateMs(left.start_time))[0]
    : null;
  const nextLimitedPool = limitedPools.find((pool) => getPoolStatus(pool, nowMs) === 'upcoming') || null;

  return {
    site_url: siteUrl,
    next_version: {
      target_at: nextVersionTargetAt,
      countdown: buildCountdownParts(parseDateMs(nextVersionTargetAt), nowMs),
    },
    current_limited_pool: simplifyPool(currentLimitedPool, nowMs),
    next_limited_pool: simplifyPool(nextLimitedPool, nowMs),
    active_pools: activePools,
    upcoming_pools: upcomingPools.slice(0, 5).map((pool) => simplifyPool(pool, nowMs)),
  };
}

export default {
  fetchSiteOverview,
};
