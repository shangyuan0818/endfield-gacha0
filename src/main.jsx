import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './registerAppFonts.js'
import './index.css'
import AppRouter from './AppRouter'
import { preloadPublicBootstrap } from './services/bootstrapService'
import { getDeviceRedirectTarget } from './utils/deviceRedirect.js'
import { appLogger } from './utils/appLogger.js'
import { prepareFreshNavigation } from './utils/serviceWorkerRecovery.js'
import { I18nProvider } from './i18n/index.js'

function syncDeviceRedirect() {
  const preference = localStorage.getItem('platform-preference');
  const pathname = window.location.pathname;

  const mqMobile = window.matchMedia('(max-width: 768px)').matches;
  const uaMobile = /Mobile|Android|iPhone|iPod|iPad|webOS|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);
  const shouldUseMobile = preference
    ? preference === 'mobile'
    : (mqMobile || window.innerWidth <= 768 || uaMobile);

  const redirectTarget = getDeviceRedirectTarget(pathname, shouldUseMobile);
  if (redirectTarget) {
    window.location.replace(window.location.origin + redirectTarget);
  }
}

const schedulePreload = typeof window.requestIdleCallback === 'function'
  ? window.requestIdleCallback.bind(window)
  : (callback) => window.setTimeout(callback, 250);

async function bootstrapApp() {
  const { didNavigate } = await prepareFreshNavigation();
  if (didNavigate) {
    return;
  }

  syncDeviceRedirect();

  schedulePreload(() => {
    preloadPublicBootstrap().catch(err => {
      appLogger.warn('预加载数据失败，将使用实时查询:', err);
    });
  });

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <I18nProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRouter />
        </BrowserRouter>
      </I18nProvider>
      <Analytics />
    </StrictMode>,
  );
}

bootstrapApp().catch((error) => {
  appLogger.error('应用启动失败:', error);
});
