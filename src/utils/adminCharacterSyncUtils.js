import {
  classifyCharacterIdSource,
  normalizeEntityNameForMatch,
} from './canonicalEntityUtils.js';
import { buildWikiAssetProxyPath } from './avatarAssetPaths.js';
import {
  buildCharacterSelfAliasRows,
  resolveAliasValue,
} from '../../shared/idAliasService.js';

function normalizeName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildSyncedPoolConfig(itemType) {
  if (itemType === 'weapon') {
    return {
      pools: ['weapon'],
      limited_rotation_count: 0,
      removes_after: null,
      is_active_in_limited: false,
    };
  }

  return {
    pools: [],
    limited_rotation_count: 0,
    removes_after: null,
    is_active_in_limited: false,
  };
}

export function buildWikiAliasRows(canonicalId, wikiId) {
  const rows = [...buildCharacterSelfAliasRows(canonicalId)];

  if (wikiId && wikiId !== canonicalId) {
    rows.push({
      source: 'wiki',
      alias_id: wikiId,
      character_id: canonicalId,
      is_primary: false,
      note: 'Resolved wiki id to canonical character id',
    });
  }

  return rows;
}

export function pushUniqueWarning(warnings, message) {
  const normalized = normalizeName(message);
  if (normalized) {
    warnings.add(normalized);
  }
}

export function isFatalSyncSetupError(error) {
  const message = error?.message || '';
  return /缺少数据库迁移 077|缺少数据库迁移 078|only super_admin|permission denied/i.test(message);
}

export function buildManualPlaceholderLookup(rows = []) {
  const lookup = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (classifyCharacterIdSource(row?.id) !== 'manual_placeholder') {
      return;
    }

    const normalizedType = row?.type === 'weapon' ? 'weapon' : 'character';
    const normalizedName = normalizeEntityNameForMatch(row?.name);
    if (!normalizedName) {
      return;
    }

    lookup.set(`${normalizedType}:${normalizedName}`, row.id);
  });

  return lookup;
}

export function resolveSyncCanonicalId({ item, wikiAliasMap, existingIdSet, manualPlaceholderLookup }) {
  const wikiResolvedId = resolveAliasValue(wikiAliasMap, item.id);

  if (wikiResolvedId && wikiResolvedId !== item.id) {
    return wikiResolvedId;
  }

  if (existingIdSet.has(wikiResolvedId)) {
    return wikiResolvedId;
  }

  const manualKey = `${item.type === 'weapon' ? 'weapon' : 'character'}:${normalizeEntityNameForMatch(item.name)}`;
  return manualPlaceholderLookup.get(manualKey) || wikiResolvedId;
}

export function resolveManagedAvatarUrl(item) {
  if (!item?.id) {
    return null;
  }

  const proxyAssetId = item.type === 'weapon'
    ? (item._iconId || item.id)
    : item.id;

  return buildWikiAssetProxyPath(item.type, proxyAssetId) || item.avatar_url || null;
}

export function buildCharacterBatchUpdates(currentItems = [], batchEditForm = {}, nowIso = new Date().toISOString()) {
  const selectedPools = batchEditForm?.pools || {};
  const updates = [];

  (Array.isArray(currentItems) ? currentItems : []).forEach((item) => {
    const nextUpdates = {};
    let needUpdate = false;

    if (batchEditForm.is_limited !== null && batchEditForm.is_limited !== undefined) {
      nextUpdates.is_limited = batchEditForm.is_limited;
      needUpdate = true;
    }

    const currentConfig = item.pool_config || { pools: [] };
    let newPools = [...(Array.isArray(currentConfig.pools) ? currentConfig.pools : [])];
    let poolsChanged = false;

    ['limited', 'standard', 'weapon'].forEach((poolType) => {
      const action = selectedPools[poolType];
      if (action === true) {
        if (!newPools.includes(poolType)) {
          newPools.push(poolType);
          poolsChanged = true;
        }
      } else if (action === false) {
        if (newPools.includes(poolType)) {
          newPools = newPools.filter(pool => pool !== poolType);
          poolsChanged = true;
        }
      }
    });

    if (poolsChanged) {
      const nextPoolConfig = {
        ...currentConfig,
        pools: newPools,
      };

      if (selectedPools.limited === true && !nextPoolConfig.introduced_at) {
        nextPoolConfig.introduced_at = nowIso;
      }

      if (!newPools.includes('limited')) {
        nextPoolConfig.is_active_in_limited = false;
      } else {
        const rotationCount = Number(nextPoolConfig.limited_rotation_count) || 0;
        const removesAfter = nextPoolConfig.removes_after;
        nextPoolConfig.is_active_in_limited = removesAfter === null
          || removesAfter === undefined
          || rotationCount < removesAfter;
      }

      nextUpdates.pool_config = nextPoolConfig;
      needUpdate = true;
    }

    if (needUpdate && item?.id) {
      updates.push({
        id: item.id,
        updates: nextUpdates,
      });
    }
  });

  return updates;
}

export function isCompleteSyncFailure({ totalItems, newCount, skippedCount, errorCount }) {
  return totalItems > 0 && errorCount > 0 && newCount === 0 && skippedCount === 0;
}
