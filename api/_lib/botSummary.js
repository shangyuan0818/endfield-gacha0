import { calculateCurrentProbability } from '../../src/utils/validators.js';

function normalizePoolType(type) {
  if (type === 'limited_character' || type === 'limited') return 'limited';
  if (type === 'extra') return 'extra';
  if (type === 'limited_weapon' || type === 'weapon') return 'weapon';
  if (type === 'beginner' || type === 'standard') return 'standard';
  return 'standard';
}

function inferPoolTypeFromPoolId(poolId) {
  const normalized = String(poolId || '').toLowerCase();
  if (normalized.startsWith('joint_') || normalized.startsWith('extra_')) return 'extra';
  if (normalized.startsWith('special_')) return 'limited';
  if (normalized.startsWith('weapon') || normalized.startsWith('wepon')) return 'weapon';
  if (normalized === 'beginner') return 'standard';
  if (normalized === 'standard') return 'standard';
  return 'standard';
}

function getProbabilityPoolType(type) {
  const normalizedType = normalizePoolType(type);
  if (normalizedType === 'extra') {
    return 'limited';
  }
  return normalizedType;
}

function isGiftPull(item) {
  return item?.special_type === 'gift' || item?.specialType === 'gift';
}

function isFreePull(item) {
  return item?.is_free === true || item?.isFree === true;
}

function getHistoryTimestamp(item) {
  if (typeof item?.timestamp === 'number' && Number.isFinite(item.timestamp)) {
    return item.timestamp;
  }

  const parsed = new Date(item?.timestamp || item?.created_at || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getHistorySeq(item) {
  const rawValue = Number(item?.seq_id ?? item?.seqId ?? 0);
  return Number.isFinite(rawValue) ? rawValue : 0;
}

function sortHistoryAsc(left, right) {
  const timestampDiff = getHistoryTimestamp(left) - getHistoryTimestamp(right);
  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return getHistorySeq(left) - getHistorySeq(right);
}

function sortHistoryDesc(left, right) {
  return sortHistoryAsc(right, left);
}

function getHistoryGameUid(item) {
  return String(item?.game_uid || item?.gameUid || '').trim() || 'unknown';
}

function getHistoryPoolId(item) {
  return String(item?.pool_id || item?.poolId || '').trim() || 'unknown';
}

function getAccountPoolKey(item) {
  return `${getHistoryGameUid(item)}::${getHistoryPoolId(item)}`;
}

function calculateSimplePity(history = [], rarityThreshold = 6) {
  let pity = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (isGiftPull(item) || isFreePull(item)) {
      continue;
    }

    if (Number(item?.rarity) >= rarityThreshold) {
      break;
    }

    pity += 1;
  }

  return pity;
}

function getPoolStatus(pool, nowMs) {
  const startMs = pool?.start_time ? new Date(pool.start_time).getTime() : NaN;
  const endMs = pool?.end_time ? new Date(pool.end_time).getTime() : NaN;

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

function buildLimitedTerminalPityMap(records, poolTypeById) {
  const terminalMap = new Map();
  const accountStateMap = new Map();

  [...records]
    .filter((item) => !isGiftPull(item) && !isFreePull(item))
    .sort(sortHistoryAsc)
    .forEach((item) => {
      const poolType = normalizePoolType(poolTypeById.get(getHistoryPoolId(item)) || inferPoolTypeFromPoolId(getHistoryPoolId(item)));
      if (poolType !== 'limited') {
        return;
      }

      const gameUid = getHistoryGameUid(item);
      const rarity = Number(item?.rarity) || 0;
      const previousState = accountStateMap.get(gameUid) || { pity6: 0, pity5: 0 };
      const nextState = {
        pity6: rarity >= 6 ? 0 : previousState.pity6 + 1,
        pity5: rarity >= 5 ? 0 : previousState.pity5 + 1,
      };

      accountStateMap.set(gameUid, nextState);
      terminalMap.set(getAccountPoolKey(item), nextState);
    });

  return terminalMap;
}

function buildPoolProbabilityInfo({ history, poolType, limitedTerminalPityMap, accountPoolKey }) {
  const normalizedType = normalizePoolType(poolType);
  const currentPityWithinPool = calculateSimplePity(history, 6);
  const currentPityFiveWithinPool = calculateSimplePity(history, 5);
  const inheritedState = normalizedType === 'limited'
    ? limitedTerminalPityMap.get(accountPoolKey) || null
    : null;

  const currentPity = inheritedState?.pity6 ?? currentPityWithinPool;
  const currentPity5 = inheritedState?.pity5 ?? currentPityFiveWithinPool;
  const probabilityInfo = calculateCurrentProbability(currentPity, getProbabilityPoolType(normalizedType));

  return {
    current_pity: currentPity,
    current_pity5: currentPity5,
    current_probability: probabilityInfo?.probability || 0,
    has_soft_pity: Boolean(probabilityInfo?.hasSoftPity),
    is_in_soft_pity: Boolean(probabilityInfo?.isInSoftPity),
    pulls_until_soft_pity: Number(probabilityInfo?.pullsUntilSoftPity || 0),
  };
}

export async function resolveVerifiedBinding(adminClient, provider, platformUserId) {
  const { data, error } = await adminClient
    .from('user_platform_bindings')
    .select('id, user_id, provider, display_handle, verified_at')
    .eq('provider', provider)
    .eq('platform_user_id', platformUserId)
    .eq('status', 'verified')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function fetchBotSelfSummary(adminClient, userId) {
  const [
    totalHistoryResult,
    sixStarResult,
    fiveStarResult,
    poolCountResult,
    latestHistoryResult,
    profileResult,
    rankingResult,
  ] = await Promise.all([
    adminClient
      .from('history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    adminClient
      .from('history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('rarity', 6),
    adminClient
      .from('history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('rarity', 5),
    adminClient
      .from('pools')
      .select('pool_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    adminClient
      .from('history')
      .select('id, game_uid, pool_id, item_name, rarity, timestamp, is_free, nick_name')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('public_profiles')
      .select('id, username, role')
      .eq('id', userId)
      .limit(1)
      .maybeSingle(),
    adminClient.rpc('get_user_ranking_stats_cached', { p_user_id: userId }),
  ]);

  for (const result of [
    totalHistoryResult,
    sixStarResult,
    fiveStarResult,
    poolCountResult,
    latestHistoryResult,
    profileResult,
    rankingResult,
  ]) {
    if (result?.error) {
      throw result.error;
    }
  }

  return {
    user: {
      id: userId,
      username: profileResult.data?.username || null,
      role: profileResult.data?.role || 'user',
    },
    summary: {
      total_pulls: totalHistoryResult.count || 0,
      six_star_count: sixStarResult.count || 0,
      five_star_count: fiveStarResult.count || 0,
      pool_count: poolCountResult.count || 0,
      latest_pull: latestHistoryResult.data || null,
      primary_account_name: latestHistoryResult.data?.nick_name || null,
    },
    ranking: rankingResult.data ?? null,
  };
}

export async function fetchRecentPullsForUser(adminClient, userId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 20));
  const { data: records, error } = await adminClient
    .from('history')
    .select('id, game_uid, pool_id, item_name, rarity, timestamp, is_free, special_type, nick_name')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw error;
  }

  const poolIds = [...new Set((records || []).map((record) => record.pool_id).filter(Boolean))];
  let poolNameMap = new Map();

  if (poolIds.length > 0) {
    const poolResult = await adminClient
      .from('pools')
      .select('pool_id, name, name_en, type')
      .in('pool_id', poolIds);

    if (poolResult.error) {
      throw poolResult.error;
    }

    poolNameMap = new Map((poolResult.data || []).map((pool) => [pool.pool_id, pool]));
  }

  return (records || []).map((record) => ({
    id: record.id,
    game_uid: record.game_uid || null,
    pool_id: record.pool_id,
    pool_name: poolNameMap.get(record.pool_id)?.name || null,
    pool_name_en: poolNameMap.get(record.pool_id)?.name_en || null,
    pool_type: poolNameMap.get(record.pool_id)?.type || null,
    account_name: String(record?.nick_name || '').trim() || null,
    item_name: record.item_name,
    rarity: record.rarity,
    timestamp: record.timestamp,
    is_free: Boolean(record.is_free),
    special_type: record.special_type || null,
  }));
}

export async function fetchBotPoolStats(adminClient, userId) {
  const [profileResult, historyResult] = await Promise.all([
    adminClient
      .from('public_profiles')
      .select('id, username, role')
      .eq('id', userId)
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('history')
      .select('id, game_uid, pool_id, item_name, rarity, timestamp, is_free, special_type, seq_id, nick_name')
      .eq('user_id', userId),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }
  if (historyResult.error) {
    throw historyResult.error;
  }

  const records = [...(historyResult.data || [])].sort(sortHistoryAsc);
  const poolIds = [...new Set(records.map((record) => record.pool_id).filter(Boolean))];
  let poolMap = new Map();

  if (poolIds.length > 0) {
    const poolResult = await adminClient
      .from('pools')
      .select('pool_id, name, name_en, type, start_time, end_time')
      .eq('user_id', userId)
      .in('pool_id', poolIds);

    if (poolResult.error) {
      throw poolResult.error;
    }

    poolMap = new Map((poolResult.data || []).map((pool) => [pool.pool_id, pool]));
  }

  const historyByAccountPool = new Map();
  for (const record of records) {
    const key = getAccountPoolKey(record);
    if (!historyByAccountPool.has(key)) {
      historyByAccountPool.set(key, []);
    }
    historyByAccountPool.get(key).push(record);
  }

  const poolTypeById = new Map(
    [...poolMap.values()].map((pool) => [pool.pool_id, pool.type])
  );
  const limitedTerminalPityMap = buildLimitedTerminalPityMap(records, poolTypeById);
  const nowMs = Date.now();

  const poolEntries = [...historyByAccountPool.entries()].map(([key, poolHistory]) => {
    const lastRecord = [...poolHistory].sort(sortHistoryDesc)[0] || null;
    const gameUid = getHistoryGameUid(lastRecord);
    const poolId = getHistoryPoolId(lastRecord);
    const poolRow = poolMap.get(poolId) || null;
    const poolType = poolRow?.type || inferPoolTypeFromPoolId(poolId);
    const validPullCount = poolHistory.filter((item) => !isGiftPull(item) && !isFreePull(item)).length;
    const accountName = [...poolHistory]
      .sort(sortHistoryDesc)
      .map((item) => String(item?.nick_name || '').trim())
      .find(Boolean) || gameUid;
    const probabilityInfo = buildPoolProbabilityInfo({
      history: poolHistory,
      poolType,
      limitedTerminalPityMap,
      accountPoolKey: key,
    });

    return {
      key,
      game_uid: gameUid,
      account_name: accountName,
      pool_id: poolId,
      pool_name: poolRow?.name || null,
      pool_name_en: poolRow?.name_en || null,
      pool_type: normalizePoolType(poolType),
      total_pulls: validPullCount,
      latest_item_name: lastRecord?.item_name || null,
      latest_item_rarity: Number(lastRecord?.rarity) || 0,
      latest_pull_at: lastRecord?.timestamp || null,
      status: getPoolStatus(poolRow, nowMs),
      start_time: poolRow?.start_time || null,
      end_time: poolRow?.end_time || null,
      ...probabilityInfo,
    };
  }).sort((left, right) => {
    const leftStatusWeight = left.status === 'active' ? 0 : left.status === 'upcoming' ? 1 : 2;
    const rightStatusWeight = right.status === 'active' ? 0 : right.status === 'upcoming' ? 1 : 2;
    if (leftStatusWeight !== rightStatusWeight) {
      return leftStatusWeight - rightStatusWeight;
    }

    return getHistoryTimestamp({ timestamp: right.latest_pull_at }) - getHistoryTimestamp({ timestamp: left.latest_pull_at });
  });

  const accounts = Array.from(
    poolEntries.reduce((map, entry) => {
      if (!map.has(entry.game_uid)) {
        map.set(entry.game_uid, {
          game_uid: entry.game_uid,
          display_name: entry.account_name || entry.game_uid,
          total_pulls: 0,
          latest_pull_at: entry.latest_pull_at,
          pools: [],
        });
      }

      const currentEntry = map.get(entry.game_uid);
      currentEntry.total_pulls += entry.total_pulls || 0;
      if (
        !currentEntry.latest_pull_at
        || getHistoryTimestamp({ timestamp: entry.latest_pull_at }) > getHistoryTimestamp({ timestamp: currentEntry.latest_pull_at })
      ) {
        currentEntry.latest_pull_at = entry.latest_pull_at;
        currentEntry.display_name = entry.account_name || currentEntry.display_name;
      }
      currentEntry.pools.push(entry);
      return map;
    }, new Map()).values()
  ).sort((left, right) => (
    getHistoryTimestamp({ timestamp: right.latest_pull_at }) - getHistoryTimestamp({ timestamp: left.latest_pull_at })
  ));

  return {
    user: {
      id: userId,
      username: profileResult.data?.username || null,
      role: profileResult.data?.role || 'user',
    },
    total_pool_entries: poolEntries.length,
    accounts,
    latest_pool: poolEntries[0] || null,
  };
}

export default {
  resolveVerifiedBinding,
  fetchBotSelfSummary,
  fetchRecentPullsForUser,
  fetchBotPoolStats,
};
