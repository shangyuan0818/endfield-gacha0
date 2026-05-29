const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SECRET_FRAGMENT_PATTERN = /\b(?:token|secret|password|api[_-]?key|authorization)\b/i;

const SOURCE_LABELS = {
  official_api: {
    'zh-CN': '官方导入',
    'en-US': 'Official import',
  },
  import_confirm: {
    'zh-CN': '文件导入',
    'en-US': 'File import',
  },
  internal_json_v3: {
    'zh-CN': '本站 JSON',
    'en-US': 'Site JSON',
  },
  internal_csv_flat: {
    'zh-CN': '本站 CSV',
    'en-US': 'Site CSV',
  },
  bhaoo_endfield_gacha_userdata_zip: {
    'zh-CN': 'EndfieldGacha userData',
    'en-US': 'EndfieldGacha userData',
  },
  endfield_gacha_helper_json: {
    'zh-CN': 'EndfieldGachaHelper JSON',
    'en-US': 'EndfieldGachaHelper JSON',
  },
  endfield_gacha_helper_csv: {
    'zh-CN': 'EndfieldGachaHelper CSV',
    'en-US': 'EndfieldGachaHelper CSV',
  },
  endfield_gacha_helper_userdata_zip: {
    'zh-CN': 'EndfieldGachaHelper userData',
    'en-US': 'EndfieldGachaHelper userData',
  },
  endgacha_kwer_top_plain_json: {
    'zh-CN': 'endgacha.kwer.top JSON',
    'en-US': 'endgacha.kwer.top JSON',
  },
  endgacha_kwer_top_plain_txt: {
    'zh-CN': 'endgacha.kwer.top TXT',
    'en-US': 'endgacha.kwer.top TXT',
  },
};

function normalizeLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

function isEnglishLocale(locale) {
  return normalizeLocale(locale) === 'en-US';
}

function toText(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value).trim();
}

function toNumber(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value.length;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Math.max(0, numeric);
    }
  }
  return 0;
}

function normalizeSourceKey(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function localizeKnownSource(sourceKey, locale) {
  const labels = SOURCE_LABELS[normalizeSourceKey(sourceKey)];
  if (!labels) {
    return '';
  }
  return labels[normalizeLocale(locale)] || labels['zh-CN'] || '';
}

function safeDisplayText(value, fallback = '') {
  const text = toText(value, fallback);
  if (!text || SECRET_FRAGMENT_PATTERN.test(text)) {
    return fallback;
  }

  const withoutEmail = text.replace(EMAIL_PATTERN, '[redacted]');
  return withoutEmail.length > 40 ? `${withoutEmail.slice(0, 37)}...` : withoutEmail;
}

function normalizeAccount(account) {
  if (!account || typeof account !== 'object') {
    return null;
  }

  const rawUid = toText(
    account.gameUid
      || account.game_uid
      || account.uid
      || account.hgUid
      || account.hg_uid
  );
  const nickName = safeDisplayText(
    account.nickName
      || account.nick_name
      || account.nickname
      || account.name
  );
  const channelName = safeDisplayText(account.channelName || account.channel_name || account.serverTag || account.source);

  if (!rawUid && !nickName && !channelName) {
    return null;
  }

  return {
    rawUid,
    nickName,
    channelName,
  };
}

function collectAccounts(source) {
  const accounts = [];
  const addAccount = (account) => {
    const normalized = normalizeAccount(account);
    if (normalized) {
      accounts.push(normalized);
    }
  };

  addAccount(source.account);
  addAccount(source.userInfo);
  (Array.isArray(source.accounts) ? source.accounts : []).forEach(addAccount);
  (Array.isArray(source.data?.accounts) ? source.data.accounts : []).forEach(addAccount);
  (Array.isArray(source.importedData?.accounts) ? source.importedData.accounts : []).forEach(addAccount);

  return accounts;
}

export function maskImportAccountIdentifier(value) {
  const text = toText(value);
  if (!text) {
    return '';
  }

  const normalized = text.includes(':') ? text.split(':').pop() : text;
  if (normalized.length <= 4) {
    return '****';
  }
  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
  }

  return `${normalized.slice(0, 3)}****${normalized.slice(-3)}`;
}

function buildAccountLabel(source, locale) {
  const english = isEnglishLocale(locale);
  const account = collectAccounts(source)[0] || null;
  if (!account) {
    return english ? 'Account not detected' : '未识别账号';
  }

  const maskedUid = maskImportAccountIdentifier(account.rawUid);
  const uidLikeName = account.nickName && account.rawUid && account.nickName === account.rawUid;
  const name = uidLikeName ? '' : account.nickName;
  const serverSuffix = account.channelName ? ` · ${account.channelName}` : '';

  if (name && maskedUid) {
    return `${name} · UID ${maskedUid}${serverSuffix}`;
  }
  if (name) {
    return `${name}${serverSuffix}`;
  }
  if (maskedUid) {
    return `UID ${maskedUid}${serverSuffix}`;
  }
  return english ? 'Account not detected' : '未识别账号';
}

function getRecordTimestampMs(record) {
  const raw = record?.timestamp || record?.created_at || record?.createdAt || record?.time;
  if (!raw) {
    return null;
  }
  if (typeof raw === 'number') {
    return raw < 1000000000000 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLatestRecordAt(source, fallback = null) {
  const direct = toText(source.latestRecordAt || source.latest_record_at || source.lastRecordAt || source.last_record_at);
  if (direct && !Number.isNaN(new Date(direct).getTime())) {
    return new Date(direct).toISOString();
  }

  const historyRecords = [
    ...(Array.isArray(source.historyRecords) ? source.historyRecords : []),
    ...(Array.isArray(source.data?.history) ? source.data.history : []),
    ...(Array.isArray(source.importedData?.history) ? source.importedData.history : []),
  ];
  let latestMs = null;
  historyRecords.forEach((record) => {
    const timestampMs = getRecordTimestampMs(record);
    if (timestampMs !== null) {
      latestMs = latestMs === null ? timestampMs : Math.max(latestMs, timestampMs);
    }
  });

  if (latestMs !== null) {
    return new Date(latestMs).toISOString();
  }

  return fallback;
}

function resolveSyncStatus(source) {
  const status = toText(source.status).toLowerCase();
  const explicitSync = source.syncedToCloud ?? source.synced_to_cloud;
  if (explicitSync === true || source.backendImported === true) {
    return 'synced';
  }
  if (status === 'partial' || source.partial === true) {
    return explicitSync === false ? 'failed' : 'partial';
  }
  if (explicitSync === false) {
    return 'local';
  }
  if (source.willSyncToCloud === true) {
    return 'synced';
  }
  return 'unknown';
}

export function resolveImportResultActionHref(pathname = null) {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location?.pathname : '');
  return String(path || '').startsWith('/m') ? '/m/details' : '/dashboard';
}

export function buildImportResultSummary(input = {}, options = {}) {
  const summary = input.summary && typeof input.summary === 'object'
    ? { ...input.summary, ...input }
    : { ...input };
  const locale = normalizeLocale(options.locale);
  const english = isEnglishLocale(locale);
  const data = summary.data || summary.importedData || null;
  const historyRecords = Array.isArray(summary.historyRecords)
    ? summary.historyRecords
    : Array.isArray(data?.history)
      ? data.history
      : [];
  const totalRecords = toNumber(
    summary.totalRecords,
    summary.total,
    summary.historyCount,
    historyRecords.length
  );
  const addedHistory = toNumber(
    summary.addedHistory,
    summary.addedRecords,
    summary.newRecords,
    summary.savedRecords
  );
  const duplicateHistory = toNumber(
    summary.duplicateHistory,
    summary.duplicateRecords,
    summary.duplicates,
    Math.max(totalRecords - addedHistory, 0)
  );
  const skippedHistory = toNumber(summary.skippedHistory, summary.skippedRecords, duplicateHistory);
  const addedPools = toNumber(summary.addedPools, summary.newPools);
  const poolCount = toNumber(
    summary.poolCount,
    summary.totalPools,
    Array.isArray(data?.pools) ? data.pools.length : undefined
  );
  const partialPools = Array.isArray(summary.partialPools) ? summary.partialPools : [];
  const failedPools = Array.isArray(summary.failedPools) ? summary.failedPools : [];
  const sourceKey = normalizeSourceKey(
    summary.sourceFormatId
      || summary.source_format_id
      || summary.source
      || summary.importSource
      || 'official_api'
  );
  const sourceLabel = safeDisplayText(
    summary.sourceFormatLabel
      || summary.source_format_label
      || localizeKnownSource(sourceKey, locale)
      || (english ? 'Import' : '导入')
  );
  const importMode = toText(summary.importMode || summary.import_mode);
  const syncStatus = resolveSyncStatus(summary);
  const partial = Boolean(summary.partial || partialPools.length > 0 || failedPools.length > 0 || syncStatus === 'partial' || syncStatus === 'failed');
  const actionHref = toText(summary.actionHref || options.actionHref || resolveImportResultActionHref(options.pathname));
  const latestRecordAt = getLatestRecordAt(summary);

  return {
    locale,
    sourceKey,
    sourceLabel,
    accountLabel: buildAccountLabel(summary, locale),
    totalRecords,
    addedHistory,
    duplicateHistory,
    skippedHistory,
    addedPools,
    poolCount,
    importMode,
    syncStatus,
    partial,
    partialPoolCount: partialPools.length,
    failedPoolCount: failedPools.length,
    partialPools,
    failedPools,
    latestRecordAt,
    completedAt: toText(summary.completedAt || summary.completed_at || summary.createdAt || summary.created_at) || null,
    actionHref,
  };
}

export function buildImportResultDiagnostic(summary) {
  return {
    phase: summary.partial ? 'import_partial' : 'import_success',
    source: summary.sourceLabel,
    account: summary.accountLabel,
    totalRecords: summary.totalRecords,
    addedHistory: summary.addedHistory,
    duplicateHistory: summary.duplicateHistory,
    skippedHistory: summary.skippedHistory,
    addedPools: summary.addedPools,
    poolCount: summary.poolCount,
    partialPoolCount: summary.partialPoolCount,
    failedPoolCount: summary.failedPoolCount,
    syncStatus: summary.syncStatus,
    importMode: summary.importMode || null,
    latestRecordAt: summary.latestRecordAt || null,
  };
}

export function buildImportResultMessage(summary, locale = 'zh-CN') {
  const english = isEnglishLocale(locale);
  const accountSegment = summary.accountLabel
    ? (english ? ` Account: ${summary.accountLabel}.` : ` 账号：${summary.accountLabel}。`)
    : '';
  const poolSegment = summary.addedPools
    ? (english ? `, added ${summary.addedPools} banner(s)` : `，新增 ${summary.addedPools} 个卡池`)
    : '';
  const syncSegment = summary.syncStatus === 'synced'
    ? (english ? ' Synced to cloud.' : ' 已同步到云端。')
    : summary.syncStatus === 'failed'
      ? (english ? ' Cloud sync failed; local data was kept.' : ' 云同步失败，已保留本机数据。')
      : summary.syncStatus === 'local'
        ? (english ? ' Saved locally only.' : ' 仅保存在本机。')
        : '';
  const partialSegment = summary.partial
    ? (english ? ' Some data still needs retry or manual review.' : ' 仍有部分数据需要稍后重试或人工排查。')
    : '';

  return english
    ? `Added ${summary.addedHistory} record(s), skipped ${summary.duplicateHistory} duplicate record(s)${poolSegment}.${accountSegment}${syncSegment}${partialSegment}`
    : `新增 ${summary.addedHistory} 条记录，跳过 ${summary.duplicateHistory} 条重复记录${poolSegment}。${accountSegment}${syncSegment}${partialSegment}`;
}
