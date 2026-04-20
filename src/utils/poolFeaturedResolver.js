import { resolveCharacterRecordByName } from './characterUtils.js';

function normalizeName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalizeCharacterRef(value) {
  const normalized = normalizeName(value);
  if (!normalized) {
    return '';
  }

  return resolveCharacterRecordByName(normalized, { fuzzy: true })?.name || normalized;
}

function dedupeNames(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).reduce((result, item) => {
    const normalized = canonicalizeCharacterRef(item);
    if (!normalized || seen.has(normalized)) {
      return result;
    }

    seen.add(normalized);
    result.push(normalized);
    return result;
  }, []);
}

function extractRosterUpNames(pool) {
  const rosterUp = Array.isArray(pool?.resolved_roster?.up) ? pool.resolved_roster.up : [];
  return rosterUp
    .map((entry) => canonicalizeCharacterRef(entry?.name || entry?.id || entry))
    .filter(Boolean);
}

export function getPoolFeaturedNames(pool) {
  const rosterUpNames = extractRosterUpNames(pool);
  const explicitFeaturedNames = Array.isArray(pool?.featured_characters) ? pool.featured_characters : [];
  const singleUpName = canonicalizeCharacterRef(pool?.up_character || pool?.upCharacter || '');

  if (rosterUpNames.length > 0) {
    return dedupeNames(rosterUpNames);
  }

  if (explicitFeaturedNames.length > 0) {
    return dedupeNames(explicitFeaturedNames);
  }

  return singleUpName ? [singleUpName] : [];
}

export function getPoolFeaturedLead(pool) {
  return getPoolFeaturedNames(pool)[0] || normalizeName(pool?.name) || null;
}
