import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_BUILD_INFO = 'Build 2026.03.31';

// One-off release gate for the March 31 cache reset. Clear or bump this token
// only when another intentionally forced refresh is needed.
export const APP_FORCE_REFRESH_TOKEN = '2026-03-31-cache-reset-v1';
