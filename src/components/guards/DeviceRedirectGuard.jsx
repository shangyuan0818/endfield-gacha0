import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';

/**
 * 设备重定向守卫组件
 * 核心首次重定向已在 main.jsx 同步完成。
 * 此组件仅处理运行时 matchMedia 变化（如旋转设备、调整窗口等）。
 * 使用 window.location.replace 替代 navigate，避免 bfcache 和路由状态问题。
 */
function DeviceRedirectGuard({ children }) {
  const location = useLocation();
  const { shouldUseMobile, platformPreference } = useDeviceDetection();

  useEffect(() => {
    // 有明确偏好时不自动重定向
    if (platformPreference !== null) return;

    const isMobilePath = location.pathname.startsWith('/m');

    if (shouldUseMobile && !isMobilePath) {
      window.location.replace(window.location.origin + '/m');
    } else if (!shouldUseMobile && isMobilePath) {
      window.location.replace(window.location.origin + '/');
    }
  }, [shouldUseMobile, platformPreference, location.pathname]);

  return children;
}

export default DeviceRedirectGuard;
