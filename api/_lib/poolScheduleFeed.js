import { getSupabaseAnonServerClient } from './authAdmin.js';
import { buildOfficialAnnouncementRecords } from './officialAnnouncementsFeed.js';
import {
  buildManualPoolId,
  normalizeEntityNameForMatch,
} from '../../src/utils/canonicalEntityUtils.js';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const LIMITED_POOL_DURATION_DAYS = 17;
const WEAPON_POOL_DURATION_DAYS = LIMITED_POOL_DURATION_DAYS * 3;

// ---------------------------------------------------------------------------
// 文本工具
// ---------------------------------------------------------------------------

function stripHtmlToTextLines(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}

/**
 * 去除名称末尾的全角括号后缀，如 "落草（手铳）" → "落草"
 */
function stripParenthesizedSuffix(name) {
  return String(name || '').replace(/[（(][^）)]*[）)]$/, '').trim();
}

function addDaysToIso(isoValue, days) {
  if (!isoValue || !Number.isFinite(days)) return null;
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// 时间解析
// ---------------------------------------------------------------------------

function parseServerDateTime(raw) {
  const m = /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/.exec(raw || '');
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+08:00`).toISOString();
}

function parseTimeRange(line) {
  const times = Array.from(String(line || '').matchAll(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/g))
    .map(m => parseServerDateTime(m[1]))
    .filter(Boolean);

  if (times.length >= 2) return { start_time: times[0], end_time: times[1] };

  if (times.length === 1) {
    const implicitStart = /版本开启后\s*-\s*\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}/.test(line || '');
    return {
      start_time: implicitStart ? null : times[0],
      end_time: implicitStart ? times[0] : null,
    };
  }

  return { start_time: null, end_time: null };
}

function parseMaintenanceWindow(lines) {
  const line = (lines || []).find(l => l.includes('更新维护时间')) || '';
  return parseTimeRange(line);
}

function hasVersionStartHint(line) {
  return /版本(?:更新)?(?:开启)?后(?:开启)?/.test(String(line || ''));
}

// ---------------------------------------------------------------------------
// 角色查找表（共享逻辑）
// ---------------------------------------------------------------------------

export function buildCharacterLookup(rows) {
  const lookup = new Map();
  for (const row of rows || []) {
    const variants = [row?.name, ...(Array.isArray(row?.aliases) ? row.aliases : [])];
    for (const v of variants) {
      const key = normalizeEntityNameForMatch(v);
      if (!key) continue;
      if (!lookup.has(key)) lookup.set(key, []);
      lookup.get(key).push(row);
    }
  }
  return lookup;
}

export function resolveEntity(lookup, name, type) {
  const key = normalizeEntityNameForMatch(name);
  if (!key) return { id: null, candidates: [] };

  const candidates = (lookup.get(key) || []).filter(c => c?.type === type);
  return {
    id: candidates.length === 1 ? String(candidates[0].id).trim() : null,
    candidates,
  };
}

// ---------------------------------------------------------------------------
// 公告段落解析
// ---------------------------------------------------------------------------

function cleanPoolLabel(raw) {
  return String(raw || '').replace(/^公测庆典/, '').trim();
}

function parsePoolSectionHeading(line) {
  const m = /^\d+\.\s*「([^」]+)」(?:\s*(特许寻访|申领))?(?:开放)?$/.exec(line || '');
  if (!m) return null;

  const rawLabel = cleanPoolLabel(m[1]);
  const suffix = m[2] || '';
  let label = rawLabel;
  let type = null;

  if (suffix === '特许寻访') type = 'limited';
  else if (suffix === '申领') {
    type = 'weapon';
    if (!label.endsWith('申领')) label = `${label}申领`;
  } else if (rawLabel.endsWith('申领')) type = 'weapon';
  else if (rawLabel.endsWith('特许寻访')) type = 'limited';

  return type ? { label, type } : null;
}

function extractFeaturedNames(line) {
  const m = /全部可能出现的6星(?:干员|武器)包括：([^。]+)/.exec(line || '');
  if (!m) return [];
  return m[1].split('/').map(s => stripParenthesizedSuffix(s)).filter(Boolean);
}

function extractUpCharacter(line, type) {
  if (type === 'weapon') {
    const m = /概率提升的6星武器为【([^】]+)】/.exec(line || '');
    return m ? stripParenthesizedSuffix(m[1]) : null;
  }
  const m = /6星干员【([^】]+)】获取概率提升/.exec(line || '');
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// 独立限定寻访公告解析
// ---------------------------------------------------------------------------

function parseStandaloneLimitedNotice(record) {
  const titleMatch = /^(?:公测庆典)?「([^」]+)」特许寻访说明$/.exec(record?.title || '');
  if (!titleMatch) return [];

  const lines = stripHtmlToTextLines(record?.raw_content || record?.content || '');
  const timeLine = lines.find(l => l.includes('开放时间'));
  const detailLine = lines.find(l =>
    l.includes('获取概率提升') && l.includes('全部可能出现的6星干员包括')
  );

  const up = extractUpCharacter(detailLine, 'limited');
  if (!up) return [];

  const timeRange = parseTimeRange(timeLine);
  return [{
    type: 'limited',
    source_notice_id: record?.source_id || null,
    source_title: cleanPoolLabel(titleMatch[1]),
    source_url: record?.source_url || null,
    up_character: up,
    featured_character_names: extractFeaturedNames(detailLine),
    start_time: timeRange.start_time,
    end_time: timeRange.end_time,
  }];
}

// ---------------------------------------------------------------------------
// 版本更新说明中的卡池段落解析
// ---------------------------------------------------------------------------

function parseVersionUpdateSections(record) {
  if (!String(record?.title || '').includes('版本更新说明')) return [];

  const lines = stripHtmlToTextLines(record?.raw_content || record?.content || '');
  const maintenanceWindow = parseMaintenanceWindow(lines);
  const sections = [];
  let cur = null;
  let limitedPhase = -1;

  for (const line of lines) {
    const heading = parsePoolSectionHeading(line);
    if (heading) {
      if (cur) sections.push(cur);
      if (heading.type === 'limited') limitedPhase += 1;
      cur = {
        ...heading,
        lines: [],
        phaseIndex: Math.max(limitedPhase, 0),
        source_notice_id: record?.source_id || null,
        source_url: record?.source_url || null,
      };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) sections.push(cur);

  const parsed = sections.map(section => {
    const timeLine = section.lines.find(l => l.includes('开放时间')) || '';
    const detailLine = section.lines.find(l =>
      section.type === 'weapon'
        ? l.includes('概率提升的6星武器为') && l.includes('全部可能出现的6星武器包括')
        : l.includes('获取概率提升') && l.includes('全部可能出现的6星干员包括')
    ) || '';

    const up = extractUpCharacter(detailLine, section.type);
    if (!up) return null;

    const timeRange = parseTimeRange(timeLine);
    return {
      type: section.type,
      phaseIndex: section.phaseIndex,
      source_notice_id: section.source_notice_id,
      source_title: section.label,
      source_url: section.source_url,
      up_character: up,
      featured_character_names: extractFeaturedNames(detailLine),
      start_time: timeRange.start_time,
      end_time: timeRange.end_time,
      hasVersionStartHint: hasVersionStartHint(timeLine),
      hasThreePoolDurationHint: /于3次「特许寻访」后结束/.test(timeLine),
    };
  }).filter(Boolean);

  return applyTimingRules(parsed, maintenanceWindow);
}

// ---------------------------------------------------------------------------
// 时间推理
// ---------------------------------------------------------------------------

function applyTimingRules(sections, maintenanceWindow) {
  const result = sections.map(s => ({ ...s }));
  const versionStart = maintenanceWindow?.end_time || null;
  const limited = result.filter(s => s.type === 'limited');

  // 限定池时间推理
  limited.forEach((s, i) => {
    if (!s.start_time) {
      if (s.hasVersionStartHint && versionStart) {
        s.start_time = i === 0 ? versionStart : addDaysToIso(versionStart, LIMITED_POOL_DURATION_DAYS * i);
      } else if (i > 0 && limited[i - 1]?.start_time) {
        s.start_time = addDaysToIso(limited[i - 1].start_time, LIMITED_POOL_DURATION_DAYS);
      }
    }
    if (!s.end_time && s.start_time) {
      s.end_time = addDaysToIso(s.start_time, LIMITED_POOL_DURATION_DAYS);
    }
  });

  // 武器池时间推理
  result.filter(s => s.type === 'weapon').forEach(s => {
    const paired = limited[Math.max(0, s.phaseIndex ?? 0)] || limited[0] || null;
    if (!s.start_time) {
      if (s.hasVersionStartHint && versionStart) {
        s.start_time = paired?.start_time || versionStart;
      } else if (paired?.start_time) {
        s.start_time = paired.start_time;
      }
    }
    if (!s.end_time && s.start_time) {
      if (s.hasThreePoolDurationHint) {
        s.end_time = addDaysToIso(s.start_time, WEAPON_POOL_DURATION_DAYS);
      } else if (paired?.end_time) {
        s.end_time = paired.end_time;
      }
    }
  });

  return result;
}

// ---------------------------------------------------------------------------
// 候选池合并与已有池匹配
// ---------------------------------------------------------------------------

function mergeCandidates(candidates) {
  const map = new Map();
  for (const c of candidates) {
    const key = [c.type, normalizeEntityNameForMatch(c.up_character), normalizeEntityNameForMatch(c.source_title)].join('|');
    if (!map.has(key)) {
      map.set(key, { ...c });
      continue;
    }
    const prev = map.get(key);
    prev.start_time = prev.start_time || c.start_time || null;
    prev.end_time = prev.end_time || c.end_time || null;
    prev.featured_character_names = [...new Set([...(prev.featured_character_names || []), ...(c.featured_character_names || [])])];
    prev.source_notice_id = prev.source_notice_id || c.source_notice_id || null;
    prev.source_url = prev.source_url || c.source_url || null;
  }
  return [...map.values()];
}

function buildCurrentPoolIndexes(rows) {
  const byUpAndDate = new Map();
  const byUp = new Map();

  for (const row of rows || []) {
    const type = row?.type === 'limited_character' ? 'limited' : row?.type;
    const up = normalizeEntityNameForMatch(row?.up_character);
    if (!type || !up) continue;

    const startDate = String(row?.start_time || '').slice(0, 10);
    if (startDate) byUpAndDate.set(`${type}|${up}|${startDate}`, row);
    if (!byUp.has(`${type}|${up}`)) byUp.set(`${type}|${up}`, row);
  }

  return { byUpAndDate, byUp };
}

function findExistingPool(pool, indexes) {
  const up = normalizeEntityNameForMatch(pool?.up_character);
  if (!up) return null;

  const startDate = String(pool?.start_time || '').slice(0, 10);
  if (startDate) {
    const direct = indexes.byUpAndDate.get(`${pool.type}|${up}|${startDate}`);
    if (direct) return direct;
  }
  return indexes.byUp.get(`${pool.type}|${up}`) || null;
}

// ---------------------------------------------------------------------------
// 数据库加载
// ---------------------------------------------------------------------------

async function loadCharacterRows(supabase) {
  if (!supabase) return [];
  const { data, error } = await supabase.from('characters').select('id, name, aliases, type');
  if (error) throw error;
  return data || [];
}

async function loadCurrentPools(supabase) {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_app_visible_pools');
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// 核心：构建卡池日程记录
// ---------------------------------------------------------------------------

export function buildPoolScheduleRecords(announcementRecords, {
  characters = [],
  currentPools = [],
} = {}) {
  // 1. 从公告中提取候选卡池
  const candidates = [];
  for (const record of announcementRecords || []) {
    candidates.push(...parseStandaloneLimitedNotice(record));
    candidates.push(...parseVersionUpdateSections(record));
  }

  const merged = mergeCandidates(candidates);
  const charLookup = buildCharacterLookup(characters);
  const poolIndexes = buildCurrentPoolIndexes(currentPools);

  // 2. 解析角色 ID 并匹配已有卡池
  return merged.map(pool => {
    const itemType = pool.type === 'weapon' ? 'weapon' : 'character';
    const existing = findExistingPool(pool, poolIndexes);

    // 解析 featured 角色 ID
    const featuredIds = [];
    for (const name of pool.featured_character_names || []) {
      const { id } = resolveEntity(charLookup, name, itemType);
      if (id) featuredIds.push(id);
    }

    const name = pool.source_title
      || existing?.name
      || (pool.up_character ? `${pool.type === 'weapon' ? '武器' : '限定'}-${pool.up_character}` : '未命名卡池');

    return {
      pool_id: existing?.pool_id || buildManualPoolId({
        type: pool.type,
        name: pool.source_title,
        upCharacter: pool.up_character,
        startTime: pool.start_time,
        endTime: pool.end_time,
      }),
      name,
      type: pool.type,
      start_time: pool.start_time,
      end_time: pool.end_time,
      up_character: pool.up_character,
      featured_characters: [...new Set(featuredIds)],
      featured_character_names: pool.featured_character_names,
      pool_title: pool.source_title,
      description: existing?.description || `${pool.source_title}（官方公告自动解析）`,
      banner_url: existing?.banner_url || null,
      source_notice_id: pool.source_notice_id,
      source_url: pool.source_url,
    };
  });
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export async function handlePoolScheduleFeed(req, res, {
  getAnnouncements = null,
  getSupabase = getSupabaseAnonServerClient,
} = {}) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 直接调用函数获取公告，避免 HTTP 自调用
    const announcementRecords = getAnnouncements
      ? await getAnnouncements()
      : await buildOfficialAnnouncementRecords(undefined, { allowLlm: false });

    const supabase = getSupabase();
    const [characters, currentPools] = await Promise.all([
      loadCharacterRows(supabase),
      loadCurrentPools(supabase),
    ]);

    const records = buildPoolScheduleRecords(announcementRecords, { characters, currentPools });

    return res.status(200).json({
      success: true,
      records,
      meta: {
        announcementCount: announcementRecords.length,
        poolCount: records.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to build pool schedule feed',
    });
  }
}

export default async function handler(req, res) {
  await handlePoolScheduleFeed(req, res);
}
