import { rejectDisallowedBrowserOrigin } from '../../../_lib/http.js';
import { getSupabaseAdminClient, getBearerToken, getSupabaseAnonServerClient } from '../../../_lib/authAdmin.js';
import { createOfficialBotConfig } from '../../../../bots/official/config.js';
import { EndfieldApiClient } from '../../../../bots/official/endfieldApiClient.js';
import { buildOfficialBotLinks } from '../../../../bots/official/links.js';
import { sendTelegramMessage } from '../../../../bots/official/adapters/telegram.js';

function normalizeBaseUrl(rawValue) {
  const value = String(rawValue || '').trim();
  return value ? value.replace(/\/+$/, '') : '';
}

export function createImportNotifyApiClient({
  env = process.env,
  siteUrl = '',
  fetchImpl = fetch,
} = {}) {
  const config = createOfficialBotConfig({ provider: 'telegram', env });
  const baseUrl = normalizeBaseUrl(
    config.baseUrl
    || env.VITE_APP_URL
    || env.OFFICIAL_BOT_SITE_URL
    || siteUrl
  );

  if (!baseUrl || !config.publicApiKey) {
    return null;
  }

  return new EndfieldApiClient({
    ...config,
    baseUrl,
    siteUrl: normalizeBaseUrl(config.siteUrl || siteUrl || baseUrl),
    verifierSecret: config.verifierSecret || '',
  }, fetchImpl);
}

function parseRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

const POOL_TYPE_LABELS = {
  extra: '附加寻访',
  limited: '限定角色池',
  limited_character: '限定角色池',
  standard: '基础寻访',
  beginner: '启程寻访',
  weapon: '武器池',
  limited_weapon: '武器池',
};

function getPoolTypeLabel(type) {
  return POOL_TYPE_LABELS[String(type || '').trim()] || '未知卡池';
}

function collectAffectedPoolLabels(summary = {}) {
  const labels = [];

  Object.keys(summary?.byPool || {}).forEach((name) => {
    const normalized = String(name || '').trim();
    if (normalized) {
      labels.push(normalized);
    }
  });

  for (const pool of summary?.partialPools || []) {
    const normalized = String(pool?.poolName || pool?.pool_name || '').trim() || getPoolTypeLabel(pool?.poolType || pool?.type);
    if (normalized) {
      labels.push(normalized);
    }
  }

  for (const pool of summary?.failedPools || []) {
    const normalized = String(pool?.poolName || pool?.pool_name || '').trim() || getPoolTypeLabel(pool?.poolType || pool?.type);
    if (normalized) {
      labels.push(normalized);
    }
  }

  return Array.from(new Set(labels)).slice(0, 3);
}

export function buildImportNotificationText({
  summary = {},
  userInfo = {},
}) {
  const nickname = String(userInfo?.nickName || '').trim();
  const displayName = nickname || '你的账号';
  const total = Number(summary?.total || 0);
  const created = Number(summary?.newRecords || 0);
  const duplicates = Number(summary?.duplicates || 0);
  const partialPoolCount = Number(summary?.partialPools?.length || 0);
  const failedPoolCount = Number(summary?.failedPools?.length || 0);
  const affectedPools = collectAffectedPoolLabels(summary);
  const headline = created > 0 ? '网页数据已更新。' : '网页导入已完成，本次没有新增记录。';

  return [
    headline,
    `账号：${displayName}`,
    total > 0 ? `本次处理：${total} 条` : null,
    `新增记录：${created}`,
    `跳过重复：${duplicates}`,
    affectedPools.length > 0 ? `受影响卡池：${affectedPools.join(' / ')}` : null,
    partialPoolCount > 0 ? `部分成功：${partialPoolCount} 个卡池` : null,
    failedPoolCount > 0 ? `导入失败：${failedPoolCount} 个卡池` : null,
    '',
    '可直接继续查看分析、回到当前池或再次导入。',
  ].filter(Boolean).join('\n');
}

export function buildImportNotificationRows(siteUrl, userInfo = {}, currentTarget = null) {
  const analysisLinks = buildOfficialBotLinks(siteUrl, {
    gameUid: userInfo?.gameUid || userInfo?.hgUid || null,
    poolId: null,
  });
  const currentLinks = buildOfficialBotLinks(siteUrl, {
    gameUid: currentTarget?.gameUid || userInfo?.gameUid || userInfo?.hgUid || null,
    poolId: currentTarget?.poolId || null,
  });

  const rows = [];
  if (analysisLinks.dashboardUrl) {
    rows.push([
      { text: '打开分析', url: analysisLinks.dashboardUrl },
      { text: '当前池', url: currentLinks.dashboardUrl || analysisLinks.dashboardUrl },
    ]);
  }
  if (analysisLinks.importUrl) {
    rows.push([{ text: '继续导入', url: analysisLinks.importUrl }]);
  }

  return rows;
}

export async function resolveCurrentPoolTarget(apiClient, {
  provider = 'telegram',
  platformUserId,
  userInfo = {},
} = {}) {
  const importedGameUid = String(userInfo?.gameUid || userInfo?.hgUid || '').trim() || null;

  if (!apiClient || !platformUserId) {
    return {
      gameUid: importedGameUid,
      poolId: null,
    };
  }

  try {
    const [overview, poolIndex] = await Promise.all([
      apiClient.getSiteOverview(),
      apiClient.getPoolStats({ provider, platformUserId }),
    ]);

    const activePoolIds = new Set(
      (overview?.active_pools || [])
        .map((pool) => String(pool?.pool_id || pool?.id || '').trim())
        .filter(Boolean)
    );
    const flatEntries = (poolIndex?.accounts || []).flatMap((account) => account?.pools || []);
    const preferredEntry = flatEntries.find((entry) => (
      activePoolIds.has(String(entry?.pool_id || entry?.id || entry?.share_target?.pool_id || '').trim())
      && (!importedGameUid || String(entry?.game_uid || entry?.share_target?.game_uid || '').trim() === importedGameUid)
    )) || flatEntries.find((entry) => (
      activePoolIds.has(String(entry?.pool_id || entry?.id || entry?.share_target?.pool_id || '').trim())
    ));

    return {
      gameUid: preferredEntry?.game_uid || preferredEntry?.share_target?.game_uid || importedGameUid,
      poolId: preferredEntry?.pool_id || preferredEntry?.share_target?.pool_id || null,
    };
  } catch {
    return {
      gameUid: importedGameUid,
      poolId: null,
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectDisallowedBrowserOrigin(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization',
  })) {
    return;
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({ success: false, error: 'Missing access token' });
  }

  const callerClient = getSupabaseAnonServerClient();
  const adminClient = getSupabaseAdminClient();
  if (!callerClient || !adminClient) {
    return res.status(503).json({ success: false, error: 'Supabase client not configured' });
  }

  const authResult = await callerClient.auth.getUser(accessToken);
  const callerUser = authResult?.data?.user;
  if (authResult?.error || !callerUser?.id) {
    return res.status(401).json({
      success: false,
      error: authResult?.error?.message || 'Invalid access token',
    });
  }

  const { summary, userInfo } = parseRequestBody(req);
  const telegramToken = String(process.env.TELEGRAM_OFFICIAL_BOT_TOKEN || '').trim();
  const siteUrl = String(process.env.OFFICIAL_BOT_SITE_URL || process.env.VITE_APP_URL || '').trim();

  if (!telegramToken) {
    return res.status(200).json({
      success: true,
      data: {
        notified: false,
        reason: 'telegram_bot_not_configured',
      },
    });
  }

  try {
    const { data: binding, error: bindingError } = await adminClient
      .from('user_platform_bindings')
      .select('platform_user_id, display_handle')
      .eq('user_id', callerUser.id)
      .eq('provider', 'telegram')
      .eq('status', 'verified')
      .limit(1)
      .maybeSingle();

    if (bindingError) {
      throw bindingError;
    }

    if (!binding?.platform_user_id) {
      return res.status(200).json({
        success: true,
        data: {
          notified: false,
          reason: 'telegram_binding_not_found',
        },
      });
    }

    const currentTarget = await resolveCurrentPoolTarget(createImportNotifyApiClient({ siteUrl }), {
      provider: 'telegram',
      platformUserId: binding.platform_user_id,
      userInfo,
    });
    const actionRows = buildImportNotificationRows(siteUrl, userInfo, currentTarget);

    await sendTelegramMessage({
      token: telegramToken,
      chatId: binding.platform_user_id,
      text: buildImportNotificationText({ summary, userInfo }),
      replyMarkup: actionRows.length > 0 ? { inline_keyboard: actionRows } : undefined,
    });

    return res.status(200).json({
      success: true,
      data: {
        notified: true,
        provider: 'telegram',
        display_handle: binding.display_handle || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to notify telegram bot',
    });
  }
}
