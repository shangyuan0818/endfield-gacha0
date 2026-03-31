import { useState, useEffect, useCallback, useRef } from 'react';
import { useMediaQuery } from 'react-responsive';
import { MOBILE_BREAKPOINT } from '../constants/index.js';

const PREF_KEY = 'platform-preference';
const MOBILE_UA_RE = /Mobile|Android|iPhone|iPod|iPad|webOS|BlackBerry|Opera Mini|IEMobile/i;

function isMobileUA() {
  if (typeof navigator === 'undefined') return false;
  return MOBILE_UA_RE.test(navigator.userAgent);
}

export function useDeviceDetection() {
  const mqMobile = useMediaQuery({ maxWidth: MOBILE_BREAKPOINT });

  const [fallbackMobile, setFallbackMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT || isMobileUA();
  });

  const rafRef = useRef(null);

  useEffect(() => {
    const check = () => {
      setFallbackMobile(
        window.innerWidth <= MOBILE_BREAKPOINT || isMobileUA()
      );
    };

    const throttledCheck = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        check();
      });
    };

    window.addEventListener('resize', throttledCheck);

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(throttledCheck);
      ro.observe(document.documentElement);
    }

    return () => {
      window.removeEventListener('resize', throttledCheck);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ro) ro.disconnect();
    };
  }, []);

  const isMobile = mqMobile || fallbackMobile;

  const [platformPreference, setPlatformPreference] = useState(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PREF_KEY);
  });

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
