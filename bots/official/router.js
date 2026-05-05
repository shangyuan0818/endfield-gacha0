import { EndfieldApiError } from './endfieldApiClient.js';
import { buildOfficialBotLinks } from './links.js';
import { parseBotCommand } from './commands.js';

const PROVIDER_LABELS = {
  discord: 'Discord',
  telegram: 'Telegram',
  qq: 'QQ',
};

const PAGE_SIZE = 6;
const NAV_PREFIX = 'nav';
const ACCOUNT_PREFIX = 'acct';
const POOL_PREFIX = 'pool';
const SHARE_PREFIX = 'share';
const LOG_PREFIX = 'log';
const PAGE_PREFIX = 'page';

function getProviderLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || 'BOT';
}

function getChallengeCode(args = []) {
  return String(args[0] || '').trim().toUpperCase();
}

function formatPercent(value = 0) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatPoolType(type) {
  if (type === 'weapon') return '武器池';
  if (type === 'standard') return '常驻池';
  if (type === 'extra') return '附加寻访';
  return '限定池';
}

function formatStatus(pool = {}) {
  if (pool.status === 'active') return pool.remaining_label ? `活动中 · ${pool.remaining_label}` : '活动中';
  if (pool.status === 'upcoming') return pool.remaining_label ? `即将开始 · ${pool.remaining_label}` : '即将开始';
  if (pool.status === 'ended') return '已结束';
  return '长期开放';
}

function safeName(value, fallback = '未命名账号') {
  const text = String(value || '').trim();
  return text || fallback;
}

function callback(prefix, ...parts) {
  return [prefix, ...parts.map((part) => String(part ?? ''))].join('|');
}

function getPoolActionRef(poolOrRef, action = 'detail') {
  if (typeof poolOrRef === 'string') {
    return poolOrRef.trim();
  }

  const actionKey = `${action}_ref`;
  return String(poolOrRef?.actions?.[actionKey] || poolOrRef?.ref || '').trim();
}

function parseCallback(data) {
  const [prefix = '', ...parts] = String(data || '').split('|');
  return { prefix, parts };
}

function buildInlineKeyboard(rows = []) {
  const safeRows = rows
    .map((row) => (Array.isArray(row) ? row : [])
      .filter((button) => {
        if (!button?.text) return false;
        if (typeof button.url === 'string' && button.url.trim()) return true;
        if (typeof button.callback_data === 'string' && button.callback_data.trim()) return true;
        return false;
      }))
    .filter((row) => row.length > 0);

  return safeRows.length > 0 ? { inline_keyboard: safeRows } : undefined;
}

function buildSiteRows(siteUrl, { importEntry = false } = {}) {
  const links = buildOfficialBotLinks(siteUrl);
  const rows = [];
  if (links.homeUrl) {
    rows.push([{ text: '打开网站', url: links.homeUrl }]);
  }
  if (importEntry && links.importUrl) {
    rows.push([{ text: '网页导入', url: links.importUrl }]);
  }
  return rows;
}

function buildHomeRows({ isBound, siteUrl }) {
  if (!isBound) {
    return [
      [{ text: '开始绑定', callback_data: callback(NAV_PREFIX, 'bind') }],
      ...buildSiteRows(siteUrl, { importEntry: true }),
    ];
  }

  return [
    [
      { text: '我的概览', callback_data: callback(NAV_PREFIX, 'me') },
      { text: '各池列表', callback_data: callback(NAV_PREFIX, 'pools') },
    ],
    [
      { text: '当前卡池', callback_data: callback(NAV_PREFIX, 'current') },
      { text: '最近出货', callback_data: callback(NAV_PREFIX, 'recent') },
    ],
    [
      { text: '下版本情报', callback_data: callback(NAV_PREFIX, 'next') },
      { text: '公开榜单', callback_data: callback(NAV_PREFIX, 'rank') },
    ],
    ...buildSiteRows(siteUrl, { importEntry: true }),
  ];
}

function buildDetailRows(poolOrRef, siteUrl) {
  const detailRef = getPoolActionRef(poolOrRef, 'detail');
  const shareRef = getPoolActionRef(poolOrRef, 'share');
  const logRef = getPoolActionRef(poolOrRef, 'log');

  return [
    [
      { text: '发送分享图', callback_data: callback(SHARE_PREFIX, shareRef) },
      { text: '导出日志', callback_data: callback(LOG_PREFIX, logRef, 'csv') },
    ],
    [
      { text: '返回池列表', callback_data: callback(NAV_PREFIX, 'pools') },
      { text: '回到首页', callback_data: callback(NAV_PREFIX, 'home') },
    ],
    ...buildSiteRows(siteUrl, { importEntry: false }),
  ];
}

function flattenPools(analysis) {
  return (analysis?.navigation?.accounts || []).flatMap((account) => (
    (account.pools || []).map((pool) => ({
      ...pool,
      account_ref: account.ref,
      account_name: account.display_name,
    }))
  ));
}

function paginate(items = [], pageIndex = 0) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(Number(pageIndex) || 0, totalPages - 1));
  return {
    pageIndex: safePage,
    totalPages,
    items: items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
  };
}

function buildPoolsRows({ analysis, pageIndex = 0 }) {
  const pools = flattenPools(analysis);
  const page = paginate(pools, pageIndex);
  const rows = [];

  (analysis?.navigation?.accounts || []).forEach((account) => {
    rows.push([{ text: `账号 · ${safeName(account.display_name)}`.slice(0, 52), callback_data: callback(ACCOUNT_PREFIX, account.ref) }]);
  });

  page.items.forEach((pool) => {
    rows.push([
      { text: `详情 · ${safeName(pool.display_name, '未知卡池')}`.slice(0, 52), callback_data: callback(POOL_PREFIX, getPoolActionRef(pool, 'detail')) },
      { text: '分享图', callback_data: callback(SHARE_PREFIX, getPoolActionRef(pool, 'share')) },
    ]);
  });

  if (page.totalPages > 1) {
    const nav = [];
    if (page.pageIndex > 0) nav.push({ text: '上一页', callback_data: callback(PAGE_PREFIX, page.pageIndex - 1) });
    if (page.pageIndex < page.totalPages - 1) nav.push({ text: '下一页', callback_data: callback(PAGE_PREFIX, page.pageIndex + 1) });
    rows.push(nav);
  }

  rows.push([{ text: '返回首页', callback_data: callback(NAV_PREFIX, 'home') }]);
  return {
    rows,
    page,
  };
}

function buildAccountRows(analysis, accountRef) {
  const account = (analysis?.navigation?.accounts || []).find((item) => item.ref === accountRef);
  if (!account) {
    return {
      text: '没有找到这个账号。请重新打开各池列表。',
      rows: [[{ text: '各池列表', callback_data: callback(NAV_PREFIX, 'pools') }]],
    };
  }

  const rows = (account.pools || []).slice(0, 8).map((pool) => ([
    { text: `详情 · ${safeName(pool.display_name, '未知卡池')}`.slice(0, 52), callback_data: callback(POOL_PREFIX, getPoolActionRef(pool, 'detail')) },
    { text: '分享图', callback_data: callback(SHARE_PREFIX, getPoolActionRef(pool, 'share')) },
  ]));
  rows.push([{ text: '返回全部账号', callback_data: callback(NAV_PREFIX, 'pools') }]);

  const lines = [
    `账号：${safeName(account.display_name)}`,
    `总抽数：${account.total_pulls || 0}`,
    '',
    ...(account.pools || []).slice(0, 8).map((pool, index) => (
      `${index + 1}. ${safeName(pool.display_name, '未知卡池')} · ${formatPoolType(pool.pool_type)} · 垫抽 ${pool.current_pity || 0} · ${formatPercent(pool.current_probability)}`
    )),
  ];

  return {
    text: lines.join('\n'),
    rows,
  };
}

function formatTimelinePreview(sections = []) {
  const entries = sections.flatMap((section) => section.entries || []).slice(0, 5);
  if (entries.length === 0) {
    return ['时间线：暂无可展示节点'];
  }

  return [
    '时间线预览：',
    ...entries.map((entry, index) => {
      const result = entry.resultSummaryWithoutFiveStar || entry.resultSummary || '无摘要';
      return `${index + 1}. ${entry.dateLabel || '--'} · ${entry.stageLabel || '节点'} · ${entry.pulls || 0} 抽\n   ${result}`;
    }),
  ];
}

function formatMetricItems(title, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return [
    title,
    ...items.slice(0, 6).map((item) => `${item.label}：${item.value}${item.hint ? `（${item.hint}）` : ''}`),
  ];
}

function formatAnalysisHome({ providerLabel, siteUrl, analysis = null }) {
  if (!analysis) {
    return [
      `终末地官方 ${providerLabel} BOT`,
      '当前状态：未绑定',
      '',
      '我可以在绑定后读取你的网页分析数据：切换账号、查看卡池详情、生成网页同款分享图、导出单池详细日志。',
      '',
      '请先在网站设置页生成绑定验证码，然后直接发给我。',
      `网站入口：${siteUrl}`,
    ].join('\n');
  }

  const account = analysis.selected?.account || analysis.navigation?.accounts?.[0] || {};
  const detail = analysis.selected?.detail || {};
  const pool = analysis.selected?.pool || detail.pool || {};

  return [
    `终末地官方 ${providerLabel} BOT`,
    `当前状态：已绑定 ${safeName(account.display_name, analysis.user?.username || '站内账号')}`,
    '',
    `当前入口：${safeName(pool.display_name, '暂无卡池')}`,
    `已记录账号：${analysis.navigation?.accounts?.length || 0}`,
    '',
    '可用能力：',
    '1. 切换账号和卡池',
    '2. 查看卡池分析页核心统计与时间线',
    '3. 发送网页同款分享图',
    '4. 导出单池详细日志文件',
    '5. 查看最近出货、下版本情报和公开榜单',
    '',
    `网站入口：${siteUrl}`,
  ].join('\n');
}

function formatBindMessage({ providerLabel, siteUrl, analysis = null }) {
  if (analysis) {
    const account = analysis.selected?.account || analysis.navigation?.accounts?.[0] || {};
    return [
      `${providerLabel} 账号已绑定。`,
      `当前主账号：${safeName(account.display_name, analysis.user?.username || '站内账号')}`,
      '',
      '如需重绑，请在网站设置页重新生成验证码后再发送给我。',
      `网站入口：${siteUrl}`,
    ].join('\n');
  }

  return [
    `请在网站中生成 ${providerLabel} 绑定验证码。`,
    '路径：设置 > 第三方账号绑定 > 选择对应平台 > 生成验证码',
    '',
    '生成后直接发送 8 位验证码，或使用：/verify ABCD1234',
    `网站入口：${siteUrl}`,
  ].join('\n');
}

function formatMe(analysis) {
  const account = analysis.selected?.account || analysis.navigation?.accounts?.[0] || {};
  const detail = analysis.selected?.detail || {};
  const pool = analysis.selected?.pool || detail.pool || {};
  const stats = detail.stats || {};
  const latest = detail.recent_records?.[0] || null;

  return [
    `${safeName(account.display_name, analysis.user?.username || '未命名账号')} 的账号概览`,
    `站内用户名：${analysis.user?.username || '未设置'}`,
    `当前卡池：${safeName(pool.display_name, '暂无卡池')} · ${formatPoolType(pool.pool_type)}`,
    `当前垫抽：${stats.current_pity || pool.current_pity || 0}`,
    `当前 6★ 概率：${formatPercent(stats.current_probability ?? pool.current_probability)}`,
    `本池总抽数：${stats.total_pulls || pool.total_pulls || 0}`,
    `累计 6★：${stats.six_star_total || 0}`,
    latest ? `最近高价值出货：${latest.item_name} (${latest.rarity}★)` : '最近高价值出货：暂无记录',
  ].join('\n');
}

function formatPools(analysis, pageIndex = 0) {
  const { page } = buildPoolsRows({ analysis, pageIndex });
  if (page.items.length === 0) {
    return '当前没有可展示的卡池记录。请先在网页导入抽卡数据。';
  }

  const lines = [`各池列表（第 ${page.pageIndex + 1} / ${page.totalPages} 页）`];
  let currentAccount = '';
  page.items.forEach((pool, index) => {
    if (pool.account_name !== currentAccount) {
      currentAccount = pool.account_name;
      lines.push('');
      lines.push(`账号：${safeName(currentAccount)}`);
    }
    lines.push(`${index + 1}. ${safeName(pool.display_name, '未知卡池')} · ${formatPoolType(pool.pool_type)} · 垫抽 ${pool.current_pity || 0} · ${formatPercent(pool.current_probability)} · ${formatStatus(pool)}`);
  });

  return lines.join('\n');
}

function formatDetail(detail) {
  if (!detail) {
    return '当前找不到这个卡池详情。';
  }

  const account = detail.account || {};
  const pool = detail.pool || {};
  const stats = detail.stats || {};
  const payload = detail.share_payload || {};
  const featured = Array.isArray(pool.featured) && pool.featured.length > 0
    ? `UP / 名单：${pool.featured.join(' / ')}`
    : null;
  const latest = detail.recent_records?.[0] || null;

  return [
    `${safeName(pool.display_name, '未知卡池')} · ${formatPoolType(pool.pool_type)}`,
    `账号：${safeName(account.display_name)}`,
    formatStatus(pool),
    featured,
    '',
    `当前 6★ 概率：${formatPercent(stats.current_probability)}`,
    `当前 6★ 垫抽：${stats.current_pity || 0}`,
    `当前 5★ 垫抽：${stats.current_pity5 || 0}`,
    `本池总抽数：${stats.total_pulls || 0}`,
    `累计 6★：${stats.six_star_total || 0}`,
    `目标 / UP 6★：${stats.up_six_star_count || 0}`,
    `偏移 / 常驻 6★：${stats.off_six_star_count || 0}`,
    `5★ 数量：${stats.five_star_count || 0}`,
    Number.isFinite(Number(stats.win_rate)) ? `目标 6★ 占比：${Number(stats.win_rate).toFixed(1)}%` : null,
    '',
    latest ? `最近出货：${latest.item_name} (${latest.rarity}★)` : '最近出货：暂无高价值记录',
    '',
    ...formatMetricItems('平均表现：', payload.averageItems),
    ...formatMetricItems('资源摘要：', payload.resourceItems),
    '',
    ...formatTimelinePreview(detail.timeline_sections),
  ].filter(Boolean).join('\n');
}

function formatCurrent(analysis) {
  const activePools = flattenPools(analysis).filter((pool) => pool.is_active);
  if (activePools.length === 0) {
    return '当前没有匹配到活动池的个人记录。可以使用“各池列表”查看全部已记录卡池。';
  }

  return [
    '当前活动池',
    '',
    ...activePools.map((pool) => (
      `${safeName(pool.account_name)} · ${safeName(pool.display_name, '未知卡池')}\n${formatPoolType(pool.pool_type)} · 垫抽 ${pool.current_pity || 0} · 当前 6★ 概率 ${formatPercent(pool.current_probability)} · ${formatStatus(pool)}`
    )),
  ].join('\n\n');
}

function formatRecent(result, limit) {
  const records = Array.isArray(result?.records) ? result.records.slice(0, limit) : [];
  if (records.length === 0) {
    return '当前没有可展示的最近出货记录。';
  }

  return [
    `最近 ${records.length} 条高价值记录：`,
    ...records.map((record, index) => (
      `${index + 1}. ${record.item_name} (${record.rarity}★) · ${record.display_name || record.pool_name || '未知卡池'} · ${safeName(record.account_name)}`
    )),
  ].join('\n');
}

function formatCountdown(countdown) {
  if (!countdown) return '时间待确认';
  if (countdown.has_started) return '已到达';
  const parts = [];
  if (countdown.days > 0) parts.push(`${countdown.days}天`);
  if (countdown.hours > 0 || countdown.days > 0) parts.push(`${countdown.hours}小时`);
  parts.push(`${countdown.minutes || 0}分钟`);
  return parts.join('');
}

function formatNext(overview) {
  const nextVersion = overview?.next_version || {};
  const nextPool = overview?.next_limited_pool || null;
  const featured = Array.isArray(nextPool?.featured_characters) ? nextPool.featured_characters.filter(Boolean) : [];
  return [
    '下版本情报',
    `预计开始：${nextVersion.target_at || '待公布'}`,
    `剩余时间：${formatCountdown(nextVersion.countdown)}`,
    `下一池：${nextPool?.name || '待配置'}`,
    nextPool?.type ? `池型：${formatPoolType(nextPool.type)}` : null,
    featured.length > 0 ? `UP / 名单：${featured.join(' / ')}` : '名单：待配置',
  ].filter(Boolean).join('\n');
}

function formatRankings(ranking) {
  function list(title, items = []) {
    const safeItems = Array.isArray(items) ? items.slice(0, 3) : [];
    if (safeItems.length === 0) return `${title}：暂无数据`;
    return [title, ...safeItems.map((item, index) => `${index + 1}. ${item.name} ×${item.count}`)].join('\n');
  }

  return [
    '公开榜单摘录',
    list('限定池 UP 6★', ranking?.limited?.sixStarUp),
    list('常驻池 6★', ranking?.standard?.sixStar),
    list('武器池 UP 6★', ranking?.weapon?.sixStarUp),
  ].join('\n\n');
}

function mapError(error) {
  if (error instanceof EndfieldApiError) {
    if (error.status === 404) return '当前平台账号尚未完成绑定。请先使用 /bind 获取绑定指引。';
    if (error.status === 429) return '请求过于频繁，请稍后再试。';
    if (error.status === 401 || error.status === 403) return 'BOT 服务鉴权异常，请联系站点管理员检查密钥配置。';
  }
  return error?.message || '服务暂时不可用，请稍后重试。';
}

export function createOfficialBotRouter({
  provider,
  apiClient,
  siteUrl,
}) {
  const providerLabel = getProviderLabel(provider);

  async function loadAnalysis(platformUserId, selection = {}) {
    return apiClient.getAnalysis({
      provider,
      platformUserId,
      ...selection,
    });
  }

  async function tryLoadAnalysis(platformUserId, selection = {}) {
    try {
      return await loadAnalysis(platformUserId, selection);
    } catch (error) {
      if (error instanceof EndfieldApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async function renderHome(platformUserId) {
    const analysis = await tryLoadAnalysis(platformUserId);
    return {
      text: formatAnalysisHome({ providerLabel, siteUrl, analysis }),
      replyMarkup: buildInlineKeyboard(buildHomeRows({ isBound: Boolean(analysis), siteUrl })),
    };
  }

  async function renderBind(platformUserId) {
    const analysis = await tryLoadAnalysis(platformUserId);
    return {
      text: formatBindMessage({ providerLabel, siteUrl, analysis }),
      replyMarkup: buildInlineKeyboard(buildHomeRows({ isBound: Boolean(analysis), siteUrl })),
    };
  }

  async function renderMe(platformUserId) {
    const analysis = await loadAnalysis(platformUserId);
    const selectedPool = analysis.selected?.pool || analysis.selected?.detail?.pool || null;
    return {
      text: formatMe(analysis),
      replyMarkup: buildInlineKeyboard(selectedPool ? buildDetailRows(selectedPool, siteUrl) : buildHomeRows({ isBound: true, siteUrl })),
    };
  }

  async function renderPools(platformUserId, pageIndex = 0) {
    const analysis = await loadAnalysis(platformUserId);
    const { rows } = buildPoolsRows({ analysis, pageIndex });
    return {
      text: formatPools(analysis, pageIndex),
      replyMarkup: buildInlineKeyboard(rows),
    };
  }

  async function renderAccount(platformUserId, accountRef) {
    const analysis = await loadAnalysis(platformUserId, { accountRef });
    const result = buildAccountRows(analysis, accountRef);
    return {
      text: result.text,
      replyMarkup: buildInlineKeyboard(result.rows),
    };
  }

  async function renderPool(platformUserId, poolRef) {
    const analysis = await loadAnalysis(platformUserId, { poolRef });
    const detail = analysis.selected?.detail || null;
    const selectedPool = detail?.pool || analysis.selected?.pool || { ref: poolRef };
    return {
      text: formatDetail(detail),
      replyMarkup: buildInlineKeyboard(buildDetailRows(selectedPool, siteUrl)),
    };
  }

  async function renderCurrent(platformUserId) {
    const analysis = await loadAnalysis(platformUserId);
    return {
      text: formatCurrent(analysis),
      replyMarkup: buildInlineKeyboard(buildHomeRows({ isBound: true, siteUrl })),
    };
  }

  async function renderRecent(platformUserId, limit = 5) {
    const result = await apiClient.getRecentPulls({ provider, platformUserId, limit });
    return {
      text: formatRecent(result, limit),
      replyMarkup: buildInlineKeyboard(buildHomeRows({ isBound: true, siteUrl })),
    };
  }

  async function renderNext() {
    const overview = await apiClient.getSiteOverview();
    return {
      text: formatNext(overview),
      replyMarkup: buildInlineKeyboard(buildSiteRows(siteUrl)),
    };
  }

  async function renderRank() {
    const ranking = await apiClient.getRankings();
    return {
      text: formatRankings(ranking),
      replyMarkup: buildInlineKeyboard(buildSiteRows(siteUrl)),
    };
  }

  async function renderShare(platformUserId, poolRef) {
    const media = await apiClient.getShareCard({ provider, platformUserId, poolRef });
    return {
      text: '分享图已生成。',
      media,
      replyMarkup: buildInlineKeyboard(buildDetailRows({ ref: poolRef }, siteUrl)),
    };
  }

  async function renderLog(platformUserId, poolRef, format = 'csv') {
    const media = await apiClient.getPoolLog({ provider, platformUserId, poolRef, format });
    return {
      text: '详细日志已导出。',
      media,
      replyMarkup: buildInlineKeyboard(buildDetailRows({ ref: poolRef }, siteUrl)),
    };
  }

  async function verify({ challengeCode, platformUserId, displayHandle }) {
    const result = await apiClient.verifyBinding({
      provider,
      challengeCode,
      platformUserId,
      displayHandle,
    });

    return {
      text: [
        `${providerLabel} 账号绑定成功。`,
        result?.binding?.display_handle ? `平台昵称：${result.binding.display_handle}` : null,
        '现在可以查看账号总览、切换卡池、生成分享图和导出详细日志。',
      ].filter(Boolean).join('\n'),
      replyMarkup: buildInlineKeyboard(buildHomeRows({ isBound: true, siteUrl })),
    };
  }

  function ensurePrivate(commandName, isPrivateChat) {
    const sensitive = ['bind', 'verify', 'me', 'recent', 'pools', 'current', 'share', 'log'].includes(commandName);
    if (sensitive && !isPrivateChat) {
      return {
        text: '该操作包含你的个人抽卡数据。请私聊官方 BOT 使用。',
        replyMarkup: buildInlineKeyboard(buildSiteRows(siteUrl, { importEntry: true })),
      };
    }
    return null;
  }

  async function handleMessage(message) {
    const command = parseBotCommand(message.text);
    const blocked = ensurePrivate(command.name, message.isPrivateChat);
    if (blocked) return blocked;

    try {
      switch (command.name) {
        case 'start':
        case 'help':
          return await renderHome(message.platformUserId);
        case 'bind':
          return await renderBind(message.platformUserId);
        case 'verify':
          return await verify({
            challengeCode: getChallengeCode(command.args),
            platformUserId: message.platformUserId,
            displayHandle: message.displayHandle,
          });
        case 'me':
          return await renderMe(message.platformUserId);
        case 'pools':
          return await renderPools(message.platformUserId, Number.parseInt(command.args?.[0], 10) || 0);
        case 'current':
          return await renderCurrent(message.platformUserId);
        case 'recent':
          return await renderRecent(message.platformUserId, Math.max(1, Math.min(Number.parseInt(command.args?.[0], 10) || 5, 10)));
        case 'next':
          return await renderNext();
        case 'rank':
          return await renderRank();
        case 'share': {
          const analysis = await loadAnalysis(message.platformUserId);
          const poolRef = analysis.selected?.pool?.ref || analysis.selected?.detail?.pool?.ref;
          return renderShare(message.platformUserId, poolRef);
        }
        case 'log': {
          const analysis = await loadAnalysis(message.platformUserId);
          const poolRef = analysis.selected?.pool?.ref || analysis.selected?.detail?.pool?.ref;
          return renderLog(message.platformUserId, poolRef, command.args?.[0] || 'csv');
        }
        default:
          return {
            text: '没有识别这个命令。可用命令：/me /pools /current /recent /share /log /next /rank',
            replyMarkup: buildInlineKeyboard(buildHomeRows({ isBound: false, siteUrl })),
          };
      }
    } catch (error) {
      return {
        text: mapError(error),
        replyMarkup: buildInlineKeyboard(buildSiteRows(siteUrl, { importEntry: true })),
      };
    }
  }

  async function handleCallback(callbackEnvelope) {
    const parsed = parseCallback(callbackEnvelope.data);
    try {
      switch (parsed.prefix) {
        case NAV_PREFIX: {
          const action = parsed.parts[0] || 'home';
          if (action === 'home') return { ...(await renderHome(callbackEnvelope.platformUserId)), ackText: '已返回首页' };
          if (action === 'bind') return { ...(await renderBind(callbackEnvelope.platformUserId)), ackText: '绑定指引' };
          if (action === 'me') return { ...(await renderMe(callbackEnvelope.platformUserId)), ackText: '账号概览' };
          if (action === 'pools') return { ...(await renderPools(callbackEnvelope.platformUserId)), ackText: '各池列表' };
          if (action === 'current') return { ...(await renderCurrent(callbackEnvelope.platformUserId)), ackText: '当前卡池' };
          if (action === 'recent') return { ...(await renderRecent(callbackEnvelope.platformUserId)), ackText: '最近出货' };
          if (action === 'next') return { ...(await renderNext()), ackText: '下版本情报' };
          if (action === 'rank') return { ...(await renderRank()), ackText: '公开榜单' };
          break;
        }
        case ACCOUNT_PREFIX:
          return { ...(await renderAccount(callbackEnvelope.platformUserId, parsed.parts[0])), ackText: '账号已切换' };
        case POOL_PREFIX:
          return { ...(await renderPool(callbackEnvelope.platformUserId, parsed.parts[0])), ackText: '卡池详情' };
        case SHARE_PREFIX:
          return { ...(await renderShare(callbackEnvelope.platformUserId, parsed.parts[0])), ackText: '正在发送分享图' };
        case LOG_PREFIX:
          return { ...(await renderLog(callbackEnvelope.platformUserId, parsed.parts[0], parsed.parts[1] || 'csv')), ackText: '正在导出日志' };
        case PAGE_PREFIX:
          return { ...(await renderPools(callbackEnvelope.platformUserId, Number.parseInt(parsed.parts[0], 10) || 0)), ackText: '列表已翻页' };
        default:
          break;
      }
    } catch (error) {
      return {
        text: mapError(error),
        ackText: '操作失败',
        replyMarkup: buildInlineKeyboard(buildSiteRows(siteUrl, { importEntry: true })),
      };
    }

    return {
      text: '按钮已过期，请重新打开菜单。',
      ackText: '按钮已过期',
      replyMarkup: buildInlineKeyboard(buildHomeRows({ isBound: false, siteUrl })),
    };
  }

  return {
    handleMessage,
    handleCallback,
  };
}

export default {
  createOfficialBotRouter,
};
