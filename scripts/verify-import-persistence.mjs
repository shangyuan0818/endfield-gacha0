import assert from 'node:assert/strict';
import {
  filterImportedHistoryRecords,
  prepareOfficialImportPersistenceData,
} from '../src/features/import/importPersistence.js';

const poolAliases = {
  special_alias_alpha: 'special_1_0_1',
  special_1_0_1: 'special_1_0_1',
};

const characterAliases = {
  char_alias_alpha: 'char_alpha',
};

const records = [
  {
    pool_id: 'special_alias_alpha',
    pool_name: '限定测试池',
    name: '莱万汀',
    character_id: 'char_alias_alpha',
    rarity: 6,
    isLimited: true,
    batchId: 'batch-1',
    seqId: '1001',
    pity: 79,
    isNew: true,
    isFree: false,
    timestamp: '2026-03-10T08:00:00.000Z',
  },
  {
    pool_id: 'special_1_0_1',
    pool_name: '限定测试池',
    name: '五星角色',
    character_id: 'five_star_alias',
    rarity: 5,
    isLimited: true,
    batchId: 'batch-1',
    seqId: '1002',
    pity: 10,
    isNew: false,
    isFree: false,
    timestamp: '2026-03-10T08:00:10.000Z',
  },
];

const pools = [
  {
    id: 'special_1_0_1',
    pool_id: 'special_1_0_1',
    type: 'limited',
    up_character: '莱万汀',
  },
];

const prepared = await prepareOfficialImportPersistenceData({
  records,
  userInfo: {
    gameUid: '1000123456',
    nickName: '测试账号',
  },
  pools,
  poolAliases,
  characterAliases,
});

assert.equal(prepared.currentGameUid, '1000123456', '应保留当前导入账号 UID');
assert.equal(prepared.poolEntries.length, 1, '指向同一 canonical 池的 alias 不应重复创建卡池目录');
assert.equal(prepared.poolEntries[0].id, 'special_1_0_1', '卡池目录应写入 canonical pool id');
assert.equal(prepared.historyRecords.length, 2, '应保留全部导入记录用于后续去重');
assert.equal(prepared.historyRecords[0].poolId, 'special_1_0_1', '历史记录应归一化到 canonical pool id');
assert.equal(prepared.historyRecords[0].character_id, 'char_alpha', '角色别名应被归一化');
assert.equal(prepared.historyRecords[0].isStandard, false, '限定 UP 6 星不应被误标为歪');
assert.equal(prepared.historyRecords[1].gameUid, '1000123456', '历史记录应带上导入账号 UID');
assert.equal(prepared.historyRecords[1].nickName, '测试账号', '历史记录应带上导入账号昵称');

const { newRecords, duplicateCount } = filterImportedHistoryRecords(
  prepared.historyRecords,
  new Set(['1000123456:special_1_0_1:1001'])
);

assert.equal(newRecords.length, 1, '已有 seq 记录应在前端去重阶段被过滤');
assert.equal(duplicateCount, 1, '去重统计应正确计数');
assert.equal(newRecords[0].seqId, '1002', '未命中去重键的记录应保留');

const jointPrepared = await prepareOfficialImportPersistenceData({
  records: [
    {
      pool_id: 'joint_1_2_2',
      pool_name: '辉光庆典',
      name: '洁尔佩塔',
      character_id: 'chr_0013_aglina',
      rarity: 6,
      isLimited: false,
      batchId: 'batch-joint',
      seqId: '682',
      pity: 40,
      isNew: false,
      isFree: false,
      timestamp: '2026-05-14T08:00:00.000Z',
    },
  ],
  userInfo: {
    gameUid: '1000123456',
    nickName: '测试账号',
  },
  pools: [],
});

assert.equal(jointPrepared.poolEntries.length, 1, 'Joint 官方池应创建一个 canonical 卡池目录');
assert.equal(jointPrepared.poolEntries[0].id, 'joint_1_2_2', 'Joint 卡池目录应保留官方 poolId');
assert.equal(jointPrepared.poolEntries[0].type, 'extra', 'Joint 官方池应归一化为 extra');
assert.equal(jointPrepared.historyRecords[0].poolId, 'joint_1_2_2', 'Joint 历史记录应保留卡池维度去重键');
assert.equal(jointPrepared.historyRecords[0].isStandard, false, '附加寻访 6 星不应因缺少单 UP 而标为常驻歪出');

const camelCasePrepared = await prepareOfficialImportPersistenceData({
  records: [
    {
      poolId: 'special_2_0_1',
      poolName: '新版本限定池',
      charId: 'char_new_official',
      charName: '新角色',
      rarity: 6,
      seqId: '2001',
      pity: 62,
      timestamp: '2026-06-05T08:00:00.000Z',
    },
    {
      poolId: 'weaponbox_2_0_1',
      poolName: '新版本武器池',
      weaponId: 'weapon_new_official',
      weaponName: '新武器',
      rarity: 6,
      seqId: '2002',
      pity: 45,
      timestamp: '2026-06-05T08:00:10.000Z',
    },
  ],
  userInfo: {
    gameUid: '1000123456',
    nickName: '测试账号',
  },
  pools: [],
});

assert.equal(camelCasePrepared.poolEntries.length, 2, '官方 camelCase poolId 应能创建 canonical 卡池目录');
assert.equal(camelCasePrepared.poolEntries[0].id, 'special_2_0_1', '应直接读取官方 poolId');
assert.equal(camelCasePrepared.historyRecords[0].character_id, 'char_new_official', '应直接读取官方 charId');
assert.equal(camelCasePrepared.historyRecords[1].character_id, 'weapon_new_official', '应直接读取官方 weaponId');

console.log('ARCH-020 import persistence verification passed');
