function normalizeBaseUrl(siteUrl) {
  return String(siteUrl || '').trim().replace(/\/+$/, '');
}

function setOptionalParam(url, key, value) {
  if (value === null || value === undefined || value === '') {
    return;
  }

  url.searchParams.set(key, String(value));
}

export function buildOfficialBotLinks(siteUrl, {
  gameUid = null,
  poolId = null,
} = {}) {
  const normalizedSiteUrl = normalizeBaseUrl(siteUrl);
  if (!normalizedSiteUrl) {
    return {
      homeUrl: '',
      dashboardUrl: '',
      shareUrl: '',
      importUrl: '',
    };
  }

  const homeUrl = normalizedSiteUrl;
  const dashboardUrl = new URL('/dashboard', `${normalizedSiteUrl}/`);
  setOptionalParam(dashboardUrl, 'gameUid', gameUid);
  setOptionalParam(dashboardUrl, 'poolId', poolId);

  const shareUrl = new URL(dashboardUrl.toString());
  shareUrl.searchParams.set('share', 'open');

  const importUrl = new URL('/dashboard', `${normalizedSiteUrl}/`);
  importUrl.searchParams.set('import', 'open');

  return {
    homeUrl,
    dashboardUrl: dashboardUrl.toString(),
    shareUrl: shareUrl.toString(),
    importUrl: importUrl.toString(),
  };
}

export function buildWebsiteActionRows(siteUrl, {
  gameUid = null,
  poolId = null,
  includeShare = true,
  includeImport = true,
} = {}) {
  const links = buildOfficialBotLinks(siteUrl, { gameUid, poolId });
  const rows = [];

  rows.push([
    { text: '打开网站', url: links.homeUrl },
    { text: '网页分析', url: links.dashboardUrl || links.homeUrl },
  ]);

  if (includeShare) {
    rows.push([
      { text: '网页分享', url: links.shareUrl || links.dashboardUrl || links.homeUrl },
    ]);
  }

  if (includeImport) {
    rows.push([
      { text: '网页导入', url: links.importUrl || links.homeUrl },
    ]);
  }

  return rows.filter((row) => row.every((item) => item?.url));
}

export default {
  buildOfficialBotLinks,
  buildWebsiteActionRows,
};
