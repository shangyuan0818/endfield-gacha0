function normalizeAvatarType(type = 'character') {
  return type === 'weapon' ? 'weapon' : 'character';
}

function normalizeAvatarExtension(extension = 'webp') {
  const normalized = String(extension || 'webp').trim().toLowerCase().replace(/^\./, '');
  return normalized || 'webp';
}

export function buildWikiAssetProxyPath(type = 'character', itemId) {
  const normalizedType = normalizeAvatarType(type);
  if (!itemId) {
    return null;
  }

  const params = new URLSearchParams({
    type: normalizedType,
    id: String(itemId)
  });

  return `/api/wiki-asset-proxy?${params.toString()}`;
}

export function buildLocalAvatarPath(type = 'character', itemId, extension = 'webp') {
  const normalizedType = normalizeAvatarType(type);
  if (!itemId) {
    return null;
  }

  const normalizedExtension = normalizeAvatarExtension(extension);
  return `/avatars/${normalizedType}s/${itemId}.${normalizedExtension}`;
}

export function inferAvatarFileExtension(sourceUrl, fallback = 'webp') {
  if (typeof sourceUrl !== 'string' || !sourceUrl.trim()) {
    return normalizeAvatarExtension(fallback);
  }

  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\.([A-Za-z0-9]+)$/);
    if (match?.[1]) {
      return normalizeAvatarExtension(match[1]);
    }
  } catch {
    const match = sourceUrl.match(/\.([A-Za-z0-9]+)(?:[?#]|$)/);
    if (match?.[1]) {
      return normalizeAvatarExtension(match[1]);
    }
  }

  return normalizeAvatarExtension(fallback);
}

export default {
  buildWikiAssetProxyPath,
  buildLocalAvatarPath,
  inferAvatarFileExtension
};
