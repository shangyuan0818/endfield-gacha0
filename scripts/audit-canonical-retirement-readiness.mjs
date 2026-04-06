import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const defaultAuditPath = path.join(
  projectRoot,
  'supabase',
  'manual',
  'data-backfill',
  '076_canonical_data_audit.supabase.generated.json'
);

function parseArgs(argv) {
  const options = {
    audit: defaultAuditPath,
    writeJson: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--audit' && nextValue) {
      options.audit = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    if (arg === '--write-json' && nextValue) {
      options.writeJson = path.resolve(process.cwd(), nextValue);
      index += 1;
    }
  }

  return options;
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function readJsonIfExists(filePath) {
  const contents = await readTextIfExists(filePath);
  if (!contents) {
    return null;
  }
  return JSON.parse(contents);
}

async function checkEvidence({ relativePath, pattern, description }) {
  const absolutePath = path.join(projectRoot, relativePath);
  const contents = await readTextIfExists(absolutePath);
  if (!contents) {
    return {
      relativePath,
      description,
      matched: false,
      missing: true,
    };
  }

  return {
    relativePath,
    description,
    matched: pattern.test(contents),
    missing: false,
  };
}

async function collectEvidence(items) {
  const results = await Promise.all(items.map(checkEvidence));
  return results.filter(item => item.matched);
}

async function checkRetirementEvidence({
  relativePath,
  createPattern,
  retirePattern,
  description,
}) {
  const absolutePath = path.join(projectRoot, relativePath);
  const contents = await readTextIfExists(absolutePath);
  if (!contents) {
    return {
      relativePath,
      description,
      matched: false,
      missing: true,
    };
  }

  return {
    relativePath,
    description,
    matched: createPattern.test(contents) && !retirePattern.test(contents),
    missing: false,
  };
}

async function collectRetirementEvidence(items) {
  const results = await Promise.all(items.map(checkRetirementEvidence));
  return results.filter(item => item.matched);
}

function formatState(state) {
  switch (state) {
    case 'blocked_runtime':
      return '运行时仍依赖，不能退役';
    case 'blocked_schema':
      return '运行时已基本脱钩，但 schema / tooling / 文档仍未收口';
    case 'planning_ready':
      return '无明显直接阻塞，可进入退役计划';
    default:
      return '未知';
  }
}

function summarizeField({
  runtimeEvidence,
  schemaEvidence,
  toolingEvidence,
  docEvidence,
  auditState,
}) {
  const blockers = [];
  let state = 'planning_ready';

  if (runtimeEvidence.length > 0) {
    state = 'blocked_runtime';
    blockers.push('运行时读写链仍显式依赖该兼容字段');
  }

  if (state !== 'blocked_runtime' && (schemaEvidence.length > 0 || toolingEvidence.length > 0 || docEvidence.length > 0)) {
    state = 'blocked_schema';
  }

  if (schemaEvidence.length > 0) {
    blockers.push('baseline 或标准 schema 仍保留该兼容字段');
  }

  if (toolingEvidence.length > 0) {
    blockers.push('审计 / merge / backfill tooling 仍依赖该兼容字段');
  }

  if (docEvidence.length > 0) {
    blockers.push('历史文档仍给出过时的删列或回滚建议');
  }

  if (auditState?.columnPresent === false && runtimeEvidence.length > 0) {
    blockers.push('真实库已缺失该列，但公开仓库运行时仍把它当成写入契约');
  }

  if ((auditState?.aliasBackedReferenceCount || 0) > 0) {
    blockers.push(`真实库仍有 ${auditState.aliasBackedReferenceCount} 条 alias-backed 引用未消解`);
  }

  if ((auditState?.unresolvedReferenceCount || 0) > 0) {
    blockers.push(`真实库仍有 ${auditState.unresolvedReferenceCount} 条 unresolved 引用`);
  }

  return {
    state,
    blockers,
  };
}

function printSection(title, section) {
  console.log(`\n## ${title}`);
  console.log(`状态: ${formatState(section.state)}`);

  if (section.auditState) {
    const { columnPresent, aliasBackedReferenceCount, unresolvedReferenceCount } = section.auditState;
    if (columnPresent === true) {
      console.log('审计: 真实库中该列存在');
    } else if (columnPresent === false) {
      console.log('审计: 真实库中该列不存在');
    } else {
      console.log('审计: 未提供真实库列存在性信息');
    }
    console.log(`审计: alias-backed 引用 ${aliasBackedReferenceCount ?? '未知'} / unresolved 引用 ${unresolvedReferenceCount ?? '未知'}`);
  }

  if (section.runtimeEvidence.length > 0) {
    console.log('运行时阻塞:');
    section.runtimeEvidence.forEach((item) => {
      console.log(`- ${item.relativePath}: ${item.description}`);
    });
  }

  if (section.schemaEvidence.length > 0) {
    console.log('Schema 阻塞:');
    section.schemaEvidence.forEach((item) => {
      console.log(`- ${item.relativePath}: ${item.description}`);
    });
  }

  if (section.toolingEvidence.length > 0) {
    console.log('Tooling 阻塞:');
    section.toolingEvidence.forEach((item) => {
      console.log(`- ${item.relativePath}: ${item.description}`);
    });
  }

  if (section.docEvidence.length > 0) {
    console.log('文档阻塞:');
    section.docEvidence.forEach((item) => {
      console.log(`- ${item.relativePath}: ${item.description}`);
    });
  }

  if (section.blockers.length > 0) {
    console.log('结论:');
    section.blockers.forEach((item) => {
      console.log(`- ${item}`);
    });
  } else {
    console.log('结论: 当前未发现直接阻塞项。');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const auditReport = await readJsonIfExists(options.audit);
  const cloudWriteContents = await readTextIfExists(path.join(projectRoot, 'src', 'services', 'cloudWriteService.js'));
  const historyCharacterFallbackEnabled = Boolean(cloudWriteContents)
    && /detectMissingHistoryOptionalColumn/.test(cloudWriteContents)
    && /omitHistoryColumns/.test(cloudWriteContents)
    && /supportedOptionalColumns\s*=\s*new Set\(\['character_id', 'server_id', 'region'\]\)/.test(cloudWriteContents);

  const historyCharacterRuntimeEvidence = await collectEvidence([
    ...(!historyCharacterFallbackEnabled ? [{
      relativePath: 'src/services/cloudWriteService.js',
      pattern: /character_id:\s*resolvedCharacterId\s*\|\|\s*record\.character_id\s*\|\|\s*record\.item_id\s*\|\|\s*null/,
      description: 'history upsert payload 仍会写入 character_id 且缺少通用 optional-column fallback',
    }] : []),
  ]);

  const historyCharacterSchemaEvidence = await collectRetirementEvidence([
    {
      relativePath: 'supabase/baseline/000_complete_schema.sql',
      createPattern: /COMMENT ON COLUMN public\.history\.character_id IS/,
      retirePattern: /ALTER TABLE public\.history[\s\S]*?DROP COLUMN IF EXISTS character_id/i,
      description: 'baseline 最终 schema 仍保留 history.character_id',
    },
  ]);

  const historyCharacterToolingEvidence = await collectEvidence([
    {
      relativePath: 'scripts/generate-alias-merge-sql.mjs',
      pattern: /history_character_id_exists/,
      description: 'merge SQL 生成器仍会条件性更新 history.character_id',
    },
    {
      relativePath: 'scripts/generate-legacy-id-alias-seed.mjs',
      pattern: /history_character_id_exists/,
      description: 'legacy alias seed 生成器仍会条件性更新 history.character_id',
    },
  ]);

  const historyCharacterDocEvidence = await collectEvidence([
    {
      relativePath: 'supabase/docs/feat-007-migration-guide.md',
      pattern: /DROP COLUMN IF EXISTS character_id/,
      description: '历史迁移指南仍保留直接删除 history.character_id 的回滚示例',
    },
  ]);

  const legacyPoolSchemaEvidence = await collectRetirementEvidence([
    {
      relativePath: 'supabase/baseline/000_complete_schema.sql',
      createPattern: /COMMENT ON COLUMN public\.history\.legacy_pool_id IS/,
      retirePattern: /ALTER TABLE public\.history[\s\S]*?DROP COLUMN IF EXISTS legacy_pool_id/i,
      description: 'baseline 最终 schema 仍保留 history.legacy_pool_id',
    },
    {
      relativePath: 'supabase/baseline/000_complete_schema.sql',
      createPattern: /COMMENT ON COLUMN public\.pools\.legacy_pool_id IS/,
      retirePattern: /ALTER TABLE public\.pools[\s\S]*?DROP COLUMN IF EXISTS legacy_pool_id/i,
      description: 'baseline 最终 schema 仍保留 pools.legacy_pool_id',
    },
  ]);

  const legacyPoolToolingEvidence = await collectEvidence([
    {
      relativePath: 'scripts/generate-alias-merge-sql.mjs',
      pattern: /history_legacy_pool_id_exists/,
      description: 'merge SQL 生成器仍会条件性维护 legacy_pool_id',
    },
    {
      relativePath: 'scripts/generate-legacy-id-alias-seed.mjs',
      pattern: /history_legacy_pool_id_exists/,
      description: 'legacy alias seed 生成器仍会条件性维护 legacy_pool_id',
    },
    {
      relativePath: 'supabase/manual/data-backfill/075_apply_alias_merges.generated.sql',
      pattern: /legacy_pool_id = COALESCE\(legacy_pool_id,/,
      description: '现有手工 backfill 产物仍会回填 legacy_pool_id',
    },
  ]);

  const legacyPoolDocEvidence = await collectEvidence([
    {
      relativePath: 'supabase/docs/feat-007-migration-guide.md',
      pattern: /DROP COLUMN IF EXISTS legacy_pool_id/,
      description: '历史迁移指南仍保留直接删除 legacy_pool_id 的回滚示例',
    },
    {
      relativePath: 'supabase/docs/feat-007-migration-guide.md',
      pattern: /6 个月/,
      description: '历史迁移指南仍用旧的“6 个月后可删”口径描述 legacy_pool_id',
    },
  ]);

  const historyCharacterAuditState = auditReport
    ? {
      columnPresent: auditReport?.schemaCapabilities?.historyCharacterId ?? null,
      aliasBackedReferenceCount: auditReport?.summary?.historyCharacterAliasBackedReferenceCount ?? null,
      unresolvedReferenceCount: auditReport?.summary?.historyCharacterUnresolvedReferenceCount ?? null,
    }
    : null;

  const legacyPoolAuditState = auditReport
    ? {
      columnPresent: null,
      aliasBackedReferenceCount: auditReport?.summary?.historyPoolAliasBackedReferenceCount ?? null,
      unresolvedReferenceCount: auditReport?.summary?.historyPoolUnresolvedReferenceCount ?? null,
    }
    : null;

  const historyCharacterSummary = summarizeField({
    runtimeEvidence: historyCharacterRuntimeEvidence,
    schemaEvidence: historyCharacterSchemaEvidence,
    toolingEvidence: historyCharacterToolingEvidence,
    docEvidence: historyCharacterDocEvidence,
    auditState: historyCharacterAuditState,
  });

  const legacyPoolSummary = summarizeField({
    runtimeEvidence: [],
    schemaEvidence: legacyPoolSchemaEvidence,
    toolingEvidence: legacyPoolToolingEvidence,
    docEvidence: legacyPoolDocEvidence,
    auditState: legacyPoolAuditState,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    auditSource: auditReport ? path.relative(projectRoot, options.audit) : null,
    historyCharacterId: {
      auditState: historyCharacterAuditState,
      runtimeEvidence: historyCharacterRuntimeEvidence,
      schemaEvidence: historyCharacterSchemaEvidence,
      toolingEvidence: historyCharacterToolingEvidence,
      docEvidence: historyCharacterDocEvidence,
      ...historyCharacterSummary,
    },
    legacyPoolId: {
      auditState: legacyPoolAuditState,
      runtimeEvidence: [],
      schemaEvidence: legacyPoolSchemaEvidence,
      toolingEvidence: legacyPoolToolingEvidence,
      docEvidence: legacyPoolDocEvidence,
      ...legacyPoolSummary,
    },
  };

  console.log('# DATA-NEW-008 兼容字段退役准备度审计');
  console.log(`审计报告: ${report.auditSource || '未提供，仅做仓库静态检查'}`);

  printSection('history.character_id', report.historyCharacterId);
  printSection('legacy_pool_id', report.legacyPoolId);

  if (options.writeJson) {
    await fs.mkdir(path.dirname(options.writeJson), { recursive: true });
    await fs.writeFile(options.writeJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n已写出 JSON 报告: ${options.writeJson}`);
  }
}

main().catch((error) => {
  console.error('[audit-canonical-retirement-readiness] 执行失败:', error);
  process.exitCode = 1;
});
