import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import AppRouter from './AppRouter'
import { preloadPublicBootstrap } from './services/bootstrapService'
import { getDeviceRedirectTarget } from './utils/deviceRedirect.js'
import { appLogger } from './utils/appLogger.js'

// 同步设备检测 + 重定向（在 React 渲染前执行）
// 解决 useEffect 异步重定向导致的闪烁和失效问题
;(function syncDeviceRedirect() {
  const preference = localStorage.getItem('platform-preference');
  if (preference) return; // 用户有明确偏好，跳过自动重定向

  const pathname = window.location.pathname;
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isMobile = mobileQuery.matches || mobileUA;
  const redirectTarget = getDeviceRedirectTarget(pathname, isMobile);

  if (redirectTarget) {
    window.location.replace(window.location.origin + redirectTarget);
  }
})();

// 在浏览器空闲时预热公共只读数据，减少首页外页面的二次等待
const schedulePreload = typeof window.requestIdleCallback === 'function'
  ? window.requestIdleCallback.bind(window)
  : (callback) => window.setTimeout(callback, 250);

schedulePreload(() => {
  preloadPublicBootstrap().catch(err => {
    appLogger.warn('预加载数据失败，将使用实时查询:', err);
  });
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRouter />
    </BrowserRouter>
    <Analytics />
  </StrictMode>,
)
