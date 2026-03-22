import assert from 'node:assert/strict';

import handler from '../api/ops-automation.js';
import {
  authorizeOpsAutomationRequest,
  buildOpsAutomationDedupeKey,
  getOpsAutomationSourceConfig,
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

const envBackup = {
  CRON_SECRET: process.env.CRON_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

process.env.CRON_SECRET = 'ops-secret';
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
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

console.log('OPS-002 scheduled automation API verification passed');
