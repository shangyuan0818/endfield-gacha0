import assert from 'node:assert/strict';

import { __internal, handleOfficialAnnouncementsFeed as handler } from '../api/_routes/root/automation-feed.js';
import {
  __internal as presentationInternal,
  buildAnnouncementDisplayContent,
} from '../api/_lib/officialAnnouncementPresentation.js';
import { __internal as syncAnnouncementsInternal } from '../api/_lib/syncAnnouncements.js';
import { __internal as runOpsAutomationInternal } from '../api/_lib/runOpsAutomation.js';
import { getDefaultRunnableJobIds } from '../api/_lib/opsAutomation.js';

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

assert.equal(
  __internal.buildOfficialArticleUrl('5992'),
  'https://endfield.hypergryph.com/news/5992',
  '官方公告原文链接应可直接构造',
);

const runnableJobs = getDefaultRunnableJobIds({}, {
  baseUrl: 'https://example.com',
});
assert.deepEqual(
  runnableJobs,
  ['official-announcements', 'pool-schedule', 'wiki-catalog'],
  '默认可运行任务应包含已接好的公告、卡池与图鉴 feed',
);

const completeStructuredSummary = [
  '> 以下为站内整理版摘要，细节以官方原文为准。',
  '',
  '## 核心内容',
  '- 第一条重点',
  '',
  '## 重要时间',
  '- 03/12 维护结束后开启',
  '',
  '## 影响与建议',
  '- 留意活动时间和卡池信息',
].join('\n');
const modernStructuredSummary = [
  '> 以下为站内整理版摘要，细节以官方原文为准。',
  '',
  '## 摘要',
  '本次公告说明「春晓时」版本相关活动安排，重点覆盖参与方式、奖励范围与活动时间，玩家可按官方原文确认具体平台规则。',
  '',
  '## 要点',
  '- 活动面向多个社区平台开放，主要鼓励创作、直播、讨论和互动参与。',
  '- 奖励包含平台激励、现金奖励、游戏道具和周边实物，具体条件以对应平台页面为准。',
  '',
  '## 时间',
  '- 各平台活动时间不同，需要以官方原文和平台活动页公布为准。',
].join('\n');
const truncatedStructuredSummary = [
  '> 以下为站内整理版摘要，细节以官方原文为准。',
  '',
  '## 核心内容',
  '- 第一条重点',
  '',
  '## 活动奖励',
].join('\n');
const repetitiveStructuredSummary = [
  '> 以下为站内整理版摘要，细节以官方原文为准。',
  '',
  '## 核心内容',
  '- 管理员，《明日方舟：终末地》「春晓时」版本创作征集活动正在多个社区平台进行中。按对应要求进行内容创作与分享即可参与奖励。',
  '',
  '## 重要时间',
  '- 管理员，《明日方舟：终末地》「春晓时」版本创作征集活动正在多个社区平台进行中。按对应要求进行内容创作与分享即可参与奖励。',
  '',
  '## 影响与建议',
  '- 管理员，《明日方舟：终末地》「春晓时」版本创作征集活动正在多个社区平台进行中。按对应要求进行内容创作与分享即可参与奖励。',
].join('\n');

assert.equal(
  presentationInternal.isStructuredSummaryComplete(completeStructuredSummary),
  true,
  '完整 LLM 摘要应通过结构校验',
);
assert.equal(
  presentationInternal.isStructuredSummaryComplete(modernStructuredSummary),
  true,
  '新的短简报 LLM 摘要应通过结构校验',
);
assert.equal(
  presentationInternal.isStructuredSummaryComplete(truncatedStructuredSummary),
  false,
  '被截断或偏离固定结构的 LLM 摘要不应被写入公告内容',
);
assert.equal(
  presentationInternal.isStructuredSummaryComplete(repetitiveStructuredSummary),
  false,
  '重复复读原文或保留原始称呼的 LLM 摘要不应被写入公告内容',
);
assert.deepEqual(
  presentationInternal.parseAnnouncementLlmRateLimit('50 requests / 5 minutes'),
  { maxCalls: 50, windowMs: 5 * 60 * 1000 },
  '公告 LLM 限流配置应支持每窗口请求数写法',
);
assert.deepEqual(
  presentationInternal.parseAnnouncementLlmRateLimit('10RPM'),
  { maxCalls: 10, windowMs: 60 * 1000 },
  '公告 LLM 限流配置应支持 RPM 写法',
);
assert.equal(
  syncAnnouncementsInternal.isAnnouncementRecordChanged(
    { source_id: 'notice-1', title: '旧公告', content: '坏摘要', summary: '旧摘要', version: 'v1', published_at: '2026-04-29T00:00:00.000Z', source_url: 'https://example.com', is_active: true, priority: -100 },
    { source_id: 'notice-1', title: '旧公告', content: '完整摘要', summary: '旧摘要', version: 'v1', published_at: '2026-04-29T00:00:00.000Z', source_url: 'https://example.com', is_active: true, priority: -100 },
  ),
  true,
  '官方公告内容变化时同步任务应更新既有记录',
);
assert.equal(
  syncAnnouncementsInternal.shouldRefreshAnnouncementRecord(
    { source_id: 'notice-1', version: 'v1', content: '已有摘要' },
    { source_id: 'notice-1', version: 'v1' },
    { forceRefresh: false },
  ),
  false,
  '增量同步不应重算同版本且已有内容的公告',
);
assert.equal(
  syncAnnouncementsInternal.shouldRefreshAnnouncementRecord(
    { source_id: 'notice-1', version: 'v1', content: '' },
    { source_id: 'notice-1', version: 'v1' },
    { forceRefresh: false },
  ),
  true,
  '增量同步应修复同版本但内容为空的公告',
);
assert.equal(
  syncAnnouncementsInternal.shouldRefreshAnnouncementRecord(
    { source_id: 'notice-1', version: 'v1', content: '已有摘要' },
    { source_id: 'notice-1', version: 'v1' },
    { forceRefresh: true },
  ),
  true,
  '强制刷新应重算同版本公告',
);
assert.ok(
  syncAnnouncementsInternal.GAME_ANNOUNCEMENT_PRIORITY >= 0
    && syncAnnouncementsInternal.GAME_ANNOUNCEMENT_PRIORITY <= 100,
  '写入 announcements 的游戏公告 priority 必须满足数据库约束',
);
{
  const persistedRecord = syncAnnouncementsInternal.normalizePersistedAnnouncementRecord({
    title: '超长标题'.repeat(30),
    summary: '摘要',
    content: '超长正文'.repeat(2000),
    version: 'hg-1773203400-very-long-source-id',
  });
  assert.ok(
    persistedRecord.title.length <= syncAnnouncementsInternal.ANNOUNCEMENT_TITLE_MAX_LENGTH,
    '写入 announcements 的游戏公告 title 必须满足数据库长度约束',
  );
  assert.ok(
    persistedRecord.content.length <= syncAnnouncementsInternal.ANNOUNCEMENT_CONTENT_MAX_LENGTH,
    '写入 announcements 的游戏公告 content 必须满足数据库长度约束',
  );
  assert.ok(
    persistedRecord.version.length <= syncAnnouncementsInternal.ANNOUNCEMENT_VERSION_MAX_LENGTH,
    '写入 announcements 的游戏公告 version 必须满足数据库长度约束',
  );
}
assert.deepEqual(
  runOpsAutomationInternal.sanitizeResponseResults({
    announcements: {
      synced: 1,
      records: [{ source_id: '5992' }],
      rawRecords: [{ source_id: '5992' }],
      updatedRecords: [{ source_id: '5992' }],
    },
  }),
  { announcements: { synced: 1 } },
  '自动化接口响应不应把公告原始记录数组回传给管理页',
);
{
  const cutoffIso = syncAnnouncementsInternal.getRecentAnnouncementCutoffIso(
    Date.parse('2026-04-29T00:00:00.000Z'),
    7,
  );
  assert.equal(cutoffIso, '2026-04-22T00:00:00.000Z', '强制刷新窗口应按最近 7 天计算');
  assert.equal(
    syncAnnouncementsInternal.isRecentAnnouncementSourceRecord(
      { published_at: '2026-04-22T00:00:00.000Z' },
      cutoffIso,
    ),
    true,
    '强制刷新应包含窗口边界当天的公告',
  );
  assert.equal(
    syncAnnouncementsInternal.isRecentAnnouncementSourceRecord(
      { published_at: '2026-04-21T23:59:59.999Z' },
      cutoffIso,
    ),
    false,
    '强制刷新不应重算超过 7 天的公告',
  );
}
{
  const calls = [];
  const mockSupabase = {
    from(table) {
      calls.push(['from', table]);
      return {
        insert(record) {
          calls.push(['insert', record.source_id]);
          return Promise.resolve({ error: null });
        },
        update(record) {
          calls.push(['update', record.source_id]);
          return {
            eq(column, value) {
              calls.push(['eq', column, value]);
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert() {
          throw new Error('upsert must not be used for announcement sync');
        },
      };
    },
  };

  await syncAnnouncementsInternal.persistAnnouncementRecord(
    mockSupabase,
    { source_id: '5992', title: '公告' },
    false,
  );
  await syncAnnouncementsInternal.persistAnnouncementRecord(
    mockSupabase,
    { source_id: '5992', title: '公告' },
    true,
  );

  assert.deepEqual(
    calls,
    [
      ['from', 'announcements'],
      ['insert', '5992'],
      ['from', 'announcements'],
      ['update', '5992'],
      ['eq', 'source_id', '5992'],
    ],
    '公告同步应使用 insert/update 兼容缺失 source_id 唯一索引的线上库',
  );
}

const truncatedLlmPresentation = await buildAnnouncementDisplayContent({
  title: '「春晓时」版本创作征集活动',
  summary: '',
  rawHtml: `<p>${'活动内容奖励时间说明'.repeat(260)}</p>`,
  sourceUrl: 'https://endfield.hypergryph.com/news/9999',
  publishedAt: '2026-04-29T00:00:00.000Z',
  env: {
    ANNOUNCEMENT_LLM_API_KEY: 'test-announcement-llm-key',
    ANNOUNCEMENT_LLM_BASE_URL: 'https://x666.me/',
    ANNOUNCEMENT_LLM_MODEL: 'gemini-flash-latest',
  },
  allowLlm: true,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [
        {
          finish_reason: 'length',
          message: {
            content: truncatedStructuredSummary,
          },
        },
      ],
    }),
  }),
});

assert.equal(
  truncatedLlmPresentation.summaryMode,
  'heuristic',
  '上游 length 截断时应回退到启发式完整摘要',
);
assert.match(
  truncatedLlmPresentation.content,
  /## 要点/,
  '截断回退内容仍应包含完整短简报小节',
);
assert.doesNotMatch(
  truncatedLlmPresentation.content,
  /[…]|\.{3}/u,
  '截断回退内容不应再使用省略号硬截断',
);

const fetchBackup = globalThis.fetch;
const envBackup = {
  ANNOUNCEMENT_LLM_API_KEY: process.env.ANNOUNCEMENT_LLM_API_KEY,
  ANNOUNCEMENT_LLM_BASE_URL: process.env.ANNOUNCEMENT_LLM_BASE_URL,
  ANNOUNCEMENT_LLM_MODEL: process.env.ANNOUNCEMENT_LLM_MODEL,
  SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY,
  SILICONFLOW_MODEL: process.env.SILICONFLOW_MODEL,
};

process.env.ANNOUNCEMENT_LLM_API_KEY = 'test-announcement-llm-key';
process.env.ANNOUNCEMENT_LLM_BASE_URL = 'https://x666.me/';
process.env.ANNOUNCEMENT_LLM_MODEL = 'gemini-flash-latest';
delete process.env.SILICONFLOW_API_KEY;
delete process.env.SILICONFLOW_MODEL;

globalThis.fetch = async (url) => {
  const normalizedUrl = String(url);

  if (normalizedUrl.includes('/bulletin?')) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        code: 0,
        data: {
          list: [
            {
              cid: '5992',
              tab: 'notices',
              title: '「河流的女儿」特许寻访说明',
              displayTime: 1773203400,
              brief: '亲爱的管理员：测试摘要',
            },
          ],
        },
      }),
    };
  }

  if (normalizedUrl.includes('/bulletin/5992?')) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        code: 0,
        data: {
          cid: '5992',
          tab: 'notices',
          title: '「河流的女儿」特许寻访说明',
          displayTime: 1773203400,
          brief: '亲爱的管理员：测试摘要',
          data: `<p>这是很长的版本公告正文。</p><p>${'超长正文内容'.repeat(260)}</p><p><img src="/images/test-banner.png" alt="测试图片" /></p>`,
        },
      }),
    };
  }

  if (normalizedUrl === 'https://x666.me/v1/chat/completions') {
    throw new Error('Public official announcement feed must not call the LLM');
  }

  throw new Error(`Unexpected URL: ${normalizedUrl}`);
};

const req = {
  method: 'GET',
  url: '/api/automation-feed?job=official-announcements',
  headers: {},
};
const res = createMockResponse();
await handler(req, res);

assert.equal(res.statusCode, 200, 'official-announcements-feed 应返回 200');
assert.equal(res.payload?.success, true, 'official-announcements-feed 应返回 success=true');
assert.equal(res.payload?.records?.length, 1, 'official-announcements-feed 应输出标准化记录');
assert.equal(res.payload.records[0].source_id, '5992', '记录应保留官方 cid 作为 source_id');
assert.equal(res.payload.records[0].summary, '亲爱的管理员：测试摘要', '公告摘要应保留或派生为可展示短摘要');
assert.match(res.payload.records[0].content, /## 摘要/, '长公告应生成结构化摘要内容');
assert.equal(res.payload.records[0].summary_mode, 'heuristic', '公共公告 feed 不应触发 LLM，应使用启发式摘要');
assert.match(res.payload.records[0].content, /原公告配图/, '长公告摘要应补上原公告配图区');
assert.match(
  res.payload.records[0].raw_content,
  /\/api\/official-announcement-image\?url=https%3A%2F%2Fendfield\.hypergryph\.com%2Fimages%2Ftest-banner\.png/,
  '原始正文中的相对图片地址应被归一化并改写为站内代理地址'
);
assert.match(res.payload.records[0].version, /^hg-1773203400-5992$/, 'version 应可从官方时间戳构造');

const llmPresentation = await buildAnnouncementDisplayContent({
  title: '「河流的女儿」特许寻访说明',
  summary: '亲爱的管理员：测试摘要',
  rawHtml: `<p>这是很长的版本公告正文。</p><p>${'超长正文内容'.repeat(260)}</p>`,
  sourceUrl: 'https://endfield.hypergryph.com/news/5992',
  publishedAt: '2026-03-11T04:30:00.000Z',
  env: process.env,
  allowLlm: true,
  fetchImpl: async (url) => {
    if (String(url) !== 'https://x666.me/v1/chat/completions') {
      throw new Error(`Unexpected LLM URL: ${url}`);
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [
          {
            message: {
              content: completeStructuredSummary,
            },
            finish_reason: 'stop',
          },
        ],
      }),
    };
  },
});

assert.equal(llmPresentation.summaryMode, 'llm', '受控同步路径显式 allowLlm=true 时仍可使用 LLM 摘要');

globalThis.fetch = fetchBackup;
if (envBackup.ANNOUNCEMENT_LLM_API_KEY === undefined) {
  delete process.env.ANNOUNCEMENT_LLM_API_KEY;
} else {
  process.env.ANNOUNCEMENT_LLM_API_KEY = envBackup.ANNOUNCEMENT_LLM_API_KEY;
}
if (envBackup.ANNOUNCEMENT_LLM_BASE_URL === undefined) {
  delete process.env.ANNOUNCEMENT_LLM_BASE_URL;
} else {
  process.env.ANNOUNCEMENT_LLM_BASE_URL = envBackup.ANNOUNCEMENT_LLM_BASE_URL;
}
if (envBackup.ANNOUNCEMENT_LLM_MODEL === undefined) {
  delete process.env.ANNOUNCEMENT_LLM_MODEL;
} else {
  process.env.ANNOUNCEMENT_LLM_MODEL = envBackup.ANNOUNCEMENT_LLM_MODEL;
}
if (envBackup.SILICONFLOW_API_KEY === undefined) {
  delete process.env.SILICONFLOW_API_KEY;
} else {
  process.env.SILICONFLOW_API_KEY = envBackup.SILICONFLOW_API_KEY;
}
if (envBackup.SILICONFLOW_MODEL === undefined) {
  delete process.env.SILICONFLOW_MODEL;
} else {
  process.env.SILICONFLOW_MODEL = envBackup.SILICONFLOW_MODEL;
}

console.log('DATA-NEW-011 official announcements feed verification passed');
