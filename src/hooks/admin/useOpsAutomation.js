import { useCallback, useEffect, useState } from 'react';
import * as opsAutomationService from '../../services/admin/opsAutomationService';

export function useOpsAutomation(showToast) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [setupIssue, setSetupIssue] = useState(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await opsAutomationService.loadOpsAutomationRuns({ limit: 24 });
      setRuns(data);
      setSetupIssue(null);
    } catch (error) {
      setRuns([]);
      setSetupIssue({ message: error.message });
      if (showToast) showToast(`加载自动化记录失败: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const refreshRuns = useCallback(async () => {
    await loadRuns();
  }, [loadRuns]);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await opsAutomationService.triggerManualSync();
      if (showToast) showToast('手动同步完成', 'success');
      await loadRuns();
      return result;
    } catch (error) {
      if (showToast) showToast(`手动同步失败: ${error.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  }, [showToast, loadRuns]);

  return {
    runs,
    loading,
    syncing,
    setupIssue,
    refreshRuns,
    triggerSync,
  };
}

export default useOpsAutomation;
