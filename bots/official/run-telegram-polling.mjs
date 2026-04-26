import process from 'node:process';
import { runTelegramPollingBot } from './adapters/telegram.js';
import { assertTelegramBotConfig, createOfficialBotConfig } from './config.js';
import { EndfieldApiClient } from './endfieldApiClient.js';
import { loadOfficialBotEnv } from './loadEnv.js';
import { createOfficialBotRouter } from './router.js';
import { createBotShareCardService } from './shareCardService.js';

loadOfficialBotEnv();

function writeLine(stream, level, message, error) {
  const timestamp = new Date().toISOString();
  const suffix = error?.message ? ` | ${error.message}` : '';
  stream.write(`[${timestamp}] [${level}] ${message}${suffix}\n`);
}

const logger = {
  info(message) {
    writeLine(process.stdout, 'INFO', message);
  },
  error(message, error) {
    writeLine(process.stderr, 'ERROR', message, error);
  },
};

async function main() {
  const config = createOfficialBotConfig({ provider: 'telegram' });
  assertTelegramBotConfig(config);

  const apiClient = new EndfieldApiClient(config);
  const shareCardService = createBotShareCardService({
    apiClient,
    siteUrl: config.siteUrl,
    logger,
  });
  const router = createOfficialBotRouter({
    provider: config.provider,
    apiClient,
    siteUrl: config.siteUrl,
    shareCardService,
  });

  logger.info('Telegram official bot started');
  await runTelegramPollingBot({
    config,
    router,
    logger,
  });
}

main().catch((error) => {
  logger.error('Telegram official bot failed to start', error);
  process.exitCode = 1;
});
