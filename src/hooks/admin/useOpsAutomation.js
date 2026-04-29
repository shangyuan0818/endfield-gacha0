import { useCallback, useEffect, useState } from 'react';
import * as opsAutomationService from '../../services/admin/opsAutomationService';

function formatAnnouncementSyncMessage(result, refreshMode) {
  const summary = result?.announcements || {};
  const synced = Number(summary.synced || 0);
  const summarized = Number(summary.summarized || 0);
  const skipped = Number(summary.skipped || 0);
  const total = Number(summary.total || 0);
  const summaryFailed = Number(summary.summaryFailed || 0);
  const announcementLimit = Number(summary.announcementLimit || 0);
  const mode = summary.refreshMode || refreshMode || 'incremental';
  const limitSuffix = mode === 'all' && announcementLimit > 0 ? `，范围 ${announcementLimit} 条` : '';
  const firstSummaryError = Array.isArray(summary.summaryErrors)
    ? summary.summaryErrors.find(error => error?.error)
    : null;
  const failureSuffix = summaryFailed > 0
    ? `，摘要失败 ${summaryFailed} 条${firstSummaryError ? `（首个原因：${firstSummaryError.error}）` : ''}`
    : '';

  if (mode === 'all') {
    return `全部公告强制刷新完成：处理 ${summarized} 条，写入 ${synced} 条，跳过 ${skipped}/${total} 条${limitSuffix}${failureSuffix}`;
  }

  if (mode === 'summary') {
    return `公告摘要强制刷新完成：重算 ${summarized} 条，写入 ${synced} 条，跳过 ${skipped}/${total} 条${failureSuffix}`;
  }

  return `公告增量同步完成：新处理 ${summarized} 条，写入 ${synced} 条，跳过 ${skipped}/${total} 条${failureSuffix}`;
}

export function useOpsAutomation(showToast) {
  const [runs, setRuns] = useState([]);
  const [filters, setFilters] = useState({
    jobId: 'all',
    status: 'all',
    triggerType: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [forceRefreshing, setForceRefreshing] = useState(false);
  const [fullRefreshing, setFullRefreshing] = useState(false);
  const [setupIssue, setSetupIssue] = useState(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await opsAutomationService.loadOpsAutomationRuns({
        ...filters,
        limit: 120,
      });
      setRuns(data);
      setSetupIssue(null);
    } catch (error) {
      setRuns([]);
      setSetupIssue({ message: error.message });
      if (showToast) showToast(`加载自动化记录失败: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const refreshRuns = useCallback(async () => {
    await loadRuns();
  }, [loadRuns]);

  const triggerSync = useCallback(async ({
    forceRefresh = false,
    refreshMode = forceRefresh ? 'summary' : 'incremental',
    announcementLimit = null,
  } = {}) => {
    if (refreshMode === 'all') {
      setFullRefreshing(true);
    } else if (refreshMode === 'summary') {
      setForceRefreshing(true);
    } else {
      setSyncing(true);
    }
    try {
      const result = await opsAutomationService.triggerManualSync('official-announcements', {
        forceRefresh: forceRefresh || refreshMode !== 'incremental',
        refreshMode,
        announcementLimit,
      });
      if (showToast) {
        showToast(formatAnnouncementSyncMessage(result, refreshMode), 'success');
      }
      await loadRuns();
      return result;
    } catch (error) {
      if (showToast) showToast(`公告同步失败: ${error.message}`, 'error');
    } finally {
      if (refreshMode === 'all') {
        setFullRefreshing(false);
      } else if (refreshMode === 'summary') {
        setForceRefreshing(false);
      } else {
        setSyncing(false);
      }
    }
  }, [showToast, loadRuns]);

  return {
    filters,
    runs,
    loading,
    syncing,
    forceRefreshing,
    fullRefreshing,
    setupIssue,
    refreshRuns,
    setFilters,
    triggerSync,
  };
}

export default useOpsAutomation;
