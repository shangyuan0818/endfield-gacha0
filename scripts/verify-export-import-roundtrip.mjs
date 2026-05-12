import assert from 'node:assert/strict';
import { buildExportJsonContent, buildExportPayload } from '../src/utils/dataExport.js';
import { getHistoryImportDedupKey, validateAndNormalizeImportData } from '../src/utils/dataImport.js';

const baseHistory = [
  {
    id: 101,
    user_id: 'source-user',
    poolId: 'special_1_0_1',
    name: '莱万汀',
    rarity: 6,
    isStandard: false,
    seqId: '5001',
    batchId: 'batch-1',
    pity: 63,
    isNew: true,
    isFree: false,
    gameUid: '1000123456',
    nickName: '测试账号',
    channelName: '官服',
    channelMasterId: '1',
    serverId: '1',
    isOfficial: true,
    timestamp: '2026-02-01T08:00:00.000Z'
  },
  {
    id: 'legacy-5-star',
    user_id: 'source-user',
    poolId: 'special_1_0_1',
    name: '五星角色',
    rarity: 5,
    isStandard: false,
    timestamp: '2026-02-01T08:05:00.000Z',
    gameUid: '1000123456',
    nickName: '测试账号'
  }
];

const basePools = [
  {
    id: 'special_1_0_1',
    name: '限定池',
    type: 'limited',
    user_id: 'source-user',
    up_character: '莱万汀',
    start_time: '2026-02-01T00:00:00.000Z',
    end_time: '2026-02-21T03:59:59.000Z'
  }
];

const payload = buildExportPayload({
  history: baseHistory,
  pools: basePools,
  currentPoolId: 'special_1_0_1',
  currentGameUid: '1000123456',
  currentUserId: 'source-user',
  options: {
    format: 'json',
    poolFilter: 'current',
    accountFilter: 'current'
  }
});

const exportedJson = JSON.parse(buildExportJsonContent(payload));
const roundTripValidation = validateAndNormalizeImportData(exportedJson, {
  existingPools: [],
  currentUserId: 'target-user'
});

assert.equal(roundTripValidation.valid, true, `当前导出的 JSON 应可重新导入: ${roundTripValidation.errors.join('; ')}`);
assert.equal(roundTripValidation.normalizedData.pools.length, 1, 'round-trip 应保留 1 个卡池');
assert.equal(roundTripValidation.normalizedData.history.length, 2, 'round-trip 应保留 2 条记录');
assert.equal(roundTripValidation.normalizedData.pools[0].user_id, 'target-user', '导入后的卡池归属应重绑到当前用户');
assert.equal(roundTripValidation.normalizedData.history[0].user_id, 'target-user', '导入后的记录归属应重绑到当前用户');
assert.equal(roundTripValidation.normalizedData.history[0].name, '莱万汀', '当前运行时 name 字段应被接受');
assert.equal(roundTripValidation.normalizedData.history[0].pool_id, 'special_1_0_1', '当前运行时 poolId 字段应归一化为 pool_id');

const legacyValidation = validateAndNormalizeImportData({
  version: '2.0',
  pools: [
    {
      pool_id: 'weaponbox_1_0_1',
      name: '武器池',
      type: 'limited_weapon',
      is_limited_weapon: true
    }
  ],
  history: [
    {
      id: '3001',
      pool_id: 'weaponbox_1_0_1',
      rarity: 6,
      item_name: '限定武器',
      is_standard: false,
      seq_id: '9001',
      game_uid: '1000999999',
      nick_name: '旧账号',
      timestamp: '2026-03-01T00:00:00.000Z'
    }
  ]
}, {
  existingPools: [],
  currentUserId: 'target-user'
});

assert.equal(legacyValidation.valid, true, `旧版 JSON 也应可导入: ${legacyValidation.errors.join('; ')}`);
assert.equal(legacyValidation.normalizedData.pools[0].type, 'weapon', 'limited_weapon 应归一化为运行时 weapon');
assert.equal(legacyValidation.normalizedData.history[0].name, '限定武器', '旧版 item_name 应归一化为运行时 name');
assert.equal(getHistoryImportDedupKey(legacyValidation.normalizedData.history[0]), 'uid:1000999999:pool:weaponbox_1_0_1:seq:9001', '导入 dedupe 应优先使用账号与卡池隔离后的 seqId');
assert.equal(getHistoryImportDedupKey({ seq_id: '9001' }), 'seq:9001', '无账号记录应保持旧 seqId 去重键');

console.log('BUG-030 export/import round-trip verification passed');
