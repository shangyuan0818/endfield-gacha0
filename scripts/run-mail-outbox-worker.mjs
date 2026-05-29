import { runMailOutboxWorker } from '../api/_lib/mailOutboxWorker.js';

function printUsage() {
  console.log('用法:');
  console.log('  node scripts/run-mail-outbox-worker.mjs [--json]');
  console.log('');
  console.log('说明:');
  console.log('  - 需要 SUPABASE_URL + SUPABASE_SECRET_KEY');
  console.log('  - 默认要求 MAIL_OUTBOX_WORKER_ENABLED=true 才会 drain 队列');
  console.log('  - 默认 MAIL_WORKER_DRY_RUN=true，不发送真实邮件');
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

try {
  const result = await runMailOutboxWorker();
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('# Mail outbox worker');
    console.log(`status: ${result.ok ? 'ok' : 'failed'}`);
    console.log(`code: ${result.code}`);
    console.log(`provider: ${result.providerKey || 'n/a'}`);
    console.log(`dryRun: ${Boolean(result.dryRun)}`);
    console.log(`loaded: ${result.stats?.loaded || 0}`);
    console.log(`sent: ${result.stats?.sent || 0}`);
    console.log(`retried: ${result.stats?.retried || 0}`);
    console.log(`failed: ${result.stats?.failed || 0}`);
    console.log(`skipped: ${result.stats?.skipped || 0}`);
  }
} catch (error) {
  console.error('[run-mail-outbox-worker] 执行失败:', error?.message || error);
  process.exitCode = 1;
}
