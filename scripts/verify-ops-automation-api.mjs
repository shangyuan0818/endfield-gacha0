import assert from 'node:assert/strict';

import handler from '../api/_routes/root/ops-automation.js';
import { __internal as runOpsAutomationInternal } from '../api/_lib/runOpsAutomation.js';
import {
  authorizeOpsAutomationRequest,
  buildOpsAutomationDedupeKey,
  getOpsAutomationSourceConfig,
  getLatestVersionMaintenanceWindow,
  getOpsAutomationMaintenanceGate,
  normalizeOpsAutomationSourceRecords,
  parseRequestedJobIds,
} from '../api/_lib/opsAutomation.js';

function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    getHeader(name) {
      return this.headers[name];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      this.ended = true;
      return this;
    },
    end(payload = null) {
      this.payload = payload;
      this.ended = true;
      return this;
    },
  };
}

const allJobIds = parseRequestedJobIds('all');
assert.equal(allJobIds.length, 3, 'all 应返回全部自动化任务');

const selectedJobIds = parseRequestedJobIds('official-announcements,pool-schedule');
assert.deepEqual(
  selectedJobIds,
  ['official-announcements', 'pool-schedule'],
  'job 查询应支持逗号分隔',
);

assert.throws(
  () => parseRequestedJobIds('unknown-job'),
  /Unknown ops automation job/,
  '未知任务应直接拒绝',
);

const authResult = authorizeOpsAutomationRequest({
  headers: {
    authorization: 'Bearer ops-secret',
  },
}, {
  CRON_SECRET: 'ops-secret',
});
assert.equal(authResult.ok, true, '合法 CRON_SECRET 应通过鉴权');

const sourceConfig = getOpsAutomationSourceConfig('pool-schedule', {
  OPS_AUTOMATION_POOL_SCHEDULE_URL: 'https://example.com/pools.json',
  OPS_AUTOMATION_POOL_SCHEDULE_TAG: 'official-json',
});
assert.equal(sourceConfig.url, 'https://example.com/pools.json', '应正确读取任务源 URL');
assert.equal(sourceConfig.tag, 'official-json', '应正确读取任务源标签');

const normalizedAnnouncementRecords = normalizeOpsAutomationSourceRecords('official-announcements', {
  records: [
    {
      id: 'notice-001',
      title: '测试公告',
      excerpt: '摘要',
      body: '正文',
      url: 'https://example.com/notices/1',
      date: '2026-03-22T00:00:00.000Z',
    },
  ],
});
assert.equal(normalizedAnnouncementRecords[0].source_id, 'notice-001', '公告源数据应归一化到 source_id');
assert.equal(normalizedAnnouncementRecords[0].summary, '摘要', '公告摘要应被保留');

const maintenanceWindow = getLatestVersionMaintenanceWindow([
  {
    source_id: 'notice-maintenance',
    title: '「新潮起，故渊离」版本更新说明',
    content: '<p>更新维护时间：2026/03/22 10:00 - 2026/03/22 12:00</p>',
    published_at: '2026-03-22T01:00:00.000Z',
    source_url: 'https://example.com/notices/maintenance',
  },
  {
    source_id: 'notice-other',
    title: '普通公告',
    content: '<p>无维护时间</p>',
    published_at: '2026-03-21T01:00:00.000Z',
    source_url: 'https://example.com/notices/other',
  },
]);
assert.equal(maintenanceWindow?.source_id, 'notice-maintenance', '应从版本更新说明中提取最新维护窗口');
assert.equal(maintenanceWindow?.end_time, '2026-03-22T04:00:00.000Z', '维护结束时间应按东八区解析为 ISO');

const maintenanceGate = await getOpsAutomationMaintenanceGate('wiki-catalog', {
  env: {
    OPS_AUTOMATION_ANNOUNCEMENTS_URL: 'https://example.com/announcements.json',
  },
  sourceBaseUrl: 'https://example.com',
  fetchImpl: async () => ({
    ok: true,
    json: async () => ({
      records: [
        {
          source_id: 'notice-maintenance',
          title: '「新潮起，故渊离」版本更新说明',
          content: '<p>更新维护时间：2026/03/22 10:00 - 2026/03/22 12:00</p>',
          published_at: '2026-03-22T01:00:00.000Z',
          source_url: 'https://example.com/notices/maintenance',
        },
      ],
    }),
    status: 200,
    statusText: 'OK',
  }),
  now: new Date('2026-03-22T03:00:00.000Z'),
});
assert.equal(maintenanceGate.blocked, true, '维护结束前，图鉴巡检应被公告窗口阻塞');
assert.match(maintenanceGate.reason, /维护结束后才开始更新图鉴与卡池数据/, '阻塞原因应明确说明等待维护结束');

const dedupeKey = buildOpsAutomationDedupeKey(
  'pool-schedule',
  'cron',
  new Date('2026-03-22T02:00:00.000Z'),
);
assert.equal(
  dedupeKey,
  'cron:pool-schedule:2026-03-22',
  'cron 调度应生成按天去重键',
);

const automationPayload = runOpsAutomationInternal.buildOpsAutomationHttpPayload({
  ok: true,
  partial: true,
  results: {
    announcements: { synced: 1, meta: { presentationStatus: 'partial' } },
  },
  jobGraph: [
    {
      id: 'official-announcements',
      presentationStatus: 'partial',
      retryCount: 1,
      failureType: 'llm',
    },
  ],
});
assert.equal(automationPayload.success, true, '自动化 HTTP payload 应保留 success=true');
assert.equal(automationPayload.partial, true, '自动化 HTTP payload 应暴露 partial');
assert.equal(automationPayload.jobGraph[0].failureType, 'llm', '自动化 HTTP payload 应暴露 jobGraph 失败分类');
assert.equal(automationPayload.announcements.synced, 1, '自动化 HTTP payload 应保留旧 announcements 字段');

const envBackup = {
  CRON_SECRET: process.env.CRON_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

process.env.CRON_SECRET = 'ops-secret';
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const unauthorizedReq = {
  method: 'GET',
  headers: {},
  query: {},
};
const unauthorizedRes = createMockResponse();
await handler(unauthorizedReq, unauthorizedRes);
assert.equal(unauthorizedRes.statusCode, 401, '缺少 Authorization 时接口应返回 401');

const noSupabaseReq = {
  method: 'GET',
  headers: {
    authorization: 'Bearer ops-secret',
  },
  query: {},
};
const noSupabaseRes = createMockResponse();
await handler(noSupabaseReq, noSupabaseRes);
assert.equal(noSupabaseRes.statusCode, 503, '缺少 Supabase 管理端环境变量时应返回 503');

if (envBackup.CRON_SECRET === undefined) {
  delete process.env.CRON_SECRET;
} else {
  process.env.CRON_SECRET = envBackup.CRON_SECRET;
}

if (envBackup.SUPABASE_URL === undefined) {
  delete process.env.SUPABASE_URL;
} else {
  process.env.SUPABASE_URL = envBackup.SUPABASE_URL;
}

if (envBackup.VITE_SUPABASE_URL === undefined) {
  delete process.env.VITE_SUPABASE_URL;
} else {
  process.env.VITE_SUPABASE_URL = envBackup.VITE_SUPABASE_URL;
}

if (envBackup.SUPABASE_SERVICE_ROLE_KEY === undefined) {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
} else {
  process.env.SUPABASE_SERVICE_ROLE_KEY = envBackup.SUPABASE_SERVICE_ROLE_KEY;
}

if (envBackup.SUPABASE_SECRET_KEY === undefined) {
  delete process.env.SUPABASE_SECRET_KEY;
} else {
  process.env.SUPABASE_SECRET_KEY = envBackup.SUPABASE_SECRET_KEY;
}

console.log('OPS-006 scheduled automation API verification passed');
