import assert from 'node:assert/strict';

import { upsertHistory } from '../src/services/cloudWriteService.js';

function createSupabaseMock() {
  const historyCalls = [];
  let historyAttempt = 0;

  return {
    historyCalls,
    from(tableName) {
      if (tableName === 'character_id_aliases' || tableName === 'pool_id_aliases') {
        return {
          select() {
            return {
              async in() {
                return { data: [], error: null };
              },
            };
          },
        };
      }

      if (tableName === 'history') {
        return {
          async upsert(rows, options) {
            historyAttempt += 1;
            historyCalls.push({
              rows,
              onConflict: options?.onConflict,
            });

            if (historyAttempt === 1) {
              return {
                data: null,
                error: { message: "Could not find the 'character_id' column of 'history' in the schema cache" },
              };
            }

            return { data: rows, error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    },
  };
}

const supabase = createSupabaseMock();

await upsertHistory(
  supabase,
  [
    {
      id: 1,
      poolId: 'special_1_0_1',
      rarity: 6,
      character_name: '测试角色',
      character_id: 'char_test_001',
      seqId: '1001',
      gameUid: '1000123456',
      timestamp: '2026-03-21T07:00:00.000Z',
    },
  ],
  'user_test'
);

assert.equal(supabase.historyCalls.length, 2, 'history upsert 应在缺列时重试一次');
assert.equal(supabase.historyCalls[0].rows[0].character_id, 'char_test_001', '首次写入应保留 canonical character_id');
assert.equal('character_id' in supabase.historyCalls[1].rows[0], false, 'fallback 重试应去掉 history.character_id');
assert.equal(supabase.historyCalls[1].onConflict, 'user_id,game_uid,pool_id,seq_id', 'fallback 应保留原有冲突键');

console.log('DATA-NEW-008 history.character_id fallback verification passed');
