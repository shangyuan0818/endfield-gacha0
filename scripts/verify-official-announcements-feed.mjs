import assert from 'node:assert/strict';

import { __internal, handleOfficialAnnouncementsFeed as handler } from '../api/automation-feed.js';
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

const fetchBackup = globalThis.fetch;
const envBackup = {
  SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY,
  SILICONFLOW_MODEL: process.env.SILICONFLOW_MODEL,
};

process.env.SILICONFLOW_API_KEY = 'test-siliconflow-key';
process.env.SILICONFLOW_MODEL = 'deepseek-ai/DeepSeek-V3.2';

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

  if (normalizedUrl.includes('api.siliconflow.cn/v1/chat/completions')) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                '> 以下为站内整理版摘要，细节以官方原文为准。',
                '',
                '## 核心内容',
                '- 第一条重点',
                '- 第二条重点',
                '',
                '## 重要时间',
                '- 03/12 维护结束后开启',
                '',
                '## 影响与建议',
                '- 留意活动时间和卡池信息',
              ].join('\n'),
            },
          },
        ],
      }),
    };
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
assert.match(res.payload.records[0].content, /## 核心内容/, '长公告应通过 LLM 生成结构化摘要内容');
assert.equal(res.payload.records[0].summary_mode, 'llm', '长公告应标记为 llm 摘要模式');
assert.match(res.payload.records[0].content, /原公告配图/, '长公告摘要应补上原公告配图区');
assert.match(res.payload.records[0].raw_content, /https:\/\/endfield\.hypergryph\.com\/images\/test-banner\.png/, '原始正文中的相对图片地址应被归一化为绝对地址');
assert.match(res.payload.records[0].version, /^hg-1773203400-5992$/, 'version 应可从官方时间戳构造');

globalThis.fetch = fetchBackup;
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
