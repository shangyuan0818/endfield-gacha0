import { useCallback, useRef } from 'react';
import { bindHorizontalWheelScroll } from '../utils/horizontalScroll.js';

export function useHorizontalWheelScroll() {
  const cleanupRef = useRef(null);

  return useCallback((element) => {
    if (typeof cleanupRef.current === 'function') {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (element) {
      cleanupRef.current = bindHorizontalWheelScroll(element);
    }
  }, []);
}

export default useHorizontalWheelScroll;
