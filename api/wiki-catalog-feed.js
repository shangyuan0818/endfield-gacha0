const IMAGE_URLS = {
  character: (charId) => `https://static.warfarin.wiki/v3/charicon/icon_${charId}.webp`,
  weapon: (iconId) => `https://static.warfarin.wiki/v3/itemicon/${iconId}.webp`,
};

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

  return Array.isArray(result.data) ? result.data : [];
}

function buildCharacterRecords(rawOperators) {
  return rawOperators
    .filter(operator => operator?.id && operator?.name)
    .map(operator => ({
      id: String(operator.id),
      name: String(operator.name),
      rarity: Number(operator.rarity) || 1,
      type: 'character',
      avatar_url: IMAGE_URLS.character(operator.id),
      is_limited: false,
      aliases: [],
      release_date: null,
    }));
}

function buildWeaponRecords(rawWeapons) {
  return rawWeapons
    .filter(weapon => weapon?.id && weapon?.name)
    .map((weapon) => {
      const iconId = weapon.iconId || weapon.id;
      return {
        id: String(weapon.id),
        name: String(weapon.name),
        rarity: Number(weapon.rarity) || 1,
        type: 'weapon',
        avatar_url: IMAGE_URLS.weapon(iconId),
        is_limited: false,
        aliases: [],
        release_date: null,
      };
    });
}

export default async function handler(req, res) {
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
    const [operators, weapons] = await Promise.all([
      fetchLocalJson(`${baseUrl}/api/wiki-proxy?type=operators`),
      fetchLocalJson(`${baseUrl}/api/wiki-proxy?type=weapons`),
    ]);

    const records = [
      ...buildCharacterRecords(operators),
      ...buildWeaponRecords(weapons),
    ];

    return res.status(200).json({
      success: true,
      records,
      meta: {
        operatorCount: operators.length,
        weaponCount: weapons.length,
        totalCount: records.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to build wiki catalog feed',
    });
  }
}
