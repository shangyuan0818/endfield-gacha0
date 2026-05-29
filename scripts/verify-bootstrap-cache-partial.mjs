import assert from 'node:assert/strict';
import bootstrapHandler, { __internal } from '../api/_routes/root/bootstrap.js';

function createMockReq() {
  return {
    method: 'GET',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    getHeader(key) {
      return this.headers[key];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    }
  };
}

async function invokeHandlerWithCache({ partial }) {
  __internal.cache.payload = {
    siteConfig: { foo: 'bar' },
    pools: [{ id: 'pool_a', name: '池 A', type: 'limited' }]
  };
  __internal.cache.partial = partial;
  __internal.cache.lastFetch = Date.now();

  const req = createMockReq();
  const res = createMockRes();
  await bootstrapHandler(req, res);

  return res.body;
}

const cachedPartialResponse = await invokeHandlerWithCache({ partial: true });
assert.equal(cachedPartialResponse.cached, true, '缓存命中应返回 cached=true');
assert.equal(cachedPartialResponse.partial, true, '缓存命中时应保留 partial=true');
assert.equal(cachedPartialResponse.meta?.source, 'memory-cache', '缓存命中应标记 source=memory-cache');
assert.equal(cachedPartialResponse.meta?.partial, true, 'meta.partial 应与顶层 partial 一致');
assert.equal(cachedPartialResponse.meta?.stale, false, '新鲜内存缓存不应标记 stale');
assert.equal(cachedPartialResponse.meta?.cacheKey, 'bootstrap:v0', 'bootstrap 缓存 key 应包含公共缓存版本');
assert.equal(cachedPartialResponse.meta?.cacheVersion, '0', 'bootstrap meta 应包含 cacheVersion');
assert.deepEqual(
  cachedPartialResponse.data,
  {
    siteConfig: { foo: 'bar' },
    pools: [{ id: 'pool_a', name: '池 A', type: 'limited' }]
  },
  'bootstrap 缓存应仅返回站点配置和卡池数据'
);

const cachedFullResponse = await invokeHandlerWithCache({ partial: false });
assert.equal(cachedFullResponse.cached, true, '缓存命中应返回 cached=true');
assert.equal(cachedFullResponse.partial, false, '完整缓存命中时应返回 partial=false');
assert.equal(cachedFullResponse.meta?.partial, false, '完整缓存命中时 meta.partial=false');

console.log('BUG-034 bootstrap cache partial verification passed');
