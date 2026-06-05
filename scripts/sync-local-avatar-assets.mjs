#!/usr/bin/env node

import {
  parseLocalAvatarSyncArgs,
  printLocalAvatarSyncHelp,
  runLocalAvatarSync
} from './lib/localAvatarSync.mjs';

async function main() {
  const options = parseLocalAvatarSyncArgs(process.argv.slice(2), {
    commandName: 'sync:local-avatars'
  });

  if (options.help) {
    printLocalAvatarSyncHelp('sync:local-avatars');
    return;
  }

  await runLocalAvatarSync(options);
}

main().catch((error) => {
  console.error('[sync-local-avatars] 失败:', error);
  process.exitCode = 1;
});
