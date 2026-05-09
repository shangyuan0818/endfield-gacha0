export const SHARE_THEME_SYSTEM = 'system';
export const SHARE_THEME_LIGHT = 'light';
export const SHARE_THEME_DARK = 'dark';

export function normalizeShareThemeMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === SHARE_THEME_SYSTEM ||
    normalized === SHARE_THEME_LIGHT ||
    normalized === SHARE_THEME_DARK
  ) {
    return normalized;
  }

  return SHARE_THEME_SYSTEM;
}

export function resolveShareThemeMode(mode, isDark) {
  return normalizeShareThemeMode(mode) === SHARE_THEME_SYSTEM
    ? (isDark ? SHARE_THEME_DARK : SHARE_THEME_LIGHT)
    : normalizeShareThemeMode(mode);
}
