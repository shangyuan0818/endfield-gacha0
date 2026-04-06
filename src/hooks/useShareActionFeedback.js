import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_FEEDBACK = Object.freeze({
  phase: 'idle',
  action: null,
  message: '',
});

export function useShareActionFeedback(options = {}) {
  const { successDuration = 2600, errorDuration = 3600 } = options;

  const [feedback, setFeedback] = useState(IDLE_FEEDBACK);
  const resetTimerRef = useRef(null);
  const busyRef = useRef(false);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const resetFeedback = useCallback(() => {
    clearResetTimer();
    busyRef.current = false;
    setFeedback(IDLE_FEEDBACK);
  }, [clearResetTimer]);

  const beginAction = useCallback(
    (action, message) => {
      if (busyRef.current) {
        return false;
      }

      clearResetTimer();
      busyRef.current = true;
      setFeedback({
        phase: 'running',
        action,
        message,
      });
      return true;
    },
    [clearResetTimer]
  );

  const updateAction = useCallback((action, message) => {
    if (!busyRef.current) {
      return;
    }

    setFeedback((current) => {
      if (current.phase !== 'running') {
        return current;
      }

      if (current.action && current.action !== action) {
        return current;
      }

      return {
        phase: 'running',
        action,
        message,
      };
    });
  }, []);

  const settleAction = useCallback(
    (action, phase, message, durationMs) => {
      clearResetTimer();
      busyRef.current = false;

      if (phase === 'idle' || !message) {
        setFeedback(IDLE_FEEDBACK);
        return;
      }

      setFeedback({
        phase,
        action,
        message,
      });

      const timeout = durationMs ?? (phase === 'error' ? errorDuration : successDuration);
      if (typeof window !== 'undefined' && timeout > 0) {
        resetTimerRef.current = window.setTimeout(() => {
          resetTimerRef.current = null;
          setFeedback(IDLE_FEEDBACK);
        }, timeout);
      }
    },
    [clearResetTimer, errorDuration, successDuration]
  );

  const finishAction = useCallback(
    (action, message, durationMs) => {
      settleAction(action, 'success', message, durationMs);
    },
    [settleAction]
  );

  const failAction = useCallback(
    (action, message, durationMs) => {
      settleAction(action, 'error', message, durationMs);
    },
    [settleAction]
  );

  const isActionRunning = useCallback(
    (action) => feedback.phase === 'running' && feedback.action === action,
    [feedback.action, feedback.phase]
  );

  useEffect(
    () => () => {
      clearResetTimer();
      busyRef.current = false;
    },
    [clearResetTimer]
  );

  return {
    feedback,
    isBusy: feedback.phase === 'running',
    isActionRunning,
    beginAction,
    updateAction,
    finishAction,
    failAction,
    resetFeedback,
  };
}

export default useShareActionFeedback;
