import { normalizeIsStandard } from '../../utils/poolUtils.js';
import { clampHistoryPity } from '../../utils/historyRecordUtils.js';
import {
  resolveAliasValue,
  resolveCharacterAliasMap,
  resolvePoolAliasMap,
} from '../../../shared/idAliasService.js';

function inferPoolTypeFromId(poolId) {
  if (!poolId) return 'standard';

  const prefix = String(poolId).split('_')[0].toLowerCase();
  const typeMap = {
    special: 'limited',
    standard: 'standard',
    beginner: 'beginner',
    weponbox: 'weapon',
    weaponbox: 'weapon',
  };

  return typeMap[prefix] || 'standard';
}

function simpleStringHash(value) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }

  return Math.abs(hash % 1000);
}

function buildPoolLookups(pools = []) {
  const poolUpCharacterMap = new Map();
  const poolTypeMap = new Map();

  pools.forEach((pool) => {
    if (pool.up_character) {
      if (pool.pool_id) poolUpCharacterMap.set(pool.pool_id, pool.up_character);
      if (pool.id) poolUpCharacterMap.set(pool.id, pool.up_character);
    }

    if (pool.pool_id) poolTypeMap.set(pool.pool_id, pool.type);
    if (pool.id) poolTypeMap.set(pool.id, pool.type);
  });

  return { poolUpCharacterMap, poolTypeMap };
}

function buildCanonicalPoolEntries(records, poolAliasMap) {
  const entryMap = new Map();

  records.forEach((record) => {
    const canonicalPoolId = resolveAliasValue(poolAliasMap, record?.pool_id);
    if (!canonicalPoolId || entryMap.has(canonicalPoolId)) {
      return;
    }

    entryMap.set(canonicalPoolId, {
      id: canonicalPoolId,
      name: record.pool_name || canonicalPoolId,
      type: inferPoolTypeFromId(canonicalPoolId),
      locked: false,
    });
  });

  return Array.from(entryMap.values());
}

function buildImportedHistoryRecords({
  records,
  userInfo,
  poolAliasMap,
  characterAliasMap,
  poolUpCharacterMap,
  poolTypeMap,
}) {
  return records.map((record, index) => {
    const canonicalPoolId = resolveAliasValue(poolAliasMap, record.pool_id);
    const canonicalCharacterId = resolveAliasValue(
      characterAliasMap,
      record.character_id || record.item_id
    );

    const poolHash = simpleStringHash(record.pool_id || 'unknown');
    const seqNum = record.seqId ? parseInt(record.seqId, 10) : index;
    const numericId = (poolHash * 10000000) + seqNum;
    const poolType = poolTypeMap.get(record.pool_id) || poolTypeMap.get(canonicalPoolId) || 'unknown';
    const upCharacter = poolUpCharacterMap.get(record.pool_id) || poolUpCharacterMap.get(canonicalPoolId);
    const isStandard = normalizeIsStandard(record, poolType, upCharacter);

    return {
      id: numericId,
      poolId: canonicalPoolId,
      name: record.name,
      character_name: record.name,
      character_id: canonicalCharacterId,
      rarity: record.rarity,
      isStandard,
      isLimited: record.isLimited,
      batchId: record.batchId,
      seqId: record.seqId,
      pity: clampHistoryPity(record.pity),
      isNew: record.isNew || false,
      isFree: record.isFree || false,
      gameUid: userInfo?.gameUid || userInfo?.hgUid || null,
      nickName: userInfo?.nickName || null,
      timestamp: record.timestamp,
      created_at: new Date().toISOString(),
    };
  });
}

export async function prepareOfficialImportPersistenceData({
  supabase,
  records,
  userInfo,
  pools,
}) {
  if (!supabase || !Array.isArray(records) || records.length === 0) {
    return {
      currentGameUid: userInfo?.gameUid || userInfo?.hgUid || null,
      poolEntries: [],
      historyRecords: [],
    };
  }

  const [poolAliasMap, characterAliasMap] = await Promise.all([
    resolvePoolAliasMap(
      supabase,
      records.map((record) => record?.pool_id),
      'official_api'
    ),
    resolveCharacterAliasMap(
      supabase,
      records.map((record) => record?.character_id || record?.item_id),
      'official_api'
    ),
  ]);

  const { poolUpCharacterMap, poolTypeMap } = buildPoolLookups(pools);

  return {
    currentGameUid: userInfo?.gameUid || userInfo?.hgUid || null,
    poolEntries: buildCanonicalPoolEntries(records, poolAliasMap),
    historyRecords: buildImportedHistoryRecords({
      records,
      userInfo,
      poolAliasMap,
      characterAliasMap,
      poolUpCharacterMap,
      poolTypeMap,
    }),
  };
}

export function filterImportedHistoryRecords(historyRecords, existingSeqIds) {
  const newRecords = historyRecords.filter((record) => {
    if (!record.seqId) {
      return true;
    }

    const compositeKey = `${record.gameUid || 'unknown'}:${record.poolId || 'unknown'}:${record.seqId}`;
    return !existingSeqIds.has(compositeKey);
  });

  return {
    newRecords,
    duplicateCount: historyRecords.length - newRecords.length,
  };
}
