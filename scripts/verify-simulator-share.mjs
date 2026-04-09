import assert from 'node:assert/strict';
import {
  buildSimulatorSharePayload,
  buildSimulatorShareText,
} from '../src/utils/simulatorShare.js';
import { SHARE_BRAND_LINK } from '../src/utils/shareBranding.js';

const TOP_LEVEL_KEYS = [
  'avgPullsPerSixStar',
  'currentPity5',
  'currentPity6',
  'fiveStarCount',
  'fiveStarRate',
  'guaranteeProgress',
  'poolName',
  'poolType',
  'poolTypeLabel',
  'resourceItems',
  'sixStarCount',
  'sixStarRate',
  'totalPulls',
  'upCharacter',
  'upSixStarCount',
  'winRate',
];

const GUARANTEE_KEYS = ['achieved', 'current', 'label', 'summary', 'target'];
const RESOURCE_ITEM_KEYS = ['hint', 'id', 'label', 'value'];

function assertAllowedShape(payload) {
  assert.deepEqual(
    Object.keys(payload).sort(),
    [...TOP_LEVEL_KEYS].sort(),
    'share payload 顶层字段必须严格受白名单约束'
  );

  assert.deepEqual(
    Object.keys(payload.guaranteeProgress).sort(),
    [...GUARANTEE_KEYS].sort(),
    'share payload.guaranteeProgress 字段必须严格受白名单约束'
  );

  payload.resourceItems.forEach((item) => {
    assert.deepEqual(
      Object.keys(item).sort(),
      [...RESOURCE_ITEM_KEYS].sort(),
      'share payload.resourceItems 字段必须严格受白名单约束'
    );
  });
}

function assertNoForbiddenContent(serialized, forbiddenValues) {
  forbiddenValues.forEach((value) => {
    assert.equal(
      serialized.includes(value),
      false,
      `分享内容不应包含敏感值: ${value}`
    );
  });
}

const dangerousPoolMeta = {
  userId: 'user-123',
  gameUid: '1000123456',
  nickName: '测试博士',
  timestamp: '2026-03-14T09:00:00.000Z',
  resourceLedger: { jade: 99999 },
  sixStarHistory: [{ pityWhenPulled: 70 }],
};

const limitedPayload = buildSimulatorSharePayload({
  currentPoolObj: {
    type: 'limited',
    name: '余烬回响',
    up_character: '莱万汀',
    ...dangerousPoolMeta,
  },
  dashboardStats: {
    total: 137,
    sixStarCount: 3,
    counts: { 5: 14 },
    upSixStarCount: 2,
    winRate: '66.67',
    currentPity: 24,
    currentPity5: 6,
    sixStarHistory: dangerousPoolMeta.sixStarHistory,
    resourceLedger: dangerousPoolMeta.resourceLedger,
  },
  pityInfoWithGuarantee: {
    guaranteedUp: {
      current: 120,
      hasReceived: true,
    },
  },
  resourceLedger: {
    jadeSpent: 68500,
    originiteEquivalent: 913.3,
    arsenalGained: 5200,
    arsenalSpent: 1980,
  },
});

assertAllowedShape(limitedPayload);
assert.equal(limitedPayload.guaranteeProgress.label, '120抽必出限定');
assert.equal(limitedPayload.guaranteeProgress.target, 120);
assert.equal(limitedPayload.guaranteeProgress.summary, '已达成');
assert.equal(limitedPayload.upSixStarCount, 2);
assert.equal(limitedPayload.winRate, '66.67');
assert.equal(limitedPayload.resourceItems.length, 4);

const weaponPayload = buildSimulatorSharePayload({
  currentPoolObj: {
    type: 'weapon',
    name: '棱镜武备',
    up_character: '炽刃系统',
    ...dangerousPoolMeta,
  },
  dashboardStats: {
    total: 52,
    sixStarCount: 2,
    counts: { 5: 5 },
    upSixStarCount: 1,
    winRate: '50.00',
    currentPity: 18,
    currentPity5: 2,
  },
  pityInfoWithGuarantee: {
    guaranteedUp: {
      current: 52,
      hasReceived: false,
    },
  },
  resourceLedger: {
    jadeSpent: 12500,
    originiteEquivalent: 166.7,
    arsenalGained: 600,
    arsenalSpent: 10296,
  },
});

assertAllowedShape(weaponPayload);
assert.equal(weaponPayload.guaranteeProgress.label, '80抽首轮限定必出');
assert.equal(weaponPayload.guaranteeProgress.target, 80);
assert.equal(weaponPayload.guaranteeProgress.summary, '52/80');

const standardPayload = buildSimulatorSharePayload({
  currentPoolObj: {
    type: 'standard',
    name: '基础甄选',
    up_character: null,
    ...dangerousPoolMeta,
  },
  dashboardStats: {
    total: 211,
    sixStarCount: 4,
    counts: { 5: 19 },
    upSixStarCount: 0,
    winRate: '0.00',
    currentPity: 31,
    currentPity5: 4,
  },
  pityInfoWithGuarantee: {},
  resourceLedger: {
    jadeSpent: 105500,
    originiteEquivalent: 1406.7,
    arsenalGained: 9400,
    arsenalSpent: 0,
  },
});

assertAllowedShape(standardPayload);
assert.equal(standardPayload.upSixStarCount, null);
assert.equal(standardPayload.winRate, null);
assert.equal(standardPayload.guaranteeProgress.label, '300抽自选进度');
assert.equal(standardPayload.guaranteeProgress.target, 300);
assert.equal(standardPayload.guaranteeProgress.summary, '211/300');

const limitedText = buildSimulatorShareText(limitedPayload);
const weaponText = buildSimulatorShareText(weaponPayload);
const standardText = buildSimulatorShareText(standardPayload);

assert.match(limitedText, /已脱敏分享卡/);
assert.match(weaponText, /80抽首轮限定必出：52\/80/);
assert.match(standardText, /300抽自选进度：211\/300/);
assert.match(limitedText, /耗金玉：68,500（角色池计费）/);
assert.match(limitedText, /衍质折金玉：913\.3（按当前换算比例）/);
assert.match(limitedText, /得武库配额：5,200（4★ \/ 5★ \/ 6★ 转化）/);
assert.match(limitedText, /耗武库配额：1,980（武器池计费）/);
assert.match(limitedText, new RegExp(SHARE_BRAND_LINK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const serializedPayloads = [
  JSON.stringify(limitedPayload),
  JSON.stringify(weaponPayload),
  JSON.stringify(standardPayload),
  limitedText,
  weaponText,
  standardText,
].join('\n');

assertNoForbiddenContent(serializedPayloads, [
  'user-123',
  '1000123456',
  '测试博士',
  '2026-03-14T09:00:00.000Z',
  'resourceLedger',
  'sixStarHistory',
  'timestamp',
  'userId',
  'gameUid',
  'nickName',
]);

console.log('FEAT-003 simulator share verification passed');
