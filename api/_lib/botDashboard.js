import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useHistoryStore from '../../src/stores/useHistoryStore.js';
import { usePoolStats } from '../../src/hooks/app/usePoolStats.js';
import { normalizeIsStandard } from '../../src/utils/index.js';
import { buildDashboardTimelineSections } from '../../src/utils/dashboardTimelineSections.js';
import { buildDashboardSharePayload } from '../../src/utils/dashboardShare.js';
import { getPoolAnalysisPityState } from '../../src/utils/poolAnalysisPity.js';
import { characterCache } from '../../src/utils/characterUtils.js';
import { fetchCharacters, fetchVisiblePools } from './publicCatalog.js';
import { localizeHistoryItemName, localizePoolFeaturedList, localizePoolName } from '../../src/utils/gameDataI18n.js';
import { getPoolTimingMeta } from '../../src/utils/poolSelectorDisplay.js';

const BOT_LOCALE = 'zh-CN';
const LIMITED_POOL_TYPES = new Set(['limited', 'limited_character']);
function encodeRefPayload(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64url');
}

function decodeRefPayload(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

export function decodeBotRef(ref) {
  const value = String(ref || '').trim();
  if (!value) {
    return null;
  }

  try {
    if (value.startsWith('a.')) {
      const gameUid = decodeRefPayload(value.slice(2)).trim();
      return gameUid ? { kind: 'account', gameUid } : null;
    }

    if (value.startsWith('p.')) {
      const [gameUid = '', poolId = ''] = decodeRefPayload(value.slice(2)).split('|');
      if (!poolId.trim()) {
        return null;
      }
      return {
        kind: 'pool',
        gameUid: gameUid.trim(),
        poolId: poolId.trim(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

function normalizePoolType(type) {
  if (type === 'limited_character' || type === 'limited') return 'limited';
  if (type === 'limited_weapon' || type === 'weapon') return 'weapon';
  if (type === 'extra') return 'extra';
  if (type === 'beginner') return 'standard';
  return type || 'standard';
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

function getHistoryRecordKey(item) {
  const value = item?.id || item?.record_id || null;
  return value == null ? null : String(value);
}

function getAccountPoolKey(item) {
  return `${getHistoryGameUid(item)}::${getHistoryPoolId(item)}`;
}

function buildAccountRef(gameUid) {
  return `a.${encodeRefPayload(String(gameUid || '').trim())}`;
}

function buildPoolRef({ gameUid, poolId }) {
  return `p.${encodeRefPayload(`${String(gameUid || '').trim()}|${String(poolId || '').trim()}`)}`;
}

function readSelectionRefs({ accountRef = null, poolRef = null, gameUid = null, poolId = null } = {}) {
  const decodedAccount = decodeBotRef(accountRef);
  const decodedPool = decodeBotRef(poolRef);

  return {
    gameUid: decodedPool?.gameUid
      || decodedAccount?.gameUid
      || (gameUid ? String(gameUid).trim() : null),
    poolId: decodedPool?.poolId
      || (poolId ? String(poolId).trim() : null),
  };
}

function isGiftPull(item) {
  return item?.special_type === 'gift' || item?.specialType === 'gift';
}

function isFreePull(item) {
  return item?.is_free === true || item?.isFree === true;
}

function localizePoolDisplayName(pool) {
  return localizePoolName(pool, { locale: BOT_LOCALE }) || pool?.name || '未知卡池';
}

function localizeFeaturedList(pool) {
  return localizePoolFeaturedList(pool, { locale: BOT_LOCALE })
    .map((name) => String(name || '').trim())
    .filter((name) => name && !isTechnicalIdentifier(name));
}

function localizeItemName(item) {
  return localizeHistoryItemName(item, { locale: BOT_LOCALE });
}

function isTechnicalIdentifier(value) {
  const text = String(value || '').trim().toLowerCase();
  return (
    /^(joint|extra|special|weapon|wepon|weponbox|pool|chr|char|wpn|manual)_/.test(text)
    || text === 'standard'
    || text === 'beginner'
  );
}

function buildFallbackPool(poolId) {
  return {
    id: poolId,
    pool_id: poolId,
    name: '',
    name_en: null,
    type: inferPoolTypeFromPoolId(poolId),
    up_character: null,
    featured_characters: [],
    start_time: null,
    end_time: null,
  };
}

function resolvePoolRow(poolMap, poolId) {
  return poolMap.get(poolId) || buildFallbackPool(poolId);
}

function buildStatusMeta(pool) {
  const timing = getPoolTimingMeta(pool, new Date(), BOT_LOCALE);
  return {
    status: timing.isActive ? 'active' : timing.isUpcoming ? 'upcoming' : timing.isExpired ? 'ended' : 'permanent',
    remaining_label: timing.remainingLabel || '',
    is_active: timing.isActive,
    is_upcoming: timing.isUpcoming,
    is_timed: timing.isTimed,
  };
}

function runPoolStatsHook(props) {
  let hookResult = null;
  const previousState = useHistoryStore.getState();

  function Probe(currentProps) {
    hookResult = usePoolStats(currentProps);
    return React.createElement('div', null, 'probe');
  }

  try {
    useHistoryStore.setState({
      ...previousState,
      historyFilter: 'all',
    });
    renderToStaticMarkup(React.createElement(Probe, props));
    return hookResult;
  } finally {
    useHistoryStore.setState(previousState);
  }
}

function buildLimitedTerminalPityMap(records, poolMap) {
  const terminalMap = new Map();
  const accountStateMap = new Map();

  [...records]
    .filter((item) => !isGiftPull(item) && !isFreePull(item))
    .sort(sortHistoryAsc)
    .forEach((item) => {
      const poolType = normalizePoolType(resolvePoolRow(poolMap, getHistoryPoolId(item)).type);
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

function buildCrossPoolPityMap(allLimitedHistory = []) {
  if (!Array.isArray(allLimitedHistory) || allLimitedHistory.length === 0) {
    return null;
  }

  const map = new Map();
  let sixPity = 0;
  let fivePity = 0;

  [...allLimitedHistory]
    .filter((item) => !isGiftPull(item))
    .sort(sortHistoryAsc)
    .forEach((item) => {
      const isFree = isFreePull(item);
      const recordKey = getHistoryRecordKey(item);

      if (!isFree) {
        sixPity += 1;
        fivePity += 1;
      }

      if (Number(item?.rarity) >= 5 && recordKey) {
        map.set(recordKey, {
          sixStarPity: isFree ? 'free' : (Number(item?.rarity) >= 6 ? sixPity : null),
          fiveStarPity: isFree ? 'free' : fivePity,
        });
      }

      if (!isFree) {
        if (Number(item?.rarity) >= 6) {
          sixPity = 0;
        }
        if (Number(item?.rarity) >= 5) {
          fivePity = 0;
        }
      }
    });

  return map;
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

function getProbabilityPoolType(type) {
  return normalizePoolType(type) === 'extra' ? 'limited' : normalizePoolType(type);
}

function calculateCurrentProbability(currentPity, poolType) {
  const normalizedType = getProbabilityPoolType(poolType);
  const softPityStart = normalizedType === 'weapon' ? 31 : 61;
  const baseProbability = normalizedType === 'weapon' ? 0.02 : 0.008;
  const hardPity = normalizedType === 'weapon' ? 40 : 80;

  if (currentPity >= hardPity - 1) {
    return {
      probability: 1,
      hasSoftPity: true,
      isInSoftPity: true,
      pullsUntilSoftPity: 0,
    };
  }

  if (currentPity < softPityStart) {
    return {
      probability: baseProbability,
      hasSoftPity: true,
      isInSoftPity: false,
      pullsUntilSoftPity: softPityStart - currentPity,
    };
  }

  const softOffset = currentPity - softPityStart + 1;
  const probability = Math.min(baseProbability + softOffset * (normalizedType === 'weapon' ? 0.08 : 0.05), 1);
  return {
    probability,
    hasSoftPity: true,
    isInSoftPity: true,
    pullsUntilSoftPity: 0,
  };
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
  const probabilityInfo = calculateCurrentProbability(currentPity, normalizedType);

  return {
    current_pity: currentPity,
    current_pity5: currentPity5,
    current_probability: probabilityInfo?.probability || 0,
    has_soft_pity: Boolean(probabilityInfo?.hasSoftPity),
    is_in_soft_pity: Boolean(probabilityInfo?.isInSoftPity),
    pulls_until_soft_pity: Number(probabilityInfo?.pullsUntilSoftPity || 0),
  };
}

function buildAnnotatedHistory(records, poolMap) {
  return [...records]
    .sort(sortHistoryAsc)
    .map((record) => {
      const gameUid = getHistoryGameUid(record);
      const poolId = getHistoryPoolId(record);
      const pool = resolvePoolRow(poolMap, poolId);
      return {
        ...record,
        poolId,
        pool_id: poolId,
        gameUid,
        game_uid: gameUid,
        isStandard: normalizeIsStandard(record, pool?.type, pool?.up_character),
      };
    });
}

function buildAccountName(records = [], fallback = '未命名账号') {
  return [...records]
    .sort(sortHistoryDesc)
    .map((item) => String(item?.nick_name || '').trim())
    .find(Boolean) || fallback;
}

async function loadBotDataset(adminClient, userId) {
  const [profileResult, historyResult, visiblePools, characters] = await Promise.all([
    adminClient
      .from('public_profiles')
      .select('id, username, role')
      .eq('id', userId)
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('history')
      .select('id, record_id, game_uid, pool_id, item_name, rarity, timestamp, is_free, special_type, seq_id, nick_name')
      .eq('user_id', userId),
    fetchVisiblePools(adminClient),
    fetchCharacters(adminClient).catch(() => []),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (historyResult.error) throw historyResult.error;

  if (Array.isArray(characters) && characters.length > 0) {
    characterCache.applyCharacters(characters);
    characterCache.finishLoading();
  }

  const poolMap = new Map((visiblePools || []).map((pool) => [pool.id || pool.pool_id, pool]));
  const history = buildAnnotatedHistory(historyResult.data || [], poolMap);

  return {
    user: {
      id: userId,
      username: profileResult.data?.username || null,
      role: profileResult.data?.role || 'user',
    },
    history,
    poolMap,
  };
}

function buildAccountPoolEntries(history, poolMap) {
  const historyByAccountPool = new Map();
  for (const record of history) {
    const key = getAccountPoolKey(record);
    if (!historyByAccountPool.has(key)) {
      historyByAccountPool.set(key, []);
    }
    historyByAccountPool.get(key).push(record);
  }

  const limitedTerminalPityMap = buildLimitedTerminalPityMap(history, poolMap);

  return [...historyByAccountPool.entries()].map(([key, poolHistory]) => {
    const lastRecord = [...poolHistory].sort(sortHistoryDesc)[0] || null;
    const gameUid = getHistoryGameUid(lastRecord);
    const poolId = getHistoryPoolId(lastRecord);
    const poolRow = resolvePoolRow(poolMap, poolId);
    const poolType = normalizePoolType(poolRow?.type);
    const validPullCount = poolHistory.filter((item) => !isGiftPull(item) && !isFreePull(item)).length;
    const accountName = buildAccountName(poolHistory, gameUid);
    const probabilityInfo = buildPoolProbabilityInfo({
      history: poolHistory,
      poolType,
      limitedTerminalPityMap,
      accountPoolKey: key,
    });
    const statusMeta = buildStatusMeta(poolRow);
    const featured = localizeFeaturedList(poolRow);
    const latestHighRarity = [...poolHistory]
      .sort(sortHistoryDesc)
      .find((item) => Number(item?.rarity) >= 5) || null;

    return {
      key,
      game_uid: gameUid,
      account_name: accountName,
      pool_id: poolId,
      pool_type: poolType,
      pool_name: poolRow?.name || null,
      display_name: localizePoolDisplayName(poolRow),
      featured,
      total_pulls: validPullCount,
      latest_item_name: latestHighRarity ? localizeItemName(latestHighRarity) : null,
      latest_item_rarity: Number(latestHighRarity?.rarity) || 0,
      latest_pull_at: lastRecord?.timestamp || null,
      start_time: poolRow?.start_time || null,
      end_time: poolRow?.end_time || null,
      share_target: {
        game_uid: gameUid,
        pool_id: poolId,
      },
      ...statusMeta,
      ...probabilityInfo,
    };
  }).sort((left, right) => {
    const weight = { active: 0, upcoming: 1, permanent: 2, ended: 3 };
    if ((weight[left.status] || 9) !== (weight[right.status] || 9)) {
      return (weight[left.status] || 9) - (weight[right.status] || 9);
    }
    return getHistoryTimestamp({ timestamp: right.latest_pull_at }) - getHistoryTimestamp({ timestamp: left.latest_pull_at });
  });
}

function buildAccountsFromEntries(entries = []) {
  return Array.from(
    entries.reduce((map, entry) => {
      if (!map.has(entry.game_uid)) {
        map.set(entry.game_uid, {
          game_uid: entry.game_uid,
          display_name: entry.account_name,
          total_pulls: 0,
          latest_pull_at: entry.latest_pull_at,
          pools: [],
        });
      }

      const current = map.get(entry.game_uid);
      current.total_pulls += Number(entry.total_pulls || 0);
      if (getHistoryTimestamp({ timestamp: entry.latest_pull_at }) > getHistoryTimestamp({ timestamp: current.latest_pull_at })) {
        current.latest_pull_at = entry.latest_pull_at;
        current.display_name = entry.account_name;
      }
      current.pools.push(entry);
      return map;
    }, new Map()).values()
  ).sort((left, right) => (
    getHistoryTimestamp({ timestamp: right.latest_pull_at }) - getHistoryTimestamp({ timestamp: left.latest_pull_at })
  ));
}

function toAnalysisPoolEntry(entry = {}) {
  const ref = buildPoolRef({
    gameUid: entry.game_uid,
    poolId: entry.pool_id,
  });

  return {
    ref,
    account_ref: buildAccountRef(entry.game_uid),
    display_name: entry.display_name,
    pool_type: entry.pool_type,
    featured: entry.featured || [],
    total_pulls: entry.total_pulls || 0,
    current_pity: entry.current_pity || 0,
    current_pity5: entry.current_pity5 || 0,
    current_probability: entry.current_probability || 0,
    has_soft_pity: Boolean(entry.has_soft_pity),
    is_in_soft_pity: Boolean(entry.is_in_soft_pity),
    pulls_until_soft_pity: entry.pulls_until_soft_pity || 0,
    latest_item_name: entry.latest_item_name || null,
    latest_item_rarity: entry.latest_item_rarity || 0,
    latest_pull_at: entry.latest_pull_at || null,
    start_time: entry.start_time || null,
    end_time: entry.end_time || null,
    status: entry.status,
    remaining_label: entry.remaining_label || '',
    is_active: Boolean(entry.is_active),
    is_upcoming: Boolean(entry.is_upcoming),
    is_timed: Boolean(entry.is_timed),
    actions: {
      detail_ref: ref,
      share_ref: ref,
      log_ref: ref,
    },
  };
}

function toAnalysisAccount(account = {}) {
  return {
    ref: buildAccountRef(account.game_uid),
    display_name: account.display_name || '未命名账号',
    total_pulls: account.total_pulls || 0,
    latest_pull_at: account.latest_pull_at || null,
    pools: (account.pools || []).map(toAnalysisPoolEntry),
  };
}

export function toAnalysisPoolDetail(detail = null) {
  if (!detail) {
    return null;
  }

  const poolRef = buildPoolRef({
    gameUid: detail?.account?.game_uid,
    poolId: detail?.pool?.pool_id,
  });

  return {
    account: {
      ref: buildAccountRef(detail?.account?.game_uid),
      display_name: detail?.account?.display_name || '未命名账号',
      total_pulls: detail?.account?.total_pulls || 0,
      six_star_count: detail?.account?.six_star_count || 0,
      five_star_count: detail?.account?.five_star_count || 0,
      pool_count: detail?.account?.pool_count || 0,
    },
    pool: {
      ref: poolRef,
      account_ref: buildAccountRef(detail?.account?.game_uid),
      pool_type: detail?.pool?.pool_type || 'standard',
      display_name: detail?.pool?.display_name || '未知卡池',
      featured: detail?.pool?.featured || [],
      status: detail?.pool?.status || 'permanent',
      remaining_label: detail?.pool?.remaining_label || '',
      is_active: Boolean(detail?.pool?.is_active),
      is_upcoming: Boolean(detail?.pool?.is_upcoming),
      is_timed: Boolean(detail?.pool?.is_timed),
      start_time: detail?.pool?.start_time || null,
      end_time: detail?.pool?.end_time || null,
      actions: {
        detail_ref: poolRef,
        share_ref: poolRef,
        log_ref: poolRef,
      },
    },
    stats: detail.stats || {},
    recent_records: detail.recent_records || [],
    timeline_sections: detail.timeline_sections || [],
    share_payload: detail.share_payload || null,
  };
}

function buildLatestHighRarity(history = []) {
  return [...history]
    .sort(sortHistoryDesc)
    .find((item) => Number(item?.rarity) >= 5) || null;
}

function buildAccountSummary(history = []) {
  const validHistory = history.filter((item) => !isGiftPull(item) && !isFreePull(item));
  const uniquePools = new Set(validHistory.map((item) => getHistoryPoolId(item)).filter(Boolean));
  return {
    total_pulls: validHistory.length,
    six_star_count: validHistory.filter((item) => Number(item?.rarity) >= 6).length,
    five_star_count: validHistory.filter((item) => Number(item?.rarity) === 5).length,
    pool_count: uniquePools.size,
  };
}

export async function fetchBotDashboard(adminClient, userId) {
  const dataset = await loadBotDataset(adminClient, userId);
  const poolEntries = buildAccountPoolEntries(dataset.history, dataset.poolMap);
  const accounts = buildAccountsFromEntries(poolEntries);
  const latestHighRarity = buildLatestHighRarity(dataset.history);
  const latestPool = poolEntries[0] || null;
  const primaryAccount = accounts[0] || null;

  return {
    user: dataset.user,
    summary: {
      ...buildAccountSummary(dataset.history),
      primary_account_name: primaryAccount?.display_name || null,
      latest_pull: latestHighRarity ? {
        item_name: localizeItemName(latestHighRarity),
        rarity: latestHighRarity.rarity,
        pool_name: localizePoolDisplayName(resolvePoolRow(dataset.poolMap, getHistoryPoolId(latestHighRarity))),
        account_name: buildAccountName([latestHighRarity], getHistoryGameUid(latestHighRarity)),
      } : null,
      recommended_pool: latestPool ? {
        ref: buildPoolRef({
          gameUid: latestPool.game_uid,
          poolId: latestPool.pool_id,
        }),
        account_ref: buildAccountRef(latestPool.game_uid),
        display_name: latestPool.display_name,
        account_name: latestPool.account_name,
        pool_type: latestPool.pool_type,
        current_pity: latestPool.current_pity,
        current_probability: latestPool.current_probability,
      } : null,
    },
  };
}

export async function fetchBotPoolIndex(adminClient, userId) {
  const dataset = await loadBotDataset(adminClient, userId);
  const poolEntries = buildAccountPoolEntries(dataset.history, dataset.poolMap);
  const accounts = buildAccountsFromEntries(poolEntries);

  return {
    user: dataset.user,
    total_pool_entries: poolEntries.length,
    latest_pool: poolEntries[0] ? toAnalysisPoolEntry(poolEntries[0]) : null,
    accounts: accounts.map(toAnalysisAccount),
  };
}

export async function fetchBotAnalysis(adminClient, userId, selection = {}) {
  const { gameUid, poolId } = readSelectionRefs(selection);
  const dataset = await loadBotDataset(adminClient, userId);
  const poolEntries = buildAccountPoolEntries(dataset.history, dataset.poolMap);
  const rawAccounts = buildAccountsFromEntries(poolEntries);
  const accounts = rawAccounts.map(toAnalysisAccount);
  const flatPools = rawAccounts.flatMap((account) => account.pools || []);
  let selectedRawAccount = gameUid
    ? rawAccounts.find((account) => String(account.game_uid) === String(gameUid)) || null
    : rawAccounts[0] || null;
  const candidatePools = selectedRawAccount
    ? selectedRawAccount.pools || []
    : flatPools;
  const selectedRawPool = poolId
    ? candidatePools.find((pool) => String(pool.pool_id) === String(poolId))
      || flatPools.find((pool) => String(pool.pool_id) === String(poolId))
      || null
    : candidatePools[0] || poolEntries[0] || null;

  if (!selectedRawAccount && selectedRawPool?.game_uid) {
    selectedRawAccount = rawAccounts.find((account) => String(account.game_uid) === String(selectedRawPool.game_uid)) || null;
  }

  const selectedPoolId = selectedRawPool?.pool_id || poolId || null;
  const selectedGameUid = selectedRawPool?.game_uid || selectedRawAccount?.game_uid || gameUid || null;
  const selectedDetail = selectedPoolId
    ? await fetchBotPoolDetail(adminClient, userId, {
      gameUid: selectedGameUid,
      poolId: selectedPoolId,
    })
    : null;

  return {
    user: dataset.user,
    navigation: {
      accounts,
      selected_account_ref: selectedRawAccount ? buildAccountRef(selectedRawAccount.game_uid) : (selectedGameUid ? buildAccountRef(selectedGameUid) : null),
      selected_pool_ref: selectedRawPool ? buildPoolRef({
        gameUid: selectedRawPool.game_uid,
        poolId: selectedRawPool.pool_id,
      }) : null,
    },
    selected: {
      account: selectedRawAccount ? toAnalysisAccount(selectedRawAccount) : null,
      pool: selectedRawPool ? toAnalysisPoolEntry(selectedRawPool) : null,
      detail: toAnalysisPoolDetail(selectedDetail),
    },
  };
}

export async function fetchBotRecentPulls(adminClient, userId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 20));
  const dataset = await loadBotDataset(adminClient, userId);
  const records = [...dataset.history]
    .sort(sortHistoryDesc)
    .filter((item) => Number(item?.rarity) >= 5)
    .slice(0, safeLimit)
    .map((record) => {
      const pool = resolvePoolRow(dataset.poolMap, getHistoryPoolId(record));
      const gameUid = getHistoryGameUid(record);
      const poolId = getHistoryPoolId(record);
      const poolRef = buildPoolRef({ gameUid, poolId });
      return {
        ref: poolRef,
        account_ref: buildAccountRef(gameUid),
        pool_type: normalizePoolType(pool.type),
        pool_name: pool?.name || null,
        display_name: localizePoolDisplayName(pool),
        account_name: buildAccountName([record], gameUid),
        item_name: localizeItemName(record),
        rarity: record.rarity,
        timestamp: record.timestamp,
        actions: {
          detail_ref: poolRef,
          share_ref: poolRef,
          log_ref: poolRef,
        },
      };
    });

  return {
    user: dataset.user,
    limit: safeLimit,
    records,
  };
}

export async function fetchBotPoolDetail(adminClient, userId, { gameUid = null, poolId } = {}) {
  const dataset = await loadBotDataset(adminClient, userId);
  const matchingByPool = dataset.history.filter((item) => getHistoryPoolId(item) === String(poolId || '').trim());
  if (matchingByPool.length === 0) {
    return null;
  }

  const resolvedGameUid = gameUid
    ? String(gameUid).trim()
    : getHistoryGameUid([...matchingByPool].sort(sortHistoryDesc)[0]);
  const accountHistory = dataset.history.filter((item) => getHistoryGameUid(item) === resolvedGameUid);
  const currentPool = resolvePoolRow(dataset.poolMap, String(poolId || '').trim());
  const currentPoolHistory = accountHistory.filter((item) => getHistoryPoolId(item) === String(poolId || '').trim());

  if (currentPoolHistory.length === 0) {
    return null;
  }

  const allLimitedHistory = accountHistory.filter((item) => {
    const pool = resolvePoolRow(dataset.poolMap, getHistoryPoolId(item));
    return LIMITED_POOL_TYPES.has(String(pool?.type || ''));
  });

  const statsResult = runPoolStatsHook({
    normalizedCurrentPoolHistory: currentPoolHistory,
    currentPool,
    allLimitedHistory,
    currentPoolId: currentPool.id || currentPool.pool_id || String(poolId || '').trim(),
  });
  const analysisPity = getPoolAnalysisPityState(currentPool, statsResult.stats, statsResult.effectivePity);
  const crossPoolPityMap = buildCrossPoolPityMap(allLimitedHistory);
  const timelineSections = buildDashboardTimelineSections({
    currentPool,
    currentPoolHistory,
    groupedHistory: statsResult.groupedHistory,
    selectedPools: [],
    crossPoolPityMap,
    isGroupMode: false,
    isAllPoolsOverview: false,
    effectivePity: statsResult.effectivePity,
    analysisPity,
    hasMergedAccountView: false,
    locale: BOT_LOCALE,
  });
  const sharePayload = buildDashboardSharePayload({
    currentPool,
    normalizedPoolType: normalizePoolType(currentPool.type),
    isGroupMode: false,
    isAllPoolsOverview: false,
    hasMergedAccountView: false,
    stats: statsResult.stats,
    analysisPity,
    sections: timelineSections,
  }, BOT_LOCALE);
  const recentRecords = [...currentPoolHistory]
    .sort(sortHistoryDesc)
    .filter((item) => Number(item?.rarity) >= 5)
    .slice(0, 5)
    .map((item) => ({
      item_name: localizeItemName(item),
      rarity: item.rarity,
      timestamp: item.timestamp,
    }));
  const accountName = buildAccountName(accountHistory, resolvedGameUid);
  const accountSummary = buildAccountSummary(accountHistory);
  const poolStatus = buildStatusMeta(currentPool);

  return {
    user: dataset.user,
    account: {
      game_uid: resolvedGameUid,
      display_name: accountName,
      ...accountSummary,
    },
    pool: {
      game_uid: resolvedGameUid,
      pool_id: String(poolId || '').trim(),
      pool_type: normalizePoolType(currentPool.type),
      pool_name: currentPool.name || null,
      display_name: localizePoolDisplayName(currentPool),
      featured: localizeFeaturedList(currentPool),
      share_target: {
        game_uid: resolvedGameUid,
        pool_id: String(poolId || '').trim(),
      },
      ...poolStatus,
    },
    stats: {
      total_pulls: statsResult.stats.total,
      current_pity: analysisPity.displayPity6,
      current_pity5: analysisPity.displayPity5,
      current_probability: calculateCurrentProbability(analysisPity.displayPity6, analysisPity.normalizedType).probability,
      six_star_total: statsResult.stats.totalSixStar,
      up_six_star_count: statsResult.stats.upSixStarCount,
      off_six_star_count: statsResult.stats.stdSixStarCount,
      five_star_count: statsResult.stats.counts?.[5] || 0,
      win_rate: statsResult.stats.winRate,
    },
    recent_records: recentRecords,
    timeline_sections: timelineSections,
    share_payload: sharePayload,
  };
}

export async function fetchBotPoolLog(adminClient, userId, selection = {}) {
  const { gameUid, poolId } = readSelectionRefs(selection);
  if (!poolId) {
    throw {
      status: 400,
      message: 'Missing pool selector',
    };
  }

  const dataset = await loadBotDataset(adminClient, userId);
  const matchingByPool = dataset.history.filter((item) => getHistoryPoolId(item) === poolId);
  if (matchingByPool.length === 0) {
    return null;
  }

  const resolvedGameUid = gameUid
    ? String(gameUid).trim()
    : getHistoryGameUid([...matchingByPool].sort(sortHistoryDesc)[0]);
  const currentPool = resolvePoolRow(dataset.poolMap, poolId);
  const poolHistory = dataset.history
    .filter((item) => getHistoryGameUid(item) === resolvedGameUid && getHistoryPoolId(item) === poolId)
    .sort(sortHistoryAsc);

  if (poolHistory.length === 0) {
    return null;
  }

  const accountName = buildAccountName(poolHistory, resolvedGameUid);
  const poolName = localizePoolDisplayName(currentPool);
  const rows = poolHistory.map((item, index) => ({
    index: index + 1,
    time: item.timestamp || null,
    account_name: accountName,
    pool_name: poolName,
    pool_type: normalizePoolType(currentPool.type),
    item_name: localizeItemName(item),
    rarity: Number(item.rarity) || 0,
    is_free: isFreePull(item),
    is_gift: isGiftPull(item),
  }));

  return {
    file_name: `${accountName}_${poolName}_详细日志`.replace(/[\\/:*?"<>|]/g, '_'),
    account: {
      ref: buildAccountRef(resolvedGameUid),
      display_name: accountName,
    },
    pool: {
      ref: buildPoolRef({ gameUid: resolvedGameUid, poolId }),
      display_name: poolName,
      pool_type: normalizePoolType(currentPool.type),
    },
    total: rows.length,
    rows,
  };
}

export default {
  fetchBotDashboard,
  fetchBotAnalysis,
  fetchBotPoolIndex,
  fetchBotRecentPulls,
  fetchBotPoolDetail,
  fetchBotPoolLog,
  toAnalysisPoolDetail,
};
