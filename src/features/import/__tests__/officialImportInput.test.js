import { describe, expect, it } from 'vitest';

import {
  OFFICIAL_IMPORT_MODES,
  detectOfficialImportSourceFromInput,
  normalizeOfficialImportMode,
  normalizeOfficialImportSource,
  parseOfficialImportTokenInput,
  validateOfficialImportToken,
} from '../officialImportInput.js';

const VALID_TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWx';

describe('officialImportInput', () => {
  it('extracts token from nested official JSON payloads', () => {
    const parsed = parseOfficialImportTokenInput(JSON.stringify({
      data: {
        content: VALID_TOKEN,
      },
    }));

    expect(parsed).toMatchObject({
      token: VALID_TOKEN,
      fromJson: true,
      fromText: false,
      inputKind: 'json',
      autoDetected: true,
      tokenLength: 24,
    });
  });

  it('extracts token from direct JSON content fields', () => {
    const parsed = parseOfficialImportTokenInput(JSON.stringify({
      content: VALID_TOKEN,
    }));

    expect(parsed).toMatchObject({
      token: VALID_TOKEN,
      fromJson: true,
      inputKind: 'json',
      autoDetected: true,
    });
  });

  it('extracts token from pasted text or URLs', () => {
    const parsed = parseOfficialImportTokenInput(`https://example.test/callback?token=${VALID_TOKEN}&foo=bar`);

    expect(parsed).toMatchObject({
      token: VALID_TOKEN,
      fromJson: false,
      fromText: true,
      inputKind: 'text',
      autoDetected: true,
    });
  });

  it('detects CN and international source hints', () => {
    expect(detectOfficialImportSourceFromInput(`https://web-api.hypergryph.com/path?content=${VALID_TOKEN}`)).toMatchObject({
      source: 'cn',
      confidence: 'high',
      reason: 'web-api.hypergryph.com',
    });
    expect(detectOfficialImportSourceFromInput(`https://web-api.gryphline.com/path?content=${VALID_TOKEN}`)).toMatchObject({
      source: 'intl',
      confidence: 'high',
      reason: 'web-api.gryphline.com',
    });
    expect(detectOfficialImportSourceFromInput(`https://topup.gryphline.com/path?content=${VALID_TOKEN}`)).toMatchObject({
      source: 'intl',
      confidence: 'high',
      reason: 'topup.gryphline.com',
    });
  });

  it('carries source detection through token parsing', () => {
    const parsed = parseOfficialImportTokenInput(JSON.stringify({
      endpoint: 'https://web-api.gryphline.com',
      data: { content: VALID_TOKEN },
    }));

    expect(parsed).toMatchObject({
      token: VALID_TOKEN,
      detectedSource: 'intl',
      sourceConfidence: 'high',
      sourceReason: 'web-api.gryphline.com',
    });
  });

  it('validates token length and allowed characters', () => {
    expect(validateOfficialImportToken('short')).toEqual({
      valid: false,
      error: { key: 'import.error.tokenLength', params: { length: 5 } },
    });
    expect(validateOfficialImportToken('AbCdEfGhIjKlMnOpQrStUvW!')).toEqual({
      valid: false,
      error: { key: 'import.error.tokenFormat' },
    });
    expect(validateOfficialImportToken(VALID_TOKEN)).toEqual({
      valid: true,
      token: VALID_TOKEN,
    });
  });

  it('normalizes source and import mode defaults', () => {
    expect(normalizeOfficialImportSource('intl')).toBe('intl');
    expect(normalizeOfficialImportSource('cn')).toBe('cn');
    expect(normalizeOfficialImportSource('unknown')).toBe('cn');
    expect(normalizeOfficialImportMode(OFFICIAL_IMPORT_MODES.FULL)).toBe('full');
    expect(normalizeOfficialImportMode('incremental')).toBe('incremental');
    expect(normalizeOfficialImportMode('unsafe')).toBe('incremental');
  });
});
