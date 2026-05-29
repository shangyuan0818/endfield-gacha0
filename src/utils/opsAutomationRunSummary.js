export const OPS_AUTOMATION_JOB_LABELS = Object.freeze({
  'official-announcements': '官方公告同步',
  'pool-schedule': '卡池轮换同步',
  'wiki-catalog': '图鉴巡检提醒',
  all: '全链路自动化',
});

export const OPS_AUTOMATION_FAILURE_LABELS = Object.freeze({
  config: '配置缺失',
  source_fetch: '上游源失败',
  database_write: '数据库写入失败',
  llm: '摘要生成失败',
  cache_invalidation: '缓存失效失败',
  unexpected: '未分类异常',
});

export function getOpsAutomationJobLabel(jobId) {
  return OPS_AUTOMATION_JOB_LABELS[jobId] || jobId || '未知任务';
}

export function getOpsAutomationNode(run) {
  if (!run || typeof run !== 'object') {
    return null;
  }

  if (run.summary?.ops && typeof run.summary.ops === 'object') {
    return run.summary.ops;
  }

  if (run.review_bundle?.node && typeof run.review_bundle.node === 'object') {
    return run.review_bundle.node;
  }

  return null;
}

export function getOpsAutomationPresentationStatus(run) {
  const node = getOpsAutomationNode(run);
  if (node?.presentationStatus) {
    return node.presentationStatus;
  }
  if (node?.partial) {
    return 'partial';
  }
  if (run?.summary?.partial) {
    return 'partial';
  }
  return run?.status || 'unknown';
}

export function getOpsAutomationStatusLabel(run) {
  switch (getOpsAutomationPresentationStatus(run)) {
    case 'success':
      return '成功';
    case 'partial':
      return '部分成功';
    case 'failure':
      return '失败';
    case 'skipped':
      return '跳过';
    default:
      return run?.status || '未知';
  }
}

export function getOpsAutomationFailureLabel(failureType) {
  return OPS_AUTOMATION_FAILURE_LABELS[failureType] || failureType || '无';
}

export function normalizeOpsAutomationAttempts(run) {
  const node = getOpsAutomationNode(run);
  if (Array.isArray(node?.attempts)) {
    return node.attempts;
  }
  if (Array.isArray(run?.review_bundle?.node?.attempts)) {
    return run.review_bundle.node.attempts;
  }
  return [];
}

export function normalizeOpsAutomationWarnings(run) {
  const node = getOpsAutomationNode(run);
  const warnings = [
    ...(Array.isArray(node?.warnings) ? node.warnings : []),
    run?.summary?.warning,
    run?.error_message,
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean);

  return [...new Set(warnings)];
}

export function formatOpsAutomationDuration(durationMs) {
  const value = Number(durationMs);
  if (!Number.isFinite(value) || value < 0) {
    return '未记录';
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}s`;
}

function pushCount(parts, label, value) {
  const numericValue = Number(value || 0);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    parts.push(`${label} ${numericValue}`);
  }
}

export function formatOpsAutomationRunSummary(run) {
  const summary = run?.summary || {};
  const node = getOpsAutomationNode(run);
  const output = node?.output || summary;
  const parts = [];

  pushCount(parts, '写入', output.synced);
  pushCount(parts, '新增', output.created);
  pushCount(parts, '更新', output.updated);
  pushCount(parts, '跳过', output.skipped);
  pushCount(parts, '重算', output.summarized);
  pushCount(parts, '解析', output.parsed);
  pushCount(parts, '发现', output.found);
  pushCount(parts, '摘要失败', output.summaryFailed || summary.summaryFailed);
  pushCount(parts, '未收录', output.unresolvedCount);

  if (node?.retryCount > 0) {
    parts.push(`重试 ${node.retryCount}`);
  }
  if (node?.durationMs != null) {
    parts.push(`耗时 ${formatOpsAutomationDuration(node.durationMs)}`);
  }
  if (node?.failureType) {
    parts.push(getOpsAutomationFailureLabel(node.failureType));
  }

  return parts.join(' / ');
}

export function buildOpsAutomationTriggerMessage(jobId, result = {}, refreshMode = 'incremental') {
  if (jobId === 'official-announcements') {
    const summary = result.announcements || {};
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

  const graph = Array.isArray(result.jobGraph) ? result.jobGraph : [];
  const graphSummary = graph
    .map(node => `${node.label || getOpsAutomationJobLabel(node.id)}:${node.presentationStatus || node.status}`)
    .join(' / ');
  const partialSuffix = result.partial ? '，存在部分成功项' : '';

  if (jobId === 'pool-schedule') {
    const pools = result.pools || {};
    return `卡池轮换同步完成：解析 ${Number(pools.parsed || 0)} 项，新增 ${Number(pools.created || 0)} 项，更新 ${Number(pools.updated || 0)} 项${partialSuffix}`;
  }
  if (jobId === 'wiki-catalog') {
    const check = result.newCharacterCheck || {};
    return `图鉴巡检完成：发现 ${Number(check.found || 0)} 个未收录项${partialSuffix}`;
  }

  return `自动化执行完成${graphSummary ? `：${graphSummary}` : ''}${partialSuffix}`;
}
