import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { shouldAllowEmptyPlan } from './generate-manual-placeholder-apply-sql.mjs';
import { buildManualPlaceholderApplySql } from './lib/manualPlaceholderApplySql.mjs';
import { buildManualPlaceholderMigrationPlanFromData } from './lib/manualPlaceholderMigrationPlan.mjs';

const fixture = {
  characters: [
    { id: 'char_manual_alpha_abc123', name: 'Alpha Prime', type: 'character' },
    { id: 'weapon_manual_beta_def456', name: 'Beta Weapon', type: 'weapon' },
    { id: 'char_manual_conflict_ghi789', name: 'Conflict Character', type: 'character' },
    { id: 'char_alpha', name: "Alpha's Prime", type: 'character' },
    { id: 'char_alpha_alt', name: 'Alpha Alternate', type: 'character' },
  ],
  pools: [
    {
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      name: 'Alpha Recruitment',
      type: 'limited',
      featured_characters: ['char_manual_alpha_abc123'],
    },
    {
      pool_id: 'joint_manual_extra_beta_20260612_def456',
      name: 'Beta Joint Recruitment',
      type: 'extra',
      featured_characters: [],
    },
    {
      pool_id: 'special_1001',
      name: 'Official Alpha Recruitment',
      type: 'limited',
      featured_characters: ['char_alpha'],
    },
  ],
  characterAliasRows: [
    {
      source: 'internal',
      alias_id: 'char_manual_alpha_abc123',
      character_id: 'char_manual_alpha_abc123',
      is_primary: true,
    },
    {
      source: 'manual_placeholder',
      alias_id: 'char_manual_alpha_abc123',
      character_id: 'char_alpha',
      is_primary: false,
    },
    {
      source: 'internal',
      alias_id: 'weapon_manual_beta_def456',
      character_id: 'weapon_manual_beta_def456',
      is_primary: true,
    },
    {
      source: 'manual_placeholder',
      alias_id: 'char_manual_conflict_ghi789',
      character_id: 'char_alpha',
      is_primary: false,
    },
    {
      source: 'wiki',
      alias_id: 'char_manual_conflict_ghi789',
      character_id: 'char_alpha_alt',
      is_primary: false,
    },
  ],
  poolAliasRows: [
    {
      source: 'internal',
      alias_id: 'special_manual_limited_alpha_20260605_abc123',
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      is_primary: true,
    },
    {
      source: 'manual_placeholder',
      alias_id: 'special_manual_limited_alpha_20260605_abc123',
      pool_id: 'special_1001',
      is_primary: false,
    },
  ],
  historyRows: [
    {
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      character_id: 'char_manual_alpha_abc123',
    },
    {
      pool_id: 'joint_manual_extra_beta_20260612_def456',
      character_id: 'weapon_manual_beta_def456',
    },
  ],
  poolCharacterRows: [
    {
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      character_id: 'char_manual_alpha_abc123',
    },
    {
      pool_id: 'joint_manual_extra_beta_20260612_def456',
      character_id: 'weapon_manual_beta_def456',
    },
  ],
};

const plan = buildManualPlaceholderMigrationPlanFromData(fixture, {
  generatedAt: '2026-05-24T00:00:00.000Z',
  generatedFrom: 'apply-sql-fixture',
});

const sql = buildManualPlaceholderApplySql(plan, {
  generatedAt: '2026-05-24T00:00:00.000Z',
  generatedFrom: "fixture's migration-plan.json",
});

assert.match(sql, /DATA-NEW-017 manual placeholder apply SQL/);
assert.match(sql, /REVIEW-ONLY ARTIFACT/);
assert.match(sql, /fresh production audit/i);
assert.match(sql, /database snapshot/i);
assert.match(sql, /REPLACE_WITH_DATA_NEW_017_APPROVAL/);
assert.match(sql, /RAISE EXCEPTION 'DATA-NEW-017 apply blocked/);
assert.match(sql, /^BEGIN;$/m);
assert.match(sql, /^ROLLBACK;$/m);
assert.doesNotMatch(sql, /^COMMIT;$/m);

assert.match(sql, /fixture's migration-plan\.json/);
assert.match(sql, /char_manual_alpha_abc123/);
assert.match(sql, /char_alpha/);
assert.match(sql, /special_manual_limited_alpha_20260605_abc123/);
assert.match(sql, /special_1001/);

assert.match(sql, /INSERT INTO public\.character_id_aliases/);
assert.match(sql, /INSERT INTO public\.pool_id_aliases/);
assert.match(sql, /ON CONFLICT \(source, alias_id\) DO UPDATE/);
assert.match(sql, /VALUES \('manual_placeholder', 'char_manual_alpha_abc123', 'char_alpha'/);
assert.match(sql, /VALUES \('manual_placeholder', 'special_manual_limited_alpha_20260605_abc123', 'special_1001'/);

assert.match(sql, /UPDATE public\.history[\s\S]*character_id = 'char_alpha'/);
assert.match(sql, /UPDATE public\.history[\s\S]*pool_id = 'special_1001'/);
assert.match(sql, /INSERT INTO public\.pool_characters/);
assert.match(sql, /DELETE FROM public\.pool_characters/);
assert.match(sql, /featured_characters = ARRAY/);
assert.match(sql, /refresh_public_analytics_cache/);
assert.match(sql, /public_cache_epoch/);

assert.doesNotMatch(sql, /UPDATE public\.history[\s\S]*char_manual_conflict_ghi789/);
assert.doesNotMatch(sql, /UPDATE public\.history[\s\S]*weapon_manual_beta_def456/);
assert.doesNotMatch(sql, /UPDATE public\.history[\s\S]*joint_manual_extra_beta_20260612_def456/);

const blockedOnlyPlan = {
  ...plan,
  summary: {
    ...plan.summary,
    readyCharacterMigrations: 0,
    readyPoolMigrations: 0,
  },
  operations: {
    characters: plan.operations.characters.filter(operation => operation.status === 'blocked'),
    pools: plan.operations.pools.filter(operation => operation.status === 'blocked'),
  },
  blocked: plan.blocked,
};

assert.throws(
  () => buildManualPlaceholderApplySql(blockedOnlyPlan),
  /no ready operations/
);

const emptySql = buildManualPlaceholderApplySql(blockedOnlyPlan, { allowEmpty: true });
assert.match(emptySql, /No ready operations/);
assert.match(emptySql, /^ROLLBACK;$/m);

const invalidWritePlan = {
  ...plan,
  writesDatabase: true,
};

assert.throws(
  () => buildManualPlaceholderApplySql(invalidWritePlan),
  /dry-run plans with writesDatabase=false/
);

const invalidSelfMergePlan = structuredClone(plan);
const readyCharacterIndex = invalidSelfMergePlan.operations.characters.findIndex(
  operation => operation.status === 'ready'
);
assert.notEqual(readyCharacterIndex, -1);
invalidSelfMergePlan.operations.characters[readyCharacterIndex] = {
  ...invalidSelfMergePlan.operations.characters[readyCharacterIndex],
  toId: invalidSelfMergePlan.operations.characters[readyCharacterIndex].fromId,
};

assert.throws(
  () => buildManualPlaceholderApplySql(invalidSelfMergePlan),
  /identical fromId and toId/
);

const fixtureDir = path.join(process.cwd(), '.agent-tmp');
await fs.mkdir(fixtureDir, { recursive: true });
const outputPath = path.join(fixtureDir, 'manual-placeholder-apply.verify.sql');
await fs.writeFile(outputPath, sql, 'utf8');
const writtenSql = await fs.readFile(outputPath, 'utf8');
assert.equal(writtenSql, sql);
await fs.rm(outputPath, { force: true });

assert.equal(shouldAllowEmptyPlan(blockedOnlyPlan), true);
assert.equal(shouldAllowEmptyPlan(plan), false);

console.log('DATA-NEW-017 manual placeholder apply SQL verification passed');
