import { rejectDisallowedBrowserOrigin } from './_lib/http.js';
import { syncAnnouncements } from './_lib/syncAnnouncements.js';
import { syncPools } from './_lib/syncPools.js';
import { detectNewCharacters } from './_lib/detectNewCharacters.js';
import { getSupabaseAdminClient, getBearerToken, createSupabaseAccessTokenClient } from './_lib/authAdmin.js';

async function verifySuperAdmin(req) {
  const token = getBearerToken(req);
  if (!token) return false;
  const client = createSupabaseAccessTokenClient(token);
  if (!client) return false;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;
  const admin = getSupabaseAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return data?.role === 'super_admin';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) return;

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const authorized = await verifySuperAdmin(req);
  if (!authorized) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
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
