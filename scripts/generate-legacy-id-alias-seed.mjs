import fs from 'node:fs/promises';
import path from 'node:path';

import { normalizeEntityNameForMatch } from '../src/utils/canonicalEntityUtils.js';

function parseArgs(argv) {
  const options = {
    legacySeedSql: null,
    officialCharactersSql: null,
    legacyPools: null,
    officialExport: null,
    planOut: null,
    sqlOut: null,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--legacy-seed-sql' && nextValue) {
      options.legacySeedSql = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--official-characters-sql' && nextValue) {
      options.officialCharactersSql = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--legacy-pools' && nextValue) {
      options.legacyPools = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--official-export' && nextValue) {
      options.officialExport = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--plan-out' && nextValue) {
      options.planOut = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--sql-out' && nextValue) {
      options.sqlOut = nextValue;
      index += 1;
      continue;
    }

    positional.push(arg);
  }

  const [
    legacySeedSql,
    officialCharactersSql,
    legacyPools,
    officialExport,
    planOut,
    sqlOut,
  ] = positional;

  options.legacySeedSql ||= legacySeedSql || null;
  options.officialCharactersSql ||= officialCharactersSql || null;
  options.legacyPools ||= legacyPools || null;
  options.officialExport ||= officialExport || null;
  options.planOut ||= planOut || null;
  options.sqlOut ||= sqlOut || null;

  return options;
}

async function readTextFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  return {
    path: absolutePath,
    data: await fs.readFile(absolutePath, 'utf8'),
  };
}

async function readJsonFile(filePath) {
  const { path: absolutePath, data } = await readTextFile(filePath);
  return {
    path: absolutePath,
    data: JSON.parse(data),
  };
}

async function writeOutputFile(filePath, contents) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents, 'utf8');
  return absolutePath;
}

function sqlText(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildLegacySeedLookup(sql) {
  const seedSectionEnd = sql.indexOf('ON CONFLICT (id) DO NOTHING;');
  const seedSection = seedSectionEnd >= 0 ? sql.slice(0, seedSectionEnd) : sql;
  const entityRegex = /\('([^']+)', '([^']+)',\s*(\d+),\s*'(character|weapon)',\s*(true|false),/g;
  const entities = [];

  for (const match of seedSection.matchAll(entityRegex)) {
    entities.push({
      id: match[1],
      name: match[2],
      rarity: Number(match[3]),
      type: match[4],
      is_limited: match[5] === 'true',
    });
  }

  return entities;
}

function buildOfficialEntityLookup(sql) {
  const entityRegex = /\('([^']+)', '([^']+)', '(?:[^']*)', '(\d+)', '(character|weapon)', (?:ARRAY\[[^\]]*\]|null), '(true|false)'/g;
  const entities = [];

  for (const match of sql.matchAll(entityRegex)) {
    entities.push({
      id: match[1],
      name: match[2],
      rarity: Number(match[3]),
      type: match[4],
      is_limited: match[5] === 'true',
    });
  }

  return entities;
}

function buildNameKey(record) {
  return `${record.type}|${normalizeEntityNameForMatch(record.name)}`;
}

function buildNameIndex(records) {
  const grouped = new Map();

  records.forEach((record) => {
    const key = buildNameKey(record);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(record);
  });

  return grouped;
}

function normalizePoolRecord(record) {
  return {
    pool_id: String(record?.pool_id || record?.id || ''),
    name: record?.name || null,
    type: record?.type || null,
    up_character: record?.up_character || record?.upCharacter || null,
    start_time: record?.start_time || record?.startTime || null,
    end_time: record?.end_time || record?.endTime || null,
    featured_characters: Array.isArray(record?.featured_characters) ? record.featured_characters : [],
  };
}

function buildPoolDateKey(value) {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null;
}

function mapLegacyCharacters(legacyEntities, officialEntities) {
  const officialByName = buildNameIndex(officialEntities);
  const aliases = [];
  const unresolved = [];

  legacyEntities
    .filter(entity => entity.type === 'character')
    .forEach((entity) => {
      const candidates = officialByName.get(buildNameKey(entity)) || [];

      if (candidates.length === 1) {
        aliases.push({
          fromId: entity.id,
          toId: candidates[0].id,
          type: entity.type,
          legacyName: entity.name,
          officialName: candidates[0].name,
          confidence: 'high',
          reason: 'Unique exact name match between legacy seed and official snapshot',
        });
        return;
      }

      unresolved.push({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        reason: candidates.length === 0 ? 'No exact official name match found' : 'Multiple official candidates found',
      });
    });

  return { aliases, unresolved };
}

function mapLegacyLimitedPools(legacyPools, officialPools) {
  const officialByKey = new Map();

  officialPools
    .filter(pool => pool.type === 'limited')
    .forEach((pool) => {
      const upCharacter = normalizeEntityNameForMatch(pool.up_character);
      const startDate = buildPoolDateKey(pool.start_time);
      if (!upCharacter || !startDate) {
        return;
      }

      officialByKey.set(`${upCharacter}|${startDate}`, pool);
    });

  const aliases = [];
  const unresolved = [];

  legacyPools
    .filter(pool => pool.type === 'limited')
    .forEach((pool) => {
      const key = `${normalizeEntityNameForMatch(pool.up_character)}|${buildPoolDateKey(pool.start_time)}`;
      const match = officialByKey.get(key);

      if (!match) {
        unresolved.push({
          id: pool.pool_id,
          name: pool.name,
          type: pool.type,
          reason: 'No official limited pool matched by up_character + start_date',
        });
        return;
      }

      aliases.push({
        fromId: pool.pool_id,
        toId: match.pool_id,
        type: pool.type,
        legacyName: pool.name,
        officialName: match.name,
        confidence: 'high',
        reason: 'Matched by up_character and start_date',
      });
    });

  return { aliases, unresolved };
}

function mapLegacyStandardPools(legacyPools, officialPools) {
  const aliases = [];
  const unresolved = [];
  const standardPool = officialPools.find(pool => pool.pool_id === 'standard');

  legacyPools
    .filter(pool => pool.pool_id === 'pool_standard_main')
    .forEach((pool) => {
      if (!standardPool) {
        unresolved.push({
          id: pool.pool_id,
          name: pool.name,
          type: pool.type,
          reason: 'Official standard pool not found in export',
        });
        return;
      }

      aliases.push({
        fromId: pool.pool_id,
        toId: standardPool.pool_id,
        type: pool.type,
        legacyName: pool.name,
        officialName: standardPool.name,
        confidence: 'high',
        reason: 'Matched to canonical standard pool',
      });
    });

  return { aliases, unresolved };
}

function mapLegacyWeaponPools(legacyPools, officialPools, limitedPoolAliases) {
  const officialPoolById = new Map(officialPools.map(pool => [pool.pool_id, pool]));
  const limitedPoolAliasByLegacyId = new Map(limitedPoolAliases.map(alias => [alias.fromId, alias.toId]));
  const aliases = [];
  const unresolved = [];

  legacyPools
    .filter(pool => pool.type === 'weapon')
    .forEach((pool) => {
      const suffixMatch = /^pool_weapon_(.+)$/.exec(pool.pool_id);
      if (!suffixMatch) {
        unresolved.push({
          id: pool.pool_id,
          name: pool.name,
          type: pool.type,
          reason: 'Legacy weapon pool id does not follow expected naming convention',
        });
        return;
      }

      const relatedLimitedPoolId = `pool_limited_${suffixMatch[1]}`;
      const officialLimitedPoolId = limitedPoolAliasByLegacyId.get(relatedLimitedPoolId);
      if (!officialLimitedPoolId || !officialLimitedPoolId.startsWith('special_')) {
        unresolved.push({
          id: pool.pool_id,
          name: pool.name,
          type: pool.type,
          reason: 'Could not derive official limited event id for related character pool',
        });
        return;
      }

      const officialWeaponPoolId = officialLimitedPoolId.replace(/^special_/, 'weponbox_');
      const officialPool = officialPoolById.get(officialWeaponPoolId);
      if (!officialPool) {
        unresolved.push({
          id: pool.pool_id,
          name: pool.name,
          type: pool.type,
          inferredTarget: officialWeaponPoolId,
          reason: 'Derived official weapon pool id is not present in official export',
        });
        return;
      }

      aliases.push({
        fromId: pool.pool_id,
        toId: officialWeaponPoolId,
        type: pool.type,
        legacyName: pool.name,
        officialName: officialPool.name,
        confidence: 'high',
        reason: 'Derived from matched limited event id and existing official weapon pool',
        upCharacter: officialPool.up_character || null,
        legacyFeaturedCharacterIds: pool.featured_characters,
      });
    });

  return { aliases, unresolved };
}

function mapLegacyWeaponEntities(legacyEntities, officialEntities, weaponPoolAliases) {
  const officialByName = buildNameIndex(officialEntities);
  const legacyEntityById = new Map(legacyEntities.map(entity => [entity.id, entity]));
  const aliases = [];
  const unresolved = [];

  weaponPoolAliases.forEach((poolAlias) => {
    const legacyWeaponId = poolAlias.legacyFeaturedCharacterIds?.[0] || null;
    const officialWeaponName = poolAlias.upCharacter || null;
    const legacyEntity = legacyWeaponId ? legacyEntityById.get(legacyWeaponId) : null;

    if (!legacyWeaponId || !legacyEntity || !officialWeaponName) {
      unresolved.push({
        id: legacyWeaponId || poolAlias.fromId,
        name: legacyEntity?.name || null,
        type: 'weapon',
        reason: 'Legacy weapon placeholder or official weapon name is missing',
      });
      return;
    }

    const candidates = officialByName.get(`weapon|${normalizeEntityNameForMatch(officialWeaponName)}`) || [];
    if (candidates.length !== 1) {
      unresolved.push({
        id: legacyWeaponId,
        name: legacyEntity.name,
        type: 'weapon',
        officialWeaponName,
        reason: candidates.length === 0 ? 'No exact official weapon name match found' : 'Multiple official weapon candidates found',
      });
      return;
    }

    aliases.push({
      fromId: legacyWeaponId,
      toId: candidates[0].id,
      type: 'weapon',
      legacyName: legacyEntity.name,
      officialName: candidates[0].name,
      confidence: 'high',
      reason: `Matched via official weapon pool ${poolAlias.toId} up_character`,
    });
  });

  const resolvedIds = new Set(aliases.map(alias => alias.fromId));
  legacyEntities
    .filter(entity => entity.type === 'weapon' && !resolvedIds.has(entity.id))
    .forEach((entity) => {
      unresolved.push({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        reason: 'No verified official weapon pool metadata available for this legacy signature weapon',
      });
    });

  return { aliases, unresolved };
}

function dedupeAliases(aliases) {
  const deduped = new Map();
  aliases.forEach((alias) => {
    deduped.set(alias.fromId, alias);
  });
  return Array.from(deduped.values()).sort((left, right) => left.fromId.localeCompare(right.fromId));
}

function dedupeUnresolved(items) {
  const deduped = new Map();
  items.forEach((item) => {
    deduped.set(`${item.type}:${item.id}`, item);
  });
  return Array.from(deduped.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function buildSql(plan) {
  const lines = [
    '-- ============================================',
    '-- Legacy alias seed SQL (generated)',
    `-- Generated at: ${new Date().toISOString()}`,
    '-- ============================================',
    'BEGIN;',
    '',
    'DO $$',
    'BEGIN',
  ];

  plan.characterAliases.forEach((alias) => {
    lines.push(
      `  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)`,
      `  VALUES ('legacy_manual', ${sqlText(alias.fromId)}, ${sqlText(alias.toId)}, FALSE, ${sqlText(alias.reason)})`,
      `  ON CONFLICT (source, alias_id) DO UPDATE`,
      '  SET',
      '    character_id = EXCLUDED.character_id,',
      '    is_primary = FALSE,',
      '    note = EXCLUDED.note,',
      '    updated_at = NOW();',
      '',
      `  UPDATE public.pool_characters SET character_id = ${sqlText(alias.toId)} WHERE character_id = ${sqlText(alias.fromId)};`,
      `  UPDATE public.pools`,
      '  SET',
      `    featured_characters = ARRAY(`,
      `      SELECT DISTINCT CASE WHEN item = ${sqlText(alias.fromId)} THEN ${sqlText(alias.toId)} ELSE item END`,
      '      FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item',
      "      WHERE item IS NOT NULL AND BTRIM(item) <> ''",
      '    ),',
      '    updated_at = NOW()',
      `  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY[${sqlText(alias.fromId)}]::TEXT[];`,
      '',
    );
  });

  plan.poolAliases.forEach((alias) => {
    lines.push(
      `  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)`,
      `  VALUES ('legacy_manual', ${sqlText(alias.fromId)}, ${sqlText(alias.toId)}, FALSE, ${sqlText(alias.reason)})`,
      `  ON CONFLICT (source, alias_id) DO UPDATE`,
      '  SET',
      '    pool_id = EXCLUDED.pool_id,',
      '    is_primary = FALSE,',
      '    note = EXCLUDED.note,',
      '    updated_at = NOW();',
      '',
      `  UPDATE public.pool_characters SET pool_id = ${sqlText(alias.toId)} WHERE pool_id = ${sqlText(alias.fromId)};`,
      `  UPDATE public.history`,
      '  SET',
      `    pool_id = ${sqlText(alias.toId)},`,
      '    updated_at = NOW()',
      `  WHERE pool_id = ${sqlText(alias.fromId)};`,
      '',
    );
  });

  lines.push(
    "  RAISE NOTICE '✅ Legacy alias seed applied';",
    'END $$;',
    '',
    'COMMIT;',
    ''
  );

  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.legacySeedSql || !options.officialCharactersSql || !options.legacyPools || !options.officialExport) {
    console.error('用法: node scripts/generate-legacy-id-alias-seed.mjs --legacy-seed-sql <初始数据导入.sql> --official-characters-sql <characters_rows.sql> --legacy-pools <旧卡池快照.json> --official-export <官方导出.json> [--plan-out <plan.json>] [--sql-out <seed.sql>]');
    process.exitCode = 1;
    return;
  }

  const [
    legacySeedSql,
    officialCharactersSql,
    legacyPoolsJson,
    officialExportJson,
  ] = await Promise.all([
    readTextFile(options.legacySeedSql),
    readTextFile(options.officialCharactersSql),
    readJsonFile(options.legacyPools),
    readJsonFile(options.officialExport),
  ]);

  const legacyEntities = buildLegacySeedLookup(legacySeedSql.data);
  const officialEntities = buildOfficialEntityLookup(officialCharactersSql.data);
  const legacyPools = Array.isArray(legacyPoolsJson.data)
    ? legacyPoolsJson.data.map(normalizePoolRecord)
    : [];
  const officialPools = Array.isArray(officialExportJson.data?.pools)
    ? officialExportJson.data.pools.map(normalizePoolRecord)
    : [];

  const characterResult = mapLegacyCharacters(legacyEntities, officialEntities);
  const limitedPoolResult = mapLegacyLimitedPools(legacyPools, officialPools);
  const standardPoolResult = mapLegacyStandardPools(legacyPools, officialPools);
  const weaponPoolResult = mapLegacyWeaponPools(legacyPools, officialPools, limitedPoolResult.aliases);
  const weaponResult = mapLegacyWeaponEntities(legacyEntities, officialEntities, weaponPoolResult.aliases);

  const plan = {
    generatedAt: new Date().toISOString(),
    files: {
      legacySeedSql: legacySeedSql.path,
      officialCharactersSql: officialCharactersSql.path,
      legacyPools: legacyPoolsJson.path,
      officialExport: officialExportJson.path,
    },
    summary: {
      legacyEntityCount: legacyEntities.length,
      officialEntityCount: officialEntities.length,
      characterAliasCount: characterResult.aliases.length + weaponResult.aliases.length,
      poolAliasCount: limitedPoolResult.aliases.length + standardPoolResult.aliases.length + weaponPoolResult.aliases.length,
      unresolvedCharacterCount: characterResult.unresolved.length + weaponResult.unresolved.length,
      unresolvedPoolCount: limitedPoolResult.unresolved.length + standardPoolResult.unresolved.length + weaponPoolResult.unresolved.length,
    },
    characterAliases: dedupeAliases([...characterResult.aliases, ...weaponResult.aliases]),
    poolAliases: dedupeAliases([...limitedPoolResult.aliases, ...standardPoolResult.aliases, ...weaponPoolResult.aliases]),
    unresolvedCharacters: dedupeUnresolved([...characterResult.unresolved, ...weaponResult.unresolved]),
    unresolvedPools: dedupeUnresolved([...limitedPoolResult.unresolved, ...standardPoolResult.unresolved, ...weaponPoolResult.unresolved]),
  };

  console.log('# Legacy Alias Seed Plan');
  console.log(`角色 alias: ${plan.characterAliases.length}`);
  console.log(`卡池 alias: ${plan.poolAliases.length}`);
  console.log(`未解决角色/武器: ${plan.unresolvedCharacters.length}`);
  console.log(`未解决卡池: ${plan.unresolvedPools.length}`);

  if (plan.characterAliases.length > 0) {
    console.log('\n## 角色 / 武器 alias');
    plan.characterAliases.forEach((alias) => {
      console.log(`- ${alias.fromId} -> ${alias.toId} (${alias.legacyName} -> ${alias.officialName})`);
    });
  }

  if (plan.poolAliases.length > 0) {
    console.log('\n## 卡池 alias');
    plan.poolAliases.forEach((alias) => {
      console.log(`- ${alias.fromId} -> ${alias.toId} (${alias.legacyName} -> ${alias.officialName})`);
    });
  }

  if (plan.unresolvedCharacters.length > 0) {
    console.log('\n## 未解决角色 / 武器');
    plan.unresolvedCharacters.forEach((item) => {
      console.log(`- ${item.id}: ${item.name || '未知'} (${item.reason})`);
    });
  }

  if (plan.unresolvedPools.length > 0) {
    console.log('\n## 未解决卡池');
    plan.unresolvedPools.forEach((item) => {
      console.log(`- ${item.id}: ${item.name || '未知'} (${item.reason})`);
    });
  }

  if (options.planOut) {
    const outputPath = await writeOutputFile(options.planOut, `${JSON.stringify(plan, null, 2)}\n`);
    console.log(`\n已写出计划文件: ${outputPath}`);
  }

  if (options.sqlOut) {
    const sql = buildSql(plan);
    const outputPath = await writeOutputFile(options.sqlOut, sql);
    console.log(`已写出 SQL 文件: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error('[generate-legacy-id-alias-seed] 执行失败:', error);
  process.exitCode = 1;
});
