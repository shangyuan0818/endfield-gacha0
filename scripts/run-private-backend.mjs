import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const backendRoot = path.join(repoRoot, 'backend');
const backendPackageJsonPath = path.join(backendRoot, 'package.json');
const harnessPath = path.join(backendRoot, 'test-harness', 'run-suite.js');

function printNotice(modeLabel) {
  console.log(`[private-backend] 当前公开仓库不包含可直接运行的私有 backend 入口（请求: ${modeLabel}）。`);
  console.log('[private-backend] 如需国服 / 国际服代理或 test harness，请在本地私有环境中放置 backend/ 后重试。');
  console.log('[private-backend] 公开仓库仍可直接运行前端与 Serverless API: npm run dev');
}

function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || repoRoot,
    stdio: 'inherit',
    shell: false
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

const mode = process.argv[2];

if (!mode) {
  console.error('[private-backend] 缺少运行模式。');
  process.exit(1);
}

if (mode === 'harness') {
  if (!existsSync(harnessPath)) {
    printNotice('test:harness');
    process.exit(0);
  }

  runCommand(process.execPath, [harnessPath]);
} else if (mode === 'npm-script') {
  const scriptName = process.argv[3];
  if (!scriptName) {
    console.error('[private-backend] 缺少 backend npm script 名称。');
    process.exit(1);
  }

  if (!existsSync(backendPackageJsonPath)) {
    printNotice(`backend:${scriptName}`);
    process.exit(0);
  }

  if (process.platform === 'win32') {
    runCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm', 'run', scriptName], {
      cwd: backendRoot
    });
  } else {
    runCommand('npm', ['run', scriptName], { cwd: backendRoot });
  }
} else {
  console.error(`[private-backend] 未知模式: ${mode}`);
  process.exit(1);
}
