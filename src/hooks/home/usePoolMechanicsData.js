import { useEffect, useMemo, useState } from 'react';
import { characterCache, getPoolCharacters } from '../../utils/characterUtils';
import { LIMITED_POOL_SCHEDULE } from '../../constants/index.js';
import { resolvePoolRosterBuckets } from '../../utils/poolRoster.js';
import { getPoolFeaturedLead, getPoolFeaturedNames } from '../../utils/poolFeaturedResolver.js';

const FALLBACK_LIMITED_CHARACTERS = {
  sixStar: ['莱万汀', '伊冯', '洁尔佩塔', '余烬', '黎风', '艾尔黛拉', '别礼', '骏卫'],
  fiveStar: ['佩丽卡', '弧光', '艾维文娜', '大潘', '陈千语', '狼卫', '赛希', '昼雪', '阿列什'],
  fourStar: ['秋栗', '卡契尔', '埃特拉', '萤石', '安塔尔'],
};

const FALLBACK_STANDARD_CHARACTERS = {
  sixStar: ['艾尔黛拉', '骏卫', '别礼', '余烬', '黎风'],
  fiveStar: ['佩丽卡', '弧光', '艾维文娜', '大潘', '陈千语', '狼卫', '赛希', '昼雪', '阿列什'],
  fourStar: ['秋栗', '卡契尔', '埃特拉', '萤石', '安塔尔'],
};

const mapCharacterNames = (characters) =>
  characters
    .map((character) => character?.name)
    .filter(Boolean);

const mergePriorityNames = (names, priorityNames = []) => {
  const nameSet = new Set(names);
  const orderedNames = [];
  const seen = new Set();

  priorityNames.forEach((name) => {
    if (name && nameSet.has(name) && !seen.has(name)) {
      orderedNames.push(name);
      seen.add(name);
    }
  });

  names.forEach((name) => {
    if (name && !seen.has(name)) {
      orderedNames.push(name);
      seen.add(name);
    }
  });

  return orderedNames;
};

const ensureLeadingCharacter = (names, leadingName) => {
  if (!leadingName) {
    return names;
  }

  if (names.includes(leadingName)) {
    return [leadingName, ...names.filter((name) => name !== leadingName)];
  }

  return [leadingName, ...names];
};

const sanitizeNames = (names = []) => Array.from(new Set((names || []).filter(Boolean)));

const FALLBACK_REMOVES_AFTER_BY_NAME = Object.fromEntries(
  LIMITED_POOL_SCHEDULE
    .filter((pool) => pool?.name && Number.isFinite(Number(pool?.removesAfter)))
    .map((pool) => [pool.name, Number(pool.removesAfter)])
);

const getCharacterRemovesAfter = (characterName) => {
  if (!characterName) {
    return null;
  }

  const cachedCharacter = characterCache.searchByName(characterName, false)
    || characterCache.searchByName(characterName, true);
  const configuredRemovesAfter = Number(cachedCharacter?.pool_config?.removes_after);
  if (Number.isFinite(configuredRemovesAfter)) {
    return configuredRemovesAfter;
  }

  const fallbackRemovesAfter = Number(FALLBACK_REMOVES_AFTER_BY_NAME[characterName]);
  return Number.isFinite(fallbackRemovesAfter) ? fallbackRemovesAfter : null;
};

const filterLimitedLineupByRotation = (names = [], currentUpInfo) => {
  const currentUpName = currentUpInfo?.name || getPoolFeaturedLead(currentUpInfo?.poolData) || null;
  const rotationPosition = Number(currentUpInfo?.rotationPosition);
  if (!Number.isFinite(rotationPosition)) {
    return sanitizeNames(names);
  }

  return sanitizeNames(names).filter((name) => {
    if (!name || name === currentUpName) {
      return Boolean(name);
    }

    const removesAfter = getCharacterRemovesAfter(name);
    return removesAfter === null || rotationPosition < removesAfter;
  });
};

const getPoolContext = (currentUpInfo) => {
  const startTime = currentUpInfo?.poolData?.start_time || currentUpInfo?.startDate;
  if (!startTime) {
    return null;
  }

  return {
    start_time: startTime,
    rotation_position: currentUpInfo?.rotationPosition,
  };
};

const getCurrentPoolRecordId = (currentUpInfo) => (
  currentUpInfo?.poolData?.id
  || currentUpInfo?.poolData?.pool_id
  || null
);

const getFeaturedCharacters = (currentUpInfo) => {
  const leadName = currentUpInfo?.name || getPoolFeaturedLead(currentUpInfo?.poolData) || null;
  const featuredCharacters = getPoolFeaturedNames(currentUpInfo?.poolData);

  return leadName
    ? [leadName, ...featuredCharacters.filter((name) => name !== leadName)]
    : featuredCharacters;
};

const buildLimitedSixStarSet = (
  currentUpInfo,
  fallbackCharacters,
  activeLimitedCharacters,
  standardSixStarCharacters
) => {
  const currentUpName = currentUpInfo?.name || getPoolFeaturedLead(currentUpInfo?.poolData) || null;
  const explicitLineup = filterLimitedLineupByRotation([
    ...sanitizeNames([
      ...getFeaturedCharacters(currentUpInfo),
      currentUpInfo?.name
    ]),
    ...sanitizeNames(activeLimitedCharacters || [])
  ], currentUpInfo);
  const normalizedStandardCharacters = sanitizeNames(standardSixStarCharacters || []);
  const normalizedFallbackCharacters = sanitizeNames(fallbackCharacters || []);

  const baseLineup = explicitLineup.length > 0
    ? sanitizeNames([
        ...explicitLineup,
        ...normalizedStandardCharacters
      ])
    : sanitizeNames([
        ...normalizedFallbackCharacters
      ]);

  const filteredLineup = sanitizeNames(baseLineup);
  return currentUpName ? ensureLeadingCharacter(filteredLineup, currentUpName) : filteredLineup;
};

const buildCharacterSet = (fallbackCharacters, dynamicCharacters, priorityNames = [], leadingName = null) => {
  const orderedDynamicCharacters = mergePriorityNames(dynamicCharacters, priorityNames);
  const baseCharacters = orderedDynamicCharacters.length > 0 ? orderedDynamicCharacters : fallbackCharacters;
  const finalCharacters = mergePriorityNames(baseCharacters, priorityNames);

  return leadingName ? ensureLeadingCharacter(finalCharacters, leadingName) : finalCharacters;
};

export default function usePoolMechanicsData(currentUpInfo) {
  const [exactPoolRoster, setExactPoolRoster] = useState(null);
  const currentPoolRecordId = getCurrentPoolRecordId(currentUpInfo);

  useEffect(() => {
    let cancelled = false;

    const loadExactPoolRoster = async () => {
      if (!currentPoolRecordId) {
        if (!cancelled) {
          setExactPoolRoster(null);
        }
        return;
      }

      const currentUpName = currentUpInfo?.name || getPoolFeaturedLead(currentUpInfo?.poolData) || null;
      const roster = await resolvePoolRosterBuckets({
        poolId: currentPoolRecordId,
        expectedType: 'character',
        currentUpName,
        poolType: 'limited',
        poolInfo: getPoolContext(currentUpInfo),
        mergeStrategy: 'fill-missing'
      });

      if (cancelled) {
        return;
      }

      if (!roster) {
        setExactPoolRoster(null);
        return;
      }

      setExactPoolRoster({
        sixStar: ensureLeadingCharacter(sanitizeNames(roster.sixStar), currentUpName),
        fiveStar: sanitizeNames(roster.fiveStar),
        fourStar: sanitizeNames(roster.fourStar),
      });
    };

    loadExactPoolRoster();

    return () => {
      cancelled = true;
    };
  }, [currentPoolRecordId, currentUpInfo]);

  const mechanicsData = useMemo(() => {
    const currentUpName = currentUpInfo?.name || getPoolFeaturedLead(currentUpInfo?.poolData) || FALLBACK_LIMITED_CHARACTERS.sixStar[0];
    const poolContext = getPoolContext(currentUpInfo);
    const featuredCharacters = getFeaturedCharacters(currentUpInfo);
    const hasCharacterData = characterCache.isLoaded() && characterCache.getAll().length > 0;

    if (!hasCharacterData) {
      return {
        limitedCharacters: {
          sixStar: buildLimitedSixStarSet(
            currentUpInfo,
            ensureLeadingCharacter(FALLBACK_LIMITED_CHARACTERS.sixStar, currentUpName),
            [],
            FALLBACK_STANDARD_CHARACTERS.sixStar
          ),
          fiveStar: buildCharacterSet(
            FALLBACK_LIMITED_CHARACTERS.fiveStar,
            [],
            featuredCharacters
          ),
          fourStar: buildCharacterSet(
            FALLBACK_LIMITED_CHARACTERS.fourStar,
            [],
            featuredCharacters
          ),
        },
        standardCharacters: FALLBACK_STANDARD_CHARACTERS,
      };
    }

    const activeLimitedSixStarCharacters = getPoolCharacters('limited', 6, true, poolContext)
      .filter((character) => character?.is_limited);
    const standardSixStarCharacters = getPoolCharacters('standard', 6, false);

    const limitedCharacters = {
      sixStar: (exactPoolRoster?.sixStar?.length || 0) >= 2 ? exactPoolRoster.sixStar : buildLimitedSixStarSet(
        currentUpInfo,
        FALLBACK_LIMITED_CHARACTERS.sixStar,
        mapCharacterNames(activeLimitedSixStarCharacters),
        mapCharacterNames(standardSixStarCharacters)
      ),
      fiveStar: exactPoolRoster?.fiveStar || buildCharacterSet(
        FALLBACK_LIMITED_CHARACTERS.fiveStar,
        mapCharacterNames(getPoolCharacters('limited', 5, true, poolContext)),
        featuredCharacters
      ),
      fourStar: exactPoolRoster?.fourStar || buildCharacterSet(
        FALLBACK_LIMITED_CHARACTERS.fourStar,
        mapCharacterNames(getPoolCharacters('limited', 4, true, poolContext)),
        featuredCharacters
      ),
    };

    const standardCharacters = {
      sixStar: buildCharacterSet(
        FALLBACK_STANDARD_CHARACTERS.sixStar,
        mapCharacterNames(standardSixStarCharacters)
      ),
      fiveStar: buildCharacterSet(
        FALLBACK_STANDARD_CHARACTERS.fiveStar,
        mapCharacterNames(getPoolCharacters('standard', 5, false))
      ),
      fourStar: buildCharacterSet(
        FALLBACK_STANDARD_CHARACTERS.fourStar,
        mapCharacterNames(getPoolCharacters('standard', 4, false))
      ),
    };

    return {
      limitedCharacters: {
        ...limitedCharacters,
        sixStar: sanitizeNames(limitedCharacters.sixStar),
        fiveStar: sanitizeNames(limitedCharacters.fiveStar),
        fourStar: sanitizeNames(limitedCharacters.fourStar)
      },
      standardCharacters: {
        sixStar: sanitizeNames(standardCharacters.sixStar),
        fiveStar: sanitizeNames(standardCharacters.fiveStar),
        fourStar: sanitizeNames(standardCharacters.fourStar)
      },
    };
  }, [currentUpInfo, exactPoolRoster]);

  return mechanicsData;
}
