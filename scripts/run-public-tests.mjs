import { spawn } from 'node:child_process';

const testCommands = [
  ['node', ['scripts/verify-simulator-inheritance.mjs']],
  ['node', ['scripts/verify-info-book-resource-accounting.mjs']],
  ['node', ['scripts/verify-export-import-roundtrip.mjs']],
  ['node', ['scripts/verify-import-persistence.mjs']],
  ['node', ['scripts/verify-bootstrap-cache-partial.mjs']],
  ['node', ['scripts/verify-supabase-baseline.mjs']],
];

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  for (const [command, args] of testCommands) {
    console.log(`\n[run-public-tests] Running: ${command} ${args.join(' ')}`);
    await runCommand(command, args);
  }

  console.log('\n[run-public-tests] All public verification scripts passed.');
}

main().catch((error) => {
  console.error('[run-public-tests] Failed:', error);
  process.exitCode = 1;
});
