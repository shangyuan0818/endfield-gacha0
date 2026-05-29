const APPLY_SQL_VERSION = 1;
const CONFIRMATION_TOKEN_PLACEHOLDER = 'REPLACE_WITH_DATA_NEW_017_APPROVAL';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sqlText(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlComment(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\*\//g, '* /');
}

function collectOperations(plan) {
  return [
    ...(Array.isArray(plan?.operations?.characters) ? plan.operations.characters : []),
    ...(Array.isArray(plan?.operations?.pools) ? plan.operations.pools : []),
  ];
}

function collectReadyOperations(plan) {
  return collectOperations(plan).filter(operation => operation?.status === 'ready');
}

function validatePlan(plan, { allowEmpty = false } = {}) {
  if (plan?.planType !== 'manual_placeholder_official_id_migration') {
    throw new Error('manual placeholder apply SQL requires a manual placeholder migration plan.');
  }

  if (plan?.mode !== 'dry_run' || plan?.writesDatabase !== false) {
    throw new Error('manual placeholder apply SQL only accepts dry-run plans with writesDatabase=false.');
  }

  const readyOperations = collectReadyOperations(plan);
  if (!allowEmpty && readyOperations.length === 0) {
    throw new Error('manual placeholder apply SQL refused: no ready operations in plan.');
  }

  readyOperations.forEach((operation, index) => {
    const fromId = normalizeText(operation?.fromId);
    const toId = normalizeText(operation?.toId);
    const kind = normalizeText(operation?.kind);

    if (!['character', 'pool'].includes(kind)) {
      throw new Error(`ready operation ${index} has unsupported kind: ${kind || 'missing'}`);
    }

    if (!fromId || !toId) {
      throw new Error(`ready operation ${index} is missing fromId or toId.`);
    }

    if (fromId === toId) {
      throw new Error(`ready operation ${index} has identical fromId and toId.`);
    }
  });

  return readyOperations;
}

function buildHeader({ plan, generatedAt, generatedFrom, readyOperations }) {
  const blockedCount = Array.isArray(plan?.blocked)
    ? plan.blocked.length
    : collectOperations(plan).filter(operation => operation?.status === 'blocked').length;

  return [
    '-- ============================================',
    '-- DATA-NEW-017 manual placeholder apply SQL',
    `-- SQL artifact version: ${APPLY_SQL_VERSION}`,
    `-- Generated at: ${generatedAt}`,
    `-- Generated from: ${sqlComment(generatedFrom)}`,
    '--',
    '-- REVIEW-ONLY ARTIFACT:',
    '--   1. Run a fresh production audit before using this file.',
    '--   2. Take a database snapshot before apply.',
    '--   3. Keep the dry-run JSON plan attached to the admin review.',
    '--   4. Replace the confirmation token only after approval.',
    '--   5. The script ends with ROLLBACK by default; change it manually only during an approved apply window.',
    '--',
    `-- Ready operations included: ${readyOperations.length}`,
    `-- Blocked operations excluded: ${blockedCount}`,
    `-- Estimated reference updates from plan: ${Number(plan?.summary?.estimatedReferenceUpdateCount) || 0}`,
    '-- Source placeholder rows are retained in this first apply artifact; only aliases and references are migrated.',
    '-- ============================================',
  ].join('\n');
}

function buildConfirmationGuard() {
  return `DO $data_new_017_guard$
DECLARE
  approval_token TEXT := ${sqlText(CONFIRMATION_TOKEN_PLACEHOLDER)};
BEGIN
  IF approval_token = ${sqlText(CONFIRMATION_TOKEN_PLACEHOLDER)} THEN
    RAISE EXCEPTION 'DATA-NEW-017 apply blocked: replace approval_token after fresh audit, database snapshot, and admin approval.';
  END IF;
END
$data_new_017_guard$;`;
}

function buildAliasConflictGuard({ aliasTable, targetColumn, fromId, toId, kind }) {
  return `  IF EXISTS (
    SELECT 1
    FROM public.${aliasTable}
    WHERE alias_id = ${sqlText(fromId)}
      AND source <> 'internal'
      AND ${targetColumn} <> ${sqlText(toId)}
  ) THEN
    RAISE EXCEPTION '${kind} placeholder migration blocked: alias target conflict for %', ${sqlText(fromId)};
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.${aliasTable}
    WHERE alias_id = ${sqlText(fromId)}
      AND ${targetColumn} = ${sqlText(toId)}
  ) THEN
    RAISE EXCEPTION '${kind} placeholder migration blocked: missing reviewed alias target % -> %', ${sqlText(fromId)}, ${sqlText(toId)};
  END IF;`;
}

function buildAliasUpserts({ aliasTable, targetColumn, fromId, toId, kind }) {
  const note = `DATA-NEW-017 ${kind} placeholder retirement: keep ${fromId} as alias for ${toId}`;

  return `  DELETE FROM public.${aliasTable}
  WHERE source = 'internal'
    AND alias_id = ${sqlText(fromId)}
    AND ${targetColumn} = ${sqlText(fromId)};

  INSERT INTO public.${aliasTable} (source, alias_id, ${targetColumn}, is_primary, note)
  VALUES ('internal', ${sqlText(toId)}, ${sqlText(toId)}, TRUE, 'canonical self alias')
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    ${targetColumn} = EXCLUDED.${targetColumn},
    is_primary = TRUE,
    note = EXCLUDED.note,
    updated_at = NOW();

  INSERT INTO public.${aliasTable} (source, alias_id, ${targetColumn}, is_primary, note)
  VALUES ('manual_placeholder', ${sqlText(fromId)}, ${sqlText(toId)}, FALSE, ${sqlText(note)})
  ON CONFLICT (source, alias_id) DO UPDATE
  SET
    ${targetColumn} = EXCLUDED.${targetColumn},
    is_primary = FALSE,
    note = EXCLUDED.note,
    updated_at = NOW();`;
}

function buildFeaturedCharactersReplacement(fromId, toId) {
  return `  UPDATE public.pools
  SET
    featured_characters = ARRAY(
      SELECT normalized_item
      FROM (
        SELECT DISTINCT ON (normalized_item)
          normalized_item,
          item_order
        FROM (
          SELECT
            CASE WHEN item = ${sqlText(fromId)} THEN ${sqlText(toId)} ELSE item END AS normalized_item,
            item_order
          FROM unnest(COALESCE(featured_characters, ARRAY[]::TEXT[])) WITH ORDINALITY AS entries(item, item_order)
          WHERE item IS NOT NULL AND BTRIM(item) <> ''
        ) AS normalized
        WHERE normalized_item IS NOT NULL AND BTRIM(normalized_item) <> ''
        ORDER BY normalized_item, item_order
      ) AS deduped
      ORDER BY item_order
    ),
    updated_at = NOW()
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY[${sqlText(fromId)}]::TEXT[];`;
}

function buildCharacterBlock(operation) {
  const fromId = normalizeText(operation.fromId);
  const toId = normalizeText(operation.toId);
  const label = sqlComment(operation.label || '');

  return `-- Character / weapon placeholder: ${sqlComment(fromId)} -> ${sqlComment(toId)}${label ? ` (${label})` : ''}
DO $data_new_017_character$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  remaining_history_refs BIGINT;
  remaining_pool_character_refs BIGINT;
  remaining_featured_refs BIGINT;
BEGIN
  IF ${sqlText(fromId)} = ${sqlText(toId)} THEN
    RAISE EXCEPTION 'character placeholder migration blocked: self merge %', ${sqlText(fromId)};
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = ${sqlText(fromId)}) INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.characters WHERE id = ${sqlText(toId)}) INTO target_exists;

  IF NOT source_exists THEN
    RAISE EXCEPTION 'character placeholder migration blocked: source % is missing; rerun audit', ${sqlText(fromId)};
  END IF;

  IF NOT target_exists THEN
    RAISE EXCEPTION 'character placeholder migration blocked: target % is missing; rerun audit', ${sqlText(toId)};
  END IF;

${buildAliasConflictGuard({
    aliasTable: 'character_id_aliases',
    targetColumn: 'character_id',
    fromId,
    toId,
    kind: 'character',
  })}

${buildAliasUpserts({
    aliasTable: 'character_id_aliases',
    targetColumn: 'character_id',
    fromId,
    toId,
    kind: 'character',
  })}

  UPDATE public.history
  SET
    character_id = ${sqlText(toId)},
    updated_at = NOW()
  WHERE character_id = ${sqlText(fromId)};

  INSERT INTO public.pool_characters (pool_id, character_id, is_up, created_at)
  SELECT
    pool_id,
    ${sqlText(toId)},
    is_up,
    created_at
  FROM public.pool_characters
  WHERE character_id = ${sqlText(fromId)}
  ON CONFLICT (pool_id, character_id) DO UPDATE
  SET is_up = public.pool_characters.is_up OR EXCLUDED.is_up;

  DELETE FROM public.pool_characters
  WHERE character_id = ${sqlText(fromId)};

${buildFeaturedCharactersReplacement(fromId, toId)}

  SELECT COUNT(*) INTO remaining_history_refs
  FROM public.history
  WHERE character_id = ${sqlText(fromId)};

  SELECT COUNT(*) INTO remaining_pool_character_refs
  FROM public.pool_characters
  WHERE character_id = ${sqlText(fromId)};

  SELECT COUNT(*) INTO remaining_featured_refs
  FROM public.pools
  WHERE COALESCE(featured_characters, ARRAY[]::TEXT[]) @> ARRAY[${sqlText(fromId)}]::TEXT[];

  IF remaining_history_refs + remaining_pool_character_refs + remaining_featured_refs > 0 THEN
    RAISE EXCEPTION 'character placeholder migration left references for %: history=%, pool_characters=%, featured=%',
      ${sqlText(fromId)},
      remaining_history_refs,
      remaining_pool_character_refs,
      remaining_featured_refs;
  END IF;

  RAISE NOTICE 'DATA-NEW-017 character placeholder references migrated: % -> %', ${sqlText(fromId)}, ${sqlText(toId)};
END
$data_new_017_character$;`;
}

function buildPoolBlock(operation) {
  const fromId = normalizeText(operation.fromId);
  const toId = normalizeText(operation.toId);
  const label = sqlComment(operation.label || '');

  return `-- Pool placeholder: ${sqlComment(fromId)} -> ${sqlComment(toId)}${label ? ` (${label})` : ''}
DO $data_new_017_pool$
DECLARE
  source_exists BOOLEAN;
  target_exists BOOLEAN;
  duplicate_history_refs BIGINT;
  remaining_history_refs BIGINT;
  remaining_pool_character_refs BIGINT;
BEGIN
  IF ${sqlText(fromId)} = ${sqlText(toId)} THEN
    RAISE EXCEPTION 'pool placeholder migration blocked: self merge %', ${sqlText(fromId)};
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = ${sqlText(fromId)}) INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.pools WHERE pool_id = ${sqlText(toId)}) INTO target_exists;

  IF NOT source_exists THEN
    RAISE EXCEPTION 'pool placeholder migration blocked: source % is missing; rerun audit', ${sqlText(fromId)};
  END IF;

  IF NOT target_exists THEN
    RAISE EXCEPTION 'pool placeholder migration blocked: target % is missing; rerun audit', ${sqlText(toId)};
  END IF;

${buildAliasConflictGuard({
    aliasTable: 'pool_id_aliases',
    targetColumn: 'pool_id',
    fromId,
    toId,
    kind: 'pool',
  })}

  SELECT COUNT(*) INTO duplicate_history_refs
  FROM public.history AS source_history
  JOIN public.history AS target_history
    ON target_history.user_id = source_history.user_id
   AND target_history.pool_id = ${sqlText(toId)}
   AND target_history.game_uid IS NOT DISTINCT FROM source_history.game_uid
   AND target_history.seq_id IS NOT DISTINCT FROM source_history.seq_id
   AND target_history.id IS DISTINCT FROM source_history.id
  WHERE source_history.pool_id = ${sqlText(fromId)}
    AND source_history.game_uid IS NOT NULL
    AND source_history.seq_id IS NOT NULL;

  IF duplicate_history_refs > 0 THEN
    RAISE EXCEPTION 'pool placeholder migration blocked: % duplicate history rows would collide for % -> %',
      duplicate_history_refs,
      ${sqlText(fromId)},
      ${sqlText(toId)};
  END IF;

${buildAliasUpserts({
    aliasTable: 'pool_id_aliases',
    targetColumn: 'pool_id',
    fromId,
    toId,
    kind: 'pool',
  })}

  UPDATE public.history
  SET
    pool_id = ${sqlText(toId)},
    updated_at = NOW()
  WHERE pool_id = ${sqlText(fromId)};

  INSERT INTO public.pool_characters (pool_id, character_id, is_up, created_at)
  SELECT
    ${sqlText(toId)},
    character_id,
    is_up,
    created_at
  FROM public.pool_characters
  WHERE pool_id = ${sqlText(fromId)}
  ON CONFLICT (pool_id, character_id) DO UPDATE
  SET is_up = public.pool_characters.is_up OR EXCLUDED.is_up;

  DELETE FROM public.pool_characters
  WHERE pool_id = ${sqlText(fromId)};

  SELECT COUNT(*) INTO remaining_history_refs
  FROM public.history
  WHERE pool_id = ${sqlText(fromId)};

  SELECT COUNT(*) INTO remaining_pool_character_refs
  FROM public.pool_characters
  WHERE pool_id = ${sqlText(fromId)};

  IF remaining_history_refs + remaining_pool_character_refs > 0 THEN
    RAISE EXCEPTION 'pool placeholder migration left references for %: history=%, pool_characters=%',
      ${sqlText(fromId)},
      remaining_history_refs,
      remaining_pool_character_refs;
  END IF;

  RAISE NOTICE 'DATA-NEW-017 pool placeholder references migrated: % -> %', ${sqlText(fromId)}, ${sqlText(toId)};
END
$data_new_017_pool$;`;
}

function buildCacheRefreshBlock() {
  return `DO $data_new_017_cache$
BEGIN
  IF to_regprocedure('public.refresh_public_analytics_cache()') IS NOT NULL THEN
    PERFORM public.refresh_public_analytics_cache();
  ELSE
    UPDATE public.site_config
    SET
      value = jsonb_build_object(
        'epoch', extract(epoch from NOW())::BIGINT,
        'scope', 'manual-placeholder',
        'reason', 'DATA-NEW-017 manual placeholder apply SQL',
        'updatedAt', NOW()
      ),
      updated_at = NOW()
    WHERE key = 'public_cache_epoch';
  END IF;
END
$data_new_017_cache$;`;
}

function buildOperationBlock(operation) {
  if (operation.kind === 'character') {
    return buildCharacterBlock(operation);
  }

  return buildPoolBlock(operation);
}

export function buildManualPlaceholderApplySql(plan, {
  generatedAt = new Date().toISOString(),
  generatedFrom = 'manual-placeholder-migration-plan',
  allowEmpty = false,
} = {}) {
  const readyOperations = validatePlan(plan, { allowEmpty });

  const sections = [
    buildHeader({ plan, generatedAt, generatedFrom, readyOperations }),
    'BEGIN;',
    "SET LOCAL lock_timeout = '5s';",
    "SET LOCAL statement_timeout = '120s';",
    '',
    buildConfirmationGuard(),
  ];

  if (readyOperations.length === 0) {
    sections.push('', '-- No ready operations. Nothing to apply.');
  } else {
    readyOperations.forEach((operation) => {
      sections.push('', buildOperationBlock(operation));
    });
    sections.push('', buildCacheRefreshBlock());
  }

  sections.push(
    '',
    '-- Default safety ending: this review artifact rolls back even after token replacement.',
    '-- For an approved apply window only, manually change ROLLBACK to COMMIT after reviewing every block above.',
    'ROLLBACK;',
    ''
  );

  return sections.join('\n');
}

export {
  APPLY_SQL_VERSION,
  CONFIRMATION_TOKEN_PLACEHOLDER,
};
