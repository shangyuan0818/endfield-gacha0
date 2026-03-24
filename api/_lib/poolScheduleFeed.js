import { getSupabaseAnonServerClient } from './authAdmin.js';
import {
  buildManualPoolId,
  normalizeEntityNameForMatch,
} from '../../src/utils/canonicalEntityUtils.js';

const LIMITED_POOL_DURATION_DAYS = 17;
const WEAPON_POOL_DURATION_DAYS = LIMITED_POOL_DURATION_DAYS * 3;

function getRequestBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  if (!host) {
    throw new Error('Missing host header');
  }

  return `${proto}://${host}`;
}

async function fetchLocalJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Feed request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (!result?.success) {
    throw new Error(result?.error || `Feed request failed: ${url}`);
  }

  return result;
}

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

function getAnnouncementRawContent(record) {
  return record?.raw_content || record?.content || '';
}

function parseServerDateTime(rawValue) {
  const match = /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/.exec(rawValue || '');
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+08:00`).toISOString();
}

function parseTimeRange(line) {
  const matches = Array.from(String(line || '').matchAll(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/g))
    .map(match => parseServerDateTime(match[1]))
    .filter(Boolean);

  if (matches.length >= 2) {
    return {
      start_time: matches[0],
      end_time: matches[1],
    };
  }

  if (matches.length === 1) {
    const hasImplicitStart = /版本开启后\s*-\s*\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}/.test(line || '');
    return {
      start_time: hasImplicitStart ? null : matches[0],
      end_time: hasImplicitStart ? matches[0] : null,
    };
  }

  return {
    start_time: null,
    end_time: null,
  };
}

function hasVersionStartHint(line) {
  return /版本(?:更新)?(?:开启)?后(?:开启)?/.test(String(line || ''));
}

function addDaysToIso(isoValue, days) {
  if (!isoValue || !Number.isFinite(days)) {
    return null;
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function parseMaintenanceWindow(lines) {
  const maintenanceLine = (lines || []).find(line => line.includes('更新维护时间')) || '';
  return parseTimeRange(maintenanceLine);
}

function cleanPoolLabel(rawValue) {
  return String(rawValue || '')
    .replace(/^公测庆典/, '')
    .trim();
}

function parsePoolSectionHeading(line) {
  const match = /^\d+\.\s*「([^」]+)」(?:\s*(特许寻访|申领))?(?:开放)?$/.exec(line || '');
  if (!match) {
    return null;
  }

  const rawLabel = cleanPoolLabel(match[1]);
  const suffix = match[2] || '';
  let label = rawLabel;
  let type = null;

  if (suffix === '特许寻访') {
    type = 'limited';
  } else if (suffix === '申领') {
    type = 'weapon';
    if (!label.endsWith('申领')) {
      label = `${label}申领`;
    }
  } else if (rawLabel.endsWith('申领')) {
    type = 'weapon';
  } else if (rawLabel.endsWith('特许寻访')) {
    type = 'limited';
  }

  if (!type) {
    return null;
  }

  return {
    label,
    type,
  };
}

function extractFeaturedNames(detailLine) {
  const match = /全部可能出现的6星(?:干员|武器)包括：([^。]+)/.exec(detailLine || '');
  if (!match) {
    return [];
  }

  return match[1]
    .split('/')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeStandaloneLimitedNotice(record) {
  const titleMatch = /^(?:公测庆典)?「([^」]+)」特许寻访说明$/.exec(record?.title || '');
  if (!titleMatch) {
    return [];
  }

  const lines = stripHtmlToTextLines(getAnnouncementRawContent(record));
  const timeLine = lines.find(line => line.includes('开放时间'));
  const detailLine = lines.find(line => line.includes('获取概率提升') && line.includes('全部可能出现的6星干员包括'));
  const upMatch = /6星干员【([^】]+)】获取概率提升/.exec(detailLine || '');

  if (!detailLine || !upMatch) {
    return [];
  }

  const timeRange = parseTimeRange(timeLine);

  return [{
    type: 'limited',
    source_notice_id: record?.source_id || null,
    source_title: cleanPoolLabel(titleMatch[1]),
    source_url: record?.source_url || null,
    up_character: upMatch[1].trim(),
    featured_character_names: extractFeaturedNames(detailLine),
    start_time: timeRange.start_time,
    end_time: timeRange.end_time,
  }];
}

function applyVersionSectionTimingRules(sections, maintenanceWindow) {
  const normalizedSections = sections.map(section => ({ ...section }));
  const versionStart = maintenanceWindow?.end_time || null;
  const limitedSections = normalizedSections.filter(section => section.type === 'limited');

  limitedSections.forEach((section, index) => {
    if (!section.start_time) {
      if (section.hasVersionStartHint && versionStart) {
        section.start_time = index === 0
          ? versionStart
          : addDaysToIso(versionStart, LIMITED_POOL_DURATION_DAYS * index);
      } else if (index > 0 && limitedSections[index - 1]?.start_time) {
        section.start_time = addDaysToIso(limitedSections[index - 1].start_time, LIMITED_POOL_DURATION_DAYS);
      }
    }

    if (!section.end_time && section.start_time) {
      section.end_time = addDaysToIso(section.start_time, LIMITED_POOL_DURATION_DAYS);
    }
  });

  normalizedSections
    .filter(section => section.type === 'weapon')
    .forEach((section) => {
      const pairedLimited = limitedSections[Math.max(0, section.phaseIndex ?? 0)] || limitedSections[0] || null;

      if (!section.start_time) {
        if (section.hasVersionStartHint && versionStart) {
          section.start_time = pairedLimited?.start_time || versionStart;
        } else if (pairedLimited?.start_time) {
          section.start_time = pairedLimited.start_time;
        }
      }

      if (!section.end_time && section.start_time) {
        if (section.hasThreePoolDurationHint) {
          section.end_time = addDaysToIso(section.start_time, WEAPON_POOL_DURATION_DAYS);
        } else if (pairedLimited?.end_time) {
          section.end_time = pairedLimited.end_time;
        }
      }
    });

  return normalizedSections;
}

function parseVersionUpdateSections(record) {
  if (!String(record?.title || '').includes('版本更新说明')) {
    return [];
  }

  const lines = stripHtmlToTextLines(getAnnouncementRawContent(record));
  const maintenanceWindow = parseMaintenanceWindow(lines);
  const sections = [];
  let currentSection = null;
  let limitedPhaseIndex = -1;

  lines.forEach((line) => {
    const heading = parsePoolSectionHeading(line);
    if (heading) {
      if (currentSection) {
        sections.push(currentSection);
      }

      if (heading.type === 'limited') {
        limitedPhaseIndex += 1;
      }

      currentSection = {
        label: heading.label,
        type: heading.type,
        lines: [],
        phaseIndex: Math.max(limitedPhaseIndex, 0),
        source_notice_id: record?.source_id || null,
        source_url: record?.source_url || null,
      };
      return;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    }
  });

  if (currentSection) {
    sections.push(currentSection);
  }

  const parsedSections = sections
    .map((section) => {
      const timeLine = section.lines.find(line => line.includes('开放时间')) || '';
      const detailLine = section.lines.find((line) => (
        section.type === 'weapon'
          ? line.includes('概率提升的6星武器为') && line.includes('全部可能出现的6星武器包括')
          : line.includes('获取概率提升') && line.includes('全部可能出现的6星干员包括')
      )) || '';

      if (!detailLine) {
        return null;
      }

      const upMatch = section.type === 'weapon'
        ? /概率提升的6星武器为【([^】]+)】/.exec(detailLine)
        : /6星干员【([^】]+)】获取概率提升/.exec(detailLine);

      if (!upMatch) {
        return null;
      }

      const timeRange = parseTimeRange(timeLine);

      return {
        type: section.type,
        phaseIndex: section.phaseIndex,
        source_notice_id: section.source_notice_id,
        source_title: section.label,
        source_url: section.source_url,
        up_character: upMatch[1].trim(),
        featured_character_names: extractFeaturedNames(detailLine),
        start_time: timeRange.start_time,
        end_time: timeRange.end_time,
        hasVersionStartHint: hasVersionStartHint(timeLine),
        hasThreePoolDurationHint: /于3次「特许寻访」后结束/.test(timeLine),
      };
    })
    .filter(Boolean);

  return applyVersionSectionTimingRules(parsedSections, maintenanceWindow);
}

function buildCharacterLookup(rows) {
  const lookup = new Map();

  (rows || []).forEach((row) => {
    const variants = [
      row?.name,
      ...(Array.isArray(row?.aliases) ? row.aliases : []),
    ];

    variants
      .map(value => normalizeEntityNameForMatch(value))
      .filter(Boolean)
      .forEach((key) => {
        if (!lookup.has(key)) {
          lookup.set(key, []);
        }

        lookup.get(key).push(row);
      });
  });

  return lookup;
}

function resolveFeaturedCharacterIds(featuredNames, itemType, characterLookup) {
  const resolvedIds = [];

  (featuredNames || []).forEach((name) => {
    const normalized = normalizeEntityNameForMatch(name);
    if (!normalized) {
      return;
    }

    const candidates = (characterLookup.get(normalized) || [])
      .filter(item => item.type === itemType);

    if (candidates.length === 1) {
      resolvedIds.push(candidates[0].id);
    }
  });

  return Array.from(new Set(resolvedIds));
}

function buildCurrentPoolIndexes(rows) {
  const byUpCharacterAndDate = new Map();
  const byUpCharacter = new Map();

  (rows || []).forEach((row) => {
    const type = row?.type === 'limited_character' ? 'limited' : row?.type;
    const upCharacter = normalizeEntityNameForMatch(row?.up_character);
    const startDate = String(row?.start_time || '').slice(0, 10);

    if (!type || !upCharacter) {
      return;
    }

    if (startDate) {
      byUpCharacterAndDate.set(`${type}|${upCharacter}|${startDate}`, row);
    }

    if (!byUpCharacter.has(`${type}|${upCharacter}`)) {
      byUpCharacter.set(`${type}|${upCharacter}`, row);
    }
  });

  return {
    byUpCharacterAndDate,
    byUpCharacter,
  };
}

function findExistingPoolMatch(pool, indexes) {
  const normalizedUpCharacter = normalizeEntityNameForMatch(pool?.up_character);
  if (!normalizedUpCharacter) {
    return null;
  }

  const startDate = String(pool?.start_time || '').slice(0, 10);
  if (startDate) {
    const directMatch = indexes.byUpCharacterAndDate.get(`${pool.type}|${normalizedUpCharacter}|${startDate}`);
    if (directMatch) {
      return directMatch;
    }
  }

  return indexes.byUpCharacter.get(`${pool.type}|${normalizedUpCharacter}`) || null;
}

function buildMergedPoolMap(candidates) {
  const merged = new Map();

  candidates.forEach((candidate) => {
    const key = [
      candidate.type,
      normalizeEntityNameForMatch(candidate.up_character),
      normalizeEntityNameForMatch(candidate.source_title),
    ].join('|');

    if (!merged.has(key)) {
      merged.set(key, {
        ...candidate,
      });
      return;
    }

    const previous = merged.get(key);
    merged.set(key, {
      ...previous,
      start_time: previous.start_time || candidate.start_time || null,
      end_time: previous.end_time || candidate.end_time || null,
      featured_character_names: Array.from(new Set([
        ...(previous.featured_character_names || []),
        ...(candidate.featured_character_names || []),
      ])),
      source_notice_id: previous.source_notice_id || candidate.source_notice_id || null,
      source_url: previous.source_url || candidate.source_url || null,
    });
  });

  return Array.from(merged.values());
}

async function loadCharacterRows(supabase) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('characters')
    .select('id, name, aliases, type');

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadCurrentPools(supabase) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_app_visible_pools');
  if (error) {
    throw error;
  }

  return data || [];
}

export function buildPoolScheduleRecords(announcementRecords, {
  characters = [],
  currentPools = [],
} = {}) {
  const candidates = [];

  (announcementRecords || []).forEach((record) => {
    candidates.push(...normalizeStandaloneLimitedNotice(record));
    candidates.push(...parseVersionUpdateSections(record));
  });

  const mergedCandidates = buildMergedPoolMap(candidates);
  const characterLookup = buildCharacterLookup(characters);
  const currentPoolIndexes = buildCurrentPoolIndexes(currentPools);

  return mergedCandidates.map((pool) => {
    const itemType = pool.type === 'weapon' ? 'weapon' : 'character';
    const existingPool = findExistingPoolMatch(pool, currentPoolIndexes);
    const featuredCharacters = resolveFeaturedCharacterIds(
      pool.featured_character_names,
      itemType,
      characterLookup,
    );

    const name = pool.source_title
      || existingPool?.name
      || (pool.up_character ? `${pool.type === 'weapon' ? '武器' : '限定'}-${pool.up_character}` : pool.source_title);

    return {
      pool_id: existingPool?.pool_id || buildManualPoolId({
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
      featured_characters: featuredCharacters,
      featured_character_names: pool.featured_character_names,
      pool_title: pool.source_title,
      description: existingPool?.description || `${pool.source_title}（官方公告自动解析）`,
      banner_url: existingPool?.banner_url || null,
      source_notice_id: pool.source_notice_id,
      source_url: pool.source_url,
    };
  });
}

export async function handlePoolScheduleFeed(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const baseUrl = getRequestBaseUrl(req);
    const announcementPayload = await fetchLocalJson(`${baseUrl}/api/automation-feed?job=official-announcements`);
    const announcementRecords = Array.isArray(announcementPayload?.records) ? announcementPayload.records : [];

    const supabase = getSupabaseAnonServerClient();
    const [characters, currentPools] = await Promise.all([
      loadCharacterRows(supabase),
      loadCurrentPools(supabase),
    ]);

    const records = buildPoolScheduleRecords(announcementRecords, {
      characters,
      currentPools,
    });

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
