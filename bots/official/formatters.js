function formatProbability(probability = 0) {
  return `${(Number(probability || 0) * 100).toFixed(1)}%`;
}

function getPoolTypeLabel(type) {
  if (type === 'weapon') return '武器池';
  if (type === 'standard') return '常驻池';
  if (type === 'extra') return '附加寻访';
  return '限定池';
}

function getSafePoolName(pool) {
  return String(
    pool?.display_name
    || pool?.pool?.display_name
    || pool?.pool_name
    || pool?.name
    || pool?.pool?.name
    || ''
  ).trim() || '未知卡池';
}

function getSafeAccountName(value, fallback = '未命名账号') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function formatCountdown(countdown) {
  if (!countdown) {
    return '时间待确认';
  }

  if (countdown.has_started) {
    return '已到达';
  }

  const parts = [];
  if (countdown.days > 0) parts.push(`${countdown.days}天`);
  if (countdown.hours > 0 || countdown.days > 0) parts.push(`${countdown.hours}小时`);
  parts.push(`${countdown.minutes}分钟`);
  return parts.join('');
}

function formatStatusText(pool) {
  if (pool?.status === 'active') {
    return pool?.remaining_label ? `活动中 · ${pool.remaining_label}` : '活动中';
  }
  if (pool?.status === 'upcoming') {
    return pool?.remaining_label ? `即将开始 · ${pool.remaining_label}` : '即将开始';
  }
  if (pool?.status === 'ended') {
    return '已结束';
  }
  return '长期开放';
}

function formatFeaturedLine(pool) {
  const featured = Array.isArray(pool?.featured) ? pool.featured.filter(Boolean) : [];
  if (featured.length === 0) {
    return null;
  }
  return `${pool?.pool_type === 'standard' ? '6★ 名单' : 'UP / 名单'}：${featured.join(' / ')}`;
}

function formatRecentPull(latestPull) {
  if (!latestPull?.item_name) {
    return '最近高价值出货：暂无记录';
  }

  const rarity = latestPull.rarity ? `${latestPull.rarity}★` : '未知';
  const poolName = latestPull.pool_name ? ` · ${latestPull.pool_name}` : '';
  const accountName = latestPull.account_name ? ` · ${latestPull.account_name}` : '';
  return `最近高价值出货：${latestPull.item_name} (${rarity})${poolName}${accountName}`;
}

function formatPoolTile(pool) {
  const lines = [
    `${getSafePoolName(pool)} · ${getPoolTypeLabel(pool.pool_type)}`,
    `垫抽 ${pool.current_pity || 0} · 当前 6★ 概率 ${formatProbability(pool.current_probability)}`,
    formatStatusText(pool),
  ];

  const featuredLine = formatFeaturedLine(pool);
  if (featuredLine) {
    lines.push(featuredLine);
  }

  if (pool.latest_item_name) {
    lines.push(`最近高价值出货：${pool.latest_item_name}${pool.latest_item_rarity ? ` (${pool.latest_item_rarity}★)` : ''}`);
  }

  return lines.filter(Boolean).join('\n');
}

function formatTimelineEntry(entry, index) {
  const result = String(entry?.resultSummaryWithoutFiveStar || entry?.resultSummary || '').trim();
  const pulls = Number(entry?.pulls || 0);
  const dateLabel = String(entry?.dateLabel || '').trim();
  const stageLabel = String(entry?.stageLabel || '').trim();
  const pullLabel = pulls > 0 ? `${pulls} 抽` : '0 抽';
  return `${index + 1}. ${dateLabel} · ${stageLabel} · ${pullLabel}${result ? `\n   ${result}` : ''}`;
}

function formatRankingList(title, items = []) {
  const safeItems = Array.isArray(items) ? items.slice(0, 3) : [];
  if (safeItems.length === 0) {
    return `${title}：暂无数据`;
  }

  const body = safeItems
    .map((item, index) => `${index + 1}. ${item.name} ×${item.count}`)
    .join('\n');

  return `${title}\n${body}`;
}

export function formatHelpMessage({ providerLabel, siteUrl, dashboard = null }) {
  if (!dashboard) {
    return [
      `终末地官方 ${providerLabel} BOT`,
      '当前状态：未绑定',
      '',
      '功能：绑定站内账号、查看本人抽卡总览、当前卡池、最近出货、下版本情报与公开榜单。',
      '',
      '先使用 /bind 获取绑定指引，绑定后再用 /me /pools /current /recent /next /rank 查询。',
      '',
      `网站入口：${siteUrl}`,
    ].join('\n');
  }

  return [
    `终末地官方 ${providerLabel} BOT`,
    `当前状态：已绑定 ${getSafeAccountName(dashboard?.summary?.primary_account_name, dashboard?.user?.username || '站内账号')}`,
    dashboard?.binding?.display_handle ? `平台账号：${dashboard.binding.display_handle}` : null,
    '',
    '主要能力：',
    '1. 查看账号总览与当前推荐卡池',
    '2. 查看各池概率与单池详情',
    '3. 直接生成单池时间线分享卡',
    '4. 查看下版本时间、下一池与公开榜单',
    '',
    `网站入口：${siteUrl}`,
  ].filter(Boolean).join('\n');
}

export function formatBindInstruction({ providerLabel, siteUrl, dashboard = null }) {
  if (dashboard?.binding?.display_handle) {
    return [
      `${providerLabel} 账号已绑定。`,
      `当前平台昵称：${dashboard.binding.display_handle}`,
      `当前主账号：${getSafeAccountName(dashboard?.summary?.primary_account_name, dashboard?.user?.username || '站内账号')}`,
      '',
      '如需重绑，请回到站点设置页重新生成验证码，再发送 /verify 新验证码。',
      `网站入口：${siteUrl}`,
    ].join('\n');
  }

  return [
    `请先在网站中生成 ${providerLabel} 绑定验证码。`,
    '路径：设置 > 第三方账号绑定 > 选择对应平台 > 生成验证码',
    '',
    '生成后可直接把 8 位验证码发给我，或使用：',
    '/verify ABCD1234',
    '',
    `网站入口：${siteUrl}`,
  ].join('\n');
}

export function formatVerifySuccess({ providerLabel, displayHandle }) {
  return [
    `${providerLabel} 账号绑定成功。`,
    displayHandle ? `平台昵称：${displayHandle}` : null,
    '现在可以查看账号总览、各池详情、最近出货和分享卡。',
  ].filter(Boolean).join('\n');
}

export function formatDashboardMessage(dashboard) {
  const username = getSafeAccountName(
    dashboard?.summary?.primary_account_name
      || dashboard?.summary?.latest_pull?.account_name
      || dashboard?.user?.username,
    '未命名账号'
  );
  const summary = dashboard?.summary || {};
  const recommendedPool = summary?.recommended_pool;

  return [
    `${username} 的账号总览`,
    `站内用户名：${dashboard?.user?.username || '未设置'}`,
    `总抽数：${summary.total_pulls || 0}`,
    `6★ 数量：${summary.six_star_count || 0}`,
    `5★ 数量：${summary.five_star_count || 0}`,
    `已记录卡池：${summary.pool_count || 0}`,
    formatRecentPull(summary.latest_pull),
    recommendedPool
      ? `当前推荐入口：${getSafePoolName(recommendedPool)} · 垫抽 ${recommendedPool.current_pity || 0} · ${formatProbability(recommendedPool.current_probability)}`
      : '当前推荐入口：暂无可用卡池',
  ].join('\n');
}

export function formatPoolsPageMessage({ accounts = [], pageEntries = [], pageIndex = 0, totalPages = 1 }) {
  if (pageEntries.length === 0) {
    return '当前没有可展示的卡池记录。请先在网页导入抽卡数据。';
  }

  const accountNameByUid = new Map(
    (accounts || []).map((account) => [account.game_uid, getSafeAccountName(account.display_name)])
  );
  const lines = [`各池列表（第 ${pageIndex + 1} / ${Math.max(totalPages, 1)} 页）`];
  let currentAccountName = null;

  pageEntries.forEach((pool, index) => {
    const accountName = accountNameByUid.get(pool.game_uid) || getSafeAccountName(pool.account_name);
    if (accountName !== currentAccountName) {
      lines.push('');
      lines.push(`账号：${accountName}`);
      currentAccountName = accountName;
    }

    lines.push('');
    lines.push(`${index + 1}. ${formatPoolTile(pool)}`);
  });

  return lines.join('\n');
}

export function formatPoolDetailMessage(detail) {
  if (!detail) {
    return '当前找不到这个卡池详情。';
  }

  const pool = detail.pool || {};
  const stats = detail.stats || {};
  const account = detail.account || {};
  const recentRecords = Array.isArray(detail.recent_records) ? detail.recent_records : [];
  const section = Array.isArray(detail.timeline_sections) ? detail.timeline_sections[0] : null;
  const timelinePreview = section?.entries?.slice(0, 4) || [];

  return [
    `${getSafePoolName(pool)} · ${getPoolTypeLabel(pool.pool_type)}`,
    `账号：${getSafeAccountName(account.display_name)}`,
    formatStatusText(pool),
    formatFeaturedLine(pool),
    '',
    `当前 6★ 概率：${formatProbability(stats.current_probability)}`,
    `当前垫抽：${stats.current_pity || 0}`,
    `本池总抽数：${stats.total_pulls || 0}`,
    `累计 6★：${stats.six_star_total || 0}`,
    `UP / 目标 6★：${stats.up_six_star_count || 0}`,
    `偏移 / 常驻 6★：${stats.off_six_star_count || 0}`,
    `5★ 数量：${stats.five_star_count || 0}`,
    Number.isFinite(Number(stats.win_rate)) ? `目标 6★ 占比：${Number(stats.win_rate).toFixed(1)}%` : null,
    '',
    recentRecords.length > 0
      ? `最近出货：${recentRecords.map((record) => `${record.item_name}${record.rarity ? ` (${record.rarity}★)` : ''}`).join(' / ')}`
      : '最近出货：暂无高价值记录',
    timelinePreview.length > 0
      ? ['时间线预览：', ...timelinePreview.map((entry, index) => formatTimelineEntry(entry, index))].join('\n')
      : '时间线预览：暂无可展示节点',
  ].filter(Boolean).join('\n');
}

export function formatCurrentPoolsMessage({ overview, poolStats }) {
  const activePools = Array.isArray(overview?.active_pools) ? overview.active_pools : [];
  const matchedPools = new Map();

  for (const account of poolStats?.accounts || []) {
    for (const pool of account.pools || []) {
      if (!matchedPools.has(pool.pool_id)) {
        matchedPools.set(pool.pool_id, []);
      }
      matchedPools.get(pool.pool_id).push(pool);
    }
  }

  if (activePools.length === 0) {
    return '当前活动池尚未同步到站点配置。';
  }

  const lines = ['当前活动池'];
  activePools.forEach((pool) => {
    const personalPools = matchedPools.get(pool.pool_id) || [];
    lines.push('');
    lines.push(`${getSafePoolName(pool)} · ${getPoolTypeLabel(pool.type)} · ${pool.status === 'active' ? `剩余 ${formatCountdown(pool.countdown)}` : formatCountdown(pool.countdown)}`);
    const featuredLine = Array.isArray(pool?.featured_characters) && pool.featured_characters.length > 0
      ? `UP / 名单：${pool.featured_characters.join(' / ')}`
      : null;
    if (featuredLine) {
      lines.push(featuredLine);
    }
    if (personalPools.length === 0) {
      lines.push('你在该池暂无记录。');
      return;
    }

    personalPools.forEach((entry) => {
      lines.push(`${getSafeAccountName(entry.account_name)}：垫抽 ${entry.current_pity || 0} · 当前 6★ 概率 ${formatProbability(entry.current_probability)}`);
    });
  });

  return lines.join('\n');
}

export function formatNextVersionMessage(overview) {
  const nextVersion = overview?.next_version || {};
  const nextLimitedPool = overview?.next_limited_pool || null;
  const featured = Array.isArray(nextLimitedPool?.featured_characters) ? nextLimitedPool.featured_characters.filter(Boolean) : [];

  return [
    '下版本情报',
    `预计开始：${nextVersion.target_at || '待公布'}`,
    `剩余时间：${formatCountdown(nextVersion.countdown)}`,
    `下一池：${nextLimitedPool?.name || '待配置'}`,
    nextLimitedPool?.type ? `池型：${getPoolTypeLabel(nextLimitedPool.type)}` : null,
    featured.length > 0 ? `UP / 名单：${featured.join(' / ')}` : '名单：待配置',
    nextLimitedPool?.start_time ? `卡池开始：${nextLimitedPool.start_time}` : null,
  ].filter(Boolean).join('\n');
}

export function formatRecentPullsMessage(result, requestedLimit) {
  const records = Array.isArray(result?.records) ? result.records : [];
  if (records.length === 0) {
    return '当前没有可展示的最近出货记录。';
  }

  const lines = records.map((record, index) => (
    `${index + 1}. ${record.item_name} (${record.rarity}★) · ${getSafePoolName(record)} · ${getSafeAccountName(record.account_name, '未命名账号')}`
  ));

  return [
    `最近 ${Math.min(records.length, requestedLimit)} 条高价值记录：`,
    ...lines,
  ].join('\n');
}

export function formatRankingMessage(ranking) {
  if (!ranking) {
    return '公开榜单暂时不可用。';
  }

  return [
    '公开榜单摘录',
    formatRankingList('限定池 UP 6★', ranking?.limited?.sixStarUp),
    formatRankingList('常驻池 6★', ranking?.standard?.sixStar),
    formatRankingList('武器池 UP 6★', ranking?.weapon?.sixStarUp),
  ].join('\n\n');
}

export default {
  formatHelpMessage,
  formatBindInstruction,
  formatVerifySuccess,
  formatDashboardMessage,
  formatPoolsPageMessage,
  formatPoolDetailMessage,
  formatCurrentPoolsMessage,
  formatNextVersionMessage,
  formatRecentPullsMessage,
  formatRankingMessage,
};
