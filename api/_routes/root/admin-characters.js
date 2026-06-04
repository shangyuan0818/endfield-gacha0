import { getSupabaseAdminClient } from '../../_lib/authAdmin.js';
import { rejectDisallowedBrowserOrigin } from '../../_lib/http.js';
import { requireSuperAdminUser } from '../../_lib/siteAuth.js';
import {
  buildCharacterBatchUpdates,
  buildManualPlaceholderLookup,
  buildSyncedPoolConfig,
  buildWikiAliasRows,
  isCompleteSyncFailure,
  isFatalSyncSetupError,
  pushUniqueWarning,
  resolveManagedAvatarUrl,
  resolveSyncCanonicalId,
} from '../../../src/utils/adminCharacterSyncUtils.js';
import { buildCharacterSelfAliasRows, resolveCharacterAliasMap } from '../../../shared/idAliasService.js';
import { serverLogger } from '../../_lib/serverLogger.js';

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function getRequestUrl(req) {
  try {
    return new URL(req.url || '/', 'http://localhost');
  } catch {
    return new URL('/', 'http://localhost');
  }
}

function sendError(res, status, error, code = error) {
  return res.status(status).json({
    success: false,
    error,
    code,
  });
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCharacterIds(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(item => normalizeId(item))
      .filter(Boolean)
      .slice(0, 500)
  ));
}

function normalizeCharacterData(value = {}) {
  const id = normalizeId(value.id);
  const name = normalizeId(value.name);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    rarity: Number(value.rarity) || 6,
    type: value.type === 'weapon' ? 'weapon' : 'character',
    avatar_url: normalizeId(value.avatar_url) || null,
    is_limited: Boolean(value.is_limited),
    aliases: Array.isArray(value.aliases) && value.aliases.length > 0 ? value.aliases : null,
    pool_config: value.pool_config && typeof value.pool_config === 'object'
      ? value.pool_config
      : buildSyncedPoolConfig(value.type),
  };
}

function normalizeSyncItems(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      const id = normalizeId(item?.id);
      const name = normalizeId(item?.name);
      if (!id || !name) return null;
      return {
        id,
        name,
        rarity: Number(item?.rarity) || 6,
        type: item?.type === 'weapon' ? 'weapon' : 'character',
        avatar_url: normalizeId(item?.avatar_url) || null,
        _iconId: normalizeId(item?._iconId) || null,
      };
    })
    .filter(Boolean)
    .slice(0, 1000);
}

async function loadCharacters(adminClient, { ids = null } = {}) {
  let query = adminClient
    .from('characters')
    .select('*')
    .order('rarity', { ascending: false })
    .order('name', { ascending: true });

  if (Array.isArray(ids) && ids.length > 0) {
    query = query.in('id', ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function saveManagedCharacterWithAliases(adminClient, characterData) {
  const { error } = await adminClient.rpc('admin_upsert_character_with_aliases', {
    p_character_id: characterData.id,
    p_insert_payload: characterData,
    p_update_payload: characterData,
    p_alias_rows: buildCharacterSelfAliasRows(characterData.id),
  });

  if (!error) return;
  if (error.code === 'PGRST202' || /admin_upsert_character_with_aliases/i.test(error.message || '')) {
    throw new Error('缺少数据库迁移 078，请先执行 078_harden_admin_entity_upsert_rpcs.sql');
  }
  throw error;
}

async function syncCharacterWithAliases(adminClient, {
  canonicalId,
  insertPayload,
  updatePayload,
  aliasRows,
}) {
  const { error } = await adminClient.rpc('admin_sync_character_with_aliases', {
    p_character_id: canonicalId,
    p_insert_payload: insertPayload,
    p_update_payload: updatePayload,
    p_alias_rows: aliasRows,
  });

  if (!error) return;
  if (error.code === 'PGRST202' || /admin_sync_character_with_aliases/i.test(error.message || '')) {
    throw new Error('缺少数据库迁移 077，请先执行 077_add_admin_sync_character_rpc.sql');
  }
  throw error;
}

async function handleGet(req, res, adminClient) {
  const url = getRequestUrl(req);
  const mode = String(url.searchParams.get('mode') || 'characters').trim();

  if (mode !== 'characters') {
    return sendError(res, 400, 'Unsupported admin characters mode', 'admin_characters_mode_invalid');
  }

  const data = await loadCharacters(adminClient);
  return res.status(200).json({ success: true, data });
}

async function handleSaveCharacter(res, adminClient, body) {
  const characterData = normalizeCharacterData(body.characterData || body.character_data);
  const existingCharacter = body.existingCharacter || body.existing_character || null;

  if (!characterData) {
    return sendError(res, 400, 'Character ID and name are required', 'character_required');
  }

  if (existingCharacter && existingCharacter.id !== characterData.id) {
    return sendError(
      res,
      400,
      '暂不支持在编辑时直接修改角色ID，请通过 alias 映射或迁移脚本处理',
      'character_id_change_blocked'
    );
  }

  await saveManagedCharacterWithAliases(adminClient, characterData);
  return res.status(200).json({ success: true, character: characterData });
}

async function handleDeleteCharacters(res, adminClient, body) {
  const characterIds = normalizeCharacterIds(body.characterIds || body.character_ids);
  if (characterIds.length === 0) {
    return sendError(res, 400, 'Character IDs are required', 'character_ids_required');
  }

  const { error } = await adminClient
    .from('characters')
    .delete()
    .in('id', characterIds);
  if (error) throw error;

  return res.status(200).json({
    success: true,
    deletedCount: characterIds.length,
  });
}

async function handleBatchUpdateCharacters(res, adminClient, body) {
  const characterIds = normalizeCharacterIds(body.characterIds || body.character_ids);
  if (characterIds.length === 0) {
    return sendError(res, 400, 'Character IDs are required', 'character_ids_required');
  }

  const currentItems = await loadCharacters(adminClient, { ids: characterIds });
  const updates = buildCharacterBatchUpdates(
    currentItems,
    body.batchEditForm || body.batch_edit_form || {},
    new Date().toISOString()
  );

  for (const item of updates) {
    const { error } = await adminClient
      .from('characters')
      .update(item.updates)
      .eq('id', item.id);
    if (error) throw error;
  }

  return res.status(200).json({
    success: true,
    updateCount: updates.length,
  });
}

async function handleBatchUpdateAvatars(res, adminClient, body) {
  const avatarUpdates = Array.isArray(body.avatarUpdates || body.avatar_updates)
    ? (body.avatarUpdates || body.avatar_updates)
    : [];
  const normalizedUpdates = avatarUpdates
    .map((item) => ({
      id: normalizeId(item?.id),
      avatar_url: normalizeId(item?.avatar_url) || null,
    }))
    .filter(item => item.id && item.avatar_url)
    .slice(0, 1000);

  let updateCount = 0;
  let errorCount = 0;

  for (const item of normalizedUpdates) {
    const { error } = await adminClient
      .from('characters')
      .update({ avatar_url: item.avatar_url })
      .eq('id', item.id);
    if (error) {
      errorCount++;
    } else {
      updateCount++;
    }
  }

  return res.status(200).json({
    success: true,
    updateCount,
    errorCount,
  });
}

async function handleSyncWikiItems(res, adminClient, body) {
  const syncWarnings = new Set();
  const allItems = normalizeSyncItems(body.items);
  (Array.isArray(body.warnings) ? body.warnings : []).forEach((warning) => {
    pushUniqueWarning(syncWarnings, warning);
  });
  pushUniqueWarning(
    syncWarnings,
    '浏览器侧同步已停用 Supabase Storage 头像上传，当前改为写入站点同源代理 URL；如需彻底切到站点本地静态头像，请在仓库本地运行 sync:local-avatars 后提交并部署'
  );

  if (allItems.length === 0) {
    return sendError(res, 400, '未从 Wiki 获取到任何可同步的角色或武器数据', 'wiki_items_empty');
  }

  const wikiAliasMap = await resolveCharacterAliasMap(
    adminClient,
    allItems.map(item => item.id),
    'wiki'
  );
  const existingRows = await loadCharacters(adminClient);
  const existingIds = normalizeCharacterIds(body.existingIds || body.existing_ids);
  const existingIdSet = new Set([
    ...existingIds,
    ...existingRows.map(row => row.id),
  ]);
  const manualPlaceholderLookup = buildManualPlaceholderLookup(existingRows);

  let newCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const item of allItems) {
    try {
      const finalAvatarUrl = resolveManagedAvatarUrl(item);
      const canonicalId = resolveSyncCanonicalId({
        item,
        wikiAliasMap,
        existingIdSet,
        manualPlaceholderLookup,
      });

      const insertPayload = {
        id: canonicalId,
        name: item.name,
        rarity: item.rarity,
        type: item.type,
        avatar_url: finalAvatarUrl,
        aliases: [],
        is_limited: false,
        pool_config: buildSyncedPoolConfig(item.type),
      };
      const updatePayload = {
        name: item.name,
        rarity: item.rarity,
        type: item.type,
        avatar_url: finalAvatarUrl,
      };

      await syncCharacterWithAliases(adminClient, {
        canonicalId,
        insertPayload,
        updatePayload,
        aliasRows: buildWikiAliasRows(canonicalId, item.id),
      });

      if (existingIdSet.has(canonicalId)) {
        skippedCount++;
      } else {
        newCount++;
        existingIdSet.add(canonicalId);
      }
    } catch (error) {
      if (isFatalSyncSetupError(error)) {
        throw error;
      }
      serverLogger.warn('admin.characters.sync-item-failed', {
        code: 'admin_character_sync_item_failed',
        itemId: item.id,
        message: String(error?.message || error || 'sync_failed').slice(0, 200),
      });
      errorCount++;
    }
  }

  if (isCompleteSyncFailure({
    totalItems: allItems.length,
    newCount,
    skippedCount,
    errorCount,
  })) {
    return sendError(
      res,
      500,
      `所有 ${errorCount} 个项目都写入失败，请检查数据库错误日志或迁移状态`,
      'wiki_sync_all_failed'
    );
  }

  if (newCount > 0) {
    pushUniqueWarning(
      syncWarnings,
      '新同步项目不会自动推断限定/常驻归属；角色默认空卡池，武器默认 weapon 池，请在卡池数据同步后复核'
    );
  }

  return res.status(200).json({
    success: true,
    newCount,
    skippedCount,
    errorCount,
    avatarCount: 0,
    avatarFailedCount: 0,
    warnings: Array.from(syncWarnings),
  });
}

async function handlePost(req, res, adminClient) {
  const body = parseRequestBody(req);
  const action = String(body.action || '').trim();

  if (action === 'saveCharacter') {
    return handleSaveCharacter(res, adminClient, body);
  }
  if (action === 'batchUpdateCharacters') {
    return handleBatchUpdateCharacters(res, adminClient, body);
  }
  if (action === 'batchUpdateCharacterAvatars') {
    return handleBatchUpdateAvatars(res, adminClient, body);
  }
  if (action === 'syncWikiItems') {
    return handleSyncWikiItems(res, adminClient, body);
  }

  return sendError(res, 400, 'Unsupported admin characters action', 'admin_characters_action_invalid');
}

async function handleDelete(req, res, adminClient) {
  const body = parseRequestBody(req);
  return handleDeleteCharacters(res, adminClient, body);
}

export default async function adminCharactersHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'GET, POST, DELETE, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    sendError(res, 405, 'Method not allowed', 'method_not_allowed');
    return;
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    sendError(res, 503, 'Auth service not configured', 'auth_service_not_configured');
    return;
  }

  const authResult = await requireSuperAdminUser(req, {
    adminClient,
    touch: true,
  });
  if (!authResult.ok) {
    sendError(
      res,
      authResult.status || 401,
      authResult.error || 'Super admin role required',
      authResult.code || 'super_admin_required'
    );
    return;
  }

  try {
    if (req.method === 'GET') {
      await handleGet(req, res, adminClient);
      return;
    }
    if (req.method === 'POST') {
      await handlePost(req, res, adminClient);
      return;
    }
    await handleDelete(req, res, adminClient);
  } catch (error) {
    const code = req.method === 'GET'
      ? 'admin_characters_load_failed'
      : req.method === 'POST'
        ? 'admin_characters_update_failed'
        : 'admin_characters_delete_failed';
    sendError(res, 500, error?.message || 'Failed to process admin characters', code);
  }
}

export const __internal = {
  normalizeCharacterData,
  normalizeSyncItems,
};
