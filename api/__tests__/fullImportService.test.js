import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockSupabaseClient;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('savePoolsToServer', () => {
  beforeEach(() => {
    vi.resetModules();

    const insertedPoolIds = new Set();
    const operations = [];

    mockSupabaseClient = {
      __operations: operations,
      from(tableName) {
        if (tableName === 'pool_id_aliases') {
          return {
            select() {
              return {
                in: async () => ({ data: [], error: null }),
              };
            },
            async upsert(rows) {
              operations.push('pool_id_aliases.upsert');

              const missingPool = (rows || []).find((row) => !insertedPoolIds.has(String(row.pool_id)));
              if (missingPool) {
                return {
                  error: {
                    code: '23503',
                    message: `Key (pool_id)=(${missingPool.pool_id}) is not present in table "pools".`,
                  },
                };
              }

              return { error: null };
            },
          };
        }

        if (tableName === 'pools') {
          return {
            select() {
              return {
                in: async (_column, values) => ({
                  data: (values || [])
                    .filter((poolId) => insertedPoolIds.has(String(poolId)))
                    .map((poolId) => ({ pool_id: String(poolId) })),
                  error: null,
                }),
              };
            },
            async upsert(rows) {
              operations.push('pools.upsert');
              (rows || []).forEach((row) => insertedPoolIds.add(String(row.pool_id)));
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table access: ${tableName}`);
      },
    };
  });

  it('creates fallback pools for unknown official ids without manually writing alias rows', async () => {
    const { initSupabaseAdmin, savePoolsToServer } = await import('../../backend/fullImportService.js');

    initSupabaseAdmin('https://example.supabase.co', 'service-role-key');

    const result = await savePoolsToServer(
      [{
        pool_id: 'special_1_2_1',
        name: '测试限定池',
        type: 'limited',
        start_time: null,
        end_time: null,
        up_character: '测试角色',
      }],
      '00000000-0000-0000-0000-000000000001'
    );

    expect(result).toMatchObject({
      success: true,
      created: 1,
    });
    expect(mockSupabaseClient.__operations).toEqual([
      'pools.upsert',
    ]);
  });
});

describe('executeFullImport import mode metadata', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('normalizes import mode values', async () => {
    const { normalizeFullImportMode } = await import('../../backend/fullImportService.js');

    expect(normalizeFullImportMode('full')).toBe('full');
    expect(normalizeFullImportMode('incremental')).toBe('incremental');
    expect(normalizeFullImportMode('unsafe')).toBe('incremental');
    expect(normalizeFullImportMode(undefined)).toBe('incremental');
  });

  it('returns selected mode and save counts without changing full-fetch dedupe semantics', async () => {
    const operations = [];
    const insertedPoolIds = new Set();

    mockSupabaseClient = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
            error: null,
          })),
        },
      },
      __operations: operations,
      from(tableName) {
        if (tableName === 'pool_id_aliases' || tableName === 'character_id_aliases') {
          return {
            select() {
              return {
                in: async () => ({ data: [], error: null }),
              };
            },
          };
        }

        if (tableName === 'pools') {
          return {
            select() {
              return {
                in: async (_column, values) => ({
                  data: (values || [])
                    .filter((poolId) => insertedPoolIds.has(String(poolId)))
                    .map((poolId) => ({ pool_id: String(poolId) })),
                  error: null,
                }),
              };
            },
            async upsert(rows) {
              operations.push({ tableName, action: 'upsert', count: rows.length });
              (rows || []).forEach((row) => insertedPoolIds.add(String(row.pool_id)));
              return { error: null };
            },
          };
        }

        if (tableName === 'history') {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        range: async () => ({ data: [], error: null }),
                      };
                    },
                  };
                },
              };
            },
            async upsert(rows) {
              operations.push({ tableName, action: 'upsert', count: rows.length });
              return { error: null };
            },
          };
        }

        if (tableName === 'profiles') {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: { id: '00000000-0000-0000-0000-000000000001' },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table access: ${tableName}`);
      },
    };

    const { executeFullImport, initSupabaseAdmin } = await import('../../backend/fullImportService.js');

    initSupabaseAdmin('https://example.supabase.co', 'service-role-key');

    const updateProgress = vi.fn();
    const authChainFunctions = {
      grantAppToken: vi.fn(async () => ({
        success: true,
        data: { token: 'app-token' },
      })),
      fetchBindingList: vi.fn(async () => ({
        success: true,
        data: {
          accounts: [{
            uid: 'hg-uid',
            gameUid: '10000001',
            nickName: '测试账号',
            serverId: '1',
          }],
        },
      })),
      fetchU8TokenByUid: vi.fn(async () => ({
        success: true,
        data: { token: 'u8-token' },
      })),
      fetchAllRecordsConcurrent: vi.fn(async () => ({
        success: true,
        data: {
          totalRecords: 1,
          partial: [],
          failed: [],
          results: [{
            type: 'char',
            poolType: 'E_CharacterGachaPoolType_Special',
            currentUpCharacter: '测试角色',
            records: [{
              poolId: 'special_1_2_1',
              poolName: '测试限定池',
              seqId: '1',
              charId: 'char_test',
              charName: '测试角色',
              rarity: 6,
              gachaTs: '1767225600000',
              isFree: false,
              isNew: true,
            }],
          }],
        },
      })),
    };

    const result = await executeFullImport({
      token: 'AbCdEfGhIjKlMnOpQrStUvWx',
      accountIndex: 0,
      userId: '00000000-0000-0000-0000-000000000001',
      updateProgress,
      authChainFunctions,
      source: 'cn',
      importMode: 'full',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      importMode: 'full',
      fetchStrategy: 'full_official_fetch_with_dedupe',
      totalRecords: 1,
      newRecords: 1,
      savedRecords: 1,
      duplicates: 0,
    });
    expect(authChainFunctions.fetchAllRecordsConcurrent).toHaveBeenCalledWith(
      'u8-token',
      '1',
      '10000001',
      '测试账号',
      {
        importMode: 'full',
        existingRecordKeys: null,
      }
    );
    expect(operations).toEqual([
      { tableName: 'pools', action: 'upsert', count: 1 },
      { tableName: 'history', action: 'upsert', count: 1 },
    ]);
    expect(updateProgress).toHaveBeenCalledWith({ progress: 100, message: '导入完成' });
  });

  it('passes existing official record keys to incremental fetch and reuses them for dedupe', async () => {
    const operations = [];
    const insertedPoolIds = new Set();
    let historySelectCalls = 0;

    mockSupabaseClient = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
            error: null,
          })),
        },
      },
      __operations: operations,
      from(tableName) {
        if (tableName === 'pool_id_aliases' || tableName === 'character_id_aliases') {
          return {
            select() {
              return {
                in: async () => ({ data: [], error: null }),
              };
            },
          };
        }

        if (tableName === 'pools') {
          return {
            select() {
              return {
                in: async (_column, values) => ({
                  data: (values || [])
                    .filter((poolId) => insertedPoolIds.has(String(poolId)))
                    .map((poolId) => ({ pool_id: String(poolId) })),
                  error: null,
                }),
              };
            },
            async upsert(rows) {
              operations.push({ tableName, action: 'upsert', count: rows.length });
              (rows || []).forEach((row) => insertedPoolIds.add(String(row.pool_id)));
              return { error: null };
            },
          };
        }

        if (tableName === 'history') {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        range: async () => {
                          historySelectCalls++;
                          return {
                            data: [{ pool_id: 'special_1_2_1', seq_id: '1' }],
                            error: null,
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
            async upsert(rows) {
              operations.push({ tableName, action: 'upsert', count: rows.length });
              return { error: null };
            },
          };
        }

        if (tableName === 'profiles') {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: { id: '00000000-0000-0000-0000-000000000001' },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table access: ${tableName}`);
      },
    };

    const { executeFullImport, initSupabaseAdmin } = await import('../../backend/fullImportService.js');

    initSupabaseAdmin('https://example.supabase.co', 'service-role-key');

    const updateProgress = vi.fn();
    const earlyStopped = [{
      type: 'char',
      poolType: 'E_CharacterGachaPoolType_Special',
      records: 2,
      pages: 2,
      reason: 'all_existing_page_with_pity_context',
    }];
    const authChainFunctions = {
      grantAppToken: vi.fn(async () => ({
        success: true,
        data: { token: 'app-token' },
      })),
      fetchBindingList: vi.fn(async () => ({
        success: true,
        data: {
          accounts: [{
            uid: 'hg-uid',
            gameUid: '10000001',
            nickName: '测试账号',
            serverId: '1',
          }],
        },
      })),
      fetchU8TokenByUid: vi.fn(async () => ({
        success: true,
        data: { token: 'u8-token' },
      })),
      fetchAllRecordsConcurrent: vi.fn(async () => ({
        success: true,
        data: {
          totalRecords: 2,
          partial: [],
          failed: [],
          earlyStopped,
          fetchStrategy: 'incremental_official_fetch_with_context_guard',
          results: [{
            type: 'char',
            poolType: 'E_CharacterGachaPoolType_Special',
            currentUpCharacter: '测试角色',
            records: [{
              poolId: 'special_1_2_1',
              poolName: '测试限定池',
              seqId: '2',
              charId: 'char_test',
              charName: '测试角色',
              rarity: 5,
              gachaTs: '1767225600001',
              isFree: false,
              isNew: true,
            }, {
              poolId: 'special_1_2_1',
              poolName: '测试限定池',
              seqId: '1',
              charId: 'char_old',
              charName: '已保存角色',
              rarity: 6,
              gachaTs: '1767225600000',
              isFree: false,
              isNew: false,
            }],
          }],
        },
      })),
    };

    const result = await executeFullImport({
      token: 'AbCdEfGhIjKlMnOpQrStUvWx',
      accountIndex: 0,
      userId: '00000000-0000-0000-0000-000000000001',
      updateProgress,
      authChainFunctions,
      source: 'cn',
      importMode: 'incremental',
    });

    const fetchCall = authChainFunctions.fetchAllRecordsConcurrent.mock.calls[0];
    expect(fetchCall.slice(0, 4)).toEqual([
      'u8-token',
      '1',
      '10000001',
      '测试账号',
    ]);
    expect(fetchCall[4]).toMatchObject({
      importMode: 'incremental',
    });
    expect([...fetchCall[4].existingRecordKeys]).toEqual([
      '10000001:special_1_2_1:1',
    ]);
    expect(historySelectCalls).toBe(1);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      importMode: 'incremental',
      fetchStrategy: 'incremental_official_fetch_with_context_guard',
      totalRecords: 2,
      newRecords: 1,
      savedRecords: 1,
      duplicates: 1,
      earlyStoppedPools: earlyStopped,
    });
    expect(operations).toEqual([
      { tableName: 'pools', action: 'upsert', count: 1 },
      { tableName: 'history', action: 'upsert', count: 1 },
    ]);
  });
});

describe('official import incremental guards', () => {
  it('only stops after a fully existing page with enough pity context', async () => {
    const {
      analyzeIncrementalPage,
      hasSufficientIncrementalPityContext,
    } = await import('../../backend/lib/officialImportIncremental.js');

    const existingRecordKeys = new Set([
      '10000001:special_1_2_1:10',
      '10000001:special_1_2_1:9',
    ]);
    const existingSixStarPage = [{
      poolId: 'special_1_2_1',
      seqId: '10',
      rarity: 6,
      isFree: false,
    }, {
      poolId: 'special_1_2_1',
      seqId: '9',
      rarity: 5,
      isFree: false,
    }];

    expect(analyzeIncrementalPage({
      records: existingSixStarPage,
      gameUid: '10000001',
      existingRecordKeys,
      getPoolId: (record) => record.poolId,
    })).toMatchObject({
      checked: 2,
      existing: 2,
      missingKey: 0,
      allExisting: true,
    });
    expect(hasSufficientIncrementalPityContext(existingSixStarPage)).toBe(true);
  });

  it('does not stop when a page has missing keys or insufficient paid context', async () => {
    const {
      analyzeIncrementalPage,
      createIncrementalImportStopGuard,
      hasSufficientIncrementalPityContext,
    } = await import('../../backend/lib/officialImportIncremental.js');

    const shortExistingPage = Array.from({ length: 20 }, (_, index) => ({
      poolId: 'special_1_2_1',
      seqId: String(80 - index),
      rarity: 5,
      isFree: false,
    }));
    const existingRecordKeys = new Set(
      shortExistingPage.map((record) => `10000001:${record.poolId}:${record.seqId}`)
    );

    expect(analyzeIncrementalPage({
      records: [{ poolId: 'special_1_2_1', rarity: 5 }],
      gameUid: '10000001',
      existingRecordKeys,
      getPoolId: (record) => record.poolId,
    })).toMatchObject({
      checked: 0,
      existing: 0,
      missingKey: 1,
      allExisting: false,
    });
    expect(analyzeIncrementalPage({
      records: shortExistingPage,
      gameUid: '10000001',
      existingRecordKeys,
      getPoolId: (record) => record.poolId,
    }).allExisting).toBe(true);
    expect(hasSufficientIncrementalPityContext(shortExistingPage)).toBe(false);
    expect(hasSufficientIncrementalPityContext(
      Array.from({ length: 80 }, (_, index) => ({
        seqId: String(index + 1),
        rarity: 5,
        isFree: false,
      }))
    )).toBe(true);

    const stopGuard = createIncrementalImportStopGuard({
      gameUid: '10000001',
      existingRecordKeys,
      getPoolId: (record) => record.poolId,
    });

    const firstCheck = stopGuard.inspectPage(shortExistingPage.slice(0, 10));
    expect(firstCheck.shouldStop).toBe(false);
    expect(firstCheck.meta).toMatchObject({
      pagesChecked: 1,
      contextRecords: 10,
      stopped: false,
    });

    const secondCheck = stopGuard.inspectPage([{ poolId: 'special_1_2_1', rarity: 5 }]);
    expect(secondCheck.shouldStop).toBe(false);
    expect(secondCheck.meta).toMatchObject({
      pagesChecked: 2,
      contextRecords: 0,
      missingKey: 1,
      stopped: false,
    });
  });

  it('accumulates only consecutive existing pages before early stop', async () => {
    const {
      createIncrementalImportStopGuard,
    } = await import('../../backend/lib/officialImportIncremental.js');

    const pageA = Array.from({ length: 40 }, (_, index) => ({
      poolId: 'special_1_2_1',
      seqId: String(100 - index),
      rarity: 5,
      isFree: false,
    }));
    const pageB = Array.from({ length: 40 }, (_, index) => ({
      poolId: 'special_1_2_1',
      seqId: String(60 - index),
      rarity: 5,
      isFree: false,
    }));
    const existingRecordKeys = new Set(
      [...pageA, ...pageB].map((record) => `10000001:${record.poolId}:${record.seqId}`)
    );
    const stopGuard = createIncrementalImportStopGuard({
      gameUid: '10000001',
      existingRecordKeys,
      getPoolId: (record) => record.poolId,
    });

    expect(stopGuard.inspectPage(pageA)).toMatchObject({
      shouldStop: false,
      meta: {
        pagesChecked: 1,
        contextRecords: 40,
        stopped: false,
      },
    });
    expect(stopGuard.inspectPage(pageB)).toMatchObject({
      shouldStop: true,
      reason: 'all_existing_page_with_pity_context',
      meta: {
        pagesChecked: 2,
        contextRecords: 80,
        stopped: true,
        stopReason: 'all_existing_page_with_pity_context',
      },
    });
  });
});
