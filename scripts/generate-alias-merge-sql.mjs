import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const options = {
    plan: null,
    out: null,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--plan' && nextValue) {
      options.plan = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--out' && nextValue) {
      options.out = nextValue;
      index += 1;
      continue;
    }

    if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (!options.plan && positional[0]) {
    options.plan = positional[0];
  }

  if (!options.out && positional[1]) {
    options.out = positional[1];
  }

  return options;
}

function sqlText(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArrayMerge(targetExpr, sourceExpr, extras = []) {
  const extraArraySql = extras.length > 0
    ? extras.map(item => sqlText(item)).join(', ')
    : '';

  const parts = [
    `COALESCE(${targetExpr}, ARRAY[]::TEXT[])`,
    `COALESCE(${sourceExpr}, ARRAY[]::TEXT[])`,
  ];

  if (extraArraySql) {
    parts.push(`ARRAY[${extraArraySql}]`);
  }

  return `ARRAY(SELECT DISTINCT item FROM unnest(${parts.join(' || ')}) AS item WHERE item IS NOT NULL AND BTRIM(item) <> '')`;
}

async function writeOutputFile(filePath, contents) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents, 'utf8');
  return absolutePath;
}

function ensureMergeShape(items, kind) {
  if (!Array.isArray(items)) {
    throw new Error(`${kind} merges must be an array`);
  }

  items.forEach((item, index) => {
    if (!item?.fromId || !item?.toId) {
      throw new Error(`${kind}[${index}] is missing fromId or toId`);
    }

    if (item.fromId === item.toId) {
      throw new Error(`${kind}[${index}] has identical fromId and toId`);
    }
  });
}

function buildCharacterMergeBlock(merge) {
  const fromId = sqlText(merge.fromId);
  const toId = sqlText(merge.toId);
  const fromSource = sqlText(merge.fromSource || 'legacy_manual');
  const toSource = sqlText(merge.toSource || 'wiki');
  const note = sqlText(merge.note || `merge ${merge.fromId} -> ${merge.toId}`);
  const expectedName = merge.expectedName ? sqlText(merge.expectedName) : null;
  const expectedType = merge.expectedType ? sqlText(merge.expectedType) : null;
  const skipIfMissing = merge.skipIfMissing === true;

  const nameGuard = expectedName
    ? `\n  IF EXISTS (\n    SELECT 1 FROM public.characters WHERE id = ${fromId} AND name <> ${expectedName}\n  ) THEN\n    RAISE EXCEPTION 'character merge blocked: unexpected name for %', ${fromId};\n  END IF;`
    : '';

  const typeGuard = expectedType
    ? `\n  IF EXISTS (\n    SELECT 1 FROM public.characters WHERE id = ${fromId} AND type <> ${expectedType}\n  ) THEN\n    RAISE EXCEPTION 'character merge blocked: unexpected type for %', ${fromId};\n  END IF;`
    : '';

  return `DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_character_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = ${fromId}) INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = ${toId}) INTO target_exists;
${nameGuard}${typeGuard}

  IF NOT source_exists AND NOT target_exists THEN
${skipIfMissing
    ? `    RAISE NOTICE 'character merge skipped: both source % and target % are missing', ${fromId}, ${toId};
    RETURN;`
    : `    RAISE EXCEPTION 'character merge blocked: both source % and target % are missing', ${fromId}, ${toId};`}
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.characters (
      id,
      name,
      avatar_url,
      rarity,
      type,
      aliases,
      is_limited,
      release_date,
      created_at,
      updated_at,
      pool_config
    )
    SELECT
      ${toId},
      c.name,
      c.avatar_url,
      c.rarity,
      c.type,
      ${sqlArrayMerge('c.aliases', 'NULL', [merge.fromId])},
      c.is_limited,
      c.release_date,
      c.created_at,
      NOW(),
      c.pool_config
    FROM public.characters AS c
    WHERE c.id = ${fromId};

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.characters AS target
    SET
      avatar_url = COALESCE(target.avatar_url, source.avatar_url),
      aliases = ${sqlArrayMerge('target.aliases', 'source.aliases', [merge.fromId])},
      is_limited = COALESCE(target.is_limited, FALSE) OR COALESCE(source.is_limited, FALSE),
      release_date = COALESCE(target.release_date, source.release_date),
      pool_config = COALESCE(target.pool_config, source.pool_config),
      updated_at = NOW()
    FROM public.characters AS source
    WHERE target.id = ${toId}
      AND source.id = ${fromId};

    UPDATE public.pool_characters
    SET character_id = ${toId}
    WHERE character_id = ${fromId};

    UPDATE public.pools
    SET
      featured_characters = ARRAY(
        SELECT DISTINCT CASE WHEN item = ${fromId} THEN ${toId} ELSE item END
        FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) AS item
        WHERE item IS NOT NULL AND BTRIM(item) <> ''
      ),
      updated_at = NOW()
    WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY[${fromId}]::TEXT[];

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'character_id'
    ) INTO history_character_id_exists;

    IF history_character_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET character_id = %L, updated_at = NOW() WHERE character_id = %L',
        ${toId},
        ${fromId}
      );
    END IF;

    DELETE FROM public.characters
    WHERE id = ${fromId}
      AND id <> ${toId};
  END IF;

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES ('internal', ${toId}, ${toId}, TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES (${toSource}, ${toId}, ${toId}, TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.character_id_aliases (source, alias_id, character_id, is_primary, note)
  VALUES (${fromSource}, ${fromId}, ${toId}, FALSE, ${note})
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    character_id = EXCLUDED.character_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;`;
}

function buildPoolMergeBlock(merge) {
  const fromId = sqlText(merge.fromId);
  const toId = sqlText(merge.toId);
  const fromSource = sqlText(merge.fromSource || 'legacy_manual');
  const toSource = sqlText(merge.toSource || 'official_api');
  const note = sqlText(merge.note || `merge ${merge.fromId} -> ${merge.toId}`);
  const expectedName = merge.expectedName ? sqlText(merge.expectedName) : null;
  const expectedType = merge.expectedType ? sqlText(merge.expectedType) : null;
  const skipIfMissing = merge.skipIfMissing === true;

  const nameGuard = expectedName
    ? `\n  IF EXISTS (\n    SELECT 1 FROM public.pools WHERE pool_id = ${fromId} AND name <> ${expectedName}\n  ) THEN\n    RAISE EXCEPTION 'pool merge blocked: unexpected name for %', ${fromId};\n  END IF;`
    : '';

  const typeGuard = expectedType
    ? `\n  IF EXISTS (\n    SELECT 1 FROM public.pools WHERE pool_id = ${fromId} AND type <> ${expectedType}\n  ) THEN\n    RAISE EXCEPTION 'pool merge blocked: unexpected type for %', ${fromId};\n  END IF;`
    : '';

  return `DO $$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  history_legacy_pool_id_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = ${fromId}) INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = ${toId}) INTO target_exists;
${nameGuard}${typeGuard}

  IF NOT source_exists AND NOT target_exists THEN
${skipIfMissing
    ? `    RAISE NOTICE 'pool merge skipped: both source % and target % are missing', ${fromId}, ${toId};
    RETURN;`
    : `    RAISE EXCEPTION 'pool merge blocked: both source % and target % are missing', ${fromId}, ${toId};`}
  END IF;

  IF source_exists AND NOT target_exists THEN
    INSERT INTO public.pools (
      pool_id,
      user_id,
      name,
      type,
      locked,
      is_limited_weapon,
      created_at,
      updated_at,
      description,
      start_time,
      end_time,
      banner_url,
      featured_characters,
      up_character,
      rotation_processed
    )
    SELECT
      ${toId},
      p.user_id,
      p.name,
      p.type,
      p.locked,
      p.is_limited_weapon,
      p.created_at,
      NOW(),
      p.description,
      p.start_time,
      p.end_time,
      p.banner_url,
      p.featured_characters,
      p.up_character,
      p.rotation_processed
    FROM public.pools AS p
    WHERE p.pool_id = ${fromId};

    target_exists := TRUE;
  END IF;

  IF source_exists AND target_exists THEN
    UPDATE public.pools AS target
    SET
      description = COALESCE(target.description, source.description),
      start_time = COALESCE(target.start_time, source.start_time),
      end_time = COALESCE(target.end_time, source.end_time),
      banner_url = COALESCE(target.banner_url, source.banner_url),
      featured_characters = CASE
        WHEN COALESCE(array_length(target.featured_characters, 1), 0) > 0 THEN target.featured_characters
        ELSE source.featured_characters
      END,
      up_character = COALESCE(target.up_character, source.up_character),
      locked = COALESCE(target.locked, FALSE) OR COALESCE(source.locked, FALSE),
      is_limited_weapon = COALESCE(target.is_limited_weapon, source.is_limited_weapon),
      rotation_processed = COALESCE(target.rotation_processed, FALSE) OR COALESCE(source.rotation_processed, FALSE),
      updated_at = NOW()
    FROM public.pools AS source
    WHERE target.pool_id = ${toId}
      AND source.pool_id = ${fromId};

    UPDATE public.pool_characters
    SET pool_id = ${toId}
    WHERE pool_id = ${fromId};

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'history'
        AND column_name = 'legacy_pool_id'
    ) INTO history_legacy_pool_id_exists;

    IF history_legacy_pool_id_exists THEN
      EXECUTE format(
        'UPDATE public.history SET pool_id = %L, legacy_pool_id = COALESCE(legacy_pool_id, %L), updated_at = NOW() WHERE pool_id = %L',
        ${toId},
        ${fromId},
        ${fromId}
      );
    ELSE
      EXECUTE format(
        'UPDATE public.history SET pool_id = %L, updated_at = NOW() WHERE pool_id = %L',
        ${toId},
        ${fromId}
      );
    END IF;

    DELETE FROM public.pools
    WHERE pool_id = ${fromId}
      AND pool_id <> ${toId};
  END IF;

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES ('internal', ${toId}, ${toId}, TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES (${toSource}, ${toId}, ${toId}, TRUE, 'official canonical alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.pool_id_aliases (source, alias_id, pool_id, is_primary, note)
  VALUES (${fromSource}, ${fromId}, ${toId}, FALSE, ${note})
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    pool_id = EXCLUDED.pool_id,
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();
END $$;`;
}

function buildSql(plan) {
  ensureMergeShape(plan.characters || [], 'character');
  ensureMergeShape(plan.pools || [], 'pool');

  const sections = [
    '-- ============================================',
    '-- Alias merge SQL (generated)',
    `-- Generated at: ${new Date().toISOString()}`,
    '-- ============================================',
    'BEGIN;',
  ];

  (plan.characters || []).forEach((merge) => {
    sections.push('', `-- Character merge: ${merge.fromId} -> ${merge.toId}`);
    sections.push(buildCharacterMergeBlock(merge));
  });

  (plan.pools || []).forEach((merge) => {
    sections.push('', `-- Pool merge: ${merge.fromId} -> ${merge.toId}`);
    sections.push(buildPoolMergeBlock(merge));
  });

  sections.push('', 'COMMIT;', '');
  return sections.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.plan) {
    console.error('用法: node scripts/generate-alias-merge-sql.mjs --plan <merge-plan.json> [--out <sql-output-path>]');
    console.error('或:   npm run generate:alias-merge-sql -- <merge-plan.json> [<sql-output-path>]');
    process.exitCode = 1;
    return;
  }

  const planPath = path.resolve(process.cwd(), options.plan);
  const rawPlan = await fs.readFile(planPath, 'utf8');
  const plan = JSON.parse(rawPlan);
  const sql = buildSql(plan);

  if (options.out) {
    const outputPath = await writeOutputFile(options.out, sql);
    console.log(`已写出合并 SQL: ${outputPath}`);
    return;
  }

  process.stdout.write(sql);
}

main().catch((error) => {
  console.error('[generate-alias-merge-sql] 执行失败:', error);
  process.exitCode = 1;
});
