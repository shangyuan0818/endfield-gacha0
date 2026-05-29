import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { buildManualPlaceholderMigrationPlanFromData } from './lib/manualPlaceholderMigrationPlan.mjs';

const fixture = {
  characters: [
    { id: 'char_manual_alpha_abc123', name: '阿尔法', type: 'character' },
    { id: 'weapon_manual_beta_def456', name: '贝塔武器', type: 'weapon' },
    { id: 'char_manual_conflict_ghi789', name: '冲突角色', type: 'character' },
    { id: 'char_alpha', name: '阿尔法', type: 'character' },
    { id: 'char_alpha_alt', name: '阿尔法别名', type: 'character' },
  ],
  pools: [
    {
      pool_id: 'special_manual_limited_alpha_20260605_abc123',
      name: '阿尔法寻访',
      type: 'limited',
      featured_characters: ['char_manual_alpha_abc123'],
    },
    {
      pool_id: 'joint_manual_extra_beta_20260612_def456',
      name: '贝塔联合寻访',
      type: 'extra',
      featured_characters: [],
    },
    {
      pool_id: 'special_1001',
      name: '官方阿尔法寻访',
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
  generatedFrom: 'verify-fixture',
});

assert.equal(plan.planType, 'manual_placeholder_official_id_migration');
assert.equal(plan.version, 1);
assert.equal(plan.mode, 'dry_run');
assert.equal(plan.writesDatabase, false);
assert.equal(plan.safety.requiresHumanReview, true);
assert.equal(plan.safety.requiresFreshProductionAudit, true);

assert.equal(plan.summary.readyCharacterMigrations, 1);
assert.equal(plan.summary.readyPoolMigrations, 1);
assert.equal(plan.summary.blockedCharacterPlaceholders, 2);
assert.equal(plan.summary.blockedPoolPlaceholders, 1);
assert.equal(plan.summary.estimatedReferenceUpdateCount, 5);
assert.ok(plan.summary.affectedTables.includes('history'));
assert.ok(plan.summary.affectedTables.includes('pool_characters'));
assert.ok(plan.summary.affectedTables.includes('character_id_aliases'));
assert.ok(plan.summary.affectedTables.includes('pool_id_aliases'));

const readyCharacter = plan.operations.characters.find(
  operation => operation.fromId === 'char_manual_alpha_abc123'
);
assert.equal(readyCharacter.status, 'ready');
assert.equal(readyCharacter.toId, 'char_alpha');
assert.deepEqual(
  readyCharacter.impact.referenceUpdates.map(update => `${update.table}.${update.column}:${update.estimatedRows}`),
  [
    'history.character_id:1',
    'pool_characters.character_id:1',
    'pools.featured_characters[]:1',
  ]
);
assert.equal(readyCharacter.impact.aliasRetention[1].source, 'manual_placeholder');
assert.equal(readyCharacter.impact.aliasRetention[1].alias_id, 'char_manual_alpha_abc123');
assert.equal(readyCharacter.impact.aliasRetention[1].character_id, 'char_alpha');
assert.equal(readyCharacter.rollback.requiresSnapshot, true);
assert.ok(readyCharacter.rollback.snapshotBeforeApply.some(snapshot => snapshot.table === 'history'));
assert.ok(readyCharacter.applyOrder.some(step => step.includes('刷新相关公共缓存')));

const readyPool = plan.operations.pools.find(
  operation => operation.fromId === 'special_manual_limited_alpha_20260605_abc123'
);
assert.equal(readyPool.status, 'ready');
assert.equal(readyPool.toId, 'special_1001');
assert.deepEqual(
  readyPool.impact.referenceUpdates.map(update => `${update.table}.${update.column}:${update.estimatedRows}`),
  [
    'history.pool_id:1',
    'pool_characters.pool_id:1',
  ]
);
assert.equal(readyPool.impact.aliasRetention[1].pool_id, 'special_1001');

const conflict = plan.operations.characters.find(
  operation => operation.fromId === 'char_manual_conflict_ghi789'
);
assert.equal(conflict.status, 'blocked');
assert.equal(conflict.reason.code, 'conflicting_alias_targets');
assert.deepEqual(conflict.alias.canonicalTargetIds, ['char_alpha', 'char_alpha_alt']);

const missingCharacter = plan.operations.characters.find(
  operation => operation.fromId === 'weapon_manual_beta_def456'
);
assert.equal(missingCharacter.status, 'blocked');
assert.equal(missingCharacter.reason.code, 'missing_official_id');

const missingPool = plan.operations.pools.find(
  operation => operation.fromId === 'joint_manual_extra_beta_20260612_def456'
);
assert.equal(missingPool.status, 'blocked');
assert.equal(missingPool.reason.code, 'missing_official_id');

const fixtureDir = path.join(process.cwd(), '.agent-tmp');
await fs.mkdir(fixtureDir, { recursive: true });
const outputPath = path.join(fixtureDir, 'manual-placeholder-migration-plan.verify.json');
await fs.writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
const writtenPlan = JSON.parse(await fs.readFile(outputPath, 'utf8'));
assert.equal(writtenPlan.writesDatabase, false);
await fs.rm(outputPath, { force: true });

console.log('DATA-NEW-017 manual placeholder migration plan verification passed');
