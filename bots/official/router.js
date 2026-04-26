import { EndfieldApiError } from './endfieldApiClient.js';
import { buildOfficialBotLinks } from './links.js';
import { parseBotCommand } from './commands.js';
import {
  formatBindInstruction,
  formatCurrentPoolsMessage,
  formatDashboardMessage,
  formatHelpMessage,
  formatNextVersionMessage,
  formatPoolDetailMessage,
  formatPoolsPageMessage,
  formatRankingMessage,
  formatRecentPullsMessage,
  formatVerifySuccess,
} from './formatters.js';

const PROVIDER_LABELS = {
  discord: 'Discord',
  telegram: 'Telegram',
  qq: 'QQ',
};

const SHARE_CALLBACK_PREFIX = 'share';
const DETAIL_CALLBACK_PREFIX = 'detail';
const NAV_CALLBACK_PREFIX = 'nav';
const POOLS_CALLBACK_PREFIX = 'pools';
const PAGE_SIZE = 6;

function getProviderLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || 'BOT';
}

function getChallengeCode(args = []) {
  return String(args[0] || '').trim().toUpperCase();
}

function normalizePoolTarget(target = {}) {
  return {
    gameUid: target?.gameUid ?? target?.game_uid ?? null,
    poolId: target?.poolId ?? target?.pool_id ?? null,
  };
}

function parseRecentLimit(args = []) {
  const value = Number.parseInt(args[0], 10);
  if (!Number.isFinite(value)) {
    return 5;
  }

  return Math.max(1, Math.min(value, 10));
}

function buildShareCallbackData(target = {}) {
  const { gameUid, poolId } = normalizePoolTarget(target);

  if (!poolId) {
    return null;
  }

  return `${SHARE_CALLBACK_PREFIX}|${String(gameUid || '')}|${String(poolId)}`;
}

function buildDetailCallbackData(target = {}) {
  const { gameUid, poolId } = normalizePoolTarget(target);

  if (!poolId) {
    return null;
  }

  return `${DETAIL_CALLBACK_PREFIX}|${String(gameUid || '')}|${String(poolId)}`;
}

function buildNavCallbackData(action) {
  return `${NAV_CALLBACK_PREFIX}|${String(action || 'home')}`;
}

function buildPoolsCallbackData(pageIndex) {
  return `${POOLS_CALLBACK_PREFIX}|${Math.max(0, Number(pageIndex) || 0)}`;
}

function parseShareCallbackData(rawValue) {
  const [prefix, gameUid = '', poolId = ''] = String(rawValue || '').split('|');
  if (prefix !== SHARE_CALLBACK_PREFIX || !poolId) {
    return null;
  }

  return {
    gameUid: gameUid || null,
    poolId,
  };
}

function parseDetailCallbackData(rawValue) {
  const [prefix, gameUid = '', poolId = ''] = String(rawValue || '').split('|');
  if (prefix !== DETAIL_CALLBACK_PREFIX || !poolId) {
    return null;
  }

  return {
    gameUid: gameUid || null,
    poolId,
  };
}

function parseNavCallbackData(rawValue) {
  const [prefix, action = 'home'] = String(rawValue || '').split('|');
  if (prefix !== NAV_CALLBACK_PREFIX || !action) {
    return null;
  }

  return action;
}

function parsePoolsCallbackData(rawValue) {
  const [prefix, rawPage = '0'] = String(rawValue || '').split('|');
  if (prefix !== POOLS_CALLBACK_PREFIX) {
    return null;
  }

  return Math.max(0, Number.parseInt(rawPage, 10) || 0);
}

function isSensitiveCommand(name) {
  return ['bind', 'verify', 'me', 'recent', 'pools', 'current'].includes(name);
}

function buildBindingMissingMessage() {
  return '当前平台账号尚未完成绑定。请先使用 /bind 获取绑定指引。';
}

function mapSharedApiErrorToMessage(error) {
  if (!(error instanceof EndfieldApiError)) {
    return error?.message || '服务暂时不可用，请稍后重试。';
  }

  if (error.status === 429) {
    return '请求过于频繁，请稍后再试。';
  }

  if (error.status === 401 || error.status === 403) {
    return 'BOT 服务鉴权异常，请联系站点管理员检查密钥配置。';
  }

  return error.message || '服务暂时不可用，请稍后重试。';
}

function mapVerifyErrorToMessage(error) {
  if (error instanceof EndfieldApiError && error.status === 404) {
    return '绑定验证码不存在、已失效或已被使用，请回到站点重新生成。';
  }

  if (error instanceof EndfieldApiError && error.status === 409) {
    return '该平台账号已绑定到其他站内账号，当前验证码无法继续使用。';
  }

  if (error instanceof EndfieldApiError && error.status === 410) {
    return '绑定验证码已过期，请回到站点重新生成后再发送。';
  }

  return mapSharedApiErrorToMessage(error);
}

function mapReadErrorToMessage(error) {
  if (error instanceof EndfieldApiError && error.status === 404) {
    if (/Pool detail not found/i.test(error.message || '')) {
      return '当前找不到这个卡池详情，可能是你在该池暂无有效记录。';
    }
    return buildBindingMissingMessage();
  }

  return mapSharedApiErrorToMessage(error);
}

async function tryLoadDashboard(apiClient, provider, platformUserId) {
  try {
    return await apiClient.getDashboard({ provider, platformUserId });
  } catch (error) {
    if (error instanceof EndfieldApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function flattenPoolEntries(poolStats) {
  return (poolStats?.accounts || []).flatMap((account) => (
    (account?.pools || []).map((pool) => ({
      ...pool,
      account_name: pool?.account_name || account?.display_name || account?.game_uid || null,
    }))
  ));
}

function buildUrlRows(siteUrl, { gameUid = null, poolId = null, includeImport = false, includeShare = false } = {}) {
  const links = buildOfficialBotLinks(siteUrl, { gameUid, poolId });
  const rows = [];

  if (links.homeUrl && links.dashboardUrl) {
    rows.push([
      { text: '打开网站', url: links.homeUrl },
      { text: '网页分析', url: links.dashboardUrl },
    ]);
  }

  if (includeShare && links.shareUrl) {
    rows.push([{ text: '网页分享', url: links.shareUrl }]);
  }

  if (includeImport && links.importUrl) {
    rows.push([{ text: '网页导入', url: links.importUrl }]);
  }

  return rows;
}

function buildInlineKeyboard(rows = []) {
  const safeRows = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (!Array.isArray(row)) {
        return [];
      }

      return row.filter((button) => {
        if (!button || typeof button !== 'object') {
          return false;
        }

        if (typeof button.url === 'string' && button.url.trim()) {
          return true;
        }

        if (typeof button.callback_data === 'string' && button.callback_data.trim()) {
          return true;
        }

        return false;
      });
    })
    .filter((row) => row.length > 0);
  if (safeRows.length === 0) {
    return undefined;
  }
  return { inline_keyboard: safeRows };
}

function buildHomeRows({ isBound, siteUrl, recommendedPool = null }) {
  const rows = [];

  if (!isBound) {
    rows.push([{ text: '开始绑定', callback_data: buildNavCallbackData('bind') }]);
    rows.push(...buildUrlRows(siteUrl, { includeImport: true }));
    return rows;
  }

  rows.push([
    { text: '我的概览', callback_data: buildNavCallbackData('me') },
    { text: '当前卡池', callback_data: buildNavCallbackData('current') },
  ]);
  rows.push([
    { text: '各池列表', callback_data: buildNavCallbackData('pools') },
    { text: '下版本情报', callback_data: buildNavCallbackData('next') },
  ]);
  rows.push([{ text: '最近出货', callback_data: buildNavCallbackData('recent') }]);
  rows.push(...buildUrlRows(siteUrl, {
    gameUid: recommendedPool?.game_uid || null,
    poolId: recommendedPool?.pool_id || null,
    includeShare: Boolean(recommendedPool?.pool_id),
    includeImport: true,
  }));
  return rows;
}

function buildPoolsPageRows(pageEntries = [], pageIndex = 0, totalPages = 1, siteUrl) {
  const rows = [];

  pageEntries.forEach((entry) => {
    rows.push([
      {
        text: `详情 · ${entry.display_name || entry.pool_name || '当前卡池'}`.slice(0, 52),
        callback_data: buildDetailCallbackData(entry.share_target || entry),
      },
      {
        text: '分享卡',
        callback_data: buildShareCallbackData(entry.share_target || entry),
      },
    ]);
  });

  if (totalPages > 1) {
    const navRow = [];
    if (pageIndex > 0) {
      navRow.push({ text: '上一页', callback_data: buildPoolsCallbackData(pageIndex - 1) });
    }
    if (pageIndex < totalPages - 1) {
      navRow.push({ text: '下一页', callback_data: buildPoolsCallbackData(pageIndex + 1) });
    }
    if (navRow.length > 0) {
      rows.push(navRow);
    }
  }

  rows.push([{ text: '返回首页', callback_data: buildNavCallbackData('home') }]);
  rows.push(...buildUrlRows(siteUrl, { includeImport: true }));
  return rows;
}

function buildPoolDetailRows(detail, siteUrl) {
  const target = detail?.pool?.share_target || {};
  const normalizedTarget = normalizePoolTarget(target);
  const rows = [
    [
      { text: '发送分享卡', callback_data: buildShareCallbackData(target) },
      { text: '返回池列表', callback_data: buildNavCallbackData('pools') },
    ],
    ...buildUrlRows(siteUrl, {
      gameUid: normalizedTarget.gameUid,
      poolId: normalizedTarget.poolId,
      includeShare: Boolean(normalizedTarget.poolId),
      includeImport: false,
    }),
  ];

  return rows;
}

function buildCurrentRows({ overview, poolStats, siteUrl }) {
  const rows = [];
  const activePools = Array.isArray(overview?.active_pools) ? overview.active_pools : [];
  const flatEntries = flattenPoolEntries(poolStats);

  activePools.forEach((pool) => {
    flatEntries
      .filter((entry) => entry.pool_id === pool.pool_id)
      .slice(0, 3)
      .forEach((matched) => {
        const accountLabel = matched.account_name ? ` · ${matched.account_name}` : '';
        rows.push([
          { text: `详情 · ${matched.display_name || matched.pool_name || '当前卡池'}${accountLabel}`.slice(0, 52), callback_data: buildDetailCallbackData(matched.share_target || matched) },
          { text: '分享卡', callback_data: buildShareCallbackData(matched.share_target || matched) },
        ]);
      });
  });

  rows.push([{ text: '各池列表', callback_data: buildNavCallbackData('pools') }]);
  rows.push(...buildUrlRows(siteUrl, {
    gameUid: poolStats?.latest_pool?.game_uid || null,
    poolId: poolStats?.latest_pool?.pool_id || null,
    includeShare: Boolean(poolStats?.latest_pool?.pool_id),
    includeImport: true,
  }));
  return rows;
}

function buildRecentRows(records = [], siteUrl) {
  const rows = [];
  records.slice(0, 5).forEach((record) => {
    rows.push([
      {
        text: `详情 · ${record.display_name || record.pool_name || '对应卡池'}`.slice(0, 52),
        callback_data: buildDetailCallbackData(record.share_target || record),
      },
      {
        text: '分享卡',
        callback_data: buildShareCallbackData(record.share_target || record),
      },
    ]);
  });
  rows.push(...buildUrlRows(siteUrl, {
    gameUid: records[0]?.game_uid || null,
    poolId: records[0]?.pool_id || null,
    includeShare: Boolean(records[0]?.pool_id),
    includeImport: true,
  }));
  return rows;
}

function buildNextRows(overview, siteUrl) {
  const nextPool = overview?.next_limited_pool || null;
  const rows = [];
  if (nextPool?.pool_id) {
    rows.push(...buildUrlRows(siteUrl, {
      poolId: nextPool.pool_id,
      includeShare: false,
      includeImport: false,
    }));
  } else {
    rows.push(...buildUrlRows(siteUrl, { includeImport: true }));
  }
  return rows;
}

function buildRankingRows(siteUrl) {
  return [
    ...buildUrlRows(siteUrl, { includeImport: false, includeShare: false }),
    [{ text: '返回首页', callback_data: buildNavCallbackData('home') }],
  ];
}

function paginatePoolEntries(entries = [], pageIndex = 0) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const totalPages = Math.max(1, Math.ceil(safeEntries.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(pageIndex, totalPages - 1));
  const start = safePage * PAGE_SIZE;
  return {
    pageEntries: safeEntries.slice(start, start + PAGE_SIZE),
    pageIndex: safePage,
    totalPages,
  };
}

export function createOfficialBotRouter({
  provider,
  apiClient,
  siteUrl,
  shareCardService = null,
}) {
  const providerLabel = getProviderLabel(provider);

  async function renderHome({ platformUserId }) {
    const dashboard = await tryLoadDashboard(apiClient, provider, platformUserId);
    return {
      text: formatHelpMessage({ providerLabel, siteUrl, dashboard }),
      replyMarkup: buildInlineKeyboard(buildHomeRows({
        isBound: Boolean(dashboard),
        siteUrl,
        recommendedPool: dashboard?.summary?.recommended_pool || null,
      })),
    };
  }

  async function renderBind({ platformUserId }) {
    const dashboard = await tryLoadDashboard(apiClient, provider, platformUserId);
    return {
      text: formatBindInstruction({ providerLabel, siteUrl, dashboard }),
      replyMarkup: buildInlineKeyboard(buildHomeRows({
        isBound: Boolean(dashboard),
        siteUrl,
        recommendedPool: dashboard?.summary?.recommended_pool || null,
      })),
    };
  }

  async function renderDashboard({ platformUserId }) {
    const dashboard = await apiClient.getDashboard({ provider, platformUserId });
    return {
      text: formatDashboardMessage(dashboard),
      replyMarkup: buildInlineKeyboard(buildHomeRows({
        isBound: true,
        siteUrl,
        recommendedPool: dashboard?.summary?.recommended_pool || null,
      })),
    };
  }

  async function renderPools({ platformUserId, pageIndex = 0 }) {
    const poolStats = await apiClient.getPoolStats({ provider, platformUserId });
    const allEntries = flattenPoolEntries(poolStats);
    const page = paginatePoolEntries(allEntries, pageIndex);
    return {
      text: formatPoolsPageMessage({
        accounts: poolStats?.accounts || [],
        pageEntries: page.pageEntries,
        pageIndex: page.pageIndex,
        totalPages: page.totalPages,
      }),
      replyMarkup: buildInlineKeyboard(buildPoolsPageRows(page.pageEntries, page.pageIndex, page.totalPages, siteUrl)),
    };
  }

  async function renderPoolDetail({ platformUserId, gameUid, poolId }) {
    const detail = await apiClient.getPoolDetail({
      provider,
      platformUserId,
      gameUid,
      poolId,
    });
    return {
      text: formatPoolDetailMessage(detail),
      replyMarkup: buildInlineKeyboard(buildPoolDetailRows(detail, siteUrl)),
    };
  }

  async function renderCurrent({ platformUserId }) {
    const [overview, poolStats] = await Promise.all([
      apiClient.getSiteOverview(),
      apiClient.getPoolStats({ provider, platformUserId }),
    ]);

    return {
      text: formatCurrentPoolsMessage({ overview, poolStats }),
      replyMarkup: buildInlineKeyboard(buildCurrentRows({ overview, poolStats, siteUrl })),
    };
  }

  async function renderRecent({ platformUserId, limit = 5 }) {
    const result = await apiClient.getRecentPulls({ provider, platformUserId, limit });
    return {
      text: formatRecentPullsMessage(result, limit),
      replyMarkup: buildInlineKeyboard(buildRecentRows(result?.records || [], siteUrl)),
    };
  }

  async function renderNext() {
    const overview = await apiClient.getSiteOverview();
    return {
      text: formatNextVersionMessage(overview),
      replyMarkup: buildInlineKeyboard(buildNextRows(overview, siteUrl)),
    };
  }

  async function renderRank() {
    const ranking = await apiClient.getRankings();
    return {
      text: formatRankingMessage(ranking),
      replyMarkup: buildInlineKeyboard(buildRankingRows(siteUrl)),
    };
  }

  async function dispatchNavAction(action, context) {
    switch (action) {
      case 'bind':
        return renderBind(context);
      case 'me':
        return renderDashboard(context);
      case 'current':
        return renderCurrent(context);
      case 'next':
        return renderNext(context);
      case 'recent':
        return renderRecent(context);
      case 'pools':
        return renderPools(context);
      case 'home':
      default:
        return renderHome(context);
    }
  }

  return {
    async handleMessage({
      text,
      platformUserId,
      displayHandle,
      isPrivateChat = true,
    }) {
      const command = parseBotCommand(text);

      if (!isPrivateChat && isSensitiveCommand(command.name)) {
        return {
          text: '涉及绑定或本人数据，请改为私聊官方 BOT 继续操作。',
        };
      }

      try {
        switch (command.name) {
          case 'start':
          case 'help':
            return await renderHome({ platformUserId });
          case 'bind':
            return await renderBind({ platformUserId });
          case 'verify': {
            const challengeCode = getChallengeCode(command.args);
            if (!challengeCode) {
              return {
                text: '请附上 8 位绑定验证码，例如：/verify ABCD1234',
              };
            }

            const result = await apiClient.verifyBinding({
              provider,
              challengeCode,
              platformUserId,
              displayHandle,
            });
            return {
              text: formatVerifySuccess({
                providerLabel,
                displayHandle: result?.binding?.display_handle || displayHandle,
              }),
              replyMarkup: buildInlineKeyboard(buildHomeRows({
                isBound: true,
                siteUrl,
              })),
            };
          }
          case 'me':
            return await renderDashboard({ platformUserId });
          case 'pools':
            return await renderPools({ platformUserId });
          case 'current':
            return await renderCurrent({ platformUserId });
          case 'next':
            return await renderNext();
          case 'recent':
            return await renderRecent({ platformUserId, limit: parseRecentLimit(command.args) });
          case 'rank':
            return await renderRank();
          case 'unknown':
            if (!isPrivateChat) {
              return null;
            }
            return await renderHome({ platformUserId });
          default:
            return {
              text: '暂不支持这个命令。输入 /help 查看可用命令。',
            };
        }
      } catch (error) {
        return {
          text: command.name === 'verify'
            ? mapVerifyErrorToMessage(error)
            : mapReadErrorToMessage(error),
        };
      }
    },

    async handleCallback({
      data,
      platformUserId,
      isPrivateChat = true,
    }) {
      if (!isPrivateChat) {
        return {
          ackText: '请改为私聊官方 BOT 使用完整功能。',
        };
      }

      const shareParams = parseShareCallbackData(data);
      if (shareParams) {
        if (!shareCardService?.buildPoolShareCard) {
          return {
            ackText: '分享卡功能尚未启用。',
          };
        }

        try {
          const media = await shareCardService.buildPoolShareCard({
            provider,
            platformUserId,
            gameUid: shareParams.gameUid,
            poolId: shareParams.poolId,
          });

          return {
            ackText: '正在发送分享卡…',
            media,
          };
        } catch (error) {
          return {
            ackText: mapReadErrorToMessage(error),
          };
        }
      }

      const detailParams = parseDetailCallbackData(data);
      if (detailParams) {
        try {
          const reply = await renderPoolDetail({
            platformUserId,
            gameUid: detailParams.gameUid,
            poolId: detailParams.poolId,
          });
          return {
            ackText: '已打开卡池详情',
            ...reply,
          };
        } catch (error) {
          return {
            ackText: mapReadErrorToMessage(error),
          };
        }
      }

      const pageIndex = parsePoolsCallbackData(data);
      if (pageIndex !== null) {
        try {
          const reply = await renderPools({ platformUserId, pageIndex });
          return {
            ackText: '已切换页面',
            ...reply,
          };
        } catch (error) {
          return {
            ackText: mapReadErrorToMessage(error),
          };
        }
      }

      const navAction = parseNavCallbackData(data);
      if (navAction) {
        try {
          const reply = await dispatchNavAction(navAction, { platformUserId });
          return {
            ackText: '已更新',
            ...reply,
          };
        } catch (error) {
          return {
            ackText: mapReadErrorToMessage(error),
          };
        }
      }

      return {
        ackText: '暂不支持这个按钮。',
      };
    },
  };
}

export default {
  createOfficialBotRouter,
};
