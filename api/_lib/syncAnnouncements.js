import { getSupabaseAdminClient } from './authAdmin.js';
import { buildOfficialAnnouncementRecords } from './officialAnnouncementsFeed.js';

const DEFAULT_PAGE_SIZE = 10;
const GAME_ANNOUNCEMENT_PRIORITY = -100;

export async function syncAnnouncements() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { synced: 0, skipped: 0, error: 'Database not configured' };
  }

  const records = await buildOfficialAnnouncementRecords(DEFAULT_PAGE_SIZE);
  if (records.length === 0) {
    return { synced: 0, skipped: 0, total: 0 };
  }

  const sourceIds = records.map(record => String(record.source_id));

  const { data: existing } = await supabase
    .from('announcements')
    .select('source_id')
    .in('source_id', sourceIds);
  const existingIds = new Set((existing || []).map(r => r.source_id));

  const upsertRecords = records.map(record => ({
    source_id: record.source_id,
    title: record.title,
    summary: record.summary,
    content: record.content,
    version: record.version,
    published_at: record.published_at,
    source_url: record.source_url,
    is_active: true,
    priority: GAME_ANNOUNCEMENT_PRIORITY,
  }));

  const recordsToPersist = upsertRecords.filter(record => !existingIds.has(record.source_id));

  if (recordsToPersist.length === 0) {
    return { synced: 0, skipped: records.length, total: records.length, records };
  }

  let synced = 0;
  const errors = [];

  for (const record of recordsToPersist) {
    try {
      const { error } = await supabase
        .from('announcements')
        .upsert(record, { onConflict: 'source_id' });

      if (error) throw error;
      synced++;
    } catch (err) {
      errors.push({ source_id: record.source_id, title: record.title, error: err.message });
    }
  }

  const skipped = records.length - recordsToPersist.length;
  return {
    synced,
    skipped,
    total: records.length,
    errors: errors.length > 0 ? errors : undefined,
    records,
  };
}
