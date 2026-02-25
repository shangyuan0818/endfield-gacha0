import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import AppRouter from './AppRouter'
import { preloadAllData } from './services/cacheService'

// 同步设备检测 + 重定向（在 React 渲染前执行）
// 解决 useEffect 异步重定向导致的闪烁和失效问题
;(function syncDeviceRedirect() {
  const preference = localStorage.getItem('platform-preference');
  if (preference) return; // 用户有明确偏好，跳过自动重定向

  const pathname = window.location.pathname;
  // 法律页面不重定向
  if (pathname === '/privacy' || pathname === '/terms') return;

  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isMobile = mobileQuery.matches || mobileUA;
  const isMobilePath = pathname.startsWith('/m');

  if (isMobile && !isMobilePath) {
    window.location.replace(window.location.origin + '/m');
  } else if (!isMobile && isMobilePath) {
    window.location.replace(window.location.origin + '/');
  }
})();

// 在应用启动时预加载缓存数据（不阻塞渲染）
preloadAllData().catch(err => {
  console.warn('预加载数据失败，将使用实时查询:', err);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>,
)
