const ACCOUNT_METADATA_STORAGE_KEY = 'gacha_account_metadata';

function safeParseJSON(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

export function normalizeMetadataTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return new Date(parsed).toISOString();
}

export function getHistoryRecordGameUid(record) {
  return normalizeString(record?.game_uid || record?.gameUid);
}

export function getHistoryRecordTimestampMs(record) {
  const raw = record?.timestamp;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  const parsed = new Date(raw || 0).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeGameAccountMetadata(metadata = {}) {
  const gameUid = normalizeString(metadata.gameUid || metadata.game_uid);
  if (!gameUid) {
    return null;
  }

  const channelMasterId = normalizeString(metadata.channelMasterId || metadata.channel_master_id);
  const channelName = normalizeString(metadata.channelName || metadata.channel_name);
  const serverId = normalizeString(metadata.serverId || metadata.server_id);
  const region = normalizeString(metadata.region || metadata.serverRegion);
  const nickName = normalizeString(metadata.nickName || metadata.nick_name) || gameUid;
  const lastImportedAt = normalizeMetadataTimestamp(
    metadata.lastImportedAt
      || metadata.last_imported_at
      || metadata.lastImportAt
  );
  const lastImportedRecordAt = normalizeMetadataTimestamp(
    metadata.lastImportedRecordAt
      || metadata.last_imported_record_at
      || metadata.latestRecordAt
      || metadata.latest_record_at
  );
  const lastImportSource = normalizeString(
    metadata.lastImportSource
      || metadata.last_import_source
      || metadata.importSource
      || metadata.import_source
  );
  const isOfficial = metadata.isOfficial === true || metadata.is_official === true
    ? true
    : metadata.isOfficial === false || metadata.is_official === false
      ? false
      : null;

  return {
    gameUid,
    nickName,
    channelMasterId,
    channelName,
    serverId,
    region,
    isOfficial,
    lastImportedAt,
    lastImportedRecordAt,
    lastImportSource
  };
}

export function loadGameAccountMetadataMap() {
  if (typeof localStorage === 'undefined') {
    return {};
  }

  return safeParseJSON(localStorage.getItem(ACCOUNT_METADATA_STORAGE_KEY), {}) || {};
}

export function saveGameAccountMetadata(metadata) {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  const normalized = normalizeGameAccountMetadata(metadata);
  if (!normalized) {
    return false;
  }

  const currentMap = loadGameAccountMetadataMap();
  currentMap[normalized.gameUid] = {
    ...(currentMap[normalized.gameUid] || {}),
    ...normalized
  };
  localStorage.setItem(ACCOUNT_METADATA_STORAGE_KEY, JSON.stringify(currentMap));
  return true;
}

function buildAccountMetadataFromHistoryRecord(record) {
  return normalizeGameAccountMetadata({
    gameUid: getHistoryRecordGameUid(record),
    nickName: record?.nick_name || record?.nickName,
    channelName: record?.channel_name || record?.channelName,
    channelMasterId: record?.channel_master_id || record?.channelMasterId,
    serverId: record?.server_id || record?.serverId,
    region: record?.region || record?.serverRegion,
    isOfficial: record?.is_official ?? record?.isOfficial
  });
}

function getMetadataTimestampMs(value) {
  const normalized = normalizeMetadataTimestamp(value);
  if (!normalized) {
    return null;
  }

  return new Date(normalized).getTime();
}

export function buildImportedGameAccountMetadataEntries({
  accounts = [],
  historyRecords = [],
  importedAt = null,
  importSource = null
} = {}) {
  const accountMap = new Map();
  const normalizedImportedAt = normalizeMetadataTimestamp(importedAt) || new Date().toISOString();
  const normalizedImportSource = normalizeString(importSource);

  const upsertAccount = (seedMetadata) => {
    const normalized = normalizeGameAccountMetadata(seedMetadata);
    if (!normalized) {
      return null;
    }

    const existing = accountMap.get(normalized.gameUid);
    const merged = normalizeGameAccountMetadata({
      ...(existing || {}),
      ...normalized,
      lastImportedAt: normalized.lastImportedAt || existing?.lastImportedAt || normalizedImportedAt,
      lastImportedRecordAt: normalized.lastImportedRecordAt || existing?.lastImportedRecordAt,
      lastImportSource: normalized.lastImportSource || existing?.lastImportSource || normalizedImportSource
    });

    accountMap.set(merged.gameUid, merged);
    return merged;
  };

  (Array.isArray(accounts) ? accounts : []).forEach((account) => {
    upsertAccount(account);
  });

  (Array.isArray(historyRecords) ? historyRecords : []).forEach((record) => {
    const gameUid = getHistoryRecordGameUid(record);
    if (!gameUid) {
      return;
    }

    const merged = upsertAccount({
      ...(accountMap.get(gameUid) || {}),
      ...(buildAccountMetadataFromHistoryRecord(record) || {}),
      gameUid
    });

    if (!merged) {
      return;
    }

    const recordTimestampMs = getHistoryRecordTimestampMs(record);
    if (!recordTimestampMs) {
      return;
    }

    const currentLatestMs = getMetadataTimestampMs(merged.lastImportedRecordAt);
    if (!currentLatestMs || recordTimestampMs > currentLatestMs) {
      accountMap.set(merged.gameUid, {
        ...merged,
        lastImportedRecordAt: new Date(recordTimestampMs).toISOString()
      });
    }
  });

  return Array.from(accountMap.values());
}

export function buildGameAccountServerTag(metadata = {}) {
  const normalized = normalizeGameAccountMetadata(metadata);
  if (!normalized) {
    return null;
  }

  const channelName = (normalized.channelName || '').toLowerCase();
  const serverId = (normalized.serverId || '').toLowerCase();
  const region = (normalized.region || '').toLowerCase();
  const signal = `${channelName} ${serverId} ${region}`;

  if (normalized.channelMasterId === '2' || /b服|bilibili|bilibili/.test(signal)) {
    return 'B服';
  }

  if (serverId === '2') {
    return '国际服·亚服';
  }

  if (serverId === '3') {
    return '国际服·欧/美服';
  }

  if (
    /asia|sea|jp|kr|tw|hk|mo|sg|亚服|亚洲/.test(signal)
  ) {
    return '国际服·亚服';
  }

  if (
    /(^|[^a-z])(eu|na|us)([^a-z]|$)|america|global|欧\/美|欧美|欧服|美服/.test(signal)
  ) {
    return '国际服·欧/美服';
  }

  if (
    normalized.channelMasterId === '1' ||
    normalized.isOfficial === true ||
    /官服|official|gryphline|hypergryph|鹰角/.test(signal)
  ) {
    return '官服';
  }

  if (serverId && serverId !== '1') {
    return '国际服';
  }

  if (/intl|international|global|海外/.test(signal)) {
    return '国际服';
  }

  return null;
}

export function classifyGameAccountRegionBucket(metadata = {}) {
  const serverTag = buildGameAccountServerTag(metadata);
  if (!serverTag) {
    const normalized = normalizeGameAccountMetadata(metadata);
    if (!normalized) {
      return null;
    }

    const serverId = (normalized.serverId || '').toLowerCase();
    const region = (normalized.region || '').toLowerCase();
    const channelName = (normalized.channelName || '').toLowerCase();
    const signal = `${serverId} ${region} ${channelName}`;

    if (
      serverId === '1' ||
      /(^|[^a-z])(cn|china|mainland)([^a-z]|$)|国服|大陆/.test(signal)
    ) {
      return 'cn';
    }

    if (
      serverId === '2' ||
      serverId === '3' ||
      /intl|international|global|asia|sea|jp|kr|tw|hk|mo|sg|亚服|亚洲|(^|[^a-z])(eu|na|us)([^a-z]|$)|america|欧\/美|欧美|欧服|美服/.test(signal)
    ) {
      return 'intl';
    }

    return null;
  }

  if (serverTag.startsWith('国际服')) {
    return 'intl';
  }

  if (serverTag === '官服' || serverTag === 'B服') {
    return 'cn';
  }

  return null;
}
