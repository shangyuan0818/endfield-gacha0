function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function looksLikeInternalPayload(data) {
  return Boolean(
    data
    && typeof data === 'object'
    && Array.isArray(data.pools)
    && Array.isArray(data.history)
  );
}

function looksLikeLegacyInternalPayload(data) {
  if (!looksLikeInternalPayload(data)) {
    return false;
  }

  const schemaVersion = normalizeText(data.schemaVersion || data.version);
  if (schemaVersion === '3.0' || schemaVersion === '3.0.0') {
    return false;
  }

  const sampleRecord = Array.isArray(data.history) ? data.history.find(Boolean) : null;
  const samplePool = Array.isArray(data.pools) ? data.pools.find(Boolean) : null;

  return Boolean(
    (sampleRecord && (
      'pool_id' in sampleRecord
      || 'item_name' in sampleRecord
      || 'character_id' in sampleRecord
      || 'seq_id' in sampleRecord
    ))
    || (samplePool && (
      'pool_id' in samplePool
      || 'up_character' in samplePool
      || 'is_limited_weapon' in samplePool
    ))
  );
}

function looksLikeCurrentInternalPayload(data) {
  if (!looksLikeInternalPayload(data)) {
    return false;
  }

  const schemaVersion = normalizeText(data.schemaVersion || data.version);
  return schemaVersion === '3.0' || schemaVersion === '3.0.0';
}

export const DATA_FORMAT_REGISTRY = Object.freeze([
  {
    id: 'internal_json_v3',
    label: '站内 JSON v3',
    direction: ['import', 'export'],
    kind: 'json',
    fileExtensions: ['json'],
    detect: looksLikeCurrentInternalPayload,
  },
  {
    id: 'internal_json_legacy',
    label: '站内旧版 JSON',
    direction: ['import'],
    kind: 'json',
    fileExtensions: ['json'],
    detect: looksLikeLegacyInternalPayload,
  },
  {
    id: 'internal_csv_flat',
    label: '站内 CSV 平铺导出',
    direction: ['export'],
    kind: 'csv',
    fileExtensions: ['csv'],
    detect: () => false,
  },
]);

export function listSupportedImportFormats() {
  return DATA_FORMAT_REGISTRY.filter(format => format.direction.includes('import'));
}

export function listSupportedExportFormats() {
  return DATA_FORMAT_REGISTRY.filter(format => format.direction.includes('export'));
}

export function getDataFormatById(formatId) {
  const normalized = normalizeText(formatId);
  return DATA_FORMAT_REGISTRY.find(format => format.id === normalized) || null;
}

export function detectImportFormat(data) {
  return listSupportedImportFormats().find(format => format.detect(data)) || null;
}
