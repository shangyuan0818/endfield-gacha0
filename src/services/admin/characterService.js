/**
 * 角色 / 武器管理服务层。
 * 前端只负责发起同源管理员请求；数据库读写、alias 解析和管理员 RPC 在服务端完成。
 */

import { syncAllCharacters, syncAllWeapons } from '../../utils/endfieldDataSync';
import { characterCache } from '../../utils/characterUtils';
import { pushUniqueWarning } from '../../utils/adminCharacterSyncUtils.js';
import { getSupabaseAccessToken } from '../authFetchService.js';
import { fetchJsonWithTimeout } from '../supabaseRequest.js';

export {
  buildManualPlaceholderLookup,
  resolveSyncCanonicalId,
} from '../../utils/adminCharacterSyncUtils.js';

const ADMIN_CHARACTERS_TIMEOUT_MS = 60000;

async function buildAdminCharactersHeaders(extraHeaders = {}) {
  const accessToken = await getSupabaseAccessToken({
    syncSiteSession: false,
    useSiteSessionCache: true,
    allowSiteSessionToken: false,
  }).catch(() => null);

  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function throwAdminCharactersError(data, response, fallbackMessage, fallbackCode) {
  const error = new Error(data?.error || `${fallbackMessage} (${response.status})`);
  error.code = data?.code || fallbackCode;
  error.status = response.status;
  throw error;
}

async function requestAdminCharacters({
  method = 'GET',
  params = null,
  body = null,
  label = 'admin-characters',
  retries = method === 'GET' ? 1 : 0,
} = {}) {
  const query = params instanceof URLSearchParams && params.toString()
    ? `?${params.toString()}`
    : '';
  const headers = await buildAdminCharactersHeaders(
    body ? { 'Content-Type': 'application/json' } : {}
  );
  const { response, data } = await fetchJsonWithTimeout(`/api/admin-characters${query}`, {
    method,
    credentials: 'same-origin',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, {
    label,
    timeoutMs: ADMIN_CHARACTERS_TIMEOUT_MS,
    retries,
  });

  if (!response.ok || data?.success !== true) {
    throwAdminCharactersError(data, response, '后台角色操作失败', 'admin_characters_request_failed');
  }

  return data;
}

export async function loadCharacters() {
  try {
    const params = new URLSearchParams({ mode: 'characters' });
    const result = await requestAdminCharacters({
      params,
      label: 'admin-characters-load',
    });
    return {
      data: Array.isArray(result.data) ? result.data : [],
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}

export async function saveCharacter(characterData, existingCharacter = null) {
  try {
    await requestAdminCharacters({
      method: 'POST',
      body: {
        action: 'saveCharacter',
        characterData,
        existingCharacter,
      },
      label: 'admin-character-save',
    });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
}

export async function deleteCharacter(characterId) {
  return batchDeleteCharacters([characterId]);
}

export async function batchDeleteCharacters(characterIds) {
  try {
    await requestAdminCharacters({
      method: 'DELETE',
      body: {
        characterIds,
      },
      label: 'admin-character-delete',
    });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
}

export async function batchUpdateCharacters(characterIds, batchEditForm) {
  try {
    const result = await requestAdminCharacters({
      method: 'POST',
      body: {
        action: 'batchUpdateCharacters',
        characterIds,
        batchEditForm,
      },
      label: 'admin-character-batch-update',
    });
    return {
      success: true,
      updateCount: Number(result.updateCount) || 0,
      error: null,
    };
  } catch (error) {
    return { success: false, updateCount: 0, error };
  }
}

export async function batchUpdateCharacterAvatars(avatarUpdates) {
  try {
    const result = await requestAdminCharacters({
      method: 'POST',
      body: {
        action: 'batchUpdateCharacterAvatars',
        avatarUpdates,
      },
      label: 'admin-character-avatar-update',
    });
    const updateCount = Number(result.updateCount) || 0;
    if (updateCount > 0) {
      await characterCache.refresh();
    }
    return {
      success: result.success === true,
      updateCount,
      errorCount: Number(result.errorCount) || 0,
      error: null,
    };
  } catch (error) {
    return { success: false, updateCount: 0, errorCount: 0, error };
  }
}

export async function syncFromAPI({ onProgress, existingIds = [] }) {
  try {
    const syncWarnings = new Set();

    onProgress?.('正在获取角色数据...');
    const characterResult = await syncAllCharacters((current, total, msg) => {
      onProgress?.(`角色: ${msg}`);
    });
    pushUniqueWarning(syncWarnings, characterResult.warning);

    onProgress?.('正在获取武器数据...');
    const weaponResult = await syncAllWeapons((current, total, msg) => {
      onProgress?.(`武器: ${msg}`);
    });
    pushUniqueWarning(syncWarnings, weaponResult.warning);

    const allItems = [
      ...characterResult.characters.map(item => ({ ...item, type: 'character' })),
      ...weaponResult.weapons.map(item => ({ ...item, type: 'weapon' })),
    ];

    if (allItems.length === 0) {
      return {
        success: false,
        error: new Error('未从 Wiki 获取到任何可同步的角色或武器数据'),
      };
    }

    onProgress?.(`正在更新数据库 (${allItems.length} 项)...`);
    const result = await requestAdminCharacters({
      method: 'POST',
      body: {
        action: 'syncWikiItems',
        items: allItems,
        existingIds,
        warnings: Array.from(syncWarnings),
      },
      label: 'admin-character-sync-wiki',
      retries: 0,
    });

    await characterCache.refresh();
    return {
      success: true,
      newCount: Number(result.newCount) || 0,
      skippedCount: Number(result.skippedCount) || 0,
      errorCount: Number(result.errorCount) || 0,
      avatarCount: Number(result.avatarCount) || 0,
      avatarFailedCount: Number(result.avatarFailedCount) || 0,
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      error: null,
    };
  } catch (error) {
    return { success: false, error };
  }
}
