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
                error: { message: "Could not find the 'server_id' column of 'history' in the schema cache" },
              };
            }

            if (historyAttempt === 2) {
              return {
                data: null,
                error: { message: "Could not find the 'region' column of 'history' in the schema cache" },
              };
            }

            if (historyAttempt === 3) {
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
      serverId: '2',
      region: 'asia',
      timestamp: '2026-03-21T07:00:00.000Z',
    },
  ],
  'user_test'
);

assert.equal(supabase.historyCalls.length, 4, 'history upsert 应在缺少多个 optional 列时逐步重试');
assert.equal(supabase.historyCalls[0].rows[0].character_id, 'char_test_001', '首次写入应保留 canonical character_id');
assert.equal(supabase.historyCalls[0].rows[0].server_id, '2', '首次写入应保留 server_id');
assert.equal(supabase.historyCalls[0].rows[0].region, 'asia', '首次写入应保留 region');
assert.equal('server_id' in supabase.historyCalls[1].rows[0], false, 'server_id 缺列后应先去掉 server_id');
assert.equal('region' in supabase.historyCalls[1].rows[0], true, 'region 在下一轮前仍应保留');
assert.equal('region' in supabase.historyCalls[2].rows[0], false, 'region 缺列后应继续去掉 region');
assert.equal('character_id' in supabase.historyCalls[2].rows[0], true, 'character_id 在最后一轮前仍应保留');
assert.equal('character_id' in supabase.historyCalls[3].rows[0], false, 'fallback 最终应去掉 history.character_id');
assert.equal(supabase.historyCalls[3].onConflict, 'user_id,game_uid,pool_id,seq_id', 'fallback 应保留原有冲突键');

console.log('DATA-NEW-008 history optional-column fallback verification passed');
