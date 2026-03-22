import assert from 'node:assert/strict';

import handler, { __internal } from '../api/official-announcements-feed.js';
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
          data: '<p>正文内容</p>',
        },
      }),
    };
  }

  throw new Error(`Unexpected URL: ${normalizedUrl}`);
};

const req = {
  method: 'GET',
  headers: {},
};
const res = createMockResponse();
await handler(req, res);

assert.equal(res.statusCode, 200, 'official-announcements-feed 应返回 200');
assert.equal(res.payload?.success, true, 'official-announcements-feed 应返回 success=true');
assert.equal(res.payload?.records?.length, 1, 'official-announcements-feed 应输出标准化记录');
assert.equal(res.payload.records[0].source_id, '5992', '记录应保留官方 cid 作为 source_id');
assert.match(res.payload.records[0].content, /查看官方原文/, '正文应补上官方原文链接');
assert.match(res.payload.records[0].version, /^hg-1773203400-5992$/, 'version 应可从官方时间戳构造');

globalThis.fetch = fetchBackup;

console.log('DATA-NEW-011 official announcements feed verification passed');
