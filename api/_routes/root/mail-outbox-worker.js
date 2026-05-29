import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { runMailOutboxWorker } from '../../_lib/mailOutboxWorker.js';

function readEnvironment() {
  return globalThis.process?.env || {};
}

function getMailWorkerSecret(env = readEnvironment()) {
  return String(env.MAIL_OUTBOX_WORKER_SECRET || env.CRON_SECRET || '').trim();
}

function getMailWorkerAcceptedSecrets(env = readEnvironment()) {
  return [
    env.MAIL_OUTBOX_WORKER_SECRET,
    env.CRON_SECRET,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function readBearerToken(req) {
  return String(req.headers?.authorization || req.headers?.Authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

function authorizeMailOutboxWorkerRequest(req, env = readEnvironment()) {
  const acceptedSecrets = getMailWorkerAcceptedSecrets(env);
  if (acceptedSecrets.length === 0) {
    return {
      ok: false,
      status: 503,
      error: 'Mail outbox worker secret is not configured',
    };
  }

  const providedSecret = readBearerToken(req)
    || String(req.headers?.['x-mail-outbox-worker-secret'] || '').trim()
    || String(req.headers?.['x-mail-worker-secret'] || '').trim()
    || String(req.headers?.['x-cron-secret'] || '').trim();

  if (providedSecret && acceptedSecrets.includes(providedSecret)) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error: 'Unauthorized',
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, POST, OPTIONS',
    headers: 'Content-Type, Authorization, X-Mail-Outbox-Worker-Secret, X-Mail-Worker-Secret, X-Cron-Secret',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = authorizeMailOutboxWorkerRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return res.status(503).json({ success: false, error: 'Auth admin not configured' });
  }

  try {
    const result = await runMailOutboxWorker({ adminClient });
    return res.status(200).json({
      success: true,
      partial: result.ok === false,
      result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to run mail outbox worker',
    });
  }
}

export const __internal = {
  getMailWorkerAcceptedSecrets,
  authorizeMailOutboxWorkerRequest,
  getMailWorkerSecret,
};
