import { useState, useEffect, useCallback } from 'react';
import { MOBILE_BREAKPOINT } from '../constants/index.js';
import { readStorageValue, removeStorageValue, STORAGE_KEYS, writeStorageValue } from '../utils/storageUtils.js';

const MQ_STRING = `(max-width: ${MOBILE_BREAKPOINT}px)`;
const MOBILE_UA_RE = /Mobile|Android|iPhone|iPod|iPad|webOS|BlackBerry|Opera Mini|IEMobile/i;

function detectMobile() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia(MQ_STRING).matches ||
    window.innerWidth <= MOBILE_BREAKPOINT ||
    MOBILE_UA_RE.test(navigator.userAgent)
  );
}

export function useDeviceDetection() {
  const [isMobile, setIsMobile] = useState(detectMobile);

  const [platformPreference, setPlatformPreference] = useState(() => {
    if (typeof window === 'undefined') return null;
    return readStorageValue(STORAGE_KEYS.PLATFORM_PREFERENCE, null, { raw: true });
  });

  useEffect(() => {
    const mql = window.matchMedia(MQ_STRING);
    const update = () => setIsMobile(detectMobile());

    mql.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      mql.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const setPreference = useCallback((pref) => {
    if (pref === null) {
      removeStorageValue(STORAGE_KEYS.PLATFORM_PREFERENCE, { raw: true });
    } else {
      writeStorageValue(STORAGE_KEYS.PLATFORM_PREFERENCE, pref, { raw: true });
    }
    setPlatformPreference(pref);
  }, []);

  const clearPreference = useCallback(() => {
    removeStorageValue(STORAGE_KEYS.PLATFORM_PREFERENCE, { raw: true });
    setPlatformPreference(null);
  }, []);

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
