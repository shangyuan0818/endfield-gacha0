/**
 * 模拟器规则验证测试
 *
 * 验证不同卡池类型的规则是否正确实现
 *
 * 运行方式: node test_simulator_rules.js
 */

import { createSimulator } from './src/utils/gachaSimulator.js';
import {
  calculateSixStarProbability
} from './src/utils/probabilityEngine.js';
import {
  LIMITED_POOL_RULES,
  WEAPON_POOL_RULES,
  STANDARD_POOL_RULES
} from './src/constants/index.js';

console.log('🧪 开始测试模拟器规则...\n');

// ===== 测试1: 软保底机制 =====
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 测试1: 软保底机制');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 限定池应该有软保底（65抽后+5%/抽）
console.log('\n✅ 限定池（应有软保底）:');
console.log(`  0抽概率: ${(calculateSixStarProbability(0, LIMITED_POOL_RULES) * 100).toFixed(2)}% (预期: 0.80%)`);
console.log(`  64抽概率: ${(calculateSixStarProbability(64, LIMITED_POOL_RULES) * 100).toFixed(2)}% (预期: 0.80%)`);
console.log(`  65抽概率: ${(calculateSixStarProbability(65, LIMITED_POOL_RULES) * 100).toFixed(2)}% (预期: 5.80%)`);
console.log(`  66抽概率: ${(calculateSixStarProbability(66, LIMITED_POOL_RULES) * 100).toFixed(2)}% (预期: 10.80%)`);
console.log(`  80抽概率: ${(calculateSixStarProbability(80, LIMITED_POOL_RULES) * 100).toFixed(2)}% (预期: 100.00%)`);

// 武器池应该无软保底（始终4%）
console.log('\n✅ 武器池（应无软保底）:');
console.log(`  0抽概率: ${(calculateSixStarProbability(0, WEAPON_POOL_RULES) * 100).toFixed(2)}% (预期: 4.00%)`);
console.log(`  20抽概率: ${(calculateSixStarProbability(20, WEAPON_POOL_RULES) * 100).toFixed(2)}% (预期: 4.00%)`);
console.log(`  39抽概率: ${(calculateSixStarProbability(39, WEAPON_POOL_RULES) * 100).toFixed(2)}% (预期: 4.00%)`);
console.log(`  40抽概率: ${(calculateSixStarProbability(40, WEAPON_POOL_RULES) * 100).toFixed(2)}% (预期: 100.00%)`);

// 常驻池应该有软保底（同限定池）
console.log('\n✅ 常驻池（应有软保底）:');
console.log(`  0抽概率: ${(calculateSixStarProbability(0, STANDARD_POOL_RULES) * 100).toFixed(2)}% (预期: 0.80%)`);
console.log(`  65抽概率: ${(calculateSixStarProbability(65, STANDARD_POOL_RULES) * 100).toFixed(2)}% (预期: 5.80%)`);
console.log(`  80抽概率: ${(calculateSixStarProbability(80, STANDARD_POOL_RULES) * 100).toFixed(2)}% (预期: 100.00%)`);

// ===== 测试2: 限定池赠送机制 =====
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎁 测试2: 限定池赠送机制（每240抽）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const limitedSim = createSimulator('limited');
console.log('\n✅ 赠送进度测试:');
console.log(`  239抽:`, limitedSim.checkGifts(239));
console.log(`  240抽:`, limitedSim.checkGifts(240));
console.log(`  241抽:`, limitedSim.checkGifts(241));
console.log(`  480抽:`, limitedSim.checkGifts(480));

// ===== 测试3: 武器池赠送机制 =====
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎁 测试3: 武器池赠送机制（100→180→80交替）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const weaponSim = createSimulator('weapon');
console.log('\n✅ 赠送进度测试:');
console.log(`  99抽:`, weaponSim.checkGifts(99));
console.log(`  100抽 (应送常驻):`, weaponSim.checkGifts(100));
console.log(`  179抽:`, weaponSim.checkGifts(179));
console.log(`  180抽 (应送限定):`, weaponSim.checkGifts(180));
console.log(`  259抽:`, weaponSim.checkGifts(259));
console.log(`  260抽 (应送常驻):`, weaponSim.checkGifts(260));
console.log(`  339抽:`, weaponSim.checkGifts(339));
console.log(`  340抽 (应送限定):`, weaponSim.checkGifts(340));
console.log(`  420抽 (应送常驻):`, weaponSim.checkGifts(420));
console.log(`  500抽 (应送限定):`, weaponSim.checkGifts(500));

// ===== 测试4: 常驻池自选赠送 =====
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎁 测试4: 常驻池自选赠送（300抽，仅1次）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const standardSim = createSimulator('standard');
console.log('\n✅ 赠送进度测试:');
console.log(`  299抽:`, standardSim.checkGifts(299));
console.log(`  300抽 (应送自选):`, standardSim.checkGifts(300));
console.log(`  301抽:`, standardSim.checkGifts(301));
console.log(`  600抽:`, standardSim.checkGifts(600));

// ===== 测试5: 模拟器规则自动选择 =====
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚙️  测试5: 模拟器规则自动选择');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const limitedTest = createSimulator('limited');
const weaponTest = createSimulator('weapon');
const standardTest = createSimulator('standard');

console.log('\n✅ 规则验证:');
console.log(`  限定池硬保底: ${limitedTest.rules.guaranteedLimitedPity} (预期: 120)`);
console.log(`  限定池6星保底: ${limitedTest.rules.sixStarPity} (预期: 80)`);
console.log(`  限定池6星基础概率: ${(limitedTest.rules.sixStarBaseProbability * 100).toFixed(2)}% (预期: 0.80%)`);

console.log(`\n  武器池硬保底: ${weaponTest.rules.guaranteedLimitedPity} (预期: 80)`);
console.log(`  武器池6星保底: ${weaponTest.rules.sixStarPity} (预期: 40)`);
console.log(`  武器池6星基础概率: ${(weaponTest.rules.sixStarBaseProbability * 100).toFixed(2)}% (预期: 4.00%)`);
console.log(`  武器池有软保底: ${weaponTest.rules.hasSoftPity} (预期: false)`);

console.log(`\n  常驻池自选阈值: ${standardTest.rules.selectGiftThreshold} (预期: 300)`);
console.log(`  常驻池6星保底: ${standardTest.rules.sixStarPity} (预期: 80)`);
console.log(`  常驻池6星基础概率: ${(standardTest.rules.sixStarBaseProbability * 100).toFixed(2)}% (预期: 0.80%)`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ 所有测试完成！');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
