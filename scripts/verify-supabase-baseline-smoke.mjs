import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(projectRoot, 'supabase', 'baseline', '000_complete_schema.sql');
const postgresImage = process.env.BASELINE_SMOKE_POSTGRES_IMAGE || 'postgres:16-alpine';
const containerName = `endfield-baseline-smoke-${Date.now()}`;
const postgresPassword = 'postgres';
const databaseName = 'postgres';

function run(command, args, options = {}) {
  const { input, allowFailure = false } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code === 0 || allowFailure) {
        resolve({ code, stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}\n${stderr || stdout}`));
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function waitForPostgres() {
  for (let i = 0; i < 30; i += 1) {
    const result = await run('docker', ['exec', containerName, 'pg_isready', '-U', 'postgres'], { allowFailure: true });
    if (result.code === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Timed out waiting for postgres container to become ready.');
}

async function cleanupContainer() {
  await run('docker', ['rm', '-f', containerName], { allowFailure: true });
}

function buildSupabaseStubSql() {
  return `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  owner UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::UUID
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT 'authenticated'::TEXT
$$;
`.trim();
}

function buildVerificationSql() {
  return `
SELECT to_regclass('public.profiles') AS profiles_table;
SELECT to_regclass('public.account_recovery_requests') AS recovery_table;
SELECT to_regclass('public.public_profile_cache') AS profile_cache_table;
SELECT proname
FROM pg_proc
WHERE proname IN ('get_global_stats', 'get_app_visible_pools', 'resolve_character_alias')
ORDER BY proname;
`.trim();
}

async function main() {
  const baselineSql = await readFile(baselinePath, 'utf8');

  const dockerVersion = await run('docker', ['version', '--format', '{{.Server.Version}}'], { allowFailure: true });
  if (dockerVersion.code !== 0) {
    throw new Error('Docker daemon is not available. Start Docker Desktop or another Docker engine before running this smoke test.');
  }

  try {
    await run('docker', [
      'run',
      '--name',
      containerName,
      '--rm',
      '-d',
      '-e',
      `POSTGRES_PASSWORD=${postgresPassword}`,
      '-e',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      postgresImage,
    ]);

    await waitForPostgres();

    await run(
      'docker',
      ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', databaseName],
      { input: `${buildSupabaseStubSql()}\n` },
    );

    await run(
      'docker',
      ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', databaseName],
      { input: baselineSql },
    );

    const verification = await run(
      'docker',
      ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', databaseName, '-At'],
      { input: `${buildVerificationSql()}\n` },
    );

    const output = verification.stdout.trim();
    const requiredMarkers = [
      'profiles',
      'account_recovery_requests',
      'public_profile_cache',
      'get_app_visible_pools',
      'get_global_stats',
      'resolve_character_alias',
    ];
    const missingMarkers = requiredMarkers.filter((marker) => !output.includes(marker));

    if (missingMarkers.length > 0) {
      throw new Error(`Baseline smoke verification returned incomplete output:\n${output}`);
    }

    console.log('[verify-supabase-baseline-smoke] OK');
    console.log(`- image: ${postgresImage}`);
    console.log(`- baseline: ${baselinePath}`);
    console.log(output);
  } finally {
    await cleanupContainer();
  }
}

main().catch((error) => {
  console.error('[verify-supabase-baseline-smoke] Failed:', error);
  process.exitCode = 1;
});
