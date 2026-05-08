import crypto from 'node:crypto';

import {
  __internal as announcementPresentationInternal,
  stripHtmlToText,
} from './officialAnnouncementPresentation.js';

export const GAME_ANNOUNCEMENT_DIGEST_CONFIG_KEY = 'home_game_announcement_digest';

const DIGEST_MIN_DAYS = 7;
const DIGEST_MAX_DAYS = 15;
const DIGEST_MIN_RECORDS = 5;
const DIGEST_MAX_RECORDS = 18;
const DIGEST_INPUT_TEXT_MAX_LENGTH = 320;
const DIGEST_OUTPUT_MAX_TOKENS = 360;
const DIGEST_FORBIDDEN_FALLBACK_HINT = '近7天游戏公告不足';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/gu, ' ');
}

function truncateText(value, maxLength) {
  const normalizedValue = compactText(value);
  if (!normalizedValue || normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function getRecordTimestamp(record = {}) {
  const value = new Date(record.published_at || record.updated_at || record.created_at || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function getAnnouncementSourceGroup(record = {}) {
  const sourceKind = String(record?.source_kind || '').toLowerCase();
  const sourceGroup = String(record?.source_group || '').toLowerCase();
  const sourceId = String(record?.source_id || '');
  const sourceUrl = String(record?.source_url || '');

  if (
    sourceGroup === 'game'
    || sourceKind === 'game-bulletin'
    || sourceId.startsWith('game-bulletin:')
    || sourceUrl.includes('game_bulletin')
  ) {
    return 'game';
  }

  return 'official';
}

export function getGameAnnouncementCategory(record = {}) {
  const directCategory = String(record?.source_category || record?.tab || '').toLowerCase();
  if (['events', 'updates', 'news'].includes(directCategory)) {
    return directCategory;
  }

  try {
    const sourceUrl = new URL(String(record?.source_url || ''));
    const urlCategory = String(sourceUrl.searchParams.get('tab') || '').toLowerCase();
    if (['events', 'updates', 'news'].includes(urlCategory)) {
      return urlCategory;
    }
  } catch {
    // Legacy official-site records often have no structured category.
  }

  return 'unknown';
}

function getDigestWindowRecords(records = [], now = Date.now()) {
  const normalizedRecords = (Array.isArray(records) ? records : [])
    .filter(record => record?.is_active !== false)
    .filter(record => record?.source_id || record?.source_url || record?.title)
    .map(record => ({
      ...record,
      source_group: record.source_group || getAnnouncementSourceGroup(record),
      source_category: record.source_category || getGameAnnouncementCategory(record),
      timestamp: getRecordTimestamp(record),
    }))
    .filter(record => record.timestamp > 0)
    .sort((a, b) => b.timestamp - a.timestamp);

  const minCutoff = now - DIGEST_MIN_DAYS * 24 * 60 * 60 * 1000;
  const maxCutoff = now - DIGEST_MAX_DAYS * 24 * 60 * 60 * 1000;
  const recentRecords = normalizedRecords.filter(record => record.timestamp >= minCutoff);
  const windowRecords = recentRecords.length >= DIGEST_MIN_RECORDS
    ? recentRecords
    : normalizedRecords.filter(record => record.timestamp >= maxCutoff);

  return windowRecords.slice(0, DIGEST_MAX_RECORDS);
}

function getRecordDigestText(record = {}) {
  return truncateText(
    record.summary
      || record.description
      || stripHtmlToText(record.raw_content || record.content || '')
      || record.title,
    DIGEST_INPUT_TEXT_MAX_LENGTH
  );
}

function getDigestFingerprint(records = [], windowDays) {
  const payload = records.map(record => [
    record.source_id || record.source_url || record.title || '',
    record.version || '',
    record.published_at || record.updated_at || record.created_at || '',
    record.title || '',
    record.summary || '',
  ]);

  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ windowDays, records: payload }))
    .digest('hex')
    .slice(0, 24);
}

function getSourceLabel(record = {}) {
  return getAnnouncementSourceGroup(record) === 'game' ? '游戏内公告' : '官网公告';
}

function getCategoryLabel(record = {}) {
  const category = getGameAnnouncementCategory(record);
  if (category === 'events') return '活动公告';
  if (category === 'updates') return '游戏公告';
  if (category === 'news') return '资讯速报';
  return getAnnouncementSourceGroup(record) === 'game' ? '游戏内公告' : '官网公告';
}

function buildPromptRecords(records = []) {
  return records.map((record, index) => {
    const date = record.published_at
      ? String(record.published_at).slice(0, 10)
      : '未知日期';
    return [
      `${index + 1}. [${date}] ${getSourceLabel(record)} / ${getCategoryLabel(record)}`,
      `标题：${compactText(record.title || '未命名公告')}`,
      `摘要：${getRecordDigestText(record) || '无'}`,
    ].join('\n');
  }).join('\n\n');
}

export function buildFallbackGameAnnouncementDigest(records = [], {
  now = Date.now(),
} = {}) {
  const selectedRecords = getDigestWindowRecords(records, now);
  const gameRecords = selectedRecords.filter(record => getAnnouncementSourceGroup(record) === 'game');
  const officialRecords = selectedRecords.filter(record => getAnnouncementSourceGroup(record) === 'official');
  const categoryCounts = gameRecords.reduce((acc, record) => {
    const category = getGameAnnouncementCategory(record);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const categoryParts = [
    ['events', '活动'],
    ['updates', '更新'],
    ['news', '资讯'],
  ]
    .filter(([category]) => categoryCounts[category] > 0)
    .map(([category, label]) => `${label} ${categoryCounts[category]} 条`);
  const sourceParts = [];

  if (gameRecords.length > 0) {
    sourceParts.push(categoryParts.length > 0
      ? `游戏内 ${gameRecords.length} 条（${categoryParts.join(' / ')}）`
      : `游戏内 ${gameRecords.length} 条`);
  }

  if (officialRecords.length > 0) {
    sourceParts.push(`官网 ${officialRecords.length} 条`);
  }

  return {
    title: gameRecords.length > 0 ? '近期游戏公告' : '近期同步公告',
    subtitle: sourceParts.join(' · ') || '暂无可汇总的近期公告',
    mode: 'fallback',
  };
}

function normalizeDigestText(value, maxLength) {
  return truncateText(
    String(value || '')
      .replace(new RegExp(DIGEST_FORBIDDEN_FALLBACK_HINT, 'gu'), '')
      .replace(/已用近期历史公告补齐[。.]?/gu, '')
      .replace(/以下已用最近同步的历史公告补齐[。.]?/gu, ''),
    maxLength
  );
}

function parseDigestJson(content) {
  const normalizedContent = normalizeText(content);
  const jsonText = normalizedContent.match(/\{[\s\S]*\}/u)?.[0] || normalizedContent;
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error('Announcement digest LLM did not return JSON');
  }

  const title = normalizeDigestText(payload?.title, 28);
  const subtitle = normalizeDigestText(payload?.subtitle, 96);
  if (!title || !subtitle) {
    throw new Error('Announcement digest LLM returned empty title or subtitle');
  }

  return { title, subtitle, mode: 'llm' };
}

async function summarizeDigestWithLlm(records, {
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  const config = await announcementPresentationInternal.loadAnnouncementLlmConfig(env);
  if (!config.apiKey || typeof fetchImpl !== 'function') {
    throw new Error('Announcement LLM API key is not configured');
  }

  const response = await fetchImpl(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      max_tokens: DIGEST_OUTPUT_MAX_TOKENS,
      stream: false,
      messages: [
        {
          role: 'system',
          content: [
            '你是终末地抽卡分析器的公告编辑。',
            '只基于输入公告事实生成首页折叠栏标题，不得添加未出现的活动、福利或版本内容。',
            '输出严格 JSON：{"title":"...","subtitle":"..."}，不要 Markdown，不要解释。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            '请根据最近 7-15 天的游戏内公告与官网公告，生成一个聚合标题和副标题。',
            '要求：',
            '1. title 为 8-18 个汉字，概括近期公告主题；不要照搬单条公告标题，除非近期只有同一主题。',
            '2. subtitle 为 28-56 个汉字，说明主要类别、重点内容或公告来源差异。',
            '3. 不要出现“近7天游戏公告不足5条”“已用近期历史公告补齐”等补齐说明。',
            '4. 若公告多为封禁/修复/周边，不要夸大为活动或福利。',
            '',
            '公告列表：',
            buildPromptRecords(records),
          ].join('\n'),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = typeof response.text === 'function'
      ? truncateText(await response.text().catch(() => ''), 240)
      : '';
    throw new Error(`Announcement digest LLM returned ${response.status}${errorText ? `: ${errorText}` : ''}`);
  }

  const payload = await response.json();
  const choice = payload?.choices?.[0];
  const finishReason = normalizeText(choice?.finish_reason || choice?.finishReason).toLowerCase();
  if (finishReason.includes('length') || finishReason.includes('max_token')) {
    throw new Error('Announcement digest LLM response was truncated');
  }

  return parseDigestJson(choice?.message?.content);
}

function normalizeStoredDigestValue(value) {
  if (!value) return null;

  let payload = value;
  if (typeof value === 'string') {
    try {
      payload = JSON.parse(value);
    } catch {
      return null;
    }
  }

  const title = normalizeDigestText(payload?.title, 28);
  const subtitle = normalizeDigestText(payload?.subtitle, 96);
  if (!title || !subtitle) {
    return null;
  }

  return {
    ...payload,
    title,
    subtitle,
  };
}

export async function getStoredGameAnnouncementDigest(supabase) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('site_config')
    .select('value')
    .eq('key', GAME_ANNOUNCEMENT_DIGEST_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeStoredDigestValue(data?.value);
}

async function persistGameAnnouncementDigest(supabase, digest) {
  const { error } = await supabase
    .from('site_config')
    .upsert({
      key: GAME_ANNOUNCEMENT_DIGEST_CONFIG_KEY,
      value: JSON.stringify(digest),
      label: '首页游戏公告聚合摘要',
      category: 'content',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'key',
    });

  if (error) {
    throw error;
  }
}

export async function refreshGameAnnouncementDigest(supabase, records = [], {
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  env = process.env,
  forceRefresh = false,
} = {}) {
  const selectedRecords = getDigestWindowRecords(records, now);
  const windowDays = selectedRecords.some(record => record.timestamp < now - DIGEST_MIN_DAYS * 24 * 60 * 60 * 1000)
    ? DIGEST_MAX_DAYS
    : DIGEST_MIN_DAYS;
  const fingerprint = getDigestFingerprint(selectedRecords, windowDays);
  const cachedDigest = await getStoredGameAnnouncementDigest(supabase).catch(() => null);

  if (selectedRecords.length === 0 && cachedDigest?.title && cachedDigest?.subtitle) {
    return {
      digest: cachedDigest,
      updated: false,
      mode: cachedDigest.mode || 'cached',
    };
  }

  if (!forceRefresh && cachedDigest?.fingerprint === fingerprint && cachedDigest?.title && cachedDigest?.subtitle) {
    return {
      digest: cachedDigest,
      updated: false,
      mode: cachedDigest.mode || 'cached',
    };
  }

  let digest;
  let digestError;
  if (selectedRecords.length > 0) {
    try {
      digest = await summarizeDigestWithLlm(selectedRecords, { fetchImpl, env });
    } catch (error) {
      digestError = error;
    }
  }

  if (!digest) {
    digest = buildFallbackGameAnnouncementDigest(selectedRecords, { now });
  }

  const nextDigest = {
    ...digest,
    fingerprint,
    windowDays,
    sourceCount: selectedRecords.length,
    generatedAt: new Date(now).toISOString(),
    error: digestError?.message,
  };

  await persistGameAnnouncementDigest(supabase, nextDigest);

  return {
    digest: nextDigest,
    updated: true,
    mode: nextDigest.mode,
    error: digestError?.message,
  };
}

export const __internal = {
  DIGEST_MAX_DAYS,
  DIGEST_MIN_DAYS,
  buildFallbackGameAnnouncementDigest,
  buildPromptRecords,
  getDigestWindowRecords,
  parseDigestJson,
  summarizeDigestWithLlm,
};
