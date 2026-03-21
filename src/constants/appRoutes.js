export const APP_TAB_IDS = ['home', 'summary', 'dashboard', 'simulator', 'timeline-demo', 'admin', 'settings', 'about', 'tickets'];

export const DESKTOP_TAB_ROUTES = {
  home: '/',
  summary: '/summary',
  dashboard: '/dashboard',
  simulator: '/simulator',
  'timeline-demo': '/timeline-demo',
  admin: '/admin',
  settings: '/settings',
  about: '/about',
  tickets: '/tickets'
};

export const MOBILE_TAB_ROUTES = {
  home: '/m',
  summary: '/m/summary',
  dashboard: '/m/dashboard',
  simulator: '/m/simulator',
  admin: '/m/admin',
  settings: '/m/settings',
  about: '/m/about',
  tickets: '/m/tickets'
};

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

export function normalizeAppTab(tab) {
  const normalizedTab = tab === 'ticket' ? 'tickets' : tab;
  return APP_TAB_IDS.includes(normalizedTab) ? normalizedTab : 'home';
}

export function getDesktopPathForTab(tab) {
  return DESKTOP_TAB_ROUTES[normalizeAppTab(tab)] || DESKTOP_TAB_ROUTES.home;
}

export function getMobilePathForTab(tab) {
  return MOBILE_TAB_ROUTES[normalizeAppTab(tab)] || MOBILE_TAB_ROUTES.home;
}

export function getDesktopTabFromPath(pathname) {
  const normalizedPath = normalizePathname(pathname);
  return Object.entries(DESKTOP_TAB_ROUTES).find(([, route]) => route === normalizedPath)?.[0] || 'home';
}

export function getMobileTabFromPath(pathname) {
  const normalizedPath = normalizePathname(pathname);
  return Object.entries(MOBILE_TAB_ROUTES).find(([, route]) => route === normalizedPath)?.[0] || 'home';
}

export function resolvePlatformPath(pathname, targetPlatform = 'desktop') {
  const normalizedPath = normalizePathname(pathname);
  const currentPlatform = normalizedPath.startsWith('/m') ? 'mobile' : 'desktop';
  const currentTab = currentPlatform === 'mobile'
    ? getMobileTabFromPath(normalizedPath)
    : getDesktopTabFromPath(normalizedPath);

  if (targetPlatform === 'mobile') {
    return getMobilePathForTab(currentTab);
  }

  return getDesktopPathForTab(currentTab);
}
