import { rejectDisallowedBrowserOrigin } from './http.js';

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

async function fetchOfficialNewsJson(url) {
  const response = await fetch(url, {
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

async function fetchOfficialNewsList(pageSize = DEFAULT_PAGE_SIZE) {
  const query = new URLSearchParams({
    lang: 'zh-cn',
    code: 'endfield_web',
    page: '1',
    pageSize: String(pageSize),
  });

  return fetchOfficialNewsJson(`${OFFICIAL_NEWS_BASE_URL}/bulletin?${query.toString()}`);
}

async function fetchOfficialNewsDetail(cid) {
  const query = new URLSearchParams({
    lang: 'zh-cn',
    code: 'endfield_web',
  });

  return fetchOfficialNewsJson(`${OFFICIAL_NEWS_BASE_URL}/bulletin/${cid}?${query.toString()}`);
}

function buildAnnouncementContent(detail) {
  const sourceUrl = buildOfficialArticleUrl(detail.cid);
  const metaLines = [
    `<p><strong>分类：</strong>${detail.tab || 'notices'}</p>`,
    `<p><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">查看官方原文</a></p>`,
  ];

  return `${metaLines.join('')}${detail.data || ''}`;
}

export async function buildOfficialAnnouncementRecords(pageSize = DEFAULT_PAGE_SIZE) {
  const listPayload = await fetchOfficialNewsList(pageSize);
  const list = Array.isArray(listPayload?.list) ? listPayload.list : [];

  const details = await Promise.all(
    list
      .filter(item => item?.cid && item?.title)
      .map(async (item) => {
        const detail = await fetchOfficialNewsDetail(item.cid);
        return {
          ...item,
          ...detail,
        };
      })
  );

  return details.map((detail) => ({
    source_id: String(detail.cid),
    title: String(detail.title),
    summary: typeof detail.brief === 'string' && detail.brief.trim()
      ? detail.brief.trim()
      : null,
    content: buildAnnouncementContent(detail),
    version: buildVersion(detail.displayTime, detail.cid),
    published_at: buildPublishedAt(detail.displayTime),
    source_url: buildOfficialArticleUrl(detail.cid),
    is_active: true,
  }));
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
    const records = await buildOfficialAnnouncementRecords(DEFAULT_PAGE_SIZE);
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
  buildAnnouncementContent,
  buildOfficialAnnouncementRecords,
  buildOfficialArticleUrl,
  buildVersion,
};
