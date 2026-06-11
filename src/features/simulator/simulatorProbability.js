import { LIMITED_POOL_RULES, STANDARD_POOL_RULES, WEAPON_POOL_RULES } from '../../constants/index.js';
import { calculateWeaponSixStarPityTargetProbability } from '../../utils/weaponPoolProbability.js';
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
  const hardGuaranteeThreshold = Number(rules?.guaranteedLimitedPity || 0);
  const currentGuaranteedCounter = Number(guaranteedLimitedPity || 0);
  const claimSize = normalizedPoolType === 'weapon' ? Number(rules?.claimSize || 10) : 1;
  const isHardGuaranteeNextPull = hardGuaranteeThreshold > 0
    && !hasReceivedGuaranteedLimited
    && currentGuaranteedCounter + claimSize >= hardGuaranteeThreshold;
  const targetRate = isHardGuaranteeNextPull ? 1 : Number(rules?.upProbability || 0);

  if (normalizedPoolType === 'weapon') {
    const baseSixStarProbability = Number(rules?.sixStarBaseProbability || 0);
    const isSixStarGuaranteeNextClaim = Number(currentPity || 0) + claimSize >= Number(rules?.sixStarPity || 0);
    const naturalSixStarProbability = 1 - ((1 - baseSixStarProbability) ** claimSize);
    const naturalTargetProbability = 1 - ((1 - baseSixStarProbability * Number(rules?.upProbability || 0)) ** claimSize);
    const probability = isHardGuaranteeNextPull
      ? 1
      : isSixStarGuaranteeNextClaim
        ? calculateWeaponSixStarPityTargetProbability({
          sixStarBaseProbability: baseSixStarProbability,
          upProbability: Number(rules?.upProbability || 0),
          claimSize
        })
        : naturalTargetProbability;

    return {
      label: '目标武器',
      probability,
      sixStarProbability: isHardGuaranteeNextPull || isSixStarGuaranteeNextClaim ? 1 : naturalSixStarProbability,
      targetRate,
      isHardGuaranteeNextPull,
      unit: 'claim'
    };
  }

  const sixStarProbabilityInfo = calculateCurrentProbability(currentPity, normalizedPoolType);

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
