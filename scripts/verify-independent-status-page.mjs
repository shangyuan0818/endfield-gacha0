import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const statusRoot = path.join(projectRoot, 'status-page');

const REQUIRED_FILES = [
  'README.md',
  'index.html',
  'styles.css',
  'app.js',
  'vercel.json',
];

const FORBIDDEN_PATTERNS = [
  /service[_-]?role/i,
  /supabase[_-]?(secret|service|jwt)/i,
  /smtp[_-]?(password|secret)/i,
  /oauth[_-]?(secret|token)/i,
  /client[_-]?secret/i,
  /cron[_-]?secret/i,
  /mail_outbox/i,
  /mail_delivery_events/i,
  /stalwart/i,
  /\/api\/admin/i,
  /\/rest\/v1/i,
  /\/auth\/v1/i,
  /127\.0\.0\.1/i,
  /localhost/i,
  /10\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
  /172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/i,
  /192\.168\.\d{1,3}\.\d{1,3}/i,
];

async function readStatusFile(relativePath) {
  return fs.readFile(path.join(statusRoot, relativePath), 'utf8');
}

const contents = {};
for (const file of REQUIRED_FILES) {
  contents[file] = await readStatusFile(file);
}

const allContent = Object.entries(contents)
  .map(([file, content]) => `\n--- ${file} ---\n${content}`)
  .join('\n');

assert.match(contents['index.html'], /https:\/\/ef-gacha\.mogujun\.icu\/api\/site-status/);
assert.match(contents['index.html'], /<script type="module" src="\.\/app\.js"><\/script>/);
assert.match(contents['index.html'], /<link rel="stylesheet" href="\.\/styles\.css" \/>/);
assert.match(contents['app.js'], /fetch\(endpoint/);
assert.match(contents['app.js'], /payload\?\.success !== true/);
assert.match(contents['README.md'], /单独的 Vercel 项目/);
assert.match(contents['vercel.json'], /"destination": "\/index\.html"/);

for (const pattern of FORBIDDEN_PATTERNS) {
  assert.equal(
    pattern.test(allContent),
    false,
    `status-page must not contain sensitive or private pattern: ${pattern}`
  );
}

const allowedEndpointMatches = allContent.match(/https:\/\/ef-gacha\.mogujun\.icu\/api\/site-status/g) || [];
assert.ok(allowedEndpointMatches.length >= 1, 'status page should point at the public site-status endpoint');

console.log('STATUS-001 independent status page verification passed');
