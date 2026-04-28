import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { resolveSupabaseSecretKey } from './supabaseEnv.js';

const API_KEY_TOKEN_PREFIX = 'egk';
const VERIFIER_TOKEN_PREFIX = 'egv';

function getSecretEnvelopeKey() {
  const raw = String(
    process.env.API_SECRET_ENCRYPTION_KEY
      || resolveSupabaseSecretKey()
      || ''
  ).trim();

  if (!raw) {
    throw new Error('Missing API secret encryption source');
  }

  return createHash('sha256').update(raw).digest();
}

function makeRandomToken(tag) {
  const random = randomBytes(24).toString('base64url');
  return `${tag}_${random}`;
}

export function buildSecretPrefix(secret) {
  return String(secret || '').trim().slice(0, 18);
}

export function hashOpaqueSecret(secret) {
  return createHash('sha256').update(String(secret || '')).digest('hex');
}

export function safeSecretHashMatch(secret, hash) {
  const normalizedHash = String(hash || '').trim();
  if (!secret || !normalizedHash) {
    return false;
  }

  const left = Buffer.from(hashOpaqueSecret(secret), 'hex');
  const right = Buffer.from(normalizedHash, 'hex');
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function createApiKeySecret() {
  const secret = makeRandomToken(API_KEY_TOKEN_PREFIX);
  return {
    secret,
    keyPrefix: buildSecretPrefix(secret),
    keyHash: hashOpaqueSecret(secret),
  };
}

export function createVerifierSecret(provider) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const shortProvider = normalizedProvider.slice(0, 3) || 'bot';
  const secret = makeRandomToken(`${VERIFIER_TOKEN_PREFIX}_${shortProvider}`);
  return {
    secret,
    secretPrefix: buildSecretPrefix(secret),
    secretHash: hashOpaqueSecret(secret),
  };
}

export function encryptRevealSecret(secret) {
  if (!secret) {
    return null;
  }

  const key = getSecretEnvelopeKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(secret), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decryptRevealSecret(payload) {
  const raw = String(payload || '').trim();
  if (!raw) {
    return null;
  }

  const [ivPart, cipherPart, tagPart] = raw.split('.');
  if (!ivPart || !cipherPart || !tagPart) {
    throw new Error('Invalid encrypted secret payload');
  }

  const key = getSecretEnvelopeKey();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherPart, 'base64url')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}
