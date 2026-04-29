import { useCallback, useEffect, useState } from 'react';
import * as opsAutomationService from '../../services/admin/opsAutomationService';

function formatAnnouncementSyncMessage(result, forceRefresh) {
  const summary = result?.announcements || {};
  const synced = Number(summary.synced || 0);
  const summarized = Number(summary.summarized || 0);
  const skipped = Number(summary.skipped || 0);
  const total = Number(summary.total || 0);

  if (forceRefresh) {
    return `公告摘要强制刷新完成：重算 ${summarized} 条，写入 ${synced} 条，跳过 ${skipped}/${total} 条`;
  }

  return `公告增量同步完成：新处理 ${summarized} 条，写入 ${synced} 条，跳过 ${skipped}/${total} 条`;
}

export function useOpsAutomation(showToast) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [forceRefreshing, setForceRefreshing] = useState(false);
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

  const triggerSync = useCallback(async ({ forceRefresh = false } = {}) => {
    if (forceRefresh) {
      setForceRefreshing(true);
    } else {
      setSyncing(true);
    }
    try {
      const result = await opsAutomationService.triggerManualSync('official-announcements', {
        forceRefresh,
      });
      if (showToast) {
        showToast(formatAnnouncementSyncMessage(result, forceRefresh), 'success');
      }
      await loadRuns();
      return result;
    } catch (error) {
      if (showToast) showToast(`公告同步失败: ${error.message}`, 'error');
    } finally {
      if (forceRefresh) {
        setForceRefreshing(false);
      } else {
        setSyncing(false);
      }
    }
  }, [showToast, loadRuns]);

  return {
    runs,
    loading,
    syncing,
    forceRefreshing,
    setupIssue,
    refreshRuns,
    triggerSync,
  };
}

export default useOpsAutomation;
