/**
 * 本地开发环境运行自动化同步
 *
 * 用法: npm run automation:local
 * 需要 .env 或 .env.local 中配置 SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const required = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`缺少环境变量: ${missing.join(', ')}`);
  console.error('请在 .env 或 .env.local 中配置');
  process.exit(1);
}

const { syncAnnouncements } = await import('../api/_lib/syncAnnouncements.js');
const { syncPools } = await import('../api/_lib/syncPools.js');
const { detectNewCharacters } = await import('../api/_lib/detectNewCharacters.js');

console.log('=== 开始本地自动化同步 ===\n');

console.log('[1/3] 同步公告...');
const ann = await syncAnnouncements();
console.log('  公告结果:', JSON.stringify(ann, null, 2).split('\n').slice(0, 8).join('\n'), '\n');

console.log('[2/3] 同步卡池...');
const pools = await syncPools(ann.rawRecords);
console.log('  卡池结果:', {
  created: pools.created,
  updated: pools.updated,
  parsed: pools.parsed,
  unresolvedNames: pools.unresolvedNames,
  errors: pools.errors,
}, '\n');

console.log('[3/3] 检测新角色/武器...');
const check = await detectNewCharacters(pools.unresolvedNames);
console.log('  检测结果:', check, '\n');

console.log('=== 本地自动化同步完成 ===');
