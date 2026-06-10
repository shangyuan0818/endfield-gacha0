import { createHash, timingSafeEqual } from 'node:crypto';

function readEnv() {
  return globalThis.process?.env || {};
}

function normalizeToken(value) {
  return String(value || '').trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

function timingSafeTokenEqual(a, b) {
  const left = sha256(normalizeToken(a));
  const right = sha256(normalizeToken(b));
  return timingSafeEqual(left, right);
}

function getBearerToken(req) {
  const header = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? normalizeToken(match[1]) : '';
}

function getAdminTokens(env = readEnv()) {
  return [
    env.STATUS_ADMIN_TOKEN,
    env.STATUS_ADMIN_READ_TOKEN,
  ].map(normalizeToken).filter(Boolean);
}

function getProbeTokens(env = readEnv()) {
  return [
    env.STATUS_PROBE_TOKEN,
    env.STATUS_ADMIN_TOKEN,
  ].map(normalizeToken).filter(Boolean);
}

function getEndpointProbeTokens(env = readEnv()) {
  return [
    env.STATUS_ENDPOINT_PROBE_TOKEN,
    env.STATUS_PROBE_TOKEN,
    env.STATUS_ADMIN_TOKEN,
    env.CRON_SECRET,
  ].map(normalizeToken).filter(Boolean);
}

export function hasStatusAdminConfig(env = readEnv()) {
  return getAdminTokens(env).length > 0;
}

export function hasStatusProbeConfig(env = readEnv()) {
  return getProbeTokens(env).length > 0;
}

export function hasStatusEndpointProbeConfig(env = readEnv()) {
  return getEndpointProbeTokens(env).length > 0;
}

export function verifyStatusAdminRequest(req, env = readEnv()) {
  const supplied = getBearerToken(req);
  if (!supplied) return false;
  return getAdminTokens(env).some((expected) => timingSafeTokenEqual(supplied, expected));
}

export function verifyStatusProbeRequest(req, env = readEnv()) {
  const supplied = getBearerToken(req);
  if (!supplied) return false;
  return getProbeTokens(env).some((expected) => timingSafeTokenEqual(supplied, expected));
}

export function verifyStatusEndpointProbeRequest(req, env = readEnv()) {
  const supplied = getBearerToken(req);
  if (!supplied) return false;
  return getEndpointProbeTokens(env).some((expected) => timingSafeTokenEqual(supplied, expected));
}

export const __internal = {
  getBearerToken,
  timingSafeTokenEqual,
};
