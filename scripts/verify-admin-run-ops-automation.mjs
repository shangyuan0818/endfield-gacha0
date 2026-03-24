import assert from 'node:assert/strict';

import { handleAdminRunOpsAutomation } from '../api/admin-ops-automation.js';

function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
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
      return this;
    },
    end(payload = null) {
      this.payload = payload;
      return this;
    },
  };
}

function createMockAdminClient() {
  return {
    from(table) {
      assert.equal(table, 'profiles', '手动 dry-run 鉴权阶段应只查询 profiles');

      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return {
            data: {
              id: 'super_admin_user',
              role: 'super_admin',
            },
            error: null,
          };
        },
      };
    },
  };
}

const unauthorizedReq = {
  method: 'POST',
  headers: {},
  body: {},
};
const unauthorizedRes = createMockResponse();

await handleAdminRunOpsAutomation(unauthorizedReq, unauthorizedRes, {
  getAdminClient: () => createMockAdminClient(),
  getCallerClient: () => ({
    auth: {
      async getUser() {
        return {
          data: { user: null },
          error: new Error('invalid'),
        };
      },
    },
  }),
});

assert.equal(unauthorizedRes.statusCode, 401, '缺少 access token 时应返回 401');

const invalidJobReq = {
  method: 'POST',
  headers: {
    authorization: 'Bearer valid-token',
    origin: 'http://localhost:5173',
    host: 'localhost:5173',
  },
  body: {
    jobIds: ['unknown-job'],
  },
};
const invalidJobRes = createMockResponse();

await handleAdminRunOpsAutomation(invalidJobReq, invalidJobRes, {
  getAdminClient: () => createMockAdminClient(),
  getCallerClient: () => ({
    auth: {
      async getUser(accessToken) {
        assert.equal(accessToken, 'valid-token', '应使用调用者 access token 鉴权');
        return {
          data: {
            user: {
              id: 'super_admin_user',
            },
          },
          error: null,
        };
      },
    },
  }),
});

assert.equal(invalidJobRes.statusCode, 400, '未知任务应返回 400');

const runCalls = [];
const successReq = {
  method: 'POST',
  headers: {
    authorization: 'Bearer valid-token',
    origin: 'http://localhost:5173',
    host: 'localhost:5173',
  },
  body: {
    jobIds: ['official-announcements', 'pool-schedule'],
  },
};
const successRes = createMockResponse();

await handleAdminRunOpsAutomation(successReq, successRes, {
  env: {
    OPS_AUTOMATION_ANNOUNCEMENTS_URL: 'https://example.com/announcements.json',
    OPS_AUTOMATION_POOL_SCHEDULE_URL: 'https://example.com/pools.json',
  },
  getAdminClient: () => createMockAdminClient(),
  getCallerClient: () => ({
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: 'super_admin_user',
            },
          },
          error: null,
        };
      },
    },
  }),
  runJob: async (payload) => {
    runCalls.push(payload);
    return {
      jobId: payload.jobId,
      status: 'success',
      runId: `run_${payload.jobId}`,
    };
  },
  now: () => new Date('2026-03-22T10:00:00.000Z'),
});

assert.equal(successRes.statusCode, 200, '手动 dry-run 成功时应返回 200');
assert.equal(successRes.payload?.success, true, '成功时 success 应为 true');
assert.deepEqual(
  runCalls.map(item => item.jobId),
  ['official-announcements', 'pool-schedule'],
  '应按请求的 jobIds 串行执行 dry-run',
);
assert.ok(
  runCalls.every(item => item.triggerType === 'manual' && item.dryRun === true),
  '手动触发应固定为 manual + dryRun',
);
assert.ok(
  runCalls.every(item => item.sourceBaseUrl === 'https://localhost:5173'),
  '应向任务执行器传递当前请求 baseUrl，以便回退到站内 feed',
);

const skippedRes = createMockResponse();
await handleAdminRunOpsAutomation(successReq, skippedRes, {
  env: {
    OPS_AUTOMATION_ANNOUNCEMENTS_URL: 'https://example.com/announcements.json',
    OPS_AUTOMATION_POOL_SCHEDULE_URL: 'https://example.com/pools.json',
  },
  getAdminClient: () => createMockAdminClient(),
  getCallerClient: () => ({
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: 'super_admin_user',
            },
          },
          error: null,
        };
      },
    },
  }),
  runJob: async (payload) => ({
    jobId: payload.jobId,
    status: payload.jobId === 'pool-schedule' ? 'skipped' : 'success',
    runId: `run_${payload.jobId}`,
  }),
  now: () => new Date('2026-03-22T10:00:00.000Z'),
});

assert.equal(skippedRes.statusCode, 200, '仅包含 skipped + success 时不应把整次手动 dry-run 判定为失败');
assert.equal(skippedRes.payload?.success, true, '仅 skipped 时仍应视为请求成功');

console.log('OPS-002 admin manual dry-run verification passed');
