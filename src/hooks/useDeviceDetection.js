import { useState, useEffect, useCallback } from 'react';
import { MOBILE_BREAKPOINT } from '../constants/index.js';

const PREF_KEY = 'platform-preference';
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
    return localStorage.getItem(PREF_KEY);
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
      localStorage.removeItem(PREF_KEY);
    } else {
      localStorage.setItem(PREF_KEY, pref);
    }
    setPlatformPreference(pref);
  }, []);

  const clearPreference = useCallback(() => {
    localStorage.removeItem(PREF_KEY);
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
