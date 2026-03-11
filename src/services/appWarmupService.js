import { preloadHomeStatsCache } from './cacheService';

const modulePreloaders = [
  () => import('../mobile/MobileApp'),
  () => import('../components/legal/PrivacyPolicy'),
  () => import('../components/legal/TermsOfService'),
  () => import('../components/home/HomePage'),
  () => import('../features/simulator/GachaSimulator'),
  () => import('../components/SummaryView'),
  () => import('../components/AdminPanel'),
  () => import('../components/SettingsPanel'),
  () => import('../components/AboutPanel'),
  () => import('../components/TicketPanel'),
  () => import('../components/dashboard/DashboardView'),
  () => import('../components/records/RecordsView'),
  () => import('../components/admin/CharacterManagement'),
  () => import('../components/admin/PoolManagement'),
  () => import('../components/admin/panels/UsersPanel'),
  () => import('../components/admin/panels/UserDataPanel'),
  () => import('../components/admin/panels/BlacklistPanel'),
  () => import('../components/admin/panels/AnnouncementsPanel'),
  () => import('../components/admin/panels/PageContentPanel'),
  () => import('../components/admin/panels/SiteConfigPanel')
];

let moduleWarmupPromise = null;
let applicationWarmupPromise = null;

export async function preloadApplicationModules() {
  if (!moduleWarmupPromise) {
    moduleWarmupPromise = Promise.allSettled(
      modulePreloaders.map(preload => preload())
    ).then(() => undefined);
  }

  return moduleWarmupPromise;
}

export async function warmupApplication() {
  if (!applicationWarmupPromise) {
    applicationWarmupPromise = Promise.allSettled([
      preloadHomeStatsCache(),
      preloadApplicationModules()
    ]).then(() => undefined);
  }

  return applicationWarmupPromise;
}

export default {
  preloadApplicationModules,
  warmupApplication
};

