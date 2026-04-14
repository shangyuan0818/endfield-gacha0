import { supabase } from '../supabaseClient.js';
import { characterCache } from './characterUtils.js';

function normalizeName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function inferExpectedPoolKey(expectedType) {
  return expectedType === 'weapon' ? 'weapon' : 'limited';
}

function isCharacterSupportedForPool(character, expectedType) {
  if (!character?.name) {
    return false;
  }

  const cachedCharacter = characterCache.searchByName(character.name, false)
    || characterCache.searchByName(character.name, true);

  if (!cachedCharacter?.pool_config?.pools) {
    return true;
  }

  const pools = cachedCharacter.pool_config.pools;
  const expectedPoolKey = inferExpectedPoolKey(expectedType);
  return pools.includes(expectedPoolKey) || pools.includes('standard');
}

function dedupeNames(items = []) {
  const seen = new Set();
  const output = [];
  items.forEach((item) => {
    const normalized = normalizeName(item);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
}

function ensureLeadingName(items = [], leadingName = null) {
  const normalizedLeading = normalizeName(leadingName);
  if (!normalizedLeading) {
    return dedupeNames(items);
  }

  const deduped = dedupeNames(items);
  if (!deduped.includes(normalizedLeading)) {
    return [normalizedLeading, ...deduped];
  }

  return [normalizedLeading, ...deduped.filter((item) => item !== normalizedLeading)];
}

function buildBucketsFromPoolCharacters(records = [], { expectedType = 'character', currentUpName = null } = {}) {
  const buckets = {
    up: [],
    offBanner: [],
    sixStar: [],
    fiveStar: [],
    fourStar: [],
    items: []
  };

  records.forEach((record) => {
    const character = record?.characters;
    if (!character || character.type !== expectedType || !isCharacterSupportedForPool(character, expectedType)) {
      return;
    }

    const normalizedName = normalizeName(character.name);
    if (!normalizedName) {
      return;
    }

    const normalizedCurrentUp = normalizeName(currentUpName);
    const isUp = Boolean(record?.is_up) || (normalizedCurrentUp && normalizedName === normalizedCurrentUp);
    const entry = {
      id: character.id || normalizedName,
      name: normalizedName,
      rarity: Number(character.rarity) || 0,
      type: character.type,
      isUp
    };

    buckets.items.push(entry);

    if (entry.rarity === 6) {
      buckets.sixStar.push(entry.name);
      if (isUp) {
        buckets.up.push(entry);
      } else {
        buckets.offBanner.push(entry);
      }
      return;
    }

    if (entry.rarity === 5) {
      buckets.fiveStar.push(entry.name);
      return;
    }

    if (entry.rarity === 4) {
      buckets.fourStar.push(entry.name);
    }
  });

  return {
    ...buckets,
    sixStar: ensureLeadingName(buckets.sixStar, currentUpName),
    fiveStar: dedupeNames(buckets.fiveStar),
    fourStar: dedupeNames(buckets.fourStar),
    up: buckets.up,
    offBanner: buckets.offBanner
  };
}

export async function fetchPoolRosterBuckets(poolId, { expectedType = 'character', currentUpName = null } = {}) {
  if (!supabase || !poolId) {
    return null;
  }

  const { data, error } = await supabase
    .from('pool_characters')
    .select(`
      character_id,
      is_up,
      characters (
        id,
        name,
        rarity,
        type,
        is_limited,
        aliases,
        pool_config
      )
    `)
    .eq('pool_id', poolId);

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return buildBucketsFromPoolCharacters(data, {
    expectedType,
    currentUpName
  });
}

