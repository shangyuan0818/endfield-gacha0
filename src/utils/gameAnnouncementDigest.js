function getAnnouncementSourceGroup(announcement = {}) {
  const sourceKind = String(announcement?.source_kind || '').toLowerCase();
  const sourceGroup = String(announcement?.source_group || '').toLowerCase();
  const sourceId = String(announcement?.source_id || '');
  const sourceUrl = String(announcement?.source_url || '');

  if (
    sourceGroup === 'game'
    || sourceKind === 'game-bulletin'
    || sourceId.startsWith('game-bulletin:')
    || sourceUrl.includes('game_bulletin')
  ) {
    return 'game';
  }

  return 'official';
}

function getGameAnnouncementCategory(announcement = {}) {
  const directCategory = String(announcement?.source_category || announcement?.tab || '').toLowerCase();
  if (['events', 'updates', 'news'].includes(directCategory)) {
    return directCategory;
  }

  try {
    const sourceUrl = new URL(String(announcement?.source_url || ''));
    const urlCategory = String(sourceUrl.searchParams.get('tab') || '').toLowerCase();
    if (['events', 'updates', 'news'].includes(urlCategory)) {
      return urlCategory;
    }
  } catch {
    // Keep the digest resilient for legacy records.
  }

  return 'unknown';
}

export function buildGameAnnouncementDigest(announcements = [], t) {
  const records = Array.isArray(announcements) ? announcements : [];
  const gameRecords = records.filter(record => getAnnouncementSourceGroup(record) === 'game');
  const officialRecords = records.filter(record => getAnnouncementSourceGroup(record) === 'official');
  const categoryCounts = gameRecords.reduce((acc, record) => {
    const category = getGameAnnouncementCategory(record);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const categoryParts = [
    ['events', 'announcement.digest.category.events'],
    ['updates', 'announcement.digest.category.updates'],
    ['news', 'announcement.digest.category.news'],
  ]
    .filter(([category]) => categoryCounts[category] > 0)
    .map(([category, key]) => t(key, { count: categoryCounts[category] }));

  const sourceParts = [];
  if (gameRecords.length > 0) {
    const gameCount = t('announcement.digest.gameCount', { count: gameRecords.length });
    sourceParts.push(categoryParts.length > 0 ? `${gameCount} (${categoryParts.join(' / ')})` : gameCount);
  }

  if (officialRecords.length > 0) {
    sourceParts.push(t('announcement.digest.officialCount', { count: officialRecords.length }));
  }

  const latestGameRecord = gameRecords[0] || records[0] || null;
  const subtitle = sourceParts.length > 0
    ? sourceParts.join(' · ')
    : t('home.autoSummary');

  return {
    title: gameRecords.length > 0
      ? t('announcement.digest.title')
      : t('announcement.digest.fallbackTitle'),
    subtitle,
    latestGameRecord,
  };
}

export function resolveGameAnnouncementDigest(storedDigest, announcements = [], t) {
  const fallbackDigest = buildGameAnnouncementDigest(announcements, t);
  const title = typeof storedDigest?.title === 'string' ? storedDigest.title.trim() : '';
  const subtitle = typeof storedDigest?.subtitle === 'string' ? storedDigest.subtitle.trim() : '';

  if (!title || !subtitle) {
    return fallbackDigest;
  }

  return {
    ...fallbackDigest,
    ...storedDigest,
    title,
    subtitle,
  };
}
