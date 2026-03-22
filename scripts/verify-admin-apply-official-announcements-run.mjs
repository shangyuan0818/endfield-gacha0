import assert from 'node:assert/strict';

import { handleAdminApplyOfficialAnnouncements } from '../api/admin-ops-automation.js';
import { buildOfficialAnnouncementApplyPlan } from '../api/_lib/officialAnnouncementAutomation.js';

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

function createMockAdminClient({ run, existingAnnouncements = [] }) {
  const state = {
    run: structuredClone(run),
    existingAnnouncements: structuredClone(existingAnnouncements),
  };

  return {
    __state: state,
    from(table) {
      if (table === 'profiles') {
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
                id: 'user_super_admin',
                role: 'super_admin',
              },
              error: null,
            };
          },
        };
      }

      if (table === 'ops_automation_runs') {
        const builder = {
          mode: 'select',
          payload: null,
          select() {
            return this;
          },
          update(payload) {
            this.mode = 'update';
            this.payload = payload;
            return this;
          },
          eq() {
            return this;
          },
          async single() {
            if (this.mode === 'update') {
              state.run = {
                ...state.run,
                ...this.payload,
              };
              return {
                data: {
                  id: state.run.id,
                  review_bundle: state.run.review_bundle,
                },
                error: null,
              };
            }

            return {
              data: structuredClone(state.run),
              error: null,
            };
          },
        };

        return builder;
      }

      if (table === 'announcements') {
        const builder = {
          sourceIds: [],
          select() {
            return this;
          },
          in(_column, sourceIds) {
            this.sourceIds = sourceIds;
            return this;
          },
          then(resolve) {
            const rows = state.existingAnnouncements.filter(item => this.sourceIds.includes(item.source_id));
            return Promise.resolve(resolve({
              data: structuredClone(rows),
              error: null,
            }));
          },
          async catch() {
            return undefined;
          },
        };

        return builder;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

const run = {
  id: 'run_official_announcements_apply',
  job_id: 'official-announcements',
  status: 'success',
  dry_run: true,
  review_bundle: {
    review: {
      status: 'pending_manual_review',
      requiresApproval: true,
      approvalMode: 'manual-review',
      appliedSourceIds: [],
    },
    snapshots: {
      incoming: [
        {
          source_id: '6003',
          title: '版本更新说明',
          summary: '版本维护与活动预告',
          content: '<p>内容 A</p>',
          version: 'hg-1741766400-6003',
          published_at: '2026-03-12T04:00:00.000Z',
          source_url: 'https://endfield.hypergryph.com/news/6003',
          is_active: true,
        },
        {
          source_id: '6004',
          title: '公测活动说明',
          summary: '活动细则',
          content: '<p>内容 B</p>',
          version: 'hg-1741852800-6004',
          published_at: '2026-03-13T04:00:00.000Z',
          source_url: 'https://endfield.hypergryph.com/news/6004',
          is_active: true,
        },
      ],
    },
  },
};

const plan = buildOfficialAnnouncementApplyPlan(run.review_bundle, {
  selectedSourceIds: ['6003'],
});
assert.equal(plan.summary.applicable, 1, '应支持按 source_id 定向发布单条公告');
assert.equal(plan.applicableRecords[0].source_id, '6003', '应保留选中的公告 source_id');

const insertedRows = [];
const updatedRows = [];
const userClient = {
  from(table) {
    assert.equal(table, 'announcements', '应仅写入 announcements 表');

    return {
      insert(payload) {
        insertedRows.push(payload);
        return {
          async then(resolve) {
            return resolve({ error: null });
          },
          async catch() {
            return undefined;
          },
        };
      },
      update(payload) {
        return {
          eq(column, id) {
            updatedRows.push({ column, id, payload });
            return {
              async then(resolve) {
                return resolve({ error: null });
              },
              async catch() {
                return undefined;
              },
            };
          },
        };
      },
    };
  },
};

const adminClient = createMockAdminClient({
  run,
  existingAnnouncements: [
    {
      id: 'announcement_row_6003',
      source_id: '6003',
      is_active: true,
      priority: -80,
    },
  ],
});

const callerClient = {
  auth: {
    async getUser(accessToken) {
      assert.equal(accessToken, 'valid-token', '应沿用调用者 access token 建立发布客户端');
      return {
        data: {
          user: {
            id: 'user_super_admin',
          },
        },
        error: null,
      };
    },
  },
};

const req = {
  method: 'POST',
  headers: {
    authorization: 'Bearer valid-token',
    origin: 'http://localhost:5173',
  },
  body: {
    runId: run.id,
    sourceIds: ['6003', '6004'],
    reviewNote: '验证自动公告发布',
  },
};
const res = createMockResponse();

await handleAdminApplyOfficialAnnouncements(req, res, {
  getAdminClient: () => adminClient,
  getCallerClient: () => callerClient,
  createUserClient: (accessToken) => {
    assert.equal(accessToken, 'valid-token');
    return userClient;
  },
  now: () => '2026-03-22T12:00:00.000Z',
});

assert.equal(res.statusCode, 200, '发布官方公告时接口应返回 200');
assert.equal(res.payload?.success, true, '发布成功时 success 应为 true');
assert.deepEqual(
  res.payload?.applied_source_ids,
  ['6003', '6004'],
  '应返回本次已发布的 source_id 列表',
);

assert.equal(updatedRows.length, 1, '已存在的自动公告应走 update');
assert.equal(updatedRows[0].id, 'announcement_row_6003', '更新应命中已存在 source_id 的公告行');
assert.equal(updatedRows[0].payload.priority, -80, '更新已有自动公告时应保留原优先级');

assert.equal(insertedRows.length, 1, '新公告应走 insert');
assert.equal(insertedRows[0].source_id, '6004', '插入时应保留 source_id');
assert.equal(insertedRows[0].priority, -100, '自动游戏公告默认应下沉优先级，避免抢占站点公告');

assert.equal(
  adminClient.__state.run.review_bundle.review.status,
  'applied',
  '全部所选公告应用完成后，审核包状态应更新为 applied',
);
assert.deepEqual(
  adminClient.__state.run.review_bundle.review.appliedSourceIds,
  ['6003', '6004'],
  '审核包应记录已发布 source_id，避免重复应用',
);

console.log('DATA-NEW-011 official announcements apply verification passed');
