import { rejectDisallowedBrowserOrigin } from './_lib/http.js';
import { syncAnnouncements } from './_lib/syncAnnouncements.js';
import { syncPools } from './_lib/syncPools.js';
import { detectNewCharacters } from './_lib/detectNewCharacters.js';

function authorizeRequest(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { ok: true };

  const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (bearer === cronSecret) return { ok: true };

  return { ok: false, status: 401, error: 'Unauthorized' };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, { methods: 'GET, OPTIONS' })) return;
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = authorizeRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const results = {};

  try {
    results.announcements = await syncAnnouncements();
  } catch (err) {
    results.announcements = { error: err.message };
  }

  try {
    results.pools = await syncPools(results.announcements?.rawRecords);
  } catch (err) {
    results.pools = { error: err.message };
  }

  try {
    results.newCharacterCheck = await detectNewCharacters(results.pools?.unresolvedNames);
  } catch (err) {
    results.newCharacterCheck = { error: err.message };
  }

  const hasErrors = results.announcements?.error || results.pools?.error;
  return res.status(hasErrors ? 500 : 200).json({
    success: !hasErrors,
    ...results,
  });
}
