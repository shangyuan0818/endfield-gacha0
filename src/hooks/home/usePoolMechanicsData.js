import { useMemo } from 'react';
import { characterCache, getPoolCharacters } from '../../utils/characterUtils';

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

const getFeaturedCharacters = (currentUpInfo) => {
  const featuredCharacters = Array.isArray(currentUpInfo?.poolData?.featured_characters)
    ? currentUpInfo.poolData.featured_characters.filter(Boolean)
    : [];

  return currentUpInfo?.name
    ? [currentUpInfo.name, ...featuredCharacters.filter((name) => name !== currentUpInfo.name)]
    : featuredCharacters;
};

const buildCharacterSet = (fallbackCharacters, dynamicCharacters, priorityNames = [], leadingName = null) => {
  const orderedDynamicCharacters = mergePriorityNames(dynamicCharacters, priorityNames);
  const baseCharacters = orderedDynamicCharacters.length > 0 ? orderedDynamicCharacters : fallbackCharacters;
  const finalCharacters = mergePriorityNames(baseCharacters, priorityNames);

  return leadingName ? ensureLeadingCharacter(finalCharacters, leadingName) : finalCharacters;
};

export default function usePoolMechanicsData(currentUpInfo) {
  return useMemo(() => {
    const currentUpName = currentUpInfo?.name || FALLBACK_LIMITED_CHARACTERS.sixStar[0];
    const poolContext = getPoolContext(currentUpInfo);
    const featuredCharacters = getFeaturedCharacters(currentUpInfo);
    const hasCharacterData = characterCache.isLoaded() && characterCache.getAll().length > 0;

    if (!hasCharacterData) {
      return {
        limitedCharacters: {
          sixStar: buildCharacterSet(
            FALLBACK_LIMITED_CHARACTERS.sixStar,
            [],
            featuredCharacters,
            currentUpName
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

    const limitedCharacters = {
      sixStar: buildCharacterSet(
        FALLBACK_LIMITED_CHARACTERS.sixStar,
        mapCharacterNames(getPoolCharacters('limited', 6, true, poolContext)),
        featuredCharacters,
        currentUpName
      ),
      fiveStar: buildCharacterSet(
        FALLBACK_LIMITED_CHARACTERS.fiveStar,
        mapCharacterNames(getPoolCharacters('limited', 5, true, poolContext)),
        featuredCharacters
      ),
      fourStar: buildCharacterSet(
        FALLBACK_LIMITED_CHARACTERS.fourStar,
        mapCharacterNames(getPoolCharacters('limited', 4, true, poolContext)),
        featuredCharacters
      ),
    };

    const standardCharacters = {
      sixStar: buildCharacterSet(
        FALLBACK_STANDARD_CHARACTERS.sixStar,
        mapCharacterNames(getPoolCharacters('standard', 6, false))
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
      limitedCharacters,
      standardCharacters,
    };
  }, [currentUpInfo]);
}
