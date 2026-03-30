import fs from 'node:fs';
import { chromium } from 'playwright';
import { normalizeEntityNameForMatch } from '../../src/utils/canonicalEntityUtils.js';

const TEAM_STARDUST_PAGE_CONFIG = Object.freeze({
  character: {
    url: 'https://endfield.teamstardust.org/operators',
    hrefPrefix: '/character/',
    itemSelector: 'a[href^="/character/"] img'
  },
  weapon: {
    url: 'https://endfield.teamstardust.org/weapons',
    hrefPrefix: '/weapon/',
    itemSelector: 'a[href^="/weapon/"] img'
  }
});

const PAGE_RENDER_WAIT_MS = 4000;
const LANGUAGE_SWITCH_WAIT_MS = 2000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function findEdgeExecutable() {
  const candidates = [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function normalizeRequestedTypes(types = ['character', 'weapon']) {
  return Array.from(new Set(
    (Array.isArray(types) ? types : [types]).filter((type) => (
      Object.prototype.hasOwnProperty.call(TEAM_STARDUST_PAGE_CONFIG, type)
    ))
  ));
}

async function extractCatalogEntries(page, hrefPrefix) {
  return page.evaluate((expectedHrefPrefix) => {
    const anchors = Array.from(document.querySelectorAll(`a[href^="${expectedHrefPrefix}"]`));
    const seenIds = new Set();
    const records = [];

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      const segments = href.split('/').filter(Boolean);
      const id = segments.at(-1) || '';
      const image = anchor.querySelector('img');
      const imageUrl = image?.currentSrc || image?.src || '';
      const name = (anchor.textContent || '').replace(/\s+/g, ' ').trim();

      if (!id || !imageUrl || seenIds.has(id)) {
        return;
      }

      seenIds.add(id);
      records.push({
        id,
        name,
        href,
        imageUrl
      });
    });

    return records;
  }, hrefPrefix);
}

function buildNameLookup(recordsMap) {
  const byName = new Map();
  const duplicateNames = new Set();

  recordsMap.forEach((record) => {
    const key = normalizeEntityNameForMatch(record?.name);
    if (!key) {
      return;
    }

    const existing = byName.get(key);
    if (existing && existing.id !== record.id) {
      duplicateNames.add(key);
      return;
    }

    byName.set(key, record);
  });

  return {
    byName,
    duplicateNames
  };
}

async function switchPageLanguageToChinese(page, config, logger) {
  try {
    await page.selectOption('#language-select', '中文');
    await page.waitForLoadState('domcontentloaded').catch(() => null);
    await page.waitForTimeout(LANGUAGE_SWITCH_WAIT_MS);
    await page.waitForSelector(config.itemSelector, { timeout: 10000 }).catch(() => null);
    logger('Team Stardust 已切换为中文页面');
  } catch {
    // Ignore language-switch failures and fall back to the default locale.
  }
}

export async function loadTeamStardustAssetCatalog(types = ['character', 'weapon'], { logger = () => {} } = {}) {
  const requestedTypes = normalizeRequestedTypes(types);
  const catalog = {
    character: new Map(),
    weapon: new Map()
  };

  if (requestedTypes.length === 0) {
    return catalog;
  }

  const edgeExecutable = findEdgeExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(edgeExecutable ? { executablePath: edgeExecutable } : {})
  });

  try {
    const context = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT
    });

    for (const itemType of requestedTypes) {
      const config = TEAM_STARDUST_PAGE_CONFIG[itemType];
      const page = await context.newPage();

      try {
        logger(`加载 Team Stardust ${itemType} 目录: ${config.url}`);
        await page.goto(config.url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(PAGE_RENDER_WAIT_MS);
        await page.waitForSelector(config.itemSelector, { timeout: 10000 }).catch(() => null);
        await switchPageLanguageToChinese(page, config, logger);

        const records = await extractCatalogEntries(page, config.hrefPrefix);
        records.forEach((record) => {
          catalog[itemType].set(record.id, record);
        });

        logger(`Team Stardust ${itemType} 目录已提取 ${records.length} 条记录`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return catalog;
}

export function buildTeamStardustLookup(catalog = {}) {
  const characterById = catalog.character instanceof Map ? catalog.character : new Map();
  const weaponById = catalog.weapon instanceof Map ? catalog.weapon : new Map();

  return {
    character: {
      byId: characterById,
      ...buildNameLookup(characterById)
    },
    weapon: {
      byId: weaponById,
      ...buildNameLookup(weaponById)
    }
  };
}

export function findTeamStardustAssetMatch(record, lookup) {
  const typeLookup = lookup?.[record?.type];
  if (!typeLookup) {
    return null;
  }

  const directMatch = typeLookup.byId?.get(record.id);
  if (directMatch?.imageUrl) {
    return directMatch;
  }

  const candidateKeys = new Set([
    normalizeEntityNameForMatch(record?.name),
    ...(Array.isArray(record?.aliases) ? record.aliases.map(normalizeEntityNameForMatch) : [])
  ].filter(Boolean));

  for (const key of candidateKeys) {
    if (typeLookup.duplicateNames?.has(key)) {
      continue;
    }

    const matched = typeLookup.byName?.get(key);
    if (matched?.imageUrl) {
      return matched;
    }
  }

  return null;
}

export default {
  loadTeamStardustAssetCatalog,
  buildTeamStardustLookup,
  findTeamStardustAssetMatch
};
