import assert from 'node:assert/strict';
import {
  buildDashboardSharePayload,
  buildDashboardShareText,
  buildDashboardShareCardFileName,
} from '../src/utils/dashboardShare.js';

const TOP_LEVEL_KEYS = [
  'averageGroups',
  'averageItems',
  'featured',
  'hasMergedAccountView',
  'notes',
  'overviewFilterLabel',
  'periodLabel',
  'pitySummary',
  'poolName',
  'poolType',
  'poolTypeLabel',
  'scopeLabel',
  'summaryGroups',
  'summaryItems',
  'totalNodes',
  'totalSections',
];

const SUMMARY_ITEM_KEYS = ['hint', 'id', 'label', 'value'];
const PITY_SUMMARY_KEYS = ['current5', 'current6', 'inherited5', 'inherited6', 'max5', 'max6', 'probabilityHint'];

function assertAllowedShape(payload) {
  assert.deepEqual(
    Object.keys(payload).sort(),
    [...TOP_LEVEL_KEYS].sort(),
    '详情页分享 payload 顶层字段必须受白名单约束'
  );

  payload.summaryItems.forEach((item) => {
    assert.deepEqual(
      Object.keys(item).sort(),
      [...SUMMARY_ITEM_KEYS].sort(),
      'summaryItems 字段必须受白名单约束'
    );
  });

  payload.averageItems.forEach((item) => {
    assert.deepEqual(
      Object.keys(item).sort(),
      ['id', 'label', 'value'],
      'averageItems 字段必须受白名单约束'
    );
  });

  if (payload.pitySummary) {
    assert.deepEqual(
      Object.keys(payload.pitySummary).sort(),
      [...PITY_SUMMARY_KEYS].sort(),
      'pitySummary 字段必须受白名单约束'
    );
  }
}

function assertNoForbiddenContent(serialized, forbiddenValues) {
  forbiddenValues.forEach((value) => {
    assert.equal(
      serialized.includes(value),
      false,
      `详情页分享内容不应包含敏感值: ${value}`
    );
  });
}

const dangerousPool = {
  name: '余烬回响',
  type: 'limited',
  up_character: '莱万汀',
  user_id: 'user-123',
  game_uid: '1000123456',
  creator_username: 'DangerAdmin',
  creator_role: 'super_admin',
  timestamp: '2026-03-21T08:00:00.000Z',
};

const payload = buildDashboardSharePayload({
  currentPool: dangerousPool,
  normalizedPoolType: 'limited',
  stats: {
    total: 137,
    totalSixStar: 3,
    winRate: '66.7',
    counts: { 6: 2, '6_std': 1, 5: 14, 4: 120 },
    avgPullCost: {
      5: 9.79,
      6: 68.5,
      '6_all': 45.67,
      '6_limited': 68.5,
    },
  },
  analysisPity: {
    displayPity6: 64,
    maxPity6: 80,
    displayPity5: 7,
    maxPity5: 10,
    normalizedType: 'limited',
    isInherited6: true,
    isInherited5: false,
  },
  sections: [
    {
      period: '2026.03.01 - 2026.03.21',
      entries: [
        { label: '莱万汀', timestamp: '2026-03-03T09:00:00.000Z' },
        { label: '常驻角色', timestamp: '2026-03-18T10:00:00.000Z' },
      ],
    },
  ],
});

assertAllowedShape(payload);
assert.equal(payload.featured, '莱万汀');
assert.equal(payload.totalNodes, 2);
assert.match(payload.notes, /已脱敏分享卡/);

const overviewPayload = buildDashboardSharePayload({
  currentPool: {
    ...dangerousPool,
    name: '全部卡池总览',
    up_character: null,
  },
  normalizedPoolType: 'limited',
  isAllPoolsOverview: true,
  overviewPoolFilter: 'all',
  stats: {
    total: 260,
    totalSixStar: 6,
    winRate: '50.0',
    counts: { 6: 3, '6_std': 3, 5: 22, 4: 190 },
    avgPullCost: {
      5: 11.8,
      6: 74.0,
      '6_all': 43.3,
      '6_limited': 74.0,
    },
  },
  sections: [
    { period: '角色池阶段', entries: [{ label: '莱万汀' }] },
    { period: '武器池阶段', entries: [{ label: '熔铸火焰' }] },
  ],
  overviewSplitStats: {
    character: {
      total: 180,
      totalSixStar: 4,
      winRate: '66.7',
      counts: { 6: 2, '6_std': 2, 5: 18, 4: 140 },
      avgPullCost: { 5: 10.0, 6: 70.0, '6_all': 45.0, '6_limited': 70.0 },
    },
    weapon: {
      total: 80,
      totalSixStar: 2,
      winRate: '50.0',
      counts: { 6: 1, '6_std': 1, 5: 4, 4: 50 },
      avgPullCost: { 5: 16.0, 6: 80.0, '6_all': 40.0, '6_limited': 80.0 },
    },
  },
});

assertAllowedShape(overviewPayload);
assert.equal(overviewPayload.summaryGroups?.length, 2, '全部卡池总览应拆分角色池/武器池统计');
assert.equal(overviewPayload.averageGroups?.length, 2, '全部卡池总览应拆分角色池/武器池平均出货');

const shareText = buildDashboardShareText(payload);
const overviewText = buildDashboardShareText(overviewPayload);
const fileName = buildDashboardShareCardFileName(payload);

assert.match(shareText, /已脱敏分享卡/);
assert.match(shareText, /当前 6★ 保底：64\/80/);
assert.match(overviewText, /角色池汇总/);
assert.match(overviewText, /武器池汇总/);
assert.match(fileName, /^终末地卡池分析分享卡_/);

const serializedContent = [
  JSON.stringify(payload),
  JSON.stringify(overviewPayload),
  shareText,
  overviewText,
  fileName,
].join('\n');

assertNoForbiddenContent(serializedContent, [
  'user-123',
  '1000123456',
  'DangerAdmin',
  'super_admin',
  '2026-03-21T08:00:00.000Z',
  'creator_username',
  'creator_role',
  'game_uid',
  'user_id',
  'timestamp',
]);

console.log('FEAT-022 dashboard share verification passed');
