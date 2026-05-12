import { sanitizeAnnouncementTitle } from './announcementLocale.js';

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

function normalizeDigestTopic(value) {
  return sanitizeAnnouncementTitle(value)
    .replace(/^【([^】]{2,18})】/u, '$1 ')
    .replace(/^(公告|活动|游戏公告|资讯速报)[:：\s-]*/u, '')
    .replace(/(公告|开启公告|即将开启|限时开启|说明)$/u, '')
    .replace(/[《》「」]/gu, '')
    .trim();
}

function truncateText(value, maxLength) {
  const text = sanitizeAnnouncementTitle(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function buildDigestTopicList(records = []) {
  const seen = new Set();
  const topics = [];

  for (const record of records) {
    const topic = normalizeDigestTopic(record.title || record.summary || '');
    if (!topic || seen.has(topic)) {
      continue;
    }

    seen.add(topic);
    topics.push(topic.length > 10 ? `${topic.slice(0, 9)}…` : topic);
    if (topics.length >= 3) {
      break;
    }
  }

  return topics;
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
  const topics = buildDigestTopicList(gameRecords.length > 0 ? gameRecords : records);
  const subtitle = topics.length > 0
    ? truncateText(`重点关注 ${topics.join('、')} 等近期公告，展开后可查看原文与摘要。`, 96)
    : (sourceParts.length > 0
      ? sourceParts.join(' · ')
      : t('home.autoSummary'));

  return {
    title: topics.length > 0
      ? truncateText(`近期公告：${topics.join('、')}`, 32)
      : (gameRecords.length > 0
        ? t('announcement.digest.title')
        : t('announcement.digest.fallbackTitle')),
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
