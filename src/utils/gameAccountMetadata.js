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
    isOfficial
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
