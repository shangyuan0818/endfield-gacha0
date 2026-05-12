export function sanitizeAnnouncementTitle(value) {
  return String(value || '')
    .replace(/\\n|\/n/giu, ' ')
    .replace(/[\r\n]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function getLocalizedAnnouncementTitle(announcement, locale = 'zh-CN') {
  if (!announcement) return '';
  if (locale === 'en-US') {
    return sanitizeAnnouncementTitle(announcement.title_en || announcement.title || '');
  }
  return sanitizeAnnouncementTitle(announcement.title || announcement.title_en || '');
}

export function getLocalizedAnnouncementContent(announcement, locale = 'zh-CN') {
  if (!announcement) return '';
  if (locale === 'en-US') {
    return announcement.content_en?.trim() || announcement.content || '';
  }
  return announcement.content || announcement.content_en?.trim() || '';
}
