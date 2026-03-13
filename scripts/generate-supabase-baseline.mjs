import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');
const outputPath = path.join(projectRoot, 'supabase', 'baseline', '000_complete_schema.sql');

function compareMigrationNames(a, b) {
  const [, aNum = '0', aRest = ''] = a.match(/^(\d+)_?(.*)$/) || [];
  const [, bNum = '0', bRest = ''] = b.match(/^(\d+)_?(.*)$/) || [];
  const numDiff = Number(aNum) - Number(bNum);
  if (numDiff !== 0) {
    return numDiff;
  }
  return aRest.localeCompare(bRest);
}

function stripBom(content) {
  return content.replace(/^\uFEFF/, '');
}

function buildHeader(migrationFiles) {
  const generatedAt = new Date().toISOString();
  const firstMigration = migrationFiles[0] || 'N/A';
  const lastMigration = migrationFiles[migrationFiles.length - 1] || 'N/A';

  return [
    '-- ============================================',
    '-- 终末地抽卡分析器 - 自动生成基线 Schema',
    '--',
    '-- 说明:',
    '--   1. 此文件由 scripts/generate-supabase-baseline.mjs 自动生成',
    '--   2. 仅合并 supabase/migrations/ 中的标准前向迁移',
    '--   3. 不包含 supabase/manual/ 下的 destructive / rollback / data-backfill 脚本',
    `--   4. 生成时间: ${generatedAt}`,
    `--   5. 覆盖范围: ${firstMigration} -> ${lastMigration}`,
    '-- ============================================',
    '',
  ].join('\n');
}

async function main() {
  const dirEntries = await readdir(migrationsDir, { withFileTypes: true });
  const migrationFiles = dirEntries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareMigrationNames);

  if (migrationFiles.length === 0) {
    throw new Error(`No migration SQL files found in ${migrationsDir}`);
  }

  const chunks = [buildHeader(migrationFiles)];

  for (const fileName of migrationFiles) {
    const absolutePath = path.join(migrationsDir, fileName);
    const rawContent = await readFile(absolutePath, 'utf8');
    const content = stripBom(rawContent).trim();

    chunks.push([
      `-- >>> BEGIN MIGRATION: ${fileName}`,
      content,
      `-- <<< END MIGRATION: ${fileName}`,
      '',
    ].join('\n'));
  }

  const output = `${chunks.join('\n')}\n`;
  await writeFile(outputPath, output, 'utf8');

  console.log(`Generated baseline from ${migrationFiles.length} migrations.`);
  console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error('[generate-supabase-baseline] Failed:', error);
  process.exitCode = 1;
});
