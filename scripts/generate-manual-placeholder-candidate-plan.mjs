import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManualPlaceholderCandidateReviewPlan } from './lib/manualPlaceholderCandidatePlan.mjs';

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

function buildDefaultOutPath(auditPath) {
  const absoluteInput = path.resolve(process.cwd(), auditPath);
  const parsedPath = path.parse(absoluteInput);
  return path.join(parsedPath.dir, `${parsedPath.name}.manual-placeholder-candidate-plan.generated.json`);
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
  const plan = buildManualPlaceholderCandidateReviewPlan(data, {
    generatedFrom: path.basename(absolutePath),
  });
  const outputPath = options.out || buildDefaultOutPath(options.audit);
  const absoluteOutputPath = await writeOutputFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log('# DATA-NEW-018 manual placeholder 官方 ID 候选审阅计划');
  console.log(`输入审计报告: ${absolutePath}`);
  console.log(`输出审阅计划: ${absoluteOutputPath}`);
  console.log(`角色/武器 placeholder: ${plan.summary.characterPlaceholders.totalPlaceholders}`);
  console.log(`角色/武器候选项: ${plan.summary.characterPlaceholders.placeholdersWithCandidates}`);
  console.log(`卡池 placeholder: ${plan.summary.poolPlaceholders.totalPlaceholders}`);
  console.log(`卡池候选项: ${plan.summary.poolPlaceholders.placeholdersWithCandidates}`);
  console.log(`总待审阅项: ${plan.summary.totalWithCandidates}`);
  console.log('注意：该计划只供人工审阅，不写数据库、不生成迁移 SQL。确认唯一目标后，应先写入 alias，再重新生成正式迁移计划。');
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error('[generate-manual-placeholder-candidate-plan] 执行失败:', error);
    process.exitCode = 1;
  });
}

export {
  parseArgs,
};
