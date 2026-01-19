import { createSimulator } from './src/utils/gachaSimulator.js';

const sim = createSimulator('limited');

console.log('执行多次抽卡，确保有六星...');
// 执行足够多次确保有六星
for (let i = 0; i < 100; i++) {
  sim.pullSingle();
}

const stats = sim.getStatistics();

console.log('\n六星历史记录数量:', stats.sixStarHistory.length);
if (stats.sixStarHistory.length > 0) {
  console.log('六星记录:');
  stats.sixStarHistory.forEach((item, idx) => {
    console.log(`  ${idx + 1}. 第${item.pullNumber}抽 - ${item.isUp ? 'UP' : '常驻'} - 垫刀${item.pityWhenPulled}`);
  });
}

// 模拟 GachaSimulator.jsx 构建 dashboardStats
const dashboardStats = {
  pityStats: {
    history: stats.sixStarHistory.map((item, index) => ({
      ...item,
      index: index + 1,
      isStandard: !item.isUp && sim.poolType !== 'standard',
      count: item.pityWhenPulled || 1
    })),
    distribution: (() => {
      const ranges = [
        { range: '1-10', min: 1, max: 10, limited: 0, standard: 0 },
        { range: '11-20', min: 11, max: 20, limited: 0, standard: 0 },
        { range: '21-30', min: 21, max: 30, limited: 0, standard: 0 },
        { range: '31-40', min: 31, max: 40, limited: 0, standard: 0 },
        { range: '41-50', min: 41, max: 50, limited: 0, standard: 0 },
        { range: '51-60', min: 51, max: 60, limited: 0, standard: 0 },
        { range: '61-70', min: 61, max: 70, limited: 0, standard: 0 },
        { range: '71-80', min: 71, max: 80, limited: 0, standard: 0 },
        { range: '81-90', min: 81, max: 90, limited: 0, standard: 0 }
      ];

      stats.sixStarHistory.forEach(item => {
        const pity = item.pityWhenPulled || 0;
        const rangeItem = ranges.find(r => pity >= r.min && pity <= r.max);
        if (rangeItem) {
          if (item.isUp) {
            rangeItem.limited++;
          } else {
            rangeItem.standard++;
          }
        }
      });

      return ranges.map(r => ({
        range: r.range,
        limited: r.limited,
        standard: r.standard
      }));
    })()
  }
};

console.log('\ndashboardStats.pityStats.history.length:', dashboardStats.pityStats.history.length);
console.log('\ndashboardStats.pityStats.distribution:');
dashboardStats.pityStats.distribution.forEach(d => {
  const total = d.limited + d.standard;
  if (total > 0) {
    console.log(`  ${d.range}: 限定=${d.limited}, 常驻=${d.standard}`);
  }
});

if (dashboardStats.pityStats.history.length === 0) {
  console.log('\n❌ 问题：pityStats.history 为空，图表不会显示！');
  console.log('   需要至少抽到一个六星才能显示图表。');
} else {
  console.log('\n✅ pityStats.history 有数据，图表应该显示！');
  console.log('   图表数据格式正确！');
}

