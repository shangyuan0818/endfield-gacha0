import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManualPlaceholderApplySql } from './lib/manualPlaceholderApplySql.mjs';

function parseArgs(argv) {
  const options = {
    plan: null,
    out: null,
    allowEmpty: false,
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

    if (arg === '--allow-empty') {
      options.allowEmpty = true;
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

async function readJsonFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const contents = await fs.readFile(absolutePath, 'utf8');
  return {
    absolutePath,
    data: JSON.parse(contents),
  };
}

function buildDefaultOutPath(planPath) {
  const absoluteInput = path.resolve(process.cwd(), planPath);
  const parsedPath = path.parse(absoluteInput);
  return path.join(parsedPath.dir, `${parsedPath.name}.manual-placeholder-apply.generated.sql`);
}

async function writeOutputFile(filePath, contents) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, contents, 'utf8');
  return absolutePath;
}

function countReadyOperations(plan) {
  const operations = [
    ...(Array.isArray(plan?.operations?.characters) ? plan.operations.characters : []),
    ...(Array.isArray(plan?.operations?.pools) ? plan.operations.pools : []),
  ];
  return operations.filter(operation => operation?.status === 'ready').length;
}

export function shouldAllowEmptyPlan(plan, explicitAllowEmpty = false) {
  return explicitAllowEmpty || countReadyOperations(plan) === 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.plan) {
    throw new Error('缺少 dry-run 迁移计划路径；请传入 --plan <path> 或使用第一个位置参数。');
  }

  const { absolutePath, data } = await readJsonFile(options.plan);
  const readyOperationCount = countReadyOperations(data);
  const sql = buildManualPlaceholderApplySql(data, {
    generatedFrom: path.basename(absolutePath),
    allowEmpty: shouldAllowEmptyPlan(data, options.allowEmpty),
  });
  const outputPath = options.out || buildDefaultOutPath(options.plan);
  const absoluteOutputPath = await writeOutputFile(outputPath, sql);

  const operations = [
    ...(Array.isArray(data?.operations?.characters) ? data.operations.characters : []),
    ...(Array.isArray(data?.operations?.pools) ? data.operations.pools : []),
  ];
  const readyCount = operations.filter(operation => operation?.status === 'ready').length;
  const blockedCount = operations.filter(operation => operation?.status === 'blocked').length;

  console.log('# DATA-NEW-017 manual placeholder apply SQL');
  console.log(`输入 dry-run 计划: ${absolutePath}`);
  console.log(`输出 SQL 审核工件: ${absoluteOutputPath}`);
  console.log(`包含 ready 操作: ${readyCount}`);
  console.log(`排除 blocked 操作: ${blockedCount}`);
  if (readyOperationCount === 0) {
    console.log('当前计划没有可迁移操作，已生成 no-op 审核工件。');
  }
  console.log('注意：SQL 默认以 ROLLBACK 结束；执行前必须重新审计、备份数据库并人工替换确认 token。');
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error('[generate-manual-placeholder-apply-sql] 执行失败:', error);
    process.exitCode = 1;
  });
}
