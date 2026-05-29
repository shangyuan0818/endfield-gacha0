const TOKEN_PATTERN = /^[A-Za-z0-9+/=]{24}$/;
const TOKEN_SCAN_PATTERN = /(^|[^A-Za-z0-9+/])([A-Za-z0-9+/=]{24})(?=$|[^A-Za-z0-9+/])/g;

const KNOWN_TOKEN_KEYS = new Set([
  'content',
  'token',
  'authToken',
  'auth_token',
  'accountToken',
  'account_token',
]);

const SOURCE_HINTS = {
  cn: [
    'web-api.hypergryph.com',
    'user.hypergryph.com',
    'hypergryph.com',
  ],
  intl: [
    'web-api.gryphline.com',
    'topup.gryphline.com',
    'gryphline.com',
  ],
};

export const OFFICIAL_IMPORT_MODES = {
  INCREMENTAL: 'incremental',
  FULL: 'full',
};

export function normalizeOfficialImportSource(source) {
  return source === 'intl' ? 'intl' : 'cn';
}

export function normalizeOfficialImportMode(mode) {
  return mode === OFFICIAL_IMPORT_MODES.FULL
    ? OFFICIAL_IMPORT_MODES.FULL
    : OFFICIAL_IMPORT_MODES.INCREMENTAL;
}

function safeJsonParse(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function scanTokenFromText(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  if (TOKEN_PATTERN.test(text)) {
    return text;
  }

  TOKEN_SCAN_PATTERN.lastIndex = 0;
  const match = TOKEN_SCAN_PATTERN.exec(text);
  return match?.[2] || '';
}

function findTokenInJson(value) {
  const queue = [{ key: '', value }];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const { key, value: node } = current;

    if (typeof node === 'string') {
      const candidate = scanTokenFromText(node);
      if (candidate && (KNOWN_TOKEN_KEYS.has(key) || TOKEN_PATTERN.test(node.trim()))) {
        return candidate;
      }
      continue;
    }

    if (!node || typeof node !== 'object' || seen.has(node)) {
      continue;
    }
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((item) => queue.push({ key: '', value: item }));
      continue;
    }

    Object.entries(node).forEach(([childKey, childValue]) => {
      queue.push({ key: childKey, value: childValue });
    });
  }

  return '';
}

export function detectOfficialImportSourceFromInput(input) {
  const normalized = String(input || '').toLowerCase();
  if (!normalized) {
    return { source: null, confidence: 'none', reason: null };
  }

  for (const [source, hints] of Object.entries(SOURCE_HINTS)) {
    const matchedHint = hints.find((hint) => normalized.includes(hint));
    if (matchedHint) {
      return {
        source,
        confidence: 'high',
        reason: matchedHint,
      };
    }
  }

  return { source: null, confidence: 'none', reason: null };
}

export function parseOfficialImportTokenInput(input) {
  const rawInput = String(input || '');
  const trimmed = rawInput.trim();
  const parsedJson = safeJsonParse(trimmed);
  const sourceDetection = detectOfficialImportSourceFromInput(trimmed);

  if (!trimmed) {
    return {
      token: '',
      fromJson: false,
      fromText: false,
      inputKind: 'empty',
      detectedSource: sourceDetection.source,
      sourceConfidence: sourceDetection.confidence,
      sourceReason: sourceDetection.reason,
      autoDetected: false,
      tokenLength: 0,
    };
  }

  if (parsedJson) {
    const token = findTokenInJson(parsedJson);
    return {
      token,
      fromJson: Boolean(token),
      fromText: false,
      inputKind: 'json',
      detectedSource: sourceDetection.source,
      sourceConfidence: sourceDetection.confidence,
      sourceReason: sourceDetection.reason,
      autoDetected: Boolean(token),
      tokenLength: token.length,
    };
  }

  const scannedToken = scanTokenFromText(trimmed);
  const isDirectToken = TOKEN_PATTERN.test(trimmed);

  return {
    token: scannedToken || trimmed,
    fromJson: false,
    fromText: Boolean(scannedToken && !isDirectToken),
    inputKind: isDirectToken ? 'token' : (scannedToken ? 'text' : 'raw'),
    detectedSource: sourceDetection.source,
    sourceConfidence: sourceDetection.confidence,
    sourceReason: sourceDetection.reason,
    autoDetected: Boolean(scannedToken && !isDirectToken),
    tokenLength: (scannedToken || trimmed).length,
  };
}

export function validateOfficialImportToken(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return { valid: false, error: null };

  if (trimmed.length !== 24) {
    return { valid: false, error: { key: 'import.error.tokenLength', params: { length: trimmed.length } } };
  }

  if (!TOKEN_PATTERN.test(trimmed)) {
    return { valid: false, error: { key: 'import.error.tokenFormat' } };
  }

  return { valid: true, token: trimmed };
}
