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
