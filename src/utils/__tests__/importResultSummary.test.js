import { describe, expect, it } from 'vitest';

import {
  buildImportResultDiagnostic,
  buildImportResultMessage,
  buildImportResultSummary,
  maskImportAccountIdentifier,
  resolveImportResultActionHref,
} from '../importResultSummary.js';

describe('importResultSummary', () => {
  it('masks import account identifiers before display', () => {
    expect(maskImportAccountIdentifier('123456789')).toBe('123****789');
    expect(maskImportAccountIdentifier('cn:987654321')).toBe('987****321');
    expect(maskImportAccountIdentifier('1234')).toBe('****');
  });

  it('builds a redacted import result summary with counts and latest record time', () => {
    const summary = buildImportResultSummary({
      sourceFormatId: 'internal_json_v3',
      sourceFormatLabel: 'Site JSON',
      data: {
        accounts: [
          {
            gameUid: '123456789',
            nickName: 'doctor@example.com',
            channelName: 'CN',
          },
        ],
        pools: [{ id: 'pool-a' }, { id: 'pool-b' }],
        history: [
          { id: 'history-secret-1', timestamp: '2026-05-20T10:00:00.000Z' },
          { id: 'history-secret-2', timestamp: 1770000000 },
        ],
      },
      addedHistory: 3,
      duplicateHistory: 4,
      addedPools: 1,
      syncedToCloud: true,
      importMode: 'incremental',
      partialPools: [{ poolId: 'pool-b' }],
    }, {
      locale: 'zh-CN',
      pathname: '/dashboard',
    });

    expect(summary).toMatchObject({
      sourceKey: 'internal_json_v3',
      sourceLabel: 'Site JSON',
      addedHistory: 3,
      duplicateHistory: 4,
      skippedHistory: 4,
      addedPools: 1,
      poolCount: 2,
      importMode: 'incremental',
      syncStatus: 'synced',
      partial: true,
      partialPoolCount: 1,
      failedPoolCount: 0,
      actionHref: '/dashboard',
    });
    expect(summary.accountLabel).toContain('UID 123****789');
    expect(summary.accountLabel).not.toContain('123456789');
    expect(summary.accountLabel).not.toContain('doctor@example.com');
    expect(summary.latestRecordAt).toBe('2026-05-20T10:00:00.000Z');
  });

  it('resolves desktop and mobile imported-data action routes', () => {
    expect(resolveImportResultActionHref('/dashboard')).toBe('/dashboard');
    expect(resolveImportResultActionHref('/summary')).toBe('/dashboard');
    expect(resolveImportResultActionHref('/m/details')).toBe('/m/details');
    expect(resolveImportResultActionHref('/m/settings')).toBe('/m/details');
  });

  it('builds safe user-facing messages and diagnostics', () => {
    const summary = buildImportResultSummary({
      source: 'official_api',
      account: {
        game_uid: '987654321',
        nick_name: 'token=secret-token-value',
      },
      addedHistory: 3,
      duplicateHistory: 4,
      addedPools: 2,
      syncedToCloud: false,
      partial: true,
      importMode: 'full',
      latestRecordAt: '2026-05-25T08:00:00.000Z',
    }, {
      locale: 'en-US',
      actionHref: '/dashboard',
    });

    const message = buildImportResultMessage(summary, 'en-US');
    const diagnostic = buildImportResultDiagnostic(summary);

    expect(message).toContain('Added 3 record(s)');
    expect(message).toContain('skipped 4 duplicate record(s)');
    expect(message).toContain('added 2 banner(s)');
    expect(message).toContain('UID 987****321');
    expect(message).not.toContain('987654321');
    expect(message).not.toContain('secret-token-value');
    expect(JSON.stringify(diagnostic)).toContain('UID 987****321');
    expect(JSON.stringify(diagnostic)).not.toContain('987654321');
    expect(JSON.stringify(diagnostic)).not.toContain('secret-token-value');
  });
});
