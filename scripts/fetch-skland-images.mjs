#!/usr/bin/env node

/**
 * 兼容旧命令名的本地头像同步入口。
 *
 * 现已与 sync:local-avatars 共用同一条主链：
 *   森空岛官方 Wiki > warfarin.wiki > Team Stardust > 旧 avatars bucket
 *
 * 默认使用增量更新；如需重新按当前最高优先级来源刷新全部头像，使用 --full。
 */

import {
  parseLocalAvatarSyncArgs,
  printLocalAvatarSyncHelp,
  runLocalAvatarSync
} from './lib/localAvatarSync.mjs';

async function main() {
  const options = parseLocalAvatarSyncArgs(process.argv.slice(2), {
    commandName: 'fetch:skland-images'
  });

  if (options.help) {
    printLocalAvatarSyncHelp('fetch:skland-images');
    return;
  }

  await runLocalAvatarSync(options);
}

main().catch((error) => {
  console.error('[fetch-skland-images] 脚本异常:', error);
  process.exitCode = 1;
});
