import { getSklandCatalogUrl } from '../constants/adminImageSources';

const ASSOCIATE_TYPE_MAP = {
  character: 'char',
  weapon: 'weapon'
};

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•・]/g, '')
    .replace(/[()（）]/g, '');
}

export function buildSklandExtractScript(itemType = 'character') {
  const pageUrl = getSklandCatalogUrl(itemType);
  const associateType = ASSOCIATE_TYPE_MAP[itemType] || 'char';

  return `await (async () => {
  const root = window.__CHIMERA_STORE__?.dataMap;
  if (!root || typeof root !== 'object') {
    throw new Error('未找到 __CHIMERA_STORE__.dataMap，请确认当前页面（森空岛终末地WIKI）已完全加载');
  }

  const records = [];
  const seenNodes = new WeakSet();
  const seenKeys = new Set();

  const visit = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || seenNodes.has(node) || depth > 20) return;
    seenNodes.add(node);

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }

    if (typeof node.name === 'string' && typeof node.brief?.cover === 'string') {
      const row = {
        itemId: node.itemId || null,
        name: node.name,
        cover: node.brief.cover,
        associateId: node.brief?.associate?.id || null,
        associateType: node.brief?.associate?.type || null
      };
      const dedupeKey = [row.itemId || '', row.name, row.cover].join('::');
      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        records.push(row);
      }
    }

    for (const value of Object.values(node)) {
      visit(value, depth + 1);
    }
  };

  visit(root);

  const filtered = records.filter((item) => !item.associateType || item.associateType === '${associateType}');
  const payload = JSON.stringify(filtered, null, 2);

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload);
    console.log('已复制 ' + filtered.length + ' 条图片记录到剪贴板。');
  } else {
    console.log(payload);
    alert('当前页面无法直接写入剪贴板，请从控制台复制输出结果。');
  }

  return {
    page: '${pageUrl}',
    count: filtered.length,
    sample: filtered.slice(0, 5)
  };
})();`;
}

export function parseSklandImportPayload(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    return { records: [], error: '请先粘贴从森空岛终末地WIKI页复制的 JSON 数据' };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { records: [], error: `JSON 解析失败：${error.message}` };
  }

  const records = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.records)
      ? parsed.records
      : [];

  if (!records.length) {
    return { records: [], error: '未找到可导入的图片记录，请确认粘贴的是脚本导出的 JSON 数组' };
  }

  const normalized = [];
  for (const item of records) {
    const name = String(item?.name || '').trim();
    const cover = String(item?.cover || '').trim();
    if (!name || !cover) continue;

    normalized.push({
      itemId: item?.itemId ? String(item.itemId) : null,
      name,
      cover,
      associateId: item?.associateId ? String(item.associateId) : null,
      associateType: item?.associateType ? String(item.associateType) : null
    });
  }

  if (!normalized.length) {
    return { records: [], error: '解析成功，但所有记录都缺少名称或图片地址' };
  }

  return { records: normalized, error: null };
}

export function matchSklandImagesToCharacters(records, characters, itemType = 'character') {
  const dbItems = (characters || []).filter(item => item.type === itemType);
  const aliasMap = new Map();
  const duplicateKeys = new Set();

  for (const item of dbItems) {
    const keys = new Set([
      normalizeName(item.name),
      ...(Array.isArray(item.aliases) ? item.aliases.map(normalizeName) : [])
    ].filter(Boolean));

    for (const key of keys) {
      if (aliasMap.has(key) && aliasMap.get(key).id !== item.id) {
        duplicateKeys.add(key);
      } else {
        aliasMap.set(key, item);
      }
    }
  }

  const updates = [];
  const unmatched = [];
  const ambiguous = [];

  for (const record of records) {
    const key = normalizeName(record.name);
    if (!key) {
      unmatched.push(record);
      continue;
    }

    if (duplicateKeys.has(key)) {
      ambiguous.push(record);
      continue;
    }

    const matched = aliasMap.get(key);
    if (!matched) {
      unmatched.push(record);
      continue;
    }

    updates.push({
      id: matched.id,
      name: matched.name,
      avatar_url: record.cover,
      sourceName: record.name,
      sourceItemId: record.itemId
    });
  }

  return {
    updates,
    unmatched,
    ambiguous
  };
}
