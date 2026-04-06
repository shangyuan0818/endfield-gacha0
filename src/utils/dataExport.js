import {
  getPoolsForGroupType,
  getPoolGroupType,
  isPoolGroupId
} from './poolGroupUtils.js';
import {
  buildGameAccountServerTag,
  loadGameAccountMetadataMap,
  normalizeGameAccountMetadata
} from './gameAccountMetadata.js';
import { getDataFormatById } from './dataFormatRegistry.js';

export const EXPORT_SCHEMA_VERSION = '3.0.0';
export const EXPORT_FORMAT_ID = 'internal_json_v3';
export const EXPORT_CSV_FORMAT_ID = 'internal_csv_flat';
const exportFormat = getDataFormatById(EXPORT_FORMAT_ID);

function getHistoryPoolId(record) {
  return record?.poolId || record?.pool_id || null;
}

function getHistoryGameUid(record) {
  return record?.game_uid || record?.gameUid || null;
}

function getHistoryTimestampMs(record) {
  const raw = record?.timestamp;
  if (typeof raw === 'number') {
    return raw;
  }

  const parsed = new Date(raw || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getHistoryTimestampIso(record) {
  const time = getHistoryTimestampMs(record);
  return time > 0 ? new Date(time).toISOString() : null;
}

function getHistoryId(record) {
  return record?.id || record?.record_id || null;
}

function getHistorySeqId(record) {
  const raw = record?.seqId || record?.seq_id || null;
  return raw === null || raw === undefined || raw === '' ? null : String(raw);
}

function normalizeSpecialType(record) {
  return record?.specialType || record?.special_type || null;
}

function normalizeIsFree(record) {
  return record?.isFree === true || record?.is_free === true;
}

function normalizeIsNew(record) {
  return record?.isNew === true || record?.is_new === true;
}

function normalizeIsStandard(record) {
  if (record?.isStandard === true || record?.is_standard === true) {
    return true;
  }
  if (record?.isStandard === false || record?.is_standard === false) {
    return false;
  }
  return null;
}

function normalizePoolTypeLabel(poolType) {
  switch (poolType) {
    case 'limited':
    case 'limited_character':
      return '限定角色池';
    case 'standard':
      return '常驻池';
    case 'beginner':
      return '新手池';
    case 'weapon':
    case 'limited_weapon':
      return '武器池';
    default:
      return poolType || '未知卡池';
  }
}

function formatLocalTime(isoString) {
  if (!isoString) {
    return '';
  }

  return new Date(isoString).toLocaleString('zh-CN');
}

function buildPoolLookup(pools) {
  return new Map((pools || []).map(pool => [pool.id, pool]));
}

function buildAccountLookup(history) {
  const metadataMap = loadGameAccountMetadataMap();
  const accountMap = new Map();

  (history || []).forEach(record => {
    const gameUid = getHistoryGameUid(record);
    if (!gameUid) {
      return;
    }

    const metadata = normalizeGameAccountMetadata({
      ...(metadataMap[gameUid] || {}),
      gameUid,
      nickName: record?.nick_name || record?.nickName || metadataMap[gameUid]?.nickName || gameUid,
      channelName: record?.channel_name || record?.channelName || metadataMap[gameUid]?.channelName,
      channelMasterId: record?.channel_master_id || record?.channelMasterId || metadataMap[gameUid]?.channelMasterId,
      serverId: record?.server_id || record?.serverId || metadataMap[gameUid]?.serverId,
      region: record?.region || record?.serverRegion || metadataMap[gameUid]?.region,
      isOfficial: record?.is_official ?? record?.isOfficial ?? metadataMap[gameUid]?.isOfficial
    });

    accountMap.set(gameUid, {
      ...(accountMap.get(gameUid) || {}),
      gameUid,
      nickName: metadata?.nickName || gameUid,
      channelName: metadata?.channelName || null,
      channelMasterId: metadata?.channelMasterId || null,
      serverId: metadata?.serverId || null,
      region: metadata?.region || null,
      isOfficial: metadata?.isOfficial ?? null,
      serverTag: buildGameAccountServerTag(metadata) || null
    });
  });

  return accountMap;
}

function resolvePoolFilterIds(options, pools, currentPoolId) {
  if (options.poolFilter === 'current') {
    if (isPoolGroupId(currentPoolId)) {
      const groupType = getPoolGroupType(currentPoolId);
      return new Set(getPoolsForGroupType(pools || [], groupType).map(pool => pool.id));
    }

    return currentPoolId ? new Set([currentPoolId]) : null;
  }

  if (options.poolFilter === 'specific' && options.poolId) {
    return new Set([options.poolId]);
  }

  return null;
}

function resolveTargetGameUid(options, currentGameUid) {
  if (options.accountFilter === 'specific' && options.gameUid) {
    return options.gameUid;
  }

  if (options.accountFilter === 'current') {
    return currentGameUid || null;
  }

  return null;
}

function buildDateBoundary(dateString, isEnd) {
  if (!dateString) {
    return null;
  }

  const suffix = isEnd ? 'T23:59:59.999' : 'T00:00:00.000';
  const timestamp = new Date(`${dateString}${suffix}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isGiftRecord(record) {
  return normalizeSpecialType(record) === 'gift';
}

function buildPitySequence(filteredHistory) {
  const groupedPity = new Map();
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    const timeDelta = getHistoryTimestampMs(a) - getHistoryTimestampMs(b);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return String(getHistoryId(a) || '').localeCompare(String(getHistoryId(b) || ''));
  });

  sortedHistory.forEach(record => {
    const gameUid = getHistoryGameUid(record) || '__all__';
    const poolId = getHistoryPoolId(record) || '__unknown__';
    const key = `${gameUid}::${poolId}`;
    const currentPity = groupedPity.get(key) || 0;

    if (isGiftRecord(record)) {
      groupedPity.set(`${key}::${getHistoryId(record)}`, '-');
      return;
    }

    const nextPity = currentPity + 1;
    groupedPity.set(key, nextPity);
    groupedPity.set(`${key}::${getHistoryId(record)}`, nextPity);

    if (record?.rarity === 6) {
      groupedPity.set(key, 0);
    }
  });

  return groupedPity;
}

function buildSummary(records, poolLookup, accountLookup) {
  const validRecords = records.filter(record => !isGiftRecord(record));
  const byPoolMap = new Map();
  const byAccountMap = new Map();

  records.forEach(record => {
    const poolId = getHistoryPoolId(record) || 'unknown';
    const gameUid = getHistoryGameUid(record) || 'unknown';
    const pool = poolLookup.get(poolId);
    const account = accountLookup.get(gameUid);
    const isGift = isGiftRecord(record);

    if (!byPoolMap.has(poolId)) {
      byPoolMap.set(poolId, {
        poolId,
        poolName: pool?.name || poolId,
        poolType: pool?.type || 'unknown',
        poolTypeLabel: normalizePoolTypeLabel(pool?.type),
        recordCount: 0,
        pullCount: 0,
        sixStarCount: 0,
        fiveStarCount: 0,
        fourStarAndBelowCount: 0
      });
    }

    if (!byAccountMap.has(gameUid)) {
      byAccountMap.set(gameUid, {
        gameUid,
        nickName: account?.nickName || gameUid,
        serverTag: account?.serverTag || null,
        recordCount: 0,
        pullCount: 0,
        sixStarCount: 0,
        fiveStarCount: 0,
        fourStarAndBelowCount: 0
      });
    }

    const poolEntry = byPoolMap.get(poolId);
    const accountEntry = byAccountMap.get(gameUid);

    poolEntry.recordCount += 1;
    accountEntry.recordCount += 1;

    if (!isGift) {
      poolEntry.pullCount += 1;
      accountEntry.pullCount += 1;
    }

    if (record?.rarity === 6) {
      poolEntry.sixStarCount += 1;
      accountEntry.sixStarCount += 1;
    } else if (record?.rarity === 5) {
      poolEntry.fiveStarCount += 1;
      accountEntry.fiveStarCount += 1;
    } else {
      poolEntry.fourStarAndBelowCount += 1;
      accountEntry.fourStarAndBelowCount += 1;
    }
  });

  const timestamps = records
    .map(getHistoryTimestampMs)
    .filter(value => value > 0)
    .sort((a, b) => a - b);

  return {
    recordCount: records.length,
    pullCount: validRecords.length,
    giftCount: records.length - validRecords.length,
    freePullCount: records.filter(normalizeIsFree).length,
    sixStarCount: validRecords.filter(record => record?.rarity === 6).length,
    fiveStarCount: validRecords.filter(record => record?.rarity === 5).length,
    fourStarAndBelowCount: validRecords.filter(record => (record?.rarity || 0) <= 4).length,
    poolCount: byPoolMap.size,
    accountCount: byAccountMap.size,
    timeRange: {
      from: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null,
      to: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null
    },
    byPool: Array.from(byPoolMap.values()).sort((a, b) => b.recordCount - a.recordCount),
    byAccount: Array.from(byAccountMap.values()).sort((a, b) => b.recordCount - a.recordCount)
  };
}

export function normalizeExportOptions(rawOptions = {}, context = {}) {
  if (typeof rawOptions === 'string') {
    return rawOptions === 'current'
      ? {
          format: context.defaultFormat || 'json',
          poolFilter: 'current',
          poolId: null,
          accountFilter: context.currentGameUid ? 'current' : 'all',
          gameUid: context.currentGameUid || null,
          dateFrom: '',
          dateTo: ''
        }
      : {
          format: context.defaultFormat || 'json',
          poolFilter: 'all',
          poolId: null,
          accountFilter: 'all',
          gameUid: null,
          dateFrom: '',
          dateTo: ''
        };
  }

  return {
    format: rawOptions.format || context.defaultFormat || 'json',
    poolFilter: rawOptions.poolFilter || 'current',
    poolId: rawOptions.poolId || null,
    accountFilter: rawOptions.accountFilter || (context.currentGameUid ? 'current' : 'all'),
    gameUid: rawOptions.gameUid || context.currentGameUid || null,
    dateFrom: rawOptions.dateFrom || '',
    dateTo: rawOptions.dateTo || ''
  };
}

export function buildExportPayload({
  history,
  pools,
  currentPoolId,
  currentGameUid,
  currentUserId,
  options
}) {
  const resolvedOptions = normalizeExportOptions(options, { currentGameUid });
  const poolLookup = buildPoolLookup(pools);
  const accountLookup = buildAccountLookup(history);
  const allowedPoolIds = resolvePoolFilterIds(resolvedOptions, pools, currentPoolId);
  const targetGameUid = resolveTargetGameUid(resolvedOptions, currentGameUid);
  const startTime = buildDateBoundary(resolvedOptions.dateFrom, false);
  const endTime = buildDateBoundary(resolvedOptions.dateTo, true);

  const filteredHistory = (history || []).filter(record => {
    if (currentUserId && record?.user_id && record.user_id !== currentUserId) {
      return false;
    }

    const poolId = getHistoryPoolId(record);
    const gameUid = getHistoryGameUid(record);
    const timestamp = getHistoryTimestampMs(record);

    if (allowedPoolIds && !allowedPoolIds.has(poolId)) {
      return false;
    }

    if (targetGameUid && gameUid !== targetGameUid) {
      return false;
    }

    if (startTime && timestamp < startTime) {
      return false;
    }

    if (endTime && timestamp > endTime) {
      return false;
    }

    return true;
  });

  const referencedPoolIds = new Set(filteredHistory.map(getHistoryPoolId).filter(Boolean));
  const referencedGameUids = new Set(filteredHistory.map(getHistoryGameUid).filter(Boolean));
  const pityMap = buildPitySequence(filteredHistory);
  const summary = buildSummary(filteredHistory, poolLookup, accountLookup);

  const exportedPools = Array.from(referencedPoolIds)
    .map(poolId => poolLookup.get(poolId))
    .filter(Boolean);

  const exportedAccounts = Array.from(referencedGameUids)
    .map(gameUid => accountLookup.get(gameUid))
    .filter(Boolean);

  return {
    formatId: EXPORT_FORMAT_ID,
    formatLabel: exportFormat?.label || '站内 JSON v3',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    filters: {
      poolFilter: resolvedOptions.poolFilter,
      poolId: resolvedOptions.poolId,
      accountFilter: resolvedOptions.accountFilter,
      gameUid: targetGameUid,
      dateFrom: resolvedOptions.dateFrom || null,
      dateTo: resolvedOptions.dateTo || null
    },
    summary,
    pools: exportedPools,
    accounts: exportedAccounts,
    history: filteredHistory,
    pityMap
  };
}

export function buildExportJsonContent(payload) {
  return JSON.stringify({
    formatId: payload.formatId,
    formatLabel: payload.formatLabel,
    version: '3.0',
    schemaVersion: payload.schemaVersion,
    exportTime: payload.exportedAt,
    filters: payload.filters,
    summary: payload.summary,
    pools: payload.pools,
    accounts: payload.accounts,
    history: payload.history
  }, null, 2);
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function buildExportCsvContent(payload) {
  const poolLookup = buildPoolLookup(payload.pools);
  const accountLookup = new Map((payload.accounts || []).map(account => [account.gameUid, account]));
  const rows = (payload.history || []).map(record => {
    const poolId = getHistoryPoolId(record);
    const gameUid = getHistoryGameUid(record);
    const account = accountLookup.get(gameUid);
    const pool = poolLookup.get(poolId);
    const pityKey = `${gameUid || '__all__'}::${poolId || '__unknown__'}::${getHistoryId(record)}`;
    const isoTime = getHistoryTimestampIso(record);

    return [
      payload.schemaVersion,
      payload.exportedAt,
      gameUid,
      account?.nickName || gameUid || '',
      account?.serverTag || '',
      poolId,
      pool?.name || poolId || '',
      normalizePoolTypeLabel(pool?.type),
      getHistoryId(record),
      getHistorySeqId(record),
      record?.rarity || '',
      record?.item_name || record?.itemName || '',
      normalizeIsStandard(record) === null ? '' : normalizeIsStandard(record) ? '常驻' : '限定',
      normalizeSpecialType(record) || '',
      normalizeIsFree(record) ? '是' : '否',
      normalizeIsNew(record) ? '是' : '否',
      payload.pityMap.get(pityKey) ?? '',
      isoTime || '',
      formatLocalTime(isoTime)
    ].map(escapeCsvValue).join(',');
  });

  const headers = [
    'schema_version',
    'exported_at',
    'game_uid',
    'nick_name',
    'server_tag',
    'pool_id',
    'pool_name',
    'pool_type',
    'record_id',
    'seq_id',
    'rarity',
    'item_name',
    'limited_or_standard',
    'special_type',
    'is_free',
    'is_new',
    'pity_at_pull',
    'timestamp_iso',
    'timestamp_local'
  ];

  return `\uFEFF${[headers.join(','), ...rows].join('\r\n')}`;
}

export function buildExportContent(formatId, payload) {
  const format = getDataFormatById(formatId);
  if (!format) {
    throw new Error(`不支持的导出格式: ${formatId}`);
  }

  if (formatId === EXPORT_FORMAT_ID) {
    return {
      content: buildExportJsonContent(payload),
      mimeType: 'application/json',
      extension: 'json',
      format,
    };
  }

  if (formatId === EXPORT_CSV_FORMAT_ID) {
    return {
      content: buildExportCsvContent(payload),
      mimeType: 'text/csv;charset=utf-8;',
      extension: 'csv',
      format,
    };
  }

  throw new Error(`导出格式尚未实现内容构建: ${formatId}`);
}
