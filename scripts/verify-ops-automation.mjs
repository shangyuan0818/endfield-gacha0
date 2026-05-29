import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildAutomationAuditReport,
  buildManualReviewBundle,
  writeJsonArtifact,
} from './lib/opsAutomationCore.mjs';
import { __internal as runOpsAutomationInternal } from '../api/_lib/runOpsAutomation.js';
import { getOpsAutomationJob } from './lib/opsAutomationJobRegistry.mjs';
import { runOpsAutomation } from './run-ops-automation.mjs';

async function captureCliRun(argv) {
  const stdout = [];
  const stderr = [];

  await runOpsAutomation(argv, {
    log: (...args) => {
      stdout.push(args.join(' '));
    },
    error: (...args) => {
      stderr.push(args.join(' '));
    },
  });

  return {
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
  };
}

const job = getOpsAutomationJob('official-announcements');
assert.ok(job, '应能找到 official-announcements 任务定义');

const currentRecords = [
  {
    source_id: 'notice-001',
    title: '旧公告',
    summary: '旧摘要',
    content: '旧内容',
    published_at: '2026-03-20T08:00:00.000Z',
    version: '3.4.0',
    source_url: 'https://example.com/notice-001',
    is_active: true,
  },
  {
    source_id: 'notice-002',
    title: '待下线公告',
    summary: '旧摘要-2',
    content: '旧内容-2',
    published_at: '2026-03-19T08:00:00.000Z',
    version: '3.4.0',
    source_url: 'https://example.com/notice-002',
    is_active: true,
  },
];

const incomingRecords = [
  {
    source_id: 'notice-001',
    title: '旧公告',
    summary: '新摘要',
    content: '新内容',
    published_at: '2026-03-20T08:00:00.000Z',
    version: '3.5.0',
    source_url: 'https://example.com/notice-001',
    is_active: true,
  },
  {
    source_id: 'notice-003',
    title: '新公告',
    summary: '新增摘要',
    content: '新增内容',
    published_at: '2026-03-21T08:00:00.000Z',
    version: '3.5.0',
    source_url: 'https://example.com/notice-003',
    is_active: true,
  },
];

const audit = buildAutomationAuditReport({
  job,
  currentRecords,
  incomingRecords,
  dryRun: true,
  sourceMeta: {
    tag: 'fixture',
  },
});

assert.deepEqual(audit.summary, {
  current: 2,
  incoming: 2,
  added: 1,
  updated: 1,
  unchanged: 0,
  removed: 0,
}, '非权威全量镜像源的审计摘要不应把缺席记录视作删除');
assert.equal(audit.preview.updated[0].key, 'notice-001', '更新预览应保留主键');
assert.ok(audit.topChangedFields.some(item => item.field === 'content'), '字段统计应包含 content');
assert.equal(audit.job.allowRemovalPreview, false, '官方公告同步应显式禁用删除预览');

const poolJob = getOpsAutomationJob('pool-schedule');
const poolAudit = buildAutomationAuditReport({
  job: poolJob,
  currentRecords: [
    {
      pool_id: 'legacy_pool_tangtang_001',
      name: '河流的女儿',
      type: 'limited',
      start_time: '2026-03-12T04:00:00.000Z',
      end_time: '2026-03-29T03:59:00.000Z',
      up_character: '汤汤',
      featured_characters: ['char_tangtang'],
      banner_url: null,
    },
  ],
  incomingRecords: [
    {
      pool_id: 'manual_pool_limited_tangtang_20260312_abcd12',
      name: '河流的女儿',
      type: 'limited',
      start_time: '2026-03-12T04:00:00.000Z',
      end_time: '2026-03-30T03:59:00.000Z',
      up_character: '汤汤',
      featured_characters: ['char_tangtang'],
      banner_url: null,
    },
  ],
  dryRun: true,
});

assert.deepEqual(poolAudit.summary, {
  current: 1,
  incoming: 1,
  added: 0,
  updated: 1,
  unchanged: 0,
  removed: 0,
}, '卡池审计应以稳定审计键归并同一池，不能因 pool_id 变化误判为新增/删除');
assert.equal(
  poolAudit.preview.updated[0].key,
  'limited|汤汤|2026-03-12',
  '卡池审计预览应使用稳定审计键，而不是公告侧临时 pool_id',
);

const bundle = buildManualReviewBundle({
  job,
  currentRecords,
  incomingRecords,
  dryRun: true,
});
assert.equal(bundle.review.status, 'pending_manual_review', '审核包应默认处于待人工审核状态');
assert.equal(bundle.snapshots.incoming.length, 2, '审核包应保留完整 incoming 快照');

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ops-automation-'));
const currentPath = path.join(tempDir, 'current.json');
const incomingPath = path.join(tempDir, 'incoming.json');
const reportPath = path.join(tempDir, 'report.json');
const bundlePath = path.join(tempDir, 'bundle.json');

await writeJsonArtifact(currentPath, currentRecords);
await writeJsonArtifact(incomingPath, incomingRecords);

const cliResult = await captureCliRun([
  '--job', 'official-announcements',
  '--current', currentPath,
  '--incoming', incomingPath,
  '--write-json', reportPath,
  '--write-bundle', bundlePath,
  '--source-tag', 'fixture-cli',
]);

assert.match(cliResult.stdout, /官方公告同步/, 'CLI 输出应包含任务名称');

const writtenReport = JSON.parse(await readFile(reportPath, 'utf8'));
const writtenBundle = JSON.parse(await readFile(bundlePath, 'utf8'));

assert.equal(writtenReport.summary.added, 1, 'CLI 审计报告应正确写出新增数量');
assert.equal(writtenBundle.review.requiresApproval, true, 'CLI 审核包应要求人工确认');

const retryDelays = [];
const retryResult = await runOpsAutomationInternal.runWithRetry({
  jobId: 'official-announcements',
  retry: { maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 5 },
  wait: async (ms) => {
    retryDelays.push(ms);
  },
  task: async ({ attempt }) => (
    attempt === 1
      ? { error: 'Official news API fetch failed: timeout after 15000ms' }
      : { synced: 1, created: 1, total: 1 }
  ),
});

assert.equal(retryResult.attempts.length, 2, '硬失败应按 job retry 配置重试');
assert.equal(retryResult.attempts[0].retryable, true, '源站超时应被标记为可重试');
assert.deepEqual(retryDelays, [5], '重试应记录退避时间');
assert.equal(retryResult.result.synced, 1, '重试成功后应返回最终成功结果');

const writeFailureRetry = await runOpsAutomationInternal.runWithRetry({
  jobId: 'pool-schedule',
  retry: { maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 5 },
  wait: async () => {},
  task: async ({ attempt }) => (
    attempt === 1
      ? { errors: [{ error: 'database write failed: upsert pool schedule' }] }
      : { parsed: 1, created: 1 }
  ),
});
assert.equal(writeFailureRetry.attempts.length, 2, '无写入的结构化 errors 硬失败也应重试');
assert.equal(writeFailureRetry.attempts[0].failureType, 'database_write', '结构化 errors 应保留失败分类');
assert.equal(writeFailureRetry.result.created, 1, '结构化 errors 重试成功后应返回最终结果');

const runContext = runOpsAutomationInternal.createRunContext({
  requestedJobIds: ['official-announcements'],
  triggerType: 'manual',
  createdBy: 'super-admin-id',
  forceRefresh: true,
  refreshMode: 'summary',
});
const partialResult = {
  synced: 1,
  created: 1,
  total: 2,
  summaryFailed: 1,
  summaryErrors: [{ source_id: 'notice-failed', title: '失败公告', error: 'LLM quota exceeded' }],
};
const partialNode = runOpsAutomationInternal.buildAutomationNodeSummary({
  jobId: 'official-announcements',
  result: partialResult,
  runContext,
  startedAt: '2026-05-22T00:00:00.000Z',
  finishedAt: '2026-05-22T00:00:01.000Z',
  durationMs: 1000,
  attempts: retryResult.attempts,
  input: { sourceTag: 'fixture' },
  status: 'success',
  dedupeKey: null,
});
const partialArtifacts = runOpsAutomationInternal.buildAutomationJobArtifacts({
  jobId: 'official-announcements',
  result: partialResult,
  node: partialNode,
  runContext,
  persistAction: 'inserted',
});

assert.equal(partialNode.presentationStatus, 'partial', 'LLM 摘要失败但有写入时应标记为部分成功');
assert.equal(partialNode.failureType, 'llm', '部分成功应保留失败分类');
assert.equal(partialArtifacts.summary.ops.presentationStatus, 'partial', 'summary.ops 应持久化展示状态');
assert.equal(partialArtifacts.reviewBundle.review.published, true, '有实际写入时审核包应标记已发布');
assert.equal(partialArtifacts.reviewBundle.review.partial, true, '审核包应保留部分成功语义');

const cacheRefreshCalls = [];
const cacheRefreshUpserts = [];
const cacheRefreshSupabase = {
  rpc(name) {
    cacheRefreshCalls.push(name);
    return Promise.resolve({
      data: {
        refreshedPools: 2,
        refreshedTrendRows: 6,
        updatedAt: '2026-06-05T12:00:00.000Z',
      },
      error: null,
    });
  },
  from(table) {
    assert.equal(table, 'site_config', '公共缓存刷新应只更新 site_config epoch');
    return {
      upsert(record, options) {
        cacheRefreshUpserts.push([record, options]);
        return Promise.resolve({ error: null });
      },
    };
  },
};

const cacheInvalidatedResult = await runOpsAutomationInternal.invalidatePublicCacheAfterMutation(
  cacheRefreshSupabase,
  'pool-schedule',
  { parsed: 1, updated: 1 },
  { triggerType: 'manual' },
);

assert.deepEqual(cacheRefreshCalls, ['refresh_public_analytics_cache'], '卡池同步写入后应刷新公共统计聚合缓存');
assert.equal(cacheInvalidatedResult.cacheInvalidation.ok, true, '公共缓存版本刷新成功应写入节点 meta');
assert.equal(cacheInvalidatedResult.cacheInvalidation.scope, 'pools', '卡池同步应刷新 pools scope');
assert.equal(cacheInvalidatedResult.cacheInvalidation.analyticsRefresh.refreshedTrendRows, 6, '节点 meta 应暴露趋势缓存刷新结果');
assert.equal(cacheRefreshUpserts.length, 1, '统计刷新后仍应 bump 公共缓存版本');

const failedRefreshSupabase = {
  rpc(name) {
    assert.equal(name, 'refresh_public_analytics_cache');
    return Promise.resolve({
      data: null,
      error: { message: 'refresh function timeout' },
    });
  },
  from(table) {
    assert.equal(table, 'site_config');
    return {
      upsert() {
        return Promise.resolve({ error: null });
      },
    };
  },
};

const cacheInvalidationPartial = await runOpsAutomationInternal.invalidatePublicCacheAfterMutation(
  failedRefreshSupabase,
  'pool-schedule',
  { parsed: 1, created: 1 },
  { triggerType: 'cron' },
);

assert.equal(cacheInvalidationPartial.cacheInvalidation.ok, true, '统计缓存刷新失败不应阻断公共缓存版本 bump');
assert.equal(cacheInvalidationPartial.cacheInvalidation.analyticsRefresh.ok, false, '失败结果应保留在 cacheInvalidation meta');
assert.match(cacheInvalidationPartial.warning, /公共统计缓存刷新失败/, '统计缓存刷新失败应写入 warning');

const persistCalls = [];
const mockSupabase = {
  from(table) {
    assert.equal(table, 'ops_automation_runs', '持久化应写入 ops_automation_runs');
    return {
      insert(record) {
        persistCalls.push(['insert', record.summary?.ops?.persistAction, record.review_bundle?.persistAction]);
        return Promise.resolve({ error: null });
      },
    };
  },
};

const persistResult = await runOpsAutomationInternal.persistAutomationRun(mockSupabase, {
  job_id: 'official-announcements',
  job_label: '官方公告同步',
  trigger_type: 'manual',
  status: 'success',
  dedupe_key: null,
  summary: partialArtifacts.summary,
  top_changed_fields: partialArtifacts.topChangedFields,
  preview: partialArtifacts.preview,
  review_bundle: partialArtifacts.reviewBundle,
  started_at: '2026-05-22T00:00:00.000Z',
  finished_at: '2026-05-22T00:00:01.000Z',
});

assert.equal(persistResult.action, 'inserted', '无 dedupe key 的手动运行应插入新记录');
assert.deepEqual(persistCalls, [['insert', 'inserted', 'inserted']], '持久化记录应写入 persistAction');

console.log('OPS-006 automation reliability verification passed');
