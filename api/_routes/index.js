function normalizeRoutePath(path) {
  const pathname = String(path || '').split('?')[0] || '';
  if (!pathname || pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/, '');
}

function route(modulePath) {
  return async (req, res) => {
    const mod = await import(modulePath);
    return mod.default(req, res);
  };
}

const accountRecoveryRequestHandler = route('./root/account-recovery-request.js');
const adminHandler = route('./root/admin.js');
const authAccountStatusHandler = route('./root/auth-account-status.js');
const authRateLimitHandler = route('./root/auth-rate-limit.js');
const automationFeedHandler = route('./root/automation-feed.js');
const bootstrapHandler = route('./root/bootstrap.js');
const officialAnnouncementImageHandler = route('./root/official-announcement-image.js');
const opsAutomationHandler = route('./root/ops-automation.js');
const selfDeleteAccountHandler = route('./root/self-delete-account.js');
const statsHandler = route('./root/stats.js');
const wikiAssetProxyHandler = route('./root/wiki-asset-proxy.js');
const wikiProxyHandler = route('./root/wiki-proxy.js');

export const API_ROUTE_ENTRIES = [
  ['/api/account-recovery-request', accountRecoveryRequestHandler],
  ['/api/admin', adminHandler],
  ['/api/admin-ops-automation', adminHandler],
  ['/api/admin-reset-recovery-password', adminHandler],
  ['/api/admin-users', adminHandler],
  ['/api/admin-delete-user', adminHandler],
  ['/api/admin-user-reset-password', adminHandler],
  ['/api/auth-account-status', authAccountStatusHandler],
  ['/api/auth-rate-limit', authRateLimitHandler],
  ['/api/automation-feed', automationFeedHandler],
  ['/api/bootstrap', bootstrapHandler],
  ['/api/official-announcement-image', officialAnnouncementImageHandler],
  ['/api/ops-automation', opsAutomationHandler],
  ['/api/self-delete-account', selfDeleteAccountHandler],
  ['/api/stats', statsHandler],
  ['/api/wiki-asset-proxy', wikiAssetProxyHandler],
  ['/api/wiki-proxy', wikiProxyHandler],
  ['/api/dev/applications', route('./dev/applications/index.js')],
  ['/api/dev/applications/me', route('./dev/applications/me.js')],
  ['/api/dev/v1/announcements', route('./dev/v1/announcements.js')],
  ['/api/dev/v1/character', route('./dev/v1/character.js')],
  ['/api/dev/v1/characters', route('./dev/v1/characters.js')],
  ['/api/dev/v1/meta', route('./dev/v1/meta.js')],
  ['/api/dev/v1/openapi', route('./dev/v1/openapi.js')],
  ['/api/dev/v1/pool', route('./dev/v1/pool.js')],
  ['/api/dev/v1/pools', route('./dev/v1/pools.js')],
  ['/api/dev/v1/bot/analysis', route('./dev/v1/bot/analysis.js')],
  ['/api/dev/v1/bot/dashboard', route('./dev/v1/bot/dashboard.js')],
  ['/api/dev/v1/bot/pool-detail', route('./dev/v1/bot/pool-detail.js')],
  ['/api/dev/v1/bot/pool-log', route('./dev/v1/bot/pool-log.js')],
  ['/api/dev/v1/bot/pools', route('./dev/v1/bot/pools.js')],
  ['/api/dev/v1/bot/recent-pulls', route('./dev/v1/bot/recent-pulls.js')],
  ['/api/dev/v1/bot/self-summary', route('./dev/v1/bot/self-summary.js')],
  ['/api/dev/v1/bot/share-card', route('./dev/v1/bot/share-card.js')],
  ['/api/dev/v1/site/overview', route('./dev/v1/site/overview.js')],
  ['/api/dev/v1/stats/distributions', route('./dev/v1/stats/distributions.js')],
  ['/api/dev/v1/stats/global', route('./dev/v1/stats/global.js')],
  ['/api/dev/v1/stats/item', route('./dev/v1/stats/item.js')],
  ['/api/dev/v1/stats/items', route('./dev/v1/stats/items.js')],
  ['/api/dev/v1/stats/pool', route('./dev/v1/stats/pool.js')],
  ['/api/dev/v1/stats/pools', route('./dev/v1/stats/pools.js')],
  ['/api/dev/v1/stats/rankings', route('./dev/v1/stats/rankings.js')],
  ['/api/dev/v1/stats/trends', route('./dev/v1/stats/trends.js')],
  ['/api/integrations/bindings/challenge', route('./integrations/bindings/challenge.js')],
  ['/api/integrations/bindings/me', route('./integrations/bindings/me.js')],
  ['/api/integrations/bindings/revoke', route('./integrations/bindings/revoke.js')],
  ['/api/integrations/bindings/verify', route('./integrations/bindings/verify.js')],
  ['/api/integrations/bot/import-notify', route('./integrations/bot/import-notify.js')],
];

const API_ROUTE_MAP = new Map(
  API_ROUTE_ENTRIES.map(([path, handler]) => [normalizeRoutePath(path), handler])
);

export function getApiRouteEntries() {
  return API_ROUTE_ENTRIES.map(([path, handler]) => [normalizeRoutePath(path), handler]);
}

export function getApiRouteHandler(path) {
  return API_ROUTE_MAP.get(normalizeRoutePath(path)) || null;
}
