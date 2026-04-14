import assert from 'node:assert/strict';

globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

async function main() {
  const {
    buildCurrentPoolHistoryWithIndex,
    buildGroupedHistory,
  } = await import('../src/hooks/app/useCurrentPoolGroupedHistory.js');
  const { buildSinglePoolTimelineSection } = await import('../src/utils/poolTimelineView.js');

  const mixedPoolHistory = [
    {
      id: 'late-import-record',
      seq_id: 5,
      timestamp: '2026-02-04T21:36:56+08:00',
      rarity: 6,
      pool_id: 'pool-old',
      isStandard: true,
      character_name: '艾尔薇拉',
    },
    {
      id: 'new-pool-hit-1',
      seq_id: 1,
      timestamp: '2026-02-13T10:40:14+08:00',
      rarity: 6,
      pool_id: 'pool-42',
      isStandard: true,
      character_name: '艾尔薇拉',
    },
    {
      id: 'new-pool-hit-2',
      seq_id: 2,
      timestamp: '2026-02-13T11:00:36+08:00',
      rarity: 6,
      pool_id: 'pool-42',
      isStandard: false,
      character_name: '莱万汀',
    },
  ];

  const indexedHistory = buildCurrentPoolHistoryWithIndex(mixedPoolHistory);
  assert.deepEqual(
    indexedHistory.map(item => item.pool_id),
    ['pool-old', 'pool-42', 'pool-42'],
    '当前池历史应按时间升序编号，而不是按 record id 排序',
  );

  const groupedHistory = buildGroupedHistory(indexedHistory);
  assert.equal(
    groupedHistory[0][0].pool_id,
    'pool-42',
    '聚合日志最新一组应先展示 42 池记录，避免“全部限定池”把新池顶掉',
  );

  const timelineHistory = [
    {
      id: 'support-1',
      seq_id: 11,
      timestamp: '2026-01-28T12:00:00+08:00',
      rarity: 5,
      pool_id: 'pool-lev',
      character_name: '陈千语',
    },
    {
      id: 'support-2',
      seq_id: 12,
      timestamp: '2026-02-01T12:00:00+08:00',
      rarity: 5,
      pool_id: 'pool-lev',
      character_name: '大酒',
    },
    {
      id: 'off-hit',
      seq_id: 13,
      timestamp: '2026-02-04T21:36:56+08:00',
      rarity: 6,
      pool_id: 'pool-lev',
      isStandard: true,
      character_name: '艾尔薇拉',
    },
    {
      id: 'up-hit',
      seq_id: 14,
      timestamp: '2026-02-04T22:07:37+08:00',
      rarity: 6,
      pool_id: 'pool-lev',
      isStandard: false,
      character_name: '莱万汀',
    },
  ];

  const timelineSection = buildSinglePoolTimelineSection({
    pool: {
      id: 'pool-lev',
      name: '熔火灼痕',
      type: 'limited',
      up_character: '莱万汀',
      start_time: '2026-01-22T12:00:00+08:00',
      end_time: '2026-02-07T12:00:00+08:00',
    },
    history: timelineHistory,
    currentPityOverride: 0,
    currentPity5Override: 0,
  });

  assert.equal(timelineSection.entries[0].dateLabel, '02-04', '最新命中节点应显示真实出货日期');
  assert.equal(
    timelineSection.entries[1].dateLabel,
    '02-04',
    '偏移节点日期应取 6★ 实际出货时间，不能回退到阶段起始的 5★ 日期',
  );

  const freeTenHistory = Array.from({ length: 10 }, (_, index) => ({
    id: `free-ten-${index + 1}`,
    seq_id: 30 + index,
    timestamp: `2026-02-05T12:${String(index).padStart(2, '0')}:00+08:00`,
    rarity: index === 3 ? 5 : index === 7 ? 6 : 4,
    pool_id: 'pool-lev',
    is_free: true,
    isStandard: index === 7 ? false : undefined,
    character_name: index === 3 ? '陈千语' : index === 7 ? '莱万汀' : `素材${index + 1}`,
  }));

  const freeTenSection = buildSinglePoolTimelineSection({
    pool: {
      id: 'pool-lev',
      name: '熔火灼痕',
      type: 'limited',
      up_character: '莱万汀',
      start_time: '2026-01-22T12:00:00+08:00',
      end_time: '2026-02-07T12:00:00+08:00',
    },
    history: freeTenHistory,
    currentPityOverride: 0,
    currentPity5Override: 0,
  });

  assert.equal(freeTenSection.entries.length, 1, '免费十连应合并成单个时间线节点');
  assert.equal(freeTenSection.entries[0].stageLabel, '免费十连', '免费节点应直接标记为免费十连');
  assert.match(
    freeTenSection.entries[0].resultSummary,
    /莱万汀/,
    '免费十连节点应保留整组结果摘要，而不是在 6★ 处切段',
  );

  const simulatorStyleSection = buildSinglePoolTimelineSection({
    pool: {
      id: 'sim-pool-lev',
      name: '熔火灼痕 [模拟]',
      type: 'limited',
      up_character: '莱万汀',
    },
    history: [
      {
        pullNumber: 1,
        rarity: 6,
        isUp: true,
        characterName: '莱万汀',
        timestamp: '2026-02-06T12:00:00+08:00',
      },
    ],
    currentPityOverride: 0,
    currentPity5Override: 0,
  });

  assert.equal(
    simulatorStyleSection.entries[0].leadBadge.label,
    '莱万汀',
    '模拟器分享时间线应兼容 characterName 字段，不能回退成“未知目标”',
  );
  assert.match(
    simulatorStyleSection.entries[0].resultSummary,
    /莱万汀/,
    '模拟器分享时间线摘要应展示模拟器历史里的具体角色名',
  );

  console.log('dashboard ordering verification passed');
}

main().catch((error) => {
  console.error('[verify-dashboard-ordering-bugs] Failed:', error);
  process.exitCode = 1;
});
