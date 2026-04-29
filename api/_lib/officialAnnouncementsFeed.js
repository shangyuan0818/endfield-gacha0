import { rejectDisallowedBrowserOrigin } from './http.js';
import {
  buildAnnouncementDisplayContent,
  normalizeOfficialHtml,
} from './officialAnnouncementPresentation.js';

const OFFICIAL_NEWS_BASE_URL = 'https://web-news.hypergryph.com/api';
const DEFAULT_PAGE_SIZE = 10;
const cache = {
  records: null,
  fetchedAt: 0,
};
const CACHE_TTL_MS = 5 * 60 * 1000;

function buildOfficialArticleUrl(cid) {
  return `https://endfield.hypergryph.com/news/${cid}`;
}

function buildVersion(displayTime, cid) {
  return `hg-${displayTime || '0'}-${cid}`;
}

function buildPublishedAt(displayTime) {
  if (!displayTime) {
    return null;
  }

  return new Date(Number(displayTime) * 1000).toISOString();
}

async function fetchOfficialNewsJson(url, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Official news API returned ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result?.code !== 0) {
    throw new Error(result?.msg || 'Official news API returned non-zero code');
  }

  return result?.data ?? null;
}

async function fetchOfficialNewsList(pageSize = DEFAULT_PAGE_SIZE, fetchImpl = globalThis.fetch) {
  const query = new URLSearchParams({
    lang: 'zh-cn',
    code: 'endfield_web',
    page: '1',
    pageSize: String(pageSize),
  });

  return fetchOfficialNewsJson(`${OFFICIAL_NEWS_BASE_URL}/bulletin?${query.toString()}`, fetchImpl);
}

async function fetchOfficialNewsDetail(cid, fetchImpl = globalThis.fetch) {
  const query = new URLSearchParams({
    lang: 'zh-cn',
    code: 'endfield_web',
  });

  return fetchOfficialNewsJson(`${OFFICIAL_NEWS_BASE_URL}/bulletin/${cid}?${query.toString()}`, fetchImpl);
}

export async function buildOfficialAnnouncementSourceRecords(pageSize = DEFAULT_PAGE_SIZE, {
  fetchImpl = globalThis.fetch,
} = {}) {
  const listPayload = await fetchOfficialNewsList(pageSize, fetchImpl);
  const list = Array.isArray(listPayload?.list) ? listPayload.list : [];

  const details = await Promise.all(
    list
      .filter(item => item?.cid && item?.title)
      .map(async (item) => {
        const detail = await fetchOfficialNewsDetail(item.cid, fetchImpl);
        return {
          ...item,
          ...detail,
        };
      })
  );

  return details.map((detail) => {
    const publishedAt = buildPublishedAt(detail.displayTime);
    const sourceUrl = buildOfficialArticleUrl(detail.cid);
    const normalizedSummary = typeof detail.brief === 'string' && detail.brief.trim()
      ? detail.brief.trim()
      : null;
    const rawContent = normalizeOfficialHtml(detail.data || '', sourceUrl);

    return {
      source_id: String(detail.cid),
      title: String(detail.title || ''),
      summary: normalizedSummary,
      raw_content: rawContent,
      version: buildVersion(detail.displayTime, detail.cid),
      published_at: publishedAt,
      source_url: sourceUrl,
      is_active: true,
    };
  });
}

export async function buildOfficialAnnouncementRecordsFromSources(sourceRecords = [], {
  fetchImpl = globalThis.fetch,
  env = process.env,
  allowLlm = false,
  bypassLlmCache = false,
} = {}) {
  return Promise.all(sourceRecords.map(async (detail) => {
    const presentation = await buildAnnouncementDisplayContent({
      title: detail.title,
      summary: detail.summary,
      rawHtml: detail.raw_content || '',
      sourceUrl: detail.source_url,
      publishedAt: detail.published_at,
      fetchImpl,
      env,
      allowLlm,
      bypassLlmCache,
    });

    return {
      source_id: detail.source_id,
      title: detail.title,
      summary: presentation.summaryText || detail.summary,
      content: presentation.content,
      raw_content: presentation.rawContent,
      image_urls: presentation.imageUrls,
      summary_mode: presentation.summaryMode,
      version: detail.version,
      published_at: detail.published_at,
      source_url: detail.source_url,
      is_active: true,
    };
  }));
}

export async function buildOfficialAnnouncementRecords(pageSize = DEFAULT_PAGE_SIZE, {
  fetchImpl = globalThis.fetch,
  env = process.env,
  allowLlm = false,
  bypassLlmCache = false,
} = {}) {
  const sourceRecords = await buildOfficialAnnouncementSourceRecords(pageSize, { fetchImpl });
  return buildOfficialAnnouncementRecordsFromSources(sourceRecords, {
    fetchImpl,
    env,
    allowLlm,
    bypassLlmCache,
  });
}

export async function handleOfficialAnnouncementsFeed(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, OPTIONS',
    headers: 'Content-Type',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const now = Date.now();
  if (cache.records && now - cache.fetchedAt < CACHE_TTL_MS) {
    return res.status(200).json({
      success: true,
      cached: true,
      records: cache.records,
    });
  }

  try {
    const records = await buildOfficialAnnouncementRecords(DEFAULT_PAGE_SIZE, {
      allowLlm: false,
    });
    cache.records = records;
    cache.fetchedAt = now;

    return res.status(200).json({
      success: true,
      cached: false,
      records,
    });
  } catch (error) {
    if (cache.records) {
      return res.status(200).json({
        success: true,
        cached: true,
        stale: true,
        records: cache.records,
        warning: error?.message || 'Official announcement feed refresh failed',
      });
    }

    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to build official announcements feed',
    });
  }
}

export default async function handler(req, res) {
  await handleOfficialAnnouncementsFeed(req, res);
}

export const __internal = {
  buildOfficialAnnouncementRecords,
  buildOfficialAnnouncementRecordsFromSources,
  buildOfficialAnnouncementSourceRecords,
  buildOfficialArticleUrl,
  buildVersion,
};
