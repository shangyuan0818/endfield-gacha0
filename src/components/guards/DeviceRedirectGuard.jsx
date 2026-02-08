import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';

/**
 * 设备重定向守卫组件
 * 根据设备类型和用户偏好自动重定向到对应平台
 */
function DeviceRedirectGuard({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldUseMobile, platformPreference } = useDeviceDetection();

  useEffect(() => {
    const isMobilePath = location.pathname.startsWith('/m');

    // 如果用户有明确偏好，不自动重定向
    if (platformPreference !== null) {
      return;
    }

    // 自动重定向逻辑
    if (shouldUseMobile && !isMobilePath) {
      // 移动设备访问桌面端，重定向到移动端
      navigate('/m', { replace: true });
    } else if (!shouldUseMobile && isMobilePath) {
      // 桌面设备访问移动端，重定向到桌面端
      navigate('/', { replace: true });
    }
  }, [shouldUseMobile, platformPreference, location.pathname, navigate]);

  return children;
}

export default DeviceRedirectGuard;
