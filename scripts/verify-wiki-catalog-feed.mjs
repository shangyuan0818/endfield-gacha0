import assert from 'node:assert/strict';

import { handleWikiCatalogFeed as handler } from '../api/automation-feed.js';
import {
  getDefaultRunnableJobIds,
  getOpsAutomationSourceConfig,
} from '../api/_lib/opsAutomation.js';

function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
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

const fallbackSource = getOpsAutomationSourceConfig('wiki-catalog', {}, {
  baseUrl: 'https://example.com',
});
assert.equal(
  fallbackSource.url,
  'https://example.com/api/automation-feed?job=wiki-catalog',
  'wiki-catalog 应支持站内 feed 回退地址',
);

const runnableJobs = getDefaultRunnableJobIds({}, {
  baseUrl: 'https://example.com',
});
assert.deepEqual(
  runnableJobs,
  ['official-announcements', 'pool-schedule', 'wiki-catalog'],
  '默认可运行任务应包含所有已接好源的 job',
);

const fetchBackup = globalThis.fetch;
globalThis.fetch = async (url) => {
  const normalizedUrl = String(url);

  if (normalizedUrl.endsWith('/api/wiki-proxy?type=operators')) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 'char_levantin', name: '莱万汀', rarity: 6 },
        ],
      }),
    };
  }

  if (normalizedUrl.endsWith('/api/wiki-proxy?type=weapons')) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 'weapon_alpha', iconId: 'weapon_alpha_icon', name: '阿尔法', rarity: 5 },
        ],
      }),
    };
  }

  throw new Error(`Unexpected URL: ${normalizedUrl}`);
};

const req = {
  method: 'GET',
  url: '/api/automation-feed?job=wiki-catalog',
  headers: {
    host: 'example.com',
    'x-forwarded-proto': 'https',
  },
};
const res = createMockResponse();
await handler(req, res);

assert.equal(res.statusCode, 200, 'wiki-catalog-feed 应返回 200');
assert.equal(res.payload?.success, true, 'wiki-catalog-feed 应返回 success=true');
assert.equal(res.payload?.records?.length, 2, 'wiki-catalog-feed 应合并角色与武器');
assert.equal(res.payload.records[0].type, 'character', '首条记录应保留 character 类型');
assert.match(
  res.payload.records[1].avatar_url,
  /weapon_alpha_icon\.webp$/,
  '武器头像 URL 应使用 iconId',
);

globalThis.fetch = fetchBackup;

console.log('ADMIN-002 wiki catalog feed verification passed');
