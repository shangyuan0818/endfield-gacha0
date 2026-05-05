import { buildDashboardShareCardFileName } from '../../src/utils/dashboardShare.js';
import {
  SHARE_BRAND_LINK,
  SHARE_BRAND_NAME,
  SHARE_BRAND_TAGLINE,
  SHARE_BRAND_URL,
  SHARE_CARD_EXPORT_PIXEL_RATIO,
  SHARE_CARD_WIDTH,
  buildShareQrCodeDataUrl,
  getResolvedShareFontVariables,
} from '../../src/utils/shareBranding.js';

let playwrightBrowserPromise = null;

function isServerlessChromiumRuntime() {
  return process.platform === 'linux' && Boolean(
    process.env.VERCEL
    || process.env.AWS_EXECUTION_ENV
    || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

function getSafeErrorInfo(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error || 'Unknown error'),
    stack: error?.stack || null,
  };
}

async function launchPlaywrightBrowser() {
  if (isServerlessChromiumRuntime()) {
    const [
      { chromium: playwrightChromium },
      { default: serverlessChromium },
    ] = await Promise.all([
      import('playwright-core'),
      import('@sparticuz/chromium'),
    ]);

    return playwrightChromium.launch({
      args: serverlessChromium.args,
      executablePath: await serverlessChromium.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSectionTone(type) {
  if (type === 'extra') {
    return { accent: '#06b6d4', soft: 'rgba(6, 182, 212, 0.14)' };
  }

  if (type === 'weapon') {
    return { accent: '#f59e0b', soft: 'rgba(245, 158, 11, 0.14)' };
  }

  if (type === 'standard') {
    return { accent: '#3b82f6', soft: 'rgba(59, 130, 246, 0.14)' };
  }

  return { accent: '#d946ef', soft: 'rgba(217, 70, 239, 0.14)' };
}

function getTimelineBarColor(sectionType, entry = {}) {
  if (entry.stageKind === 'gift') return '#34d399';
  if (entry.stageKind === 'offStandard' || entry.stageKind === 'offLimited') return '#fb7185';
  return getSectionTone(sectionType).accent;
}

function renderMetricItems(items = []) {
  return (items || []).map((item) => `
    <div class="metric-pill">
      <div class="metric-label">${escapeHtml(item?.label)}</div>
      <div class="metric-value">${escapeHtml(item?.value)}</div>
      ${item?.hint ? `<div class="metric-hint">${escapeHtml(item.hint)}</div>` : ''}
    </div>
  `).join('');
}

function renderMetricPanel(title, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }

  return `
    <section class="panel">
      <div class="section-title">${escapeHtml(title)}</div>
      <div class="metrics">${renderMetricItems(items)}</div>
    </section>
  `;
}

function renderGroupedPanels(title, groups = []) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return '';
  }

  return `
    <section class="panel">
      <div class="section-title">${escapeHtml(title)}</div>
      <div class="group-grid">
        ${groups.map((group) => `
          <div class="group-panel">
            <div class="group-title">${escapeHtml(group?.label)}</div>
            <div class="metric-rows">${renderMetricItems(group?.items || [])}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderPitySummary(pitySummary) {
  if (!pitySummary) {
    return '';
  }

  return `
    <section class="panel accent-panel">
      <div>
        <div class="section-title">当前垫抽</div>
        <div class="pity-value">${escapeHtml(`${pitySummary.current6}/${pitySummary.max6}`)}</div>
      </div>
      <div class="pity-hint">${escapeHtml(pitySummary.probabilityHint || 'Toward the next 6★ milestone')}</div>
    </section>
  `;
}

function renderDropBadges(entry = {}) {
  const badges = Array.isArray(entry.dropBadges) ? entry.dropBadges : [];
  if (badges.length === 0) {
    return '';
  }

  return `
    <div class="badge-list">
      ${badges.map((badge) => `
        <div class="drop-badge">
          <div class="drop-thumb">${escapeHtml(String(badge?.label || '?').slice(0, 1))}</div>
          <div>${escapeHtml(badge?.label || '?')} <span>x${escapeHtml(badge?.count ?? 1)}</span></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTimelineSections(sections = []) {
  return (sections || []).map((section) => {
    const tone = getSectionTone(section?.type);
    const scaleBase = Math.max(normalizeNumber(section?.scaleMax, 1), 1);
    const entries = (section?.entries || []).map((entry) => {
      const pulls = normalizeNumber(entry?.pulls);
      const widthPercent = entry?.stageKind === 'gift'
        ? 100
        : Math.max(12, Math.min(100, (pulls / scaleBase) * 100));
      const fillColor = getTimelineBarColor(section?.type, entry);
      const summary = entry?.resultSummary || entry?.resultSummaryWithoutFiveStar || '';
      const leadBadge = entry?.leadBadge || entry?.dropBadges?.[0] || null;

      return `
        <div class="timeline-entry">
          <div class="portrait">
            <div class="portrait-rarity">${escapeHtml(leadBadge?.rarity ? `${leadBadge.rarity}★` : 'Stage')}</div>
            <div class="portrait-label">${escapeHtml(String(leadBadge?.label || '?').slice(0, 1))}</div>
            <div class="date-label">${escapeHtml(entry?.dateLabel || '--')}</div>
          </div>
          <div class="entry-body">
            <div class="stage-top">
              <div class="stage-chip">${escapeHtml(entry?.stageLabel || '阶段')}</div>
              <div class="result-text">${escapeHtml(summary || '--')}</div>
            </div>
            <div class="bar-row">
              <div class="bar-track">
                <div class="bar-fill" style="width:${widthPercent}%;background:${fillColor};"></div>
                <div class="bar-value">${escapeHtml(pulls)} <span>抽</span></div>
              </div>
              ${entry?.stageKind ? `<div class="stamp" style="border-color:${fillColor};color:${fillColor};">${escapeHtml(entry.stageKind === 'gift' ? 'FREE' : entry.stageKind === 'up' ? 'UP' : 'LIVE')}</div>` : ''}
            </div>
            ${renderDropBadges(entry)}
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="timeline-section">
        <div class="timeline-accent" style="background:${tone.accent};"></div>
        <div class="timeline-inner">
          <div class="timeline-title-row">
            <div>
              <div class="timeline-title">${escapeHtml(section?.title || '未知卡池')}</div>
              <div class="timeline-subtitle">
                <span>${escapeHtml(section?.period || '长期开放')}</span>
                ${section?.featured ? `<span>|</span><span style="color:${tone.accent};">${escapeHtml(section.featured)}</span>` : ''}
              </div>
            </div>
            <div class="timeline-summary">
              <span>总抽数 ${escapeHtml(section?.totalPulls ?? 0)}</span>
              <span>当前垫抽 ${escapeHtml(section?.hidePityState ? 'Merged' : section?.currentPity ?? '--')}</span>
            </div>
          </div>
          ${entries}
        </div>
      </section>
    `;
  }).join('');
}

async function getPlaywrightBrowser() {
  if (!playwrightBrowserPromise) {
    playwrightBrowserPromise = launchPlaywrightBrowser()
      .catch((error) => {
        playwrightBrowserPromise = null;
        throw error;
      });
  }

  return playwrightBrowserPromise;
}

export function buildDashboardShareCardHtml({ payload, sections, theme = 'dark' }) {
  const dark = theme === 'dark';
  const fontVariables = getResolvedShareFontVariables();
  const qrCodeUrl = buildShareQrCodeDataUrl(SHARE_BRAND_LINK, {
    size: 88,
    darkColor: '#111827',
    lightColor: '#ffffff',
  });
  const accentColor = getSectionTone(payload?.poolType).accent;
  const summaryPanels = Array.isArray(payload?.summaryGroups) && payload.summaryGroups.length > 0
    ? renderGroupedPanels('核心统计', payload.summaryGroups)
    : renderMetricPanel('核心统计', payload?.summaryItems || []);
  const averagePanels = Array.isArray(payload?.averageGroups) && payload.averageGroups.length > 0
    ? renderGroupedPanels('平均表现', payload.averageGroups)
    : renderMetricPanel('平均表现', payload?.averageItems || []);
  const resourcePanels = Array.isArray(payload?.resourceGroups) && payload.resourceGroups.length > 0
    ? renderGroupedPanels('资源摘要', payload.resourceGroups)
    : renderMetricPanel('资源摘要', payload?.resourceItems || []);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: ${dark ? 'dark' : 'light'};
        --share-font-sans: ${fontVariables['--share-font-sans']};
        --share-font-mono: ${fontVariables['--share-font-mono']};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        background: transparent;
        font-family: var(--share-font-sans);
      }
      .share-card-capture-root {
        width: ${SHARE_CARD_WIDTH}px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: ${dark ? '#fafafa' : '#18181b'};
        background: ${dark
          ? 'linear-gradient(145deg, #090b0f 0%, #131820 48%, #1a1f29 100%)'
          : 'linear-gradient(140deg, #fcfbf7 0%, #f6f2e9 52%, #eef3f8 100%)'};
        border: 2px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        position: relative;
        overflow: hidden;
      }
      .share-card-capture-root::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 12% 12%, rgba(250, 204, 21, 0.14), transparent 32%),
          radial-gradient(circle at 88% 10%, rgba(56, 189, 248, 0.11), transparent 28%);
        pointer-events: none;
      }
      .header,
      .panel,
      .timeline-section,
      .footer,
      .methodology {
        position: relative;
        z-index: 1;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
      }
      .eyebrow,
      .section-title,
      .metric-label,
      .group-title {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.16em;
        color: ${dark ? '#a1a1aa' : '#71717a'};
        text-transform: uppercase;
      }
      .title {
        margin-top: 8px;
        font-size: 30px;
        line-height: 1.08;
        font-weight: 900;
      }
      .subtitle {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 13px;
        color: ${dark ? '#d4d4d8' : '#52525b'};
        font-weight: 600;
      }
      .brand {
        width: 236px;
        flex-shrink: 0;
        border: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        background: ${dark ? 'rgba(24, 24, 27, 0.92)' : 'rgba(255, 255, 255, 0.92)'};
        padding: 8px;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .brand-name {
        font-size: 16px;
        line-height: 1.15;
        font-weight: 900;
      }
      .brand-url {
        margin-top: 4px;
        font-size: 9px;
        color: ${accentColor};
        font-family: var(--share-font-mono);
        white-space: nowrap;
      }
      .brand-tagline {
        margin-top: 4px;
        font-size: 10px;
        line-height: 1.35;
        color: ${dark ? '#a1a1aa' : '#71717a'};
      }
      .qr-wrap {
        border: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        background: #ffffff;
        padding: 4px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
      }
      .qr-label {
        font-size: 9px;
        font-weight: 800;
        color: #111827;
        letter-spacing: 0.08em;
      }
      .methodology,
      .panel,
      .timeline-section,
      .group-panel,
      .metric-pill {
        border: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        background: ${dark ? 'rgba(24, 24, 27, 0.94)' : '#ffffff'};
      }
      .methodology {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-color: ${accentColor};
        background: ${getSectionTone(payload?.poolType).soft};
      }
      .methodology-value,
      .pity-value {
        font-size: 18px;
        line-height: 1.1;
        font-weight: 900;
        color: ${accentColor};
        font-family: var(--share-font-mono);
      }
      .methodology-hint,
      .pity-hint {
        font-size: 11px;
        line-height: 1.45;
        font-weight: 700;
        color: ${dark ? '#d4d4d8' : '#52525b'};
      }
      .panel {
        padding: 12px;
      }
      .metrics,
      .metric-rows {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .group-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .group-panel {
        padding: 10px;
      }
      .metric-pill {
        padding: 10px;
      }
      .metric-value {
        margin-top: 6px;
        font-size: 18px;
        line-height: 1.1;
        font-weight: 900;
        color: ${dark ? '#fafafa' : '#18181b'};
        font-family: var(--share-font-mono);
      }
      .metric-hint {
        margin-top: 4px;
        font-size: 11px;
        color: ${dark ? '#d4d4d8' : '#52525b'};
      }
      .timeline-accent {
        height: 4px;
        width: 100%;
      }
      .timeline-inner {
        padding: 16px;
      }
      .timeline-title-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .timeline-title {
        font-size: 24px;
        font-weight: 900;
      }
      .timeline-subtitle {
        margin-top: 6px;
        display: flex;
        gap: 8px;
        font-size: 12px;
        color: ${dark ? '#d4d4d8' : '#52525b'};
      }
      .timeline-summary {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: ${dark ? '#d4d4d8' : '#52525b'};
        font-family: var(--share-font-mono);
        text-align: right;
      }
      .timeline-entry {
        display: flex;
        gap: 14px;
        border-top: 1px solid ${dark ? '#27272a' : '#f4f4f5'};
        padding-top: 14px;
        margin-top: 14px;
      }
      .portrait {
        width: 80px;
        flex-shrink: 0;
        text-align: center;
      }
      .portrait-rarity {
        display: inline-block;
        background: ${dark ? '#fafafa' : '#18181b'};
        color: ${dark ? '#111827' : '#fafafa'};
        font-size: 8px;
        font-weight: 900;
        padding: 2px 4px;
      }
      .portrait-label {
        height: 68px;
        border: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        background: ${dark ? 'rgba(39,39,42,0.92)' : '#fafafa'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        font-weight: 900;
      }
      .date-label {
        margin-top: 6px;
        font-size: 10px;
        font-weight: 800;
        color: ${dark ? '#a1a1aa' : '#71717a'};
      }
      .entry-body {
        flex: 1;
        min-width: 0;
      }
      .stage-top {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .stage-chip {
        border: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        background: ${dark ? 'rgba(39,39,42,0.92)' : '#fafafa'};
        color: ${dark ? '#a1a1aa' : '#71717a'};
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 3px 6px;
      }
      .result-text {
        font-size: 14px;
        font-weight: 700;
      }
      .bar-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
      }
      .bar-track {
        position: relative;
        flex: 0 1 360px;
        width: 100%;
        max-width: 360px;
        height: 34px;
        border: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        background: ${dark ? '#18181b' : '#f4f4f5'};
        overflow: hidden;
      }
      .bar-fill {
        position: absolute;
        inset: 0 auto 0 0;
      }
      .bar-value {
        position: absolute;
        inset: 0 auto 0 12px;
        display: flex;
        align-items: center;
        font-size: 20px;
        font-weight: 900;
        color: ${dark ? '#fafafa' : '#111827'};
      }
      .bar-value span {
        margin-left: 4px;
        font-size: 12px;
        font-weight: 700;
      }
      .stamp {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        transform: rotate(14deg);
        border: 2px solid;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 900;
        background: ${dark ? '#18181b' : '#ffffff'};
        flex-shrink: 0;
      }
      .badge-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .drop-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        background: ${dark ? 'rgba(39,39,42,0.92)' : '#fafafa'};
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 700;
      }
      .drop-badge span {
        margin-left: 6px;
        color: ${dark ? '#a1a1aa' : '#71717a'};
      }
      .drop-thumb {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${dark ? '#27272a' : '#e4e4e7'};
        font-size: 10px;
        font-weight: 900;
      }
      .footer {
        border-top: 1px solid ${dark ? '#3f3f46' : '#d4d4d8'};
        padding-top: 12px;
        font-size: 12px;
        line-height: 1.5;
        color: ${dark ? '#a1a1aa' : '#71717a'};
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    </style>
  </head>
  <body>
    <div class="share-card-capture-root">
      <div class="header">
        <div>
          <div class="eyebrow">ENDFIELD GACHA ANALYZER</div>
          <div class="title">${escapeHtml(payload?.poolName || 'Banner Detail Share')}</div>
          <div class="subtitle">
            <span>${escapeHtml(payload?.scopeLabel || '卡池详情')}</span>
            <span>|</span>
            <span>${escapeHtml(payload?.poolTypeLabel || '卡池')}</span>
            <span>|</span>
            <span>${escapeHtml(payload?.periodLabel || '长期开放')}</span>
          </div>
        </div>
        <div class="brand">
          <div>
            <div class="brand-name">${escapeHtml(SHARE_BRAND_NAME)}</div>
            <div class="brand-url">${escapeHtml(SHARE_BRAND_URL)}</div>
            <div class="brand-tagline">${escapeHtml(SHARE_BRAND_TAGLINE)}</div>
          </div>
          <div class="qr-wrap">
            <img src="${qrCodeUrl}" alt="扫码访问网站" width="88" height="88" />
            <div class="qr-label">SCAN</div>
          </div>
        </div>
      </div>

      <section class="methodology">
        <div>
          <div class="section-title">统计口径</div>
          <div class="methodology-value">${escapeHtml(payload?.includeFreePullsInStats ? '含免费十连' : '不含免费十连')}</div>
        </div>
        <div class="methodology-hint">${escapeHtml(payload?.methodology || 'Method: excludes gift nodes and free ten-pulls; intel books still count as valid pulls.')}</div>
      </section>

      ${summaryPanels}
      ${averagePanels}
      ${resourcePanels}
      ${renderPitySummary(payload?.pitySummary)}

      <div class="timeline-section">
        <div class="timeline-accent" style="background:${accentColor};"></div>
        <div class="timeline-inner">
          <div class="timeline-title-row">
            <div>
              <div class="section-title">时间线视图</div>
              <div class="timeline-subtitle">完整展示当前卡池的阶段节点与推进状态</div>
            </div>
            <div class="timeline-summary">
              <span>${escapeHtml(payload?.totalSections || 0)} 个阶段</span>
              <span>${escapeHtml(payload?.totalNodes || 0)} 个节点</span>
            </div>
          </div>
        </div>
      </div>

      ${renderTimelineSections(sections)}

      <div class="footer">
        <span>${escapeHtml(payload?.notes || '已脱敏分享卡，不含 UID、卡池 ID、原始时间戳。')}</span>
        <span>继续分析：${escapeHtml(SHARE_BRAND_LINK)}</span>
      </div>
    </div>
  </body>
</html>`;
}

export async function renderDashboardShareCardImage(detail, {
  theme = 'dark',
  locale = 'zh-CN',
} = {}) {
  const payload = detail?.share_payload || null;
  const sections = Array.isArray(detail?.timeline_sections) ? detail.timeline_sections : [];
  if (!payload || sections.length === 0) {
    throw {
      status: 404,
      message: 'Share payload or timeline sections not found',
    };
  }

  let browser;
  try {
    browser = await getPlaywrightBrowser();
  } catch (error) {
    console.error('[dashboard-share-image] Browser launch failed', getSafeErrorInfo(error));
    throw {
      status: 503,
      message: 'Share card rendering environment is not ready',
    };
  }

  const page = await browser.newPage({
    viewport: {
      width: SHARE_CARD_WIDTH + 48,
      height: 1400,
      deviceScaleFactor: SHARE_CARD_EXPORT_PIXEL_RATIO,
    },
  });

  try {
    await page.setContent(buildDashboardShareCardHtml({ payload, sections, theme, locale }), {
      waitUntil: 'domcontentloaded',
    });
    const buffer = await page.locator('.share-card-capture-root').screenshot({
      type: 'png',
    });

    return {
      buffer,
      mime_type: 'image/png',
      file_name: buildDashboardShareCardFileName(payload, locale),
    };
  } finally {
    await page.close();
  }
}

export default {
  buildDashboardShareCardHtml,
  renderDashboardShareCardImage,
};
