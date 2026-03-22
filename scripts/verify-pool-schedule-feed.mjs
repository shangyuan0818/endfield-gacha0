import assert from 'node:assert/strict';

import { buildPoolScheduleRecords, handlePoolScheduleFeed as handler } from '../api/automation-feed.js';
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

const sampleAnnouncements = [
  {
    source_id: '5992',
    title: '「河流的女儿」特许寻访说明',
    content: `
      <p>· 开放时间：「新潮起，故渊离」版本开启后 - 2026/03/29 11:59（服务器时间）</p>
      <p>· 寻访说明：「河流的女儿」特许寻访中，6星干员【汤汤】获取概率提升。全部可能出现的6星干员包括：汤汤/伊冯/洁尔佩塔/余烬。</p>
    `,
    source_url: 'https://endfield.hypergryph.com/news/5992',
  },
  {
    source_id: '6003',
    title: '「新潮起，故渊离」版本更新说明',
    content: `
      <p>■ 更新维护时间2026/03/12 06:00 - 2026/03/12 12:00（UTC+8）</p>
      <p>2. 「河流的女儿」特许寻访</p>
      <p>· 开放时间：「新潮起，故渊离」版本开启后 - 2026/03/29 11:59（服务器时间）</p>
      <p>· 寻访说明：「河流的女儿」特许寻访中，6星干员【汤汤】获取概率提升。全部可能出现的6星干员包括：汤汤/伊冯/洁尔佩塔/余烬。</p>
      <p>4. 「新芽申领」开放</p>
      <p>· 开放时间：「新潮起，故渊离」版本更新后开启，于3次「特许寻访」后结束（从「河流的女儿」起计算）</p>
      <p>· 申领说明：「新芽申领」中，概率提升的6星武器为【落草（手铳）】，全部可能出现的6星武器包括：落草（手铳）/同类相食（手铳）/楔子（手铳）。</p>
      <p>8. 「狼珀」特许寻访</p>
      <p>· 开放时间：2026/03/29 12:00（服务器时间） - 版本更新维护前</p>
      <p>· 寻访说明：「狼珀」特许寻访中，6星干员【洛茜】获取概率提升。全部可能出现的6星干员包括：洛茜/汤汤/伊冯。</p>
      <p>10. 「绯珀申领」开放</p>
      <p>· 开放时间：2026/03/29 12:00（服务器时间）开启，于3次「特许寻访」后结束（从「狼珀」起计算）</p>
      <p>· 申领说明：「绯珀申领」中，概率提升的6星武器为【狼之绯（单手剑）】，全部可能出现的6星武器包括：狼之绯（单手剑）/扶摇（单手剑）/显赫声名（单手剑）。</p>
    `,
    source_url: 'https://endfield.hypergryph.com/news/6003',
  },
];

const sampleCharacters = [
  { id: 'char_tangtang', name: '汤汤', aliases: [], type: 'character' },
  { id: 'char_yvonne', name: '伊冯', aliases: [], type: 'character' },
  { id: 'char_jerpeta', name: '洁尔佩塔', aliases: [], type: 'character' },
  { id: 'char_yujin', name: '余烬', aliases: [], type: 'character' },
  { id: 'char_luoxi', name: '洛茜', aliases: [], type: 'character' },
  { id: 'wpn_luocao', name: '落草（手铳）', aliases: [], type: 'weapon' },
  { id: 'wpn_tonglei', name: '同类相食（手铳）', aliases: [], type: 'weapon' },
  { id: 'wpn_xiezi', name: '楔子（手铳）', aliases: [], type: 'weapon' },
  { id: 'wpn_langzhifei', name: '狼之绯（单手剑）', aliases: [], type: 'weapon' },
  { id: 'wpn_fuyao', name: '扶摇（单手剑）', aliases: [], type: 'weapon' },
  { id: 'wpn_xianhe', name: '显赫声名（单手剑）', aliases: [], type: 'weapon' },
];

const sampleCurrentPools = [
  {
    pool_id: 'special_1_0_4',
    name: '限定-汤汤',
    type: 'limited',
    up_character: '汤汤',
    start_time: '2026-03-12T04:00:00.000Z',
    end_time: '2026-03-29T03:59:00.000Z',
    description: 'existing-limited',
    banner_url: null,
  },
];

const poolRecords = buildPoolScheduleRecords(sampleAnnouncements, {
  characters: sampleCharacters,
  currentPools: sampleCurrentPools,
});

assert.equal(poolRecords.length, 4, '应从公告中解析出 4 个卡池');

const currentLimited = poolRecords.find(pool => pool.up_character === '汤汤');
assert.equal(currentLimited.pool_id, 'special_1_0_4', '现有限定池应复用已有 pool_id');
assert.equal(currentLimited.name, '河流的女儿', '角色池应保留官方卡池标题');
assert.equal(currentLimited.start_time, '2026-03-12T04:00:00.000Z', '版本开启后应继承版本维护结束时间');
assert.deepEqual(
  currentLimited.featured_characters,
  ['char_tangtang', 'char_yvonne', 'char_jerpeta', 'char_yujin'],
  '角色池应解析并映射 featured_characters',
);

const futureLimited = poolRecords.find(pool => pool.up_character === '洛茜');
assert.equal(futureLimited.name, '狼珀', '未来限定池应保留官方卡池标题');
assert.equal(futureLimited.start_time, '2026-03-29T04:00:00.000Z', '未来限定池应解析开始时间');
assert.equal(futureLimited.end_time, '2026-04-15T04:00:00.000Z', '维护前结束的角色池应按 17 天持续时间推断结束时间');

const currentWeapon = poolRecords.find(pool => pool.up_character === '落草（手铳）');
assert.equal(currentWeapon.name, '新芽申领', '武器池应保留官方申领标题');
assert.equal(currentWeapon.start_time, '2026-03-12T04:00:00.000Z', '申领池在版本开启后应继承同期开启的限定时间');
assert.equal(currentWeapon.end_time, '2026-05-02T04:00:00.000Z', '申领池应按 3 个卡池周期推断结束时间');

const futureWeapon = poolRecords.find(pool => pool.up_character === '狼之绯（单手剑）');
assert.equal(futureWeapon.name, '绯珀申领', '后续武器池应保留官方申领标题');
assert.deepEqual(
  futureWeapon.featured_characters,
  ['wpn_langzhifei', 'wpn_fuyao', 'wpn_xianhe'],
  '武器池应解析并映射 featured_characters',
);
assert.equal(futureWeapon.end_time, '2026-05-19T04:00:00.000Z', '后续申领池应按 3 个卡池周期推断结束时间');

const runnableJobs = getDefaultRunnableJobIds({}, {
  baseUrl: 'https://example.com',
});
assert.deepEqual(
  runnableJobs,
  ['official-announcements', 'pool-schedule', 'wiki-catalog'],
  '默认可运行任务应包含公告、卡池与图鉴 feed',
);

const fetchBackup = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url) === 'https://example.com/api/automation-feed?job=official-announcements') {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        success: true,
        records: sampleAnnouncements,
      }),
    };
  }

  throw new Error(`Unexpected URL: ${String(url)}`);
};

const req = {
  method: 'GET',
  url: '/api/automation-feed?job=pool-schedule',
  headers: {
    host: 'example.com',
    'x-forwarded-proto': 'https',
  },
};
const res = createMockResponse();
await handler(req, res);

assert.equal(res.statusCode, 200, 'pool-schedule-feed 应返回 200');
assert.equal(res.payload?.success, true, 'pool-schedule-feed 应返回 success=true');
assert.equal(res.payload?.records?.length, 4, 'pool-schedule-feed 应输出标准化卡池记录');

globalThis.fetch = fetchBackup;

console.log('DATA-NEW-012 pool schedule feed verification passed');
