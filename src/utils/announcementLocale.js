export function getLocalizedAnnouncementTitle(announcement, locale = 'zh-CN') {
  if (!announcement) return '';
  if (locale === 'en-US') {
    return announcement.title_en?.trim() || announcement.title || '';
  }
  return announcement.title || announcement.title_en?.trim() || '';
}

export function getLocalizedAnnouncementContent(announcement, locale = 'zh-CN') {
  if (!announcement) return '';
  if (locale === 'en-US') {
    return announcement.content_en?.trim() || announcement.content || '';
  }
  return announcement.content || announcement.content_en?.trim() || '';
}
