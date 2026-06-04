import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { parseArgs } from './generate-manual-placeholder-candidate-plan.mjs';
import { buildManualPlaceholderCandidateReviewPlan } from './lib/manualPlaceholderCandidatePlan.mjs';

const fixture = {
  characters: [
    { id: 'manual_character_char_alpha_abc123', name: '阿尔法', type: 'character' },
    { id: 'char_alpha', name: '阿尔法', type: 'character' },
    { id: 'manual_weapon_wp_beta_def456', name: '贝塔武器', type: 'weapon' },
    { id: 'weapon_beta', name: '贝塔武器', type: 'weapon' },
    { id: 'manual_character_char_gamma_ghi789', name: '伽马', type: 'character' },
  ],
  pools: [
    {
      pool_id: 'manual_pool_limited_alpha_20260605_abc123',
      name: '阿尔法寻访（前瞻）',
      type: 'limited',
      up_character: '阿尔法',
      start_time: '2026-06-05T04:00:00+00:00',
      end_time: '2026-06-26T04:00:00+00:00',
    },
    {
      pool_id: 'special_2001',
      name: '阿尔法寻访',
      type: 'limited',
      up_character: '阿尔法',
      start_time: '2026-06-05T04:00:00+00:00',
      end_time: '2026-06-26T04:00:00+00:00',
    },
    {
      pool_id: 'manual_pool_limited_delta_20260701_def456',
      name: '德尔塔寻访',
      type: 'limited',
      up_character: '德尔塔',
      start_time: '2026-07-01T04:00:00+00:00',
    },
  ],
  characterAliasRows: [
    {
      source: 'internal',
      alias_id: 'manual_character_char_alpha_abc123',
      character_id: 'manual_character_char_alpha_abc123',
      is_primary: true,
    },
    {
      source: 'import_official',
      alias_id: 'manual_character_char_alpha_abc123',
      character_id: 'char_alpha',
      is_primary: false,
    },
    {
      source: 'internal',
      alias_id: 'manual_weapon_wp_beta_def456',
      character_id: 'manual_weapon_wp_beta_def456',
      is_primary: true,
    },
  ],
  poolAliasRows: [
    {
      source: 'internal',
      alias_id: 'manual_pool_limited_alpha_20260605_abc123',
      pool_id: 'manual_pool_limited_alpha_20260605_abc123',
      is_primary: true,
    },
  ],
  manualPlaceholderRetirement: {
    summary: {
      characterPlaceholderCount: 3,
      poolPlaceholderCount: 2,
    },
    characters: [
      {
        id: 'manual_character_char_alpha_abc123',
        name: '阿尔法',
        type: 'character',
        state: 'needs_official_id',
        references: { historyRows: 2, poolCharacterRows: 1 },
      },
      {
        id: 'manual_weapon_wp_beta_def456',
        name: '贝塔武器',
        type: 'weapon',
        state: 'needs_official_id',
        references: { historyRows: 0, poolCharacterRows: 1 },
      },
      {
        id: 'manual_character_char_gamma_ghi789',
        name: '伽马',
        type: 'character',
        state: 'needs_official_id',
        references: { historyRows: 0, poolCharacterRows: 0 },
      },
    ],
    pools: [
      {
        id: 'manual_pool_limited_alpha_20260605_abc123',
        name: '阿尔法寻访（前瞻）',
        type: 'limited',
        up_character: '阿尔法',
        start_time: '2026-06-05T04:00:00+00:00',
        end_time: '2026-06-26T04:00:00+00:00',
        state: 'needs_official_id',
        references: { historyRows: 0, poolCharacterRows: 2 },
      },
      {
        id: 'manual_pool_limited_delta_20260701_def456',
        name: '德尔塔寻访',
        type: 'limited',
        up_character: '德尔塔',
        start_time: '2026-07-01T04:00:00+00:00',
        state: 'needs_official_id',
        references: { historyRows: 0, poolCharacterRows: 0 },
      },
    ],
  },
};

const plan = buildManualPlaceholderCandidateReviewPlan(fixture, {
  generatedAt: '2026-06-05T00:00:00.000Z',
  generatedFrom: 'candidate-fixture',
});

assert.equal(plan.planType, 'manual_placeholder_official_id_candidate_review');
assert.equal(plan.version, 1);
assert.equal(plan.mode, 'review_only');
assert.equal(plan.writesDatabase, false);
assert.equal(plan.safety.requiresHumanReview, true);
assert.equal(plan.safety.producesApplySql, false);

assert.equal(plan.summary.characterPlaceholders.totalPlaceholders, 3);
assert.equal(plan.summary.characterPlaceholders.placeholdersWithCandidates, 2);
assert.equal(plan.summary.poolPlaceholders.totalPlaceholders, 2);
assert.equal(plan.summary.poolPlaceholders.placeholdersWithCandidates, 1);
assert.equal(plan.summary.totalWithCandidates, 3);

const alpha = plan.reviewItems.characters.find(
  item => item.placeholderId === 'manual_character_char_alpha_abc123'
);
assert.equal(alpha.reviewStatus, 'needs_human_review');
assert.equal(alpha.candidates[0].targetId, 'char_alpha');
assert.equal(alpha.candidates[0].confidence, 'high');
assert.ok(alpha.candidates[0].evidence.includes('alias_target'));
assert.ok(alpha.candidates[0].evidence.includes('same_normalized_name_and_type'));
assert.match(alpha.recommendedNextStep, /确认后写入 alias/);

const beta = plan.reviewItems.characters.find(
  item => item.placeholderId === 'manual_weapon_wp_beta_def456'
);
assert.equal(beta.candidates[0].targetId, 'weapon_beta');
assert.equal(beta.candidates[0].confidence, 'medium');
assert.ok(beta.candidates[0].evidence.includes('same_normalized_name_and_type'));

const gamma = plan.reviewItems.characters.find(
  item => item.placeholderId === 'manual_character_char_gamma_ghi789'
);
assert.equal(gamma.reviewStatus, 'no_candidate');
assert.equal(gamma.candidates.length, 0);

const alphaPool = plan.reviewItems.pools.find(
  item => item.placeholderId === 'manual_pool_limited_alpha_20260605_abc123'
);
assert.equal(alphaPool.candidates[0].targetId, 'special_2001');
assert.equal(alphaPool.candidates[0].confidence, 'medium');
assert.ok(alphaPool.candidates[0].evidence.includes('same_type_up_and_start_date'));

const deltaPool = plan.reviewItems.pools.find(
  item => item.placeholderId === 'manual_pool_limited_delta_20260701_def456'
);
assert.equal(deltaPool.reviewStatus, 'no_candidate');

assert.deepEqual(
  parseArgs(['--audit', 'audit.json', '--out', 'plan.json']),
  { audit: 'audit.json', out: 'plan.json' }
);
assert.deepEqual(
  parseArgs(['audit.json', 'plan.json']),
  { audit: 'audit.json', out: 'plan.json' }
);

const fixtureDir = path.join(process.cwd(), '.agent-tmp');
await fs.mkdir(fixtureDir, { recursive: true });
const outputPath = path.join(fixtureDir, 'manual-placeholder-candidate-plan.verify.json');
await fs.writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
const writtenPlan = JSON.parse(await fs.readFile(outputPath, 'utf8'));
assert.equal(writtenPlan.writesDatabase, false);
assert.equal(writtenPlan.candidateReviewQueue.length, 3);
await fs.rm(outputPath, { force: true });

console.log('DATA-NEW-018 manual placeholder candidate review plan verification passed');
