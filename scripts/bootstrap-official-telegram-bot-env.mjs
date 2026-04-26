import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createApiKeySecret, createVerifierSecret } from '../api/_lib/devApiSecrets.js';
import { loadOfficialBotEnv } from '../bots/official/loadEnv.js';

loadOfficialBotEnv();

const cwd = process.cwd();
const envLocalPath = path.join(cwd, '.env.local');

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function createAdminClient() {
  return createClient(
    getRequiredEnv('VITE_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function upsertEnvVar(sourceText, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(sourceText)) {
    return sourceText.replace(pattern, line);
  }

  const suffix = sourceText.endsWith('\n') ? '' : '\n';
  return `${sourceText}${suffix}${line}\n`;
}

async function revokeExistingKeys(adminClient, clientId) {
  const nowIso = new Date().toISOString();
  const { error } = await adminClient
    .from('api_client_keys')
    .update({
      status: 'revoked',
      revoked_at: nowIso,
    })
    .eq('client_id', clientId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }
}

async function main() {
  const adminClient = createAdminClient();

  const { data: telegramClient, error: telegramClientError } = await adminClient
    .from('api_clients')
    .select('id, provider')
    .eq('client_type', 'official_bot')
    .eq('provider', 'telegram')
    .limit(1)
    .maybeSingle();

  if (telegramClientError) {
    throw telegramClientError;
  }

  if (!telegramClient?.id) {
    throw new Error('Official Telegram bot client not found. Confirm migration 102 was applied.');
  }

  await revokeExistingKeys(adminClient, telegramClient.id);

  const apiKey = createApiKeySecret();
  const verifier = createVerifierSecret('telegram');
  const nowIso = new Date().toISOString();

  const { error: keyInsertError } = await adminClient
    .from('api_client_keys')
    .insert({
      client_id: telegramClient.id,
      key_prefix: apiKey.keyPrefix,
      key_hash: apiKey.keyHash,
      label: 'telegram-local',
      status: 'active',
      created_at: nowIso,
    });

  if (keyInsertError) {
    throw keyInsertError;
  }

  const { error: verifierUpdateError } = await adminClient
    .from('api_clients')
    .update({
      verifier_secret_prefix: verifier.secretPrefix,
      verifier_secret_hash: verifier.secretHash,
      verifier_rotated_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', telegramClient.id);

  if (verifierUpdateError) {
    throw verifierUpdateError;
  }

  const baseUrl = 'http://127.0.0.1:5173';
  const timeoutMs = '30000';
  const pollIntervalMs = '1500';
  const longPollSeconds = '20';
  let envLocalText = '';

  try {
    envLocalText = await fs.readFile(envLocalPath, 'utf8');
  } catch {
    envLocalText = '';
  }

  const nextEnvText = [
    ['OFFICIAL_BOT_BASE_URL', baseUrl],
    ['OFFICIAL_BOT_SITE_URL', baseUrl],
    ['OFFICIAL_BOT_PROVIDER', 'telegram'],
    ['OFFICIAL_BOT_REQUEST_TIMEOUT_MS', timeoutMs],
    ['TELEGRAM_OFFICIAL_BOT_PUBLIC_API_KEY', apiKey.secret],
    ['TELEGRAM_OFFICIAL_BOT_VERIFIER_SECRET', verifier.secret],
    ['TELEGRAM_OFFICIAL_BOT_POLL_INTERVAL_MS', pollIntervalMs],
    ['TELEGRAM_OFFICIAL_BOT_LONG_POLL_SECONDS', longPollSeconds],
    ['TELEGRAM_OFFICIAL_BOT_TOKEN', process.env.TELEGRAM_OFFICIAL_BOT_TOKEN || ''],
  ].reduce((currentText, [key, value]) => upsertEnvVar(currentText, key, value), envLocalText);

  await fs.writeFile(envLocalPath, nextEnvText, 'utf8');

  process.stdout.write('Official Telegram bot local env bootstrap complete.\n');
  process.stdout.write(`Updated: ${envLocalPath}\n`);
  if (!String(process.env.TELEGRAM_OFFICIAL_BOT_TOKEN || '').trim()) {
    process.stdout.write('TELEGRAM_OFFICIAL_BOT_TOKEN is still empty. Fill it before running the bot.\n');
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
});
