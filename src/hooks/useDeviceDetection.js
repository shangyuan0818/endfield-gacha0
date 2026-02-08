import { useState, useEffect, useCallback } from 'react';

const PLATFORM_PREFERENCE_KEY = 'platform-preference';

/**
 * 同步检测是否为移动设备
 */
function detectMobileSync() {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileDevice = mobileRegex.test(userAgent);
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileDevice || isSmallScreen;
}

/**
 * 设备检测 Hook
 * 检测用户设备类型并管理平台偏好
 */
export function useDeviceDetection() {
  // 使用同步检测作为初始值，避免闪烁
  const [isMobile, setIsMobile] = useState(() => detectMobileSync());
  const [platformPreference, setPlatformPreference] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PLATFORM_PREFERENCE_KEY);
  });
  const [isReady, setIsReady] = useState(false);

  // 检测是否为移动设备
  const detectMobile = useCallback(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const isMobileDevice = mobileRegex.test(userAgent);

    // 也检查屏幕宽度（平板横屏等情况）
    const isSmallScreen = window.innerWidth <= 768;

    return isMobileDevice || isSmallScreen;
  }, []);

  // 加载保存的平台偏好
  useEffect(() => {
    const savedPreference = localStorage.getItem(PLATFORM_PREFERENCE_KEY);
    if (savedPreference) {
      setPlatformPreference(savedPreference);
    }
    setIsMobile(detectMobile());

    // 监听窗口大小变化
    const handleResize = () => {
      setIsMobile(detectMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [detectMobile]);

  // 设置平台偏好
  const setPreference = useCallback((preference) => {
    if (preference === null) {
      localStorage.removeItem(PLATFORM_PREFERENCE_KEY);
    } else {
      localStorage.setItem(PLATFORM_PREFERENCE_KEY, preference);
    }
    setPlatformPreference(preference);
  }, []);

  // 清除平台偏好（恢复自动检测）
  const clearPreference = useCallback(() => {
    localStorage.removeItem(PLATFORM_PREFERENCE_KEY);
    setPlatformPreference(null);
  }, []);

  // 判断是否应该使用移动端
  const shouldUseMobile = platformPreference
    ? platformPreference === 'mobile'
    : isMobile;

  return {
    isMobile,
    platformPreference,
    shouldUseMobile,
    setPreference,
    clearPreference,
  };
}

export default useDeviceDetection;
