import { LIMITED_POOL_RULES, STANDARD_POOL_RULES, WEAPON_POOL_RULES } from '../../constants/index.js';
import { calculateCurrentProbability } from '../../utils/validators.js';
import { normalizeSimulatorPoolType } from './simulatorInheritance.js';

export function getSimulatorRules(normalizedPoolType, customRules = null) {
  if (customRules) {
    return customRules;
  }

  if (normalizedPoolType === 'weapon') {
    return WEAPON_POOL_RULES;
  }

  if (normalizedPoolType === 'standard') {
    return STANDARD_POOL_RULES;
  }

  return LIMITED_POOL_RULES;
}

export function buildCurrentTargetProbabilityInfo({
  guaranteedLimitedPity = 0,
  hasReceivedGuaranteedLimited = false,
  currentPity = 0,
  poolType = 'limited',
  customRules = null
}) {
  const normalizedPoolType = normalizeSimulatorPoolType(poolType);
  if (normalizedPoolType !== 'limited' && normalizedPoolType !== 'weapon') {
    return null;
  }

  const rules = getSimulatorRules(normalizedPoolType, customRules);
  const sixStarProbabilityInfo = calculateCurrentProbability(currentPity, normalizedPoolType);
  const hardGuaranteeThreshold = Number(rules?.guaranteedLimitedPity || 0);
  const currentGuaranteedCounter = Number(guaranteedLimitedPity || 0);
  const isHardGuaranteeNextPull = hardGuaranteeThreshold > 0
    && !hasReceivedGuaranteedLimited
    && currentGuaranteedCounter + 1 >= hardGuaranteeThreshold;
  const targetRate = isHardGuaranteeNextPull ? 1 : Number(rules?.upProbability || 0);

  return {
    label: normalizedPoolType === 'weapon' ? '目标武器' : 'UP角色',
    probability: isHardGuaranteeNextPull ? 1 : sixStarProbabilityInfo.probability * targetRate,
    sixStarProbability: isHardGuaranteeNextPull ? 1 : sixStarProbabilityInfo.probability,
    targetRate,
    isHardGuaranteeNextPull
  };
}

export default {
  buildCurrentTargetProbabilityInfo,
  getSimulatorRules
};
