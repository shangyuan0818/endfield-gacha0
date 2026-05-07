import {
  MAX_POTENTIAL_LEVEL,
  normalizeQuotaSummary
} from './quotaEconomy.js';

export const DEFAULT_CHARACTER_CATALOG_FILTERS = {
  search: '',
  rarity: 'all',
  limitedStatus: 'all',
  ownershipStatus: 'all',
  potentialStatus: 'all',
  sortKey: 'ownershipRate',
  sortDirection: 'desc'
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function getCatalogRowQuota(row = {}) {
  return normalizeQuotaSummary(row.quota || row.quotaAggregate || {});
}

export function getCatalogQuotaSortValue(row = {}) {
  const quota = getCatalogRowQuota(row);
  return (
    toNumber(quota.aicQuotaTotalPotential)
    + toNumber(quota.bondQuotaDirect)
    + toNumber(quota.endpointQuotaConvertible)
  );
}

export function isCatalogRowOwned(row = {}, dataSource = 'global') {
  if (dataSource === 'global') {
    return toNumber(row.ownerUsers) > 0;
  }

  return Boolean(row.owned) || toNumber(row.acquisitionCount) > 0;
}

export function getCatalogRowPotentialState(row = {}, dataSource = 'global') {
  if (!isCatalogRowOwned(row, dataSource)) {
    return 'unowned';
  }

  if (dataSource === 'global') {
    if (toNumber(getCatalogRowQuota(row).excessTrustTokens) > 0) {
      return 'excess';
    }

    if (toNumber(row.fullPotentialUsers) > 0) {
      return 'full';
    }

    return 'owned_unfull';
  }

  if (toNumber(row.excessTrustTokens) > 0) {
    return 'excess';
  }

  if (toNumber(row.potentialLevel) >= MAX_POTENTIAL_LEVEL) {
    return 'full';
  }

  return 'owned_unfull';
}

function matchesOwnershipFilter(row, ownershipStatus, dataSource) {
  if (!ownershipStatus || ownershipStatus === 'all') {
    return true;
  }

  const owned = isCatalogRowOwned(row, dataSource);
  if (ownershipStatus === 'owned') {
    return owned;
  }

  if (ownershipStatus === 'unowned') {
    return !owned;
  }

  return true;
}

function matchesPotentialFilter(row, potentialStatus, dataSource) {
  if (!potentialStatus || potentialStatus === 'all') {
    return true;
  }

  const state = getCatalogRowPotentialState(row, dataSource);
  if (potentialStatus === 'full') {
    return state === 'full' || state === 'excess';
  }

  return state === potentialStatus;
}

export function filterCharacterCatalogRows(rows = [], filters = {}, dataSource = 'global') {
  const mergedFilters = {
    ...DEFAULT_CHARACTER_CATALOG_FILTERS,
    ...(filters || {})
  };
  const search = normalizeText(mergedFilters.search);

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (toNumber(row.rarity) < 4) {
      return false;
    }

    if (search) {
      const searchable = [
        row.name,
        row.id,
        ...(Array.isArray(row.aliases) ? row.aliases : [])
      ].map(normalizeText);
      if (!searchable.some((value) => value.includes(search))) {
        return false;
      }
    }

    if (mergedFilters.rarity !== 'all' && toNumber(row.rarity) !== toNumber(mergedFilters.rarity)) {
      return false;
    }

    if (mergedFilters.limitedStatus === 'limited' && !row.isLimited) {
      return false;
    }

    if (mergedFilters.limitedStatus === 'standard' && row.isLimited) {
      return false;
    }

    if (!matchesOwnershipFilter(row, mergedFilters.ownershipStatus, dataSource)) {
      return false;
    }

    if (!matchesPotentialFilter(row, mergedFilters.potentialStatus, dataSource)) {
      return false;
    }

    return true;
  });
}

function getSortValue(row, sortKey, dataSource) {
  switch (sortKey) {
    case 'ownerUsers':
      return dataSource === 'global' ? toNumber(row.ownerUsers) : toNumber(row.acquisitionCount);
    case 'fullPotentialRate':
      return dataSource === 'global'
        ? toNumber(row.fullPotentialRateOfOwners)
        : toNumber(row.potentialLevel) / MAX_POTENTIAL_LEVEL;
    case 'rarity':
      return toNumber(row.rarity);
    case 'name':
      return normalizeText(row.name);
    case 'copies':
      return dataSource === 'global' ? toNumber(row.totalCopies) : toNumber(row.acquisitionCount);
    case 'quota':
      return getCatalogQuotaSortValue(row);
    case 'ownershipRate':
    default:
      return dataSource === 'global'
        ? toNumber(row.ownershipRate)
        : (isCatalogRowOwned(row, dataSource) ? 1 : 0);
  }
}

export function sortCharacterCatalogRows(rows = [], sortKey = 'ownershipRate', dataSource = 'global', sortDirection = 'desc') {
  const sorted = [...(Array.isArray(rows) ? rows : [])];
  const direction = sortDirection === 'asc' ? 'asc' : 'desc';

  sorted.sort((left, right) => {
    const leftValue = getSortValue(left, sortKey, dataSource);
    const rightValue = getSortValue(right, sortKey, dataSource);

    if (sortKey === 'name') {
      const nameDiff = String(leftValue).localeCompare(String(rightValue), 'zh-Hans-CN');
      return direction === 'asc' ? nameDiff : -nameDiff;
    }

    const diff = direction === 'asc'
      ? toNumber(leftValue) - toNumber(rightValue)
      : toNumber(rightValue) - toNumber(leftValue);
    if (diff !== 0) {
      return diff;
    }

    const rarityDiff = toNumber(right.rarity) - toNumber(left.rarity);
    if (rarityDiff !== 0) {
      return rarityDiff;
    }

    return String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hans-CN');
  });

  return sorted;
}

export function selectCharacterCatalogRows(rows = [], filters = {}, dataSource = 'global') {
  const mergedFilters = {
    ...DEFAULT_CHARACTER_CATALOG_FILTERS,
    ...(filters || {})
  };

  return sortCharacterCatalogRows(
    filterCharacterCatalogRows(rows, mergedFilters, dataSource),
    mergedFilters.sortKey,
    dataSource,
    mergedFilters.sortDirection
  );
}

export function hasPrivateIdentifierFields(value) {
  const serialized = JSON.stringify(value || {});
  return [
    'user_id',
    'game_uid',
    'history_id',
    'record_id',
    'platform_user_id',
    'email'
  ].some((token) => serialized.includes(token));
}

export default {
  DEFAULT_CHARACTER_CATALOG_FILTERS,
  getCatalogRowQuota,
  getCatalogQuotaSortValue,
  getCatalogRowPotentialState,
  isCatalogRowOwned,
  filterCharacterCatalogRows,
  sortCharacterCatalogRows,
  selectCharacterCatalogRows,
  hasPrivateIdentifierFields
};
