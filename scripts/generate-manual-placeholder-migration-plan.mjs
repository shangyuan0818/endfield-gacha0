import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManualPlaceholderMigrationPlan } from './lib/manualPlaceholderMigrationPlan.mjs';

function parseArgs(argv) {
  const options = {
    audit: null,
    out: null,
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--audit' && nextValue) {
      options.audit = nextValue;
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

  if (!options.audit && positional[0]) {
    options.audit = positional[0];
  }

  if (!options.out && positional[1]) {
    options.out = positional[1];
  }

  return options;
}

async function readJsonFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const contents = await fs.readFile(absolutePath, 'utf8');
  return {
    absolutePath,
    data: JSON.parse(contents),
  };
}

function extractRetirementReport(data) {
  if (data?.manualPlaceholderRetirement) {
    return data.manualPlaceholderRetirement;
  }

  if (data?.summary && Array.isArray(data?.characters) && Array.isArray(data?.pools)) {
    return data;
  }

  throw new Error('输入 JSON 缺少 manualPlaceholderRetirement，或不是 manual placeholder retirement report。');
}

function buildDefaultOutPath(auditPath) {
  const absoluteInput = path.resolve(process.cwd(), auditPath);
  const parsedPath = path.parse(absoluteInput);
  return path.join(parsedPath.dir, `${parsedPath.name}.manual-placeholder-migration-plan.generated.json`);
}

async function writeOutputFile(filePath, contents) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents, 'utf8');
  return absolutePath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.audit) {
    throw new Error('缺少审计报告路径；请传入 --audit <path> 或使用第一个位置参数。');
  }

  const { absolutePath, data } = await readJsonFile(options.audit);
  const retirementReport = extractRetirementReport(data);
  const plan = buildManualPlaceholderMigrationPlan(retirementReport, {
    generatedFrom: path.basename(absolutePath),
  });
  const outputPath = options.out || buildDefaultOutPath(options.audit);
  const absoluteOutputPath = await writeOutputFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log('# DATA-NEW-017 manual placeholder migration dry-run plan');
  console.log(`输入审计报告: ${absolutePath}`);
  console.log(`输出 dry-run 计划: ${absoluteOutputPath}`);
  console.log(`可迁移角色/武器: ${plan.summary.readyCharacterMigrations}`);
  console.log(`可迁移卡池: ${plan.summary.readyPoolMigrations}`);
  console.log(`阻塞角色/武器: ${plan.summary.blockedCharacterPlaceholders}`);
  console.log(`阻塞卡池: ${plan.summary.blockedPoolPlaceholders}`);
  console.log(`预计引用更新行数: ${plan.summary.estimatedReferenceUpdateCount}`);
  console.log('注意：该计划不写数据库；执行前仍需人工审核和最新生产审计。');
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error('[generate-manual-placeholder-migration-plan] 执行失败:', error);
    process.exitCode = 1;
  });
}
