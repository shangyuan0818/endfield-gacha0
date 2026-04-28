import assert from 'node:assert/strict';

import { APP_FORCE_REFRESH_TOKEN } from '../src/constants/appMeta.js';
import { prepareFreshNavigation } from '../src/utils/serviceWorkerRecovery.js';

const storage = new Map();
let currentHref = 'https://example.com/dashboard?tab=stats';
let replacedHref = null;
let historyHref = null;

function installBrowserMocks() {
  const location = {
    get href() {
      return currentHref;
    },
    set href(value) {
      currentHref = String(value);
    },
    get origin() {
      return new URL(currentHref).origin;
    },
    replace(value) {
      replacedHref = String(value);
      currentHref = replacedHref;
    },
  };

  globalThis.window = {
    location,
    history: {
      replaceState(_state, _title, value) {
        historyHref = String(value);
        currentHref = historyHref;
      },
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serviceWorker: {
        getRegistrations: async () => [],
      },
    },
    configurable: true,
  });

  globalThis.caches = {
    keys: async () => [],
    delete: async () => true,
  };
}

installBrowserMocks();

assert.ok(APP_FORCE_REFRESH_TOKEN, '强制刷新 token 不应为空');

const firstVisit = await prepareFreshNavigation();
assert.equal(firstVisit.didNavigate, true, '首次访问新发布版本应触发一次导航刷新');
assert.ok(
  replacedHref.includes(`__force_refresh=${encodeURIComponent(APP_FORCE_REFRESH_TOKEN)}`),
  '刷新 URL 应携带当前发布 token',
);
assert.ok(replacedHref.includes('__sw_recover='), '刷新 URL 应携带缓存恢复标记');

const redirectedVisit = await prepareFreshNavigation();
assert.equal(redirectedVisit.didNavigate, false, '带 token 回来后不应再次跳转');
assert.equal(
  storage.get('endfield-force-refresh-token'),
  APP_FORCE_REFRESH_TOKEN,
  '完成刷新后应记录当前发布 token',
);
assert.equal(
  new URL(historyHref).searchParams.has('__force_refresh'),
  false,
  '完成刷新后应清理 URL 中的强制刷新参数',
);

const laterVisit = await prepareFreshNavigation();
assert.equal(laterVisit.didNavigate, false, '同一发布 token 后续访问不应重复刷新');

console.log('release force refresh gate verification passed');
