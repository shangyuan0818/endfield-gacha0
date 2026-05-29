import { useCallback, useEffect, useState } from 'react';
import * as opsAutomationService from '../../services/admin/opsAutomationService';
import { buildOpsAutomationTriggerMessage } from '../../utils/opsAutomationRunSummary';

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
  const [runningJobId, setRunningJobId] = useState(null);
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

  const triggerJob = useCallback(async (jobId = 'official-announcements', {
    forceRefresh = false,
    refreshMode = forceRefresh ? 'summary' : 'incremental',
    announcementLimit = null,
  } = {}) => {
    const isAnnouncementJob = jobId === 'official-announcements';
    if (isAnnouncementJob && refreshMode === 'all') {
      setFullRefreshing(true);
    } else if (isAnnouncementJob && refreshMode === 'summary') {
      setForceRefreshing(true);
    } else if (isAnnouncementJob) {
      setSyncing(true);
    } else {
      setRunningJobId(jobId);
    }
    try {
      const result = await opsAutomationService.triggerManualSync(jobId, {
        forceRefresh: forceRefresh || refreshMode !== 'incremental',
        refreshMode,
        announcementLimit,
      });
      if (showToast) {
        showToast(buildOpsAutomationTriggerMessage(jobId, result, refreshMode), result?.partial ? 'warning' : 'success');
      }
      await loadRuns();
      return result;
    } catch (error) {
      if (showToast) showToast(`${jobId === 'official-announcements' ? '公告同步' : '自动化任务'}失败: ${error.message}`, 'error');
    } finally {
      if (isAnnouncementJob && refreshMode === 'all') {
        setFullRefreshing(false);
      } else if (isAnnouncementJob && refreshMode === 'summary') {
        setForceRefreshing(false);
      } else if (isAnnouncementJob) {
        setSyncing(false);
      } else {
        setRunningJobId(null);
      }
    }
  }, [showToast, loadRuns]);

  const triggerSync = useCallback((options = {}) => (
    triggerJob('official-announcements', options)
  ), [triggerJob]);

  const rerunRun = useCallback(async (run) => {
    if (!run?.job_id) {
      return undefined;
    }

    const summary = run.summary || {};
    const opsInput = summary.ops?.input || {};
    return triggerJob(run.job_id, {
      forceRefresh: Boolean(summary.forceRefresh || opsInput.forceRefresh),
      refreshMode: summary.refreshMode || opsInput.refreshMode || 'incremental',
      announcementLimit: summary.announcementLimit ?? opsInput.announcementLimit ?? null,
    });
  }, [triggerJob]);

  return {
    filters,
    runs,
    loading,
    syncing,
    forceRefreshing,
    fullRefreshing,
    runningJobId,
    setupIssue,
    refreshRuns,
    setFilters,
    triggerJob,
    rerunRun,
    triggerSync,
  };
}

export default useOpsAutomation;
