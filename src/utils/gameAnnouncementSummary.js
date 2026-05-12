function stripAnnouncementMarkup(value) {
  return String(value || '')
    .replace(/\\n|\/n/giu, '\n')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/^>\s*/gmu, '')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/^[-*]\s+/gmu, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function getGameAnnouncementSummary(record, maxLength = 96) {
  const directSummary = String(record?.summary || '').trim();
  const sourceText = directSummary
    || stripAnnouncementMarkup(record?.raw_content || '')
    || stripAnnouncementMarkup(record?.content || '');

  if (!sourceText) {
    return '';
  }

  if (sourceText.length <= maxLength) {
    return sourceText;
  }

  return `${sourceText.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
