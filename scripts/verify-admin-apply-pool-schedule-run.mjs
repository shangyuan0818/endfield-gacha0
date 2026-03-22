import assert from 'node:assert/strict';

import { handleAdminApplyPoolSchedule } from '../api/admin-apply-pool-schedule-run.js';
import { buildPoolScheduleApplyPlan } from '../api/_lib/poolScheduleAutomation.js';

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

function createMockAdminClient({ run, characters }) {
  const state = {
    run: structuredClone(run),
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

      if (table === 'characters') {
        return {
          async select() {
            return {
              data: structuredClone(characters),
              error: null,
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

const characters = [
  { id: 'char_luoxi', name: '洛茜', aliases: [], type: 'character' },
  { id: 'char_tangtang', name: '汤汤', aliases: [], type: 'character' },
  { id: 'char_yvonne', name: '伊冯', aliases: [], type: 'character' },
];

const run = {
  id: 'run_pool_schedule_apply',
  job_id: 'pool-schedule',
  status: 'success',
  dry_run: true,
  review_bundle: {
    review: {
      status: 'pending_manual_review',
      requiresApproval: true,
      approvalMode: 'manual-review',
      appliedPoolIds: [],
    },
    snapshots: {
      incoming: [
        {
          pool_id: 'special_blocked_001',
          name: '限定-阻塞示例',
          type: 'limited',
          start_time: '2026-03-29T04:00:00.000Z',
          end_time: null,
          up_character: '洛茜',
          featured_characters: ['char_luoxi'],
          featured_character_names: ['洛茜', '未知角色'],
        },
        {
          pool_id: 'special_apply_001',
          name: '限定-洛茜',
          type: 'limited',
          start_time: '2026-03-29T04:00:00.000Z',
          end_time: '2026-04-12T03:59:00.000Z',
          up_character: '洛茜',
          featured_characters: ['char_luoxi', 'char_tangtang', 'char_yvonne'],
          featured_character_names: ['洛茜', '汤汤', '伊冯'],
          description: '限定-洛茜（官方公告自动解析）',
          banner_url: null,
        },
      ],
    },
  },
};

const plan = buildPoolScheduleApplyPlan(run.review_bundle, { characters });
assert.equal(plan.summary.applicable, 1, '应只允许 1 个完整卡池进入发布计划');
assert.equal(plan.summary.blocked, 1, '缺失结束时间或角色映射时应阻塞发布');
assert.deepEqual(
  plan.blockedRecords[0].issues.map(issue => issue.code),
  ['missing_end_time', 'unresolved_featured_characters'],
  '阻塞计划应显式列出缺失时间和未映射角色',
);

const rpcCalls = [];
const userClient = {
  async rpc(name, payload) {
    rpcCalls.push({ name, payload });
    return { error: null };
  },
};

const adminClient = createMockAdminClient({ run, characters });
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
    poolIds: ['special_apply_001'],
    reviewNote: '通过脚本验证定向发布单池能力',
  },
};
const res = createMockResponse();

await handleAdminApplyPoolSchedule(req, res, {
  getAdminClient: () => adminClient,
  getCallerClient: () => callerClient,
  createUserClient: (accessToken) => {
    assert.equal(accessToken, 'valid-token');
    return userClient;
  },
  now: () => '2026-03-22T12:00:00.000Z',
});

assert.equal(res.statusCode, 200, '定向发布可应用卡池时接口应返回 200');
assert.equal(res.payload?.success, true, '发布成功时 success 应为 true');
assert.deepEqual(res.payload?.applied_pool_ids, ['special_apply_001'], '应返回本次已发布 pool_id');
assert.equal(rpcCalls.length, 1, '应只对被选中的可应用卡池执行一次 RPC');
assert.equal(rpcCalls[0].name, 'admin_upsert_pool_with_aliases', '应复用现有原子写入 RPC');
assert.deepEqual(
  rpcCalls[0].payload.p_pool_character_rows,
  [
    { character_id: 'char_luoxi', is_up: true },
    { character_id: 'char_tangtang', is_up: false },
    { character_id: 'char_yvonne', is_up: false },
  ],
  '发布时应同步构建 pool_characters 初始集并标记 UP 项',
);
assert.equal(
  adminClient.__state.run.review_bundle.review.status,
  'partially_applied',
  '当同一审核包仍含阻塞项时，发布后状态应保持为 partially_applied',
);
assert.deepEqual(
  adminClient.__state.run.review_bundle.review.appliedPoolIds,
  ['special_apply_001'],
  '审核包应记录已发布 pool_id，避免重复应用',
);

console.log('DATA-NEW-012 pool schedule apply verification passed');
