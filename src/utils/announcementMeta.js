export const ANNOUNCEMENT_TYPE_OPTIONS = [
  { value: 'update', label: '更新公告', labelEn: 'Update' },
  { value: 'temporary', label: '临时公告', labelEn: 'Temporary' },
];

export const ANNOUNCEMENT_SEVERITY_OPTIONS = [
  { value: 'info', label: '普通', labelEn: 'Info' },
  { value: 'maintenance', label: '维护', labelEn: 'Maintenance' },
  { value: 'warning', label: '警告', labelEn: 'Warning' },
  { value: 'critical', label: '重要', labelEn: 'Critical' },
];

const SEVERITY_STYLES = {
  info: {
    label: '普通',
    labelEn: 'Info',
    card: 'border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-900 dark:border-sky-800/50 dark:from-sky-950/30 dark:to-cyan-950/20 dark:text-sky-100',
    badge: 'bg-sky-200 text-sky-800 dark:bg-sky-900/70 dark:text-sky-200',
    icon: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300',
    chevron: 'text-sky-500',
  },
  maintenance: {
    label: '维护',
    labelEn: 'Maintenance',
    card: 'border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-900 dark:border-violet-800/50 dark:from-violet-950/30 dark:to-fuchsia-950/20 dark:text-violet-100',
    badge: 'bg-violet-200 text-violet-800 dark:bg-violet-900/70 dark:text-violet-200',
    icon: 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300',
    chevron: 'text-violet-500',
  },
  warning: {
    label: '警告',
    labelEn: 'Warning',
    card: 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:text-amber-100',
    badge: 'bg-amber-200 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200',
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300',
    chevron: 'text-amber-500',
  },
  critical: {
    label: '重要',
    labelEn: 'Critical',
    card: 'border-red-300 bg-gradient-to-r from-red-50 to-rose-50 text-red-950 dark:border-red-800/60 dark:from-red-950/40 dark:to-rose-950/20 dark:text-red-100',
    badge: 'bg-red-500 text-white dark:bg-red-500 dark:text-white',
    icon: 'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-200',
    chevron: 'text-red-500',
  },
};

export function normalizeAnnouncementType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'temporary' ? 'temporary' : 'update';
}

export function normalizeAnnouncementSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_STYLES, normalized) ? normalized : 'info';
}

export function getAnnouncementTypeLabel(value, locale = 'zh-CN') {
  const type = normalizeAnnouncementType(value);
  const option = ANNOUNCEMENT_TYPE_OPTIONS.find((item) => item.value === type) || ANNOUNCEMENT_TYPE_OPTIONS[0];
  return String(locale || '').toLowerCase().startsWith('en') ? option.labelEn : option.label;
}

export function getAnnouncementSeverityMeta(value, locale = 'zh-CN') {
  const severity = normalizeAnnouncementSeverity(value);
  const meta = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
  return {
    ...meta,
    value: severity,
    displayLabel: String(locale || '').toLowerCase().startsWith('en') ? meta.labelEn : meta.label,
  };
}

export function splitSiteAnnouncements(announcements = []) {
  const activeSiteAnnouncements = (Array.isArray(announcements) ? announcements : [])
    .filter((announcement) => announcement?.is_active !== false && !announcement?.source_id);

  return {
    temporary: activeSiteAnnouncements.filter((announcement) => normalizeAnnouncementType(announcement?.announcement_type) === 'temporary'),
    updates: activeSiteAnnouncements.filter((announcement) => normalizeAnnouncementType(announcement?.announcement_type) !== 'temporary'),
  };
}
