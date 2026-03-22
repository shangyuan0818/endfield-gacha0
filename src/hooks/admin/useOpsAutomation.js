import { useCallback, useEffect, useRef, useState } from 'react';
import * as opsAutomationService from '../../services/admin/opsAutomationService';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(item => normalizeText(item))
      .filter(Boolean)
  ));
}

function getReviewRecordKey(run) {
  if (run?.job_id === 'official-announcements') {
    return 'source_id';
  }

  if (run?.job_id === 'pool-schedule') {
    return 'pool_id';
  }

  return 'id';
}

function getReviewRecords(run) {
  return Array.isArray(run?.review_bundle?.snapshots?.incoming)
    ? run.review_bundle.snapshots.incoming
    : [];
}

function getAppliedRecordIds(run) {
  if (run?.job_id === 'official-announcements') {
    return normalizeStringArray(run?.review_bundle?.review?.appliedSourceIds);
  }

  if (run?.job_id === 'pool-schedule') {
    return normalizeStringArray(run?.review_bundle?.review?.appliedPoolIds);
  }

  return [];
}

function getBlockedRecordIds(run) {
  if (run?.job_id === 'official-announcements') {
    return normalizeStringArray(run?.review_bundle?.review?.blockedSourceIds);
  }

  if (run?.job_id === 'pool-schedule') {
    return normalizeStringArray(run?.review_bundle?.review?.blockedPoolIds);
  }

  return [];
}

function getPendingRecordIds(run) {
  const keyField = getReviewRecordKey(run);
  const appliedIdSet = new Set(getAppliedRecordIds(run));
  const blockedIdSet = new Set(getBlockedRecordIds(run));

  return getReviewRecords(run)
    .map(record => normalizeText(record?.[keyField] || record?.id))
    .filter(recordId => recordId && !appliedIdSet.has(recordId) && !blockedIdSet.has(recordId));
}

function pickPreferredRunId(result) {
  const successfulResult = (Array.isArray(result?.results) ? result.results : [])
    .find(item => item?.status === 'success' && item?.runId);

  return normalizeText(successfulResult?.runId);
}

export function useOpsAutomation(showToast) {
  const [jobFilter, setJobFilter] = useState('all');
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [reviewNote, setReviewNote] = useState('');
  const [lastApplyResult, setLastApplyResult] = useState(null);
  const [setupIssue, setSetupIssue] = useState(null);
  const selectedRunIdRef = useRef('');

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
  }, [selectedRunId]);

  const loadRuns = useCallback(async (targetJobId = jobFilter, {
    preferredRunId = '',
  } = {}) => {
    setLoading(true);

    try {
      const data = await opsAutomationService.loadOpsAutomationRuns({
        jobId: targetJobId,
        limit: 24,
      });

      setRuns(data);
      setSetupIssue(null);

      const normalizedPreferredRunId = normalizeText(preferredRunId);
      const nextSelectedRun = data.find(run => run.id === normalizedPreferredRunId)
        || data.find(run => run.id === selectedRunIdRef.current)
        || data[0]
        || null;

      setSelectedRunId(nextSelectedRun?.id || '');
      setSelectedRecordIds(nextSelectedRun ? getPendingRecordIds(nextSelectedRun) : []);
    } catch (error) {
      setRuns([]);
      setSelectedRunId('');
      setSelectedRecordIds([]);

      if (opsAutomationService.isOpsAutomationSchemaMissingError(error) || error?.code === 'OPS_AUTOMATION_SCHEMA_MISSING') {
        setSetupIssue({
          code: 'schema-missing',
          message: error.message,
        });
      } else {
        setSetupIssue(null);
        showToast(`加载自动化审计记录失败: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [jobFilter, showToast]);

  useEffect(() => {
    loadRuns(jobFilter);
  }, [jobFilter, loadRuns]);

  const selectedRun = runs.find(run => run.id === selectedRunId) || null;

  const selectRun = useCallback((runId) => {
    const normalizedRunId = normalizeText(runId);
    const nextRun = runs.find(run => run.id === normalizedRunId) || null;

    setSelectedRunId(normalizedRunId);
    setSelectedRecordIds(nextRun ? getPendingRecordIds(nextRun) : []);
    setLastApplyResult(null);
  }, [runs]);

  const refreshRuns = useCallback(async () => {
    await loadRuns(jobFilter);
  }, [jobFilter, loadRuns]);

  const triggerRuns = useCallback(async (targetJobId = jobFilter) => {
    const normalizedJobId = normalizeText(targetJobId) || 'all';
    const targetLabel = normalizedJobId === 'all' ? '当前可运行任务' : normalizedJobId;

    if (!window.confirm(`确定要手动执行 ${targetLabel} 的 dry-run 吗？这会创建新的审计记录。`)) {
      return;
    }

    setActionLoading('trigger');
    setLastApplyResult(null);

    try {
      const jobIds = normalizedJobId === 'all' ? [] : [normalizedJobId];
      const result = await opsAutomationService.triggerOpsAutomation(jobIds);
      const preferredRunId = pickPreferredRunId(result);
      await loadRuns(normalizedJobId, { preferredRunId });

      const successCount = Array.isArray(result?.results)
        ? result.results.filter(item => item?.status === 'success').length
        : 0;
      const failureCount = Array.isArray(result?.results)
        ? result.results.filter(item => item?.status !== 'success').length
        : 0;

      showToast(
        `dry-run 完成：成功 ${successCount} 个，异常 ${failureCount} 个`,
        failureCount > 0 ? 'warning' : 'success'
      );
    } catch (error) {
      showToast(`手动执行 dry-run 失败: ${error.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [jobFilter, loadRuns, showToast]);

  const toggleRecordSelection = useCallback((recordId) => {
    const normalizedRecordId = normalizeText(recordId);
    if (!normalizedRecordId) {
      return;
    }

    setSelectedRecordIds((prev) => (
      prev.includes(normalizedRecordId)
        ? prev.filter(item => item !== normalizedRecordId)
        : [...prev, normalizedRecordId]
    ));
  }, []);

  const selectPendingRecords = useCallback(() => {
    setSelectedRecordIds(getPendingRecordIds(selectedRun));
  }, [selectedRun]);

  const clearSelectedRecords = useCallback(() => {
    setSelectedRecordIds([]);
  }, []);

  const applySelectedRecords = useCallback(async () => {
    if (!selectedRun) {
      showToast('请先选择一条审计记录', 'warning');
      return;
    }

    const normalizedSelectedIds = normalizeStringArray(selectedRecordIds);
    if (normalizedSelectedIds.length === 0) {
      showToast('请至少选择一条待发布记录', 'warning');
      return;
    }

    const jobLabel = selectedRun.job_label || selectedRun.job_id;
    if (!window.confirm(`确定要发布 ${jobLabel} 中选中的 ${normalizedSelectedIds.length} 条记录吗？`)) {
      return;
    }

    const actionKey = `apply:${selectedRun.job_id}`;
    setActionLoading(actionKey);
    setLastApplyResult(null);

    try {
      let result = null;

      if (selectedRun.job_id === 'official-announcements') {
        result = await opsAutomationService.applyOfficialAnnouncementsRun({
          runId: selectedRun.id,
          sourceIds: normalizedSelectedIds,
          reviewNote,
        });
      } else if (selectedRun.job_id === 'pool-schedule') {
        result = await opsAutomationService.applyPoolScheduleRun({
          runId: selectedRun.id,
          poolIds: normalizedSelectedIds,
          reviewNote,
        });
      } else {
        showToast('当前任务暂不支持一键发布', 'warning');
        return;
      }

      setLastApplyResult(result);
      await loadRuns(jobFilter, { preferredRunId: selectedRun.id });
      showToast(`已发布 ${normalizedSelectedIds.length} 条记录`, 'success');
    } catch (error) {
      setLastApplyResult(error?.result || null);

      const blockedCount = Array.isArray(error?.result?.plan?.blocked_records)
        ? error.result.plan.blocked_records.length
        : 0;
      const toastType = blockedCount > 0 ? 'warning' : 'error';
      showToast(error.message, toastType);

      await loadRuns(jobFilter, { preferredRunId: selectedRun.id });
    } finally {
      setActionLoading(null);
    }
  }, [jobFilter, loadRuns, reviewNote, selectedRecordIds, selectedRun, showToast]);

  return {
    jobFilter,
    setJobFilter,
    runs,
    loading,
    actionLoading,
    selectedRunId,
    selectedRun,
    selectedRecordIds,
    reviewNote,
    setReviewNote,
    lastApplyResult,
    setupIssue,
    loadRuns,
    refreshRuns,
    triggerRuns,
    selectRun,
    toggleRecordSelection,
    selectPendingRecords,
    clearSelectedRecords,
    applySelectedRecords,
  };
}

export default useOpsAutomation;
