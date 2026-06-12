/**
 * 计算武器池第 4 次申领触发 6★ 保底时，申领内至少出现一个目标武器的概率。
 *
 * 保底申领等价于 claimSize - 1 个普通槽位 + 1 个强制 6★ 槽位：
 * - 普通槽位命中目标武器的概率为 sixStarBaseProbability × upProbability
 * - 强制 6★ 槽位命中目标武器的概率为 upProbability
 *
 * @param {Object} options - 武器池规则参数
 * @param {number} options.sixStarBaseProbability - 普通槽位 6★ 概率
 * @param {number} options.upProbability - 6★ 为目标武器的条件概率
 * @param {number} options.claimSize - 单次申领槽位数
 * @returns {number} 保底申领命中目标武器的概率（0-1）
 */
export function calculateWeaponSixStarPityTargetProbability({
  sixStarBaseProbability = 0.04,
  upProbability = 0.25,
  claimSize = 10
} = {}) {
  const normalizedClaimSize = Math.max(1, Math.floor(Number(claimSize) || 10));
  const baseProbability = Number(sixStarBaseProbability);
  const targetRate = Number(upProbability);

  return 1 - (1 - targetRate) * Math.pow(1 - baseProbability * targetRate, normalizedClaimSize - 1);
}

export default {
  calculateWeaponSixStarPityTargetProbability
};
