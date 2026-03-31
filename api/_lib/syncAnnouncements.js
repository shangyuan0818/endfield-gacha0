import { getSupabaseAdminClient } from './authAdmin.js';
import { buildAnnouncementDisplayContent } from './officialAnnouncementPresentation.js';

const OFFICIAL_NEWS_BASE_URL = 'https://web-news.hypergryph.com/api';
const OFFICIAL_SITE_ORIGIN = 'https://endfield.hypergryph.com';
const DEFAULT_PAGE_SIZE = 10;
const GAME_ANNOUNCEMENT_PRIORITY = -100;

async function fetchOfficialNewsJson(url) {
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Official API ${resp.status} ${resp.statusText}`);
  const result = await resp.json();
  if (result?.code !== 0) throw new Error(result?.msg || 'Official API non-zero code');
  return result?.data ?? null;
}

async function fetchNewsList(pageSize = DEFAULT_PAGE_SIZE) {
  const query = new URLSearchParams({
    lang: 'zh-cn',
    code: 'endfield_web',
    page: '1',
    pageSize: String(pageSize),
  });
  return fetchOfficialNewsJson(`${OFFICIAL_NEWS_BASE_URL}/bulletin?${query}`);
}

async function fetchNewsDetail(cid) {
  const query = new URLSearchParams({ lang: 'zh-cn', code: 'endfield_web' });
  return fetchOfficialNewsJson(`${OFFICIAL_NEWS_BASE_URL}/bulletin/${cid}?${query}`);
}

function buildPublishedAt(displayTime) {
  if (!displayTime) return null;
  return new Date(Number(displayTime) * 1000).toISOString();
}

function buildVersion(displayTime, cid) {
  return `hg-${displayTime || '0'}-${cid}`;
}

async function buildRecord(detail) {
  const cid = String(detail.cid);
  const title = String(detail.title || '');
  const brief = typeof detail.brief === 'string' ? detail.brief.trim() : null;
  const publishedAt = buildPublishedAt(detail.displayTime);
  const sourceUrl = `${OFFICIAL_SITE_ORIGIN}/news/${cid}`;

  const presentation = await buildAnnouncementDisplayContent({
    title,
    summary: brief,
    rawHtml: detail.data || '',
    sourceUrl,
    publishedAt,
  });

  return {
    source_id: cid,
    title,
    summary: brief,
    content: presentation.content,
    version: buildVersion(detail.displayTime, cid),
    published_at: publishedAt,
    source_url: sourceUrl,
    is_active: true,
    priority: GAME_ANNOUNCEMENT_PRIORITY,
  };
}

export async function syncAnnouncements() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { synced: 0, skipped: 0, error: 'Database not configured' };
  }

  const listPayload = await fetchNewsList(DEFAULT_PAGE_SIZE);
  const list = Array.isArray(listPayload?.list) ? listPayload.list : [];
  if (list.length === 0) {
    return { synced: 0, skipped: 0, total: 0 };
  }

  const validItems = list.filter(item => item?.cid && item?.title);
  const cids = validItems.map(item => String(item.cid));

  const { data: existing } = await supabase
    .from('announcements')
    .select('source_id')
    .in('source_id', cids);
  const existingIds = new Set((existing || []).map(r => r.source_id));

  const newItems = validItems.filter(item => !existingIds.has(String(item.cid)));
  if (newItems.length === 0) {
    return { synced: 0, skipped: validItems.length, total: validItems.length };
  }

  let synced = 0;
  const errors = [];

  for (const item of newItems) {
    try {
      const detail = await fetchNewsDetail(item.cid);
      const record = await buildRecord({ ...item, ...detail });

      const { error } = await supabase
        .from('announcements')
        .upsert(record, { onConflict: 'source_id' });

      if (error) throw error;
      synced++;
    } catch (err) {
      errors.push({ cid: item.cid, title: item.title, error: err.message });
    }
  }

  return {
    synced,
    skipped: existingIds.size,
    total: validItems.length,
    errors: errors.length > 0 ? errors : undefined,
    rawRecords: list,
  };
}
