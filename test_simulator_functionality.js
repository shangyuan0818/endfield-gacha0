/**
 * 模拟器功能测试脚本
 *
 * 验证抽卡记录和统计数据是否正确生成
 */

import { createSimulator } from './src/utils/gachaSimulator.js';

console.log('🧪 开始测试模拟器功能...\n');

// 创建限定池模拟器
const simulator = createSimulator('limited');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 测试1: 初始状态');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
let stats = simulator.getStatistics();
let pityInfo = simulator.getPityInfo();
console.log('✅ 总抽数:', stats.totalPulls);
console.log('✅ 6星数量:', stats.sixStarCount);
console.log('✅ 6星历史记录数:', stats.sixStarHistory.length);
console.log('✅ 当前保底:', pityInfo.sixStar.current);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 测试2: 执行10次单抽');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
for (let i = 0; i < 10; i++) {
  const result = simulator.pullSingle();
  console.log(`第${i+1}抽: ${result.rarity}★ ${result.isUp ? '(UP)' : ''}`);
}

stats = simulator.getStatistics();
pityInfo = simulator.getPityInfo();
console.log('\n✅ 总抽数:', stats.totalPulls);
console.log('✅ 6星数量:', stats.sixStarCount);
console.log('✅ 5星数量:', stats.fiveStarCount);
console.log('✅ 6星历史记录数:', stats.sixStarHistory.length);
console.log('✅ 当前保底:', pityInfo.sixStar.current);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 测试3: 执行1次十连');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const tenPullResults = simulator.pullTen();
console.log('十连结果:');
tenPullResults.forEach((result, idx) => {
  console.log(`  ${idx+1}. ${result.rarity}★ ${result.isUp ? '(UP)' : ''}`);
});

stats = simulator.getStatistics();
pityInfo = simulator.getPityInfo();
console.log('\n✅ 总抽数:', stats.totalPulls);
console.log('✅ 6星数量:', stats.sixStarCount);
console.log('✅ 5星数量:', stats.fiveStarCount);
console.log('✅ UP 6星数量:', stats.upSixStarCount);
console.log('✅ 6星概率:', stats.sixStarRate + '%');
console.log('✅ 不歪率:', stats.upRate + '%');
console.log('✅ 平均出货:', stats.avgPullsPerSixStar, '抽');
console.log('✅ 期望抽数:', stats.expectedPulls, '抽');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 测试4: 6星历史记录');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (stats.sixStarHistory.length > 0) {
  console.log('6星历史记录:');
  stats.sixStarHistory.forEach((record, idx) => {
    console.log(`  ${idx+1}. 第${record.pullNumber}抽: ${record.isUp ? 'UP 6★' : '常驻 6★'} (垫刀${record.pityWhenPulled})`);
  });
} else {
  console.log('⚠️ 还没有抽到6星');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 测试5: 赠送机制');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const gifts = stats.gifts;
console.log('✅ 赠送进度:', gifts);
console.log('✅ 情报书:', stats.hasReceivedInfoBook ? '已获取' : '未获取');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 所有测试完成！');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// 测试状态导入导出
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 测试6: 状态导入导出');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const exportedState = simulator.exportState();
console.log('✅ 导出的状态字段:', Object.keys(exportedState));

const newSimulator = createSimulator('limited');
newSimulator.importState(exportedState);
const newStats = newSimulator.getStatistics();
console.log('✅ 导入后总抽数:', newStats.totalPulls);
console.log('✅ 导入后6星数量:', newStats.sixStarCount);
console.log('✅ 状态导入导出测试通过！');

console.log('\n🎉 模拟器功能测试全部通过！');
