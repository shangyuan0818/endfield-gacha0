import { createHmac, randomBytes, subtle } from 'node:crypto';

export const POW_ALGORITHM = 'sha256-chain-v1';

function readEnvironment() {
  return globalThis.process?.env || {};
}

function getPowSecret(env = readEnvironment()) {
  return (
    env.AUTH_POW_SECRET ||
    env.AUTH_SECURITY_HASH_SECRET ||
    env.SUPABASE_JWT_SECRET ||
    'local-development-pow-secret'
  );
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, '0')).join('');
}

function getDefaultDifficulty(env = readEnvironment()) {
  const parsed = Number.parseInt(env.AUTH_POW_DIFFICULTY || '', 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
    return parsed;
  }

  return env.NODE_ENV === 'production' ? 4 : 2;
}

function getDefaultTotalSteps(difficulty, env = readEnvironment()) {
  const parsed = Number.parseInt(env.AUTH_POW_TOTAL_STEPS || '', 10);
  if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 60000) {
    return parsed;
  }

  return 7200 + difficulty * 1200;
}

function getExpiresInMs(env = readEnvironment()) {
  const parsed = Number.parseInt(env.AUTH_POW_EXPIRES_MS || '', 10);
  if (Number.isFinite(parsed) && parsed >= 30000 && parsed <= 1800000) {
    return parsed;
  }

  return 10 * 60 * 1000;
}

function signChallengePayload(payload, secret = getPowSecret()) {
  return createHmac('sha256', String(secret || ''))
    .update(JSON.stringify({
      action: payload.action,
      algorithm: payload.algorithm,
      challengeId: payload.challengeId,
      difficulty: payload.difficulty,
      expiresAt: payload.expiresAt,
      issuedAt: payload.issuedAt,
      seed: payload.seed,
      totalSteps: payload.totalSteps,
    }))
    .digest('hex');
}

export function createPowChallenge({
  action = 'auth',
  env = readEnvironment(),
} = {}) {
  const difficulty = getDefaultDifficulty(env);
  const issuedAt = Date.now();
  const challenge = {
    action: String(action || 'auth').trim().toLowerCase(),
    algorithm: POW_ALGORITHM,
    challengeId: randomBytes(12).toString('hex'),
    difficulty,
    expiresAt: issuedAt + getExpiresInMs(env),
    issuedAt,
    seed: randomBytes(16).toString('hex'),
    totalSteps: getDefaultTotalSteps(difficulty, env),
  };

  return {
    ...challenge,
    signature: signChallengePayload(challenge, getPowSecret(env)),
  };
}

export function getPowPublicPolicy(env = readEnvironment()) {
  const difficulty = getDefaultDifficulty(env);
  return {
    algorithm: POW_ALGORITHM,
    difficulty,
    expiresInMs: getExpiresInMs(env),
    totalSteps: getDefaultTotalSteps(difficulty, env),
  };
}

function normalizePowPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return {
    action: String(payload.action || '').trim().toLowerCase(),
    algorithm: String(payload.algorithm || POW_ALGORITHM).trim(),
    challengeId: String(payload.challengeId || '').trim(),
    difficulty: Number.parseInt(payload.difficulty, 10),
    expiresAt: Number.parseInt(payload.expiresAt, 10),
    hash: String(payload.hash || '').trim().toLowerCase(),
    issuedAt: Number.parseInt(payload.issuedAt, 10),
    seed: String(payload.seed || '').trim(),
    signature: String(payload.signature || '').trim(),
    step: Number.parseInt(payload.step, 10),
    totalSteps: Number.parseInt(payload.totalSteps, 10),
  };
}

async function hashPowStep({
  seed,
  step,
  previousHash,
  rounds,
}) {
  const encoder = new TextEncoder();
  let payload = encoder.encode(`${seed}:${step}:${previousHash}`);
  let hex = '';

  for (let round = 0; round < rounds; round += 1) {
    const digest = await subtle.digest('SHA-256', payload);
    hex = toHex(digest);

    if (round + 1 < rounds) {
      payload = encoder.encode(`${seed}:${step}:${hex}:${round + 1}`);
    }
  }

  return hex;
}

async function computePowHash(payload) {
  let step = 0;
  let hash = payload.seed;

  while (step < payload.totalSteps) {
    hash = await hashPowStep({
      seed: payload.seed,
      step,
      previousHash: hash,
      rounds: payload.difficulty,
    });
    step += 1;
  }

  return hash;
}

export async function verifyPowPayload({
  action,
  payload,
  env = readEnvironment(),
} = {}) {
  const normalized = normalizePowPayload(payload);
  if (!normalized) {
    return {
      ok: false,
      status: 'missing',
      code: 'pow_missing',
    };
  }

  if (
    normalized.algorithm !== POW_ALGORITHM ||
    !normalized.challengeId ||
    !normalized.seed ||
    !normalized.signature ||
    !normalized.hash ||
    !Number.isFinite(normalized.difficulty) ||
    !Number.isFinite(normalized.totalSteps) ||
    !Number.isFinite(normalized.expiresAt) ||
    !Number.isFinite(normalized.issuedAt)
  ) {
    return {
      ok: false,
      status: 'invalid',
      code: 'pow_invalid_payload',
    };
  }

  const normalizedAction = String(action || '').trim().toLowerCase();
  if (normalized.action !== normalizedAction) {
    return {
      ok: false,
      status: 'action_mismatch',
      code: 'pow_action_mismatch',
    };
  }

  if (Date.now() > normalized.expiresAt) {
    return {
      ok: false,
      status: 'expired',
      code: 'pow_expired',
    };
  }

  const expectedSignature = signChallengePayload(normalized, getPowSecret(env));
  if (expectedSignature !== normalized.signature) {
    return {
      ok: false,
      status: 'bad_signature',
      code: 'pow_bad_signature',
    };
  }

  const maxSteps = Number.parseInt(env.AUTH_POW_MAX_VERIFY_STEPS || '60000', 10);
  if (normalized.totalSteps < 1000 || normalized.totalSteps > maxSteps) {
    return {
      ok: false,
      status: 'invalid_steps',
      code: 'pow_invalid_steps',
    };
  }

  const expectedHash = await computePowHash(normalized);
  if (expectedHash !== normalized.hash || normalized.step !== normalized.totalSteps) {
    return {
      ok: false,
      status: 'failed',
      code: 'pow_failed',
    };
  }

  return {
    ok: true,
    status: 'verified',
    code: 'pow_verified',
    algorithm: normalized.algorithm,
    challengeId: normalized.challengeId,
    difficulty: normalized.difficulty,
    totalSteps: normalized.totalSteps,
  };
}
