import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  buildAutomationAuditReport,
  buildManualReviewBundle,
  writeJsonArtifact,
} from './lib/opsAutomationCore.mjs';
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

console.log('OPS-002 automation foundation verification passed');
