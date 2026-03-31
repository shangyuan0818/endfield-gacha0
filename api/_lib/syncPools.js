import { getSupabaseAdminClient } from './authAdmin.js';
import {
  buildManualPoolId,
  normalizeEntityNameForMatch,
} from '../../src/utils/canonicalEntityUtils.js';

const LIMITED_POOL_DURATION_DAYS = 17;
const WEAPON_POOL_DURATION_DAYS = LIMITED_POOL_DURATION_DAYS * 3;

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
      cur = { ...heading, lines: [], phaseIndex: Math.max(limitedPhase, 0), source_notice_id: record?.source_id || null, source_url: record?.source_url || null };
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

function applyTimingRules(sections, maintenanceWindow) {
  const result = sections.map(s => ({ ...s }));
  const versionStart = maintenanceWindow?.end_time || null;
  const limited = result.filter(s => s.type === 'limited');

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

function mergeCandidates(candidates) {
  const map = new Map();
  for (const c of candidates) {
    const key = [c.type, normalizeEntityNameForMatch(c.up_character), normalizeEntityNameForMatch(c.source_title)].join('|');
    if (!map.has(key)) { map.set(key, { ...c }); continue; }
    const prev = map.get(key);
    prev.start_time = prev.start_time || c.start_time || null;
    prev.end_time = prev.end_time || c.end_time || null;
    prev.featured_character_names = [...new Set([...(prev.featured_character_names || []), ...(c.featured_character_names || [])])];
    prev.source_notice_id = prev.source_notice_id || c.source_notice_id || null;
    prev.source_url = prev.source_url || c.source_url || null;
  }
  return [...map.values()];
}

function buildCharacterLookup(rows) {
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

function resolveEntity(lookup, name, type) {
  const key = normalizeEntityNameForMatch(name);
  if (!key) return { id: null };
  const candidates = (lookup.get(key) || []).filter(c => c?.type === type);
  return { id: candidates.length === 1 ? String(candidates[0].id).trim() : null };
}

async function findExistingPoolWithAlias(supabase, candidatePoolId, upCharacter, startTime, currentPools) {
  const normalizedUp = normalizeEntityNameForMatch(upCharacter);

  if (candidatePoolId) {
    const { data: aliasMatch } = await supabase
      .from('pool_id_aliases')
      .select('pool_id')
      .eq('alias_id', candidatePoolId)
      .limit(1);
    if (aliasMatch?.[0]?.pool_id) {
      const found = currentPools.find(p => p.pool_id === aliasMatch[0].pool_id);
      if (found) return found;
    }
  }

  const startDate = String(startTime || '').slice(0, 10);
  if (startDate && normalizedUp) {
    const byUpAndDate = currentPools.find(p => {
      const pType = p.type === 'limited_character' ? 'limited' : p.type;
      const pUp = normalizeEntityNameForMatch(p.up_character);
      const pDate = String(p.start_time || '').slice(0, 10);
      return pUp === normalizedUp && pDate === startDate && (pType === 'limited' || pType === 'weapon');
    });
    if (byUpAndDate) return byUpAndDate;
  }

  if (normalizedUp) {
    const byUp = currentPools.find(p => {
      const pUp = normalizeEntityNameForMatch(p.up_character);
      return pUp === normalizedUp;
    });
    if (byUp) return byUp;
  }

  return null;
}

async function registerPoolAlias(supabase, canonicalPoolId, aliasId, source = 'official_notice') {
  if (!canonicalPoolId || !aliasId || canonicalPoolId === aliasId) return;
  try {
    await supabase
      .from('pool_id_aliases')
      .upsert(
        { source, alias_id: aliasId, pool_id: canonicalPoolId, is_primary: false },
        { onConflict: 'pool_id_aliases_source_alias_unique' }
      );
  } catch {
    // alias registration is best-effort
  }
}

export async function syncPools(announcementRecords) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { created: 0, updated: 0, error: 'Database not configured' };
  }

  const candidates = [];
  for (const record of announcementRecords || []) {
    candidates.push(...parseStandaloneLimitedNotice(record));
    candidates.push(...parseVersionUpdateSections(record));
  }

  if (candidates.length === 0) {
    return { created: 0, updated: 0, parsed: 0 };
  }

  const merged = mergeCandidates(candidates);

  const { data: characters } = await supabase.from('characters').select('id, name, aliases, type');
  const { data: currentPoolsRaw } = await supabase.rpc('get_app_visible_pools');
  const currentPools = currentPoolsRaw || [];
  const charLookup = buildCharacterLookup(characters || []);

  let created = 0;
  let updated = 0;
  const errors = [];
  const unresolvedNames = new Set();

  for (const pool of merged) {
    try {
      const itemType = pool.type === 'weapon' ? 'weapon' : 'character';
      const candidatePoolId = buildManualPoolId({
        type: pool.type,
        name: pool.source_title,
        upCharacter: pool.up_character,
        startTime: pool.start_time,
        endTime: pool.end_time,
      });

      const existing = await findExistingPoolWithAlias(
        supabase, candidatePoolId, pool.up_character, pool.start_time, currentPools
      );

      const featuredIds = [];
      for (const name of pool.featured_character_names || []) {
        const { id } = resolveEntity(charLookup, name, itemType);
        if (id) featuredIds.push(id);
        else unresolvedNames.add(name);
      }

      const upResolved = resolveEntity(charLookup, pool.up_character, itemType);
      if (!upResolved?.id && pool.up_character) {
        unresolvedNames.add(pool.up_character);
      }

      if (existing) {
        const updates = {};
        if (pool.start_time && !existing.start_time) updates.start_time = pool.start_time;
        if (pool.end_time && !existing.end_time) updates.end_time = pool.end_time;
        if (featuredIds.length > 0 && !existing.featured_characters?.length) {
          updates.featured_characters = featuredIds;
        }
        if (pool.up_character && !existing.up_character) {
          updates.up_character = pool.up_character;
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('pools')
            .update(updates)
            .eq('pool_id', existing.pool_id);
          if (!error) updated++;
        }

        await registerPoolAlias(supabase, existing.pool_id, candidatePoolId);
      } else {
        const poolId = candidatePoolId;
        const name = pool.source_title
          || (pool.up_character ? `${pool.type === 'weapon' ? '武器' : '限定'}-${pool.up_character}` : '未命名卡池');

        const { error } = await supabase.rpc('admin_upsert_pool_with_aliases', {
          p_pool_id: poolId,
          p_name: name,
          p_type: pool.type === 'limited' ? 'limited_character' : pool.type,
          p_description: `${name}（官方公告自动解析）`,
          p_start_time: pool.start_time || null,
          p_end_time: pool.end_time || null,
          p_up_character: pool.up_character || null,
          p_featured_characters: featuredIds.length > 0 ? featuredIds : null,
          p_banner_url: null,
          p_alias_rows: [
            { source: 'internal', alias_id: poolId, is_primary: true },
            { source: 'official_notice', alias_id: poolId, is_primary: false },
          ],
          p_pool_character_rows: featuredIds.map(id => ({
            character_id: id,
            is_up: upResolved?.id === id,
            is_new: false,
          })),
        });

        if (error) {
          errors.push({ pool: pool.up_character, error: error.message });
        } else {
          created++;
          currentPools.push({
            pool_id: poolId,
            name,
            type: pool.type === 'limited' ? 'limited_character' : pool.type,
            up_character: pool.up_character,
            start_time: pool.start_time,
            end_time: pool.end_time,
          });
        }
      }
    } catch (err) {
      errors.push({ pool: pool.up_character, error: err.message });
    }
  }

  return {
    created,
    updated,
    parsed: merged.length,
    errors: errors.length > 0 ? errors : undefined,
    unresolvedNames: [...unresolvedNames],
  };
}
