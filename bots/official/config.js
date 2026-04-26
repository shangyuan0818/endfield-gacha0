const PROVIDERS = new Set(['discord', 'telegram', 'qq']);

function normalizeBaseUrl(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return '';
  }

  return value.replace(/\/+$/, '');
}

function parseInteger(rawValue, fallbackValue) {
  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) && value > 0 ? value : fallbackValue;
}

function readScopedEnv(env, provider, suffix, fallbackKeys = []) {
  const scopedKey = `${provider.toUpperCase()}_${suffix}`;
  const scopedValue = String(env[scopedKey] || '').trim();
  if (scopedValue) {
    return scopedValue;
  }

  for (const key of fallbackKeys) {
    const value = String(env[key] || '').trim();
    if (value) {
      return value;
    }
  }

  return '';
}

export function createOfficialBotConfig({
  provider = process.env.OFFICIAL_BOT_PROVIDER || 'telegram',
  env = process.env,
} = {}) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!PROVIDERS.has(normalizedProvider)) {
    throw new Error(`Unsupported official bot provider: ${provider}`);
  }

  const baseUrl = normalizeBaseUrl(env.OFFICIAL_BOT_BASE_URL || env.SITE_BASE_URL || env.VITE_APP_URL);
  const siteUrl = normalizeBaseUrl(env.OFFICIAL_BOT_SITE_URL || baseUrl);
  const publicApiKey = readScopedEnv(env, normalizedProvider, 'OFFICIAL_BOT_PUBLIC_API_KEY', [
    'OFFICIAL_BOT_PUBLIC_API_KEY',
  ]);
  const verifierSecret = readScopedEnv(env, normalizedProvider, 'OFFICIAL_BOT_VERIFIER_SECRET', [
    'OFFICIAL_BOT_VERIFIER_SECRET',
  ]);

  return {
    provider: normalizedProvider,
    baseUrl,
    siteUrl,
    publicApiKey,
    verifierSecret,
    requestTimeoutMs: parseInteger(env.OFFICIAL_BOT_REQUEST_TIMEOUT_MS, 30000),
    telegram: {
      token: String(env.TELEGRAM_OFFICIAL_BOT_TOKEN || '').trim(),
      pollIntervalMs: parseInteger(env.TELEGRAM_OFFICIAL_BOT_POLL_INTERVAL_MS, 1500),
      longPollSeconds: parseInteger(env.TELEGRAM_OFFICIAL_BOT_LONG_POLL_SECONDS, 20),
    },
    discord: {
      token: String(env.DISCORD_OFFICIAL_BOT_TOKEN || '').trim(),
      applicationId: String(env.DISCORD_OFFICIAL_BOT_APPLICATION_ID || '').trim(),
    },
    qq: {
      token: String(env.QQ_OFFICIAL_BOT_TOKEN || '').trim(),
      appId: String(env.QQ_OFFICIAL_BOT_APP_ID || '').trim(),
    },
  };
}

export function assertOfficialBotBaseConfig(config) {
  if (!config.baseUrl) {
    throw new Error('Missing OFFICIAL_BOT_BASE_URL');
  }
  if (!config.siteUrl) {
    throw new Error('Missing OFFICIAL_BOT_SITE_URL or OFFICIAL_BOT_BASE_URL');
  }
  if (!config.publicApiKey) {
    throw new Error('Missing official bot read-only API key');
  }
  if (!config.verifierSecret) {
    throw new Error('Missing official bot verifier secret');
  }
}

export function assertTelegramBotConfig(config) {
  assertOfficialBotBaseConfig(config);
  if (!config.telegram?.token) {
    throw new Error('Missing TELEGRAM_OFFICIAL_BOT_TOKEN');
  }
}

export default {
  createOfficialBotConfig,
  assertOfficialBotBaseConfig,
  assertTelegramBotConfig,
};
