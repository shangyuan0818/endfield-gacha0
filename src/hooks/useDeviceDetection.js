import { useState, useEffect, useCallback } from 'react';

const PLATFORM_PREFERENCE_KEY = 'platform-preference';

/**
 * 使用 matchMedia 检测是否为移动设备（比 innerWidth 更可靠）
 */
function detectMobileSync() {
  if (typeof window === 'undefined') return false;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  return mobileUA || mobileQuery.matches;
}

/**
 * 设备检测 Hook
 * 使用 matchMedia 替代 innerWidth + resize 事件
 */
export function useDeviceDetection() {
  const [isMobile, setIsMobile] = useState(detectMobileSync);
  const [platformPreference, setPlatformPreference] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PLATFORM_PREFERENCE_KEY);
  });

  // 监听 matchMedia 变化（替代 resize 事件，更可靠）
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => {
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(e.matches || mobileUA);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
