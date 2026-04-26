import { EndfieldApiError } from './endfieldApiClient.js';
import {
  SHARE_BRAND_LINK,
  SHARE_BRAND_URL,
  buildShareQrCodeDataUrl,
  getResolvedShareFontVariables,
} from '../../src/utils/shareBranding.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFileNameSegment(value, fallback = 'share-card') {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

  return normalized || fallback;
}

function formatProbability(probability = 0) {
  return `${(Number(probability || 0) * 100).toFixed(1)}%`;
}

function getPoolTypeLabel(type) {
  if (type === 'weapon') return '武器池';
  if (type === 'standard') return '常驻池';
  if (type === 'extra') return '附加寻访';
  return '限定池';
}

function getTimelineAccent(type) {
  if (type === 'extra') return '#06b6d4';
  if (type === 'weapon') return '#f59e0b';
  if (type === 'standard') return '#3b82f6';
  return '#eab308';
}

function renderMetricItems(items = []) {
  return (items || []).map((item) => `
    <div class="metric-pill">
      <div class="metric-label">${escapeHtml(item.label)}</div>
      <div class="metric-value">${escapeHtml(item.value)}</div>
      ${item.hint ? `<div class="metric-hint">${escapeHtml(item.hint)}</div>` : ''}
    </div>
  `).join('');
}

function renderTimelineSections(sections = []) {
  return (sections || []).map((section) => {
    const accent = getTimelineAccent(section?.type);
    const entries = (section?.entries || []).map((entry) => {
      const widthPercent = Math.max(
        10,
        Math.min(
          100,
          ((Number(entry?.pulls || 0) || 0) / Math.max(Number(section?.scaleMax || 1), 1)) * 100
        )
      );

      return `
        <div class="timeline-entry">
          <div class="timeline-head">
            <div class="timeline-stage">${escapeHtml(entry?.stageLabel || '阶段')}</div>
            <div class="timeline-date">${escapeHtml(entry?.dateLabel || '--')}</div>
          </div>
          <div class="timeline-result">${escapeHtml(entry?.resultSummaryWithoutFiveStar || entry?.resultSummary || '')}</div>
          <div class="timeline-bar">
            <div class="timeline-bar-fill" style="width:${widthPercent}%;background:${accent};"></div>
            <div class="timeline-bar-text">${escapeHtml(String(entry?.pulls || 0))} 抽</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="timeline-section">
        <div class="timeline-accent" style="background:${accent};"></div>
        <div class="timeline-title-row">
          <div>
            <div class="timeline-title">${escapeHtml(section?.title || '未知卡池')}</div>
            <div class="timeline-subtitle">${escapeHtml(section?.period || '')}</div>
          </div>
          <div class="timeline-summary">
            <span>总抽数 ${escapeHtml(String(section?.totalPulls || 0))}</span>
            <span>当前垫抽 ${escapeHtml(String(section?.currentPity ?? '--'))}</span>
          </div>
        </div>
        ${entries}
      </section>
    `;
  }).join('');
}

function buildShareCardHtml(detail) {
  const payload = detail?.share_payload || {};
  const sections = Array.isArray(detail?.timeline_sections) ? detail.timeline_sections : [];
  const accountName = escapeHtml(detail?.account?.display_name || detail?.user?.username || '未命名账号');
  const poolName = escapeHtml(payload?.poolName || detail?.pool?.display_name || '未知卡池');
  const featured = payload?.featured ? escapeHtml(payload.featured) : null;
  const summaryItems = renderMetricItems(payload?.summaryItems || []);
  const averageItems = renderMetricItems(payload?.averageItems || []);
  const resourceItems = renderMetricItems(payload?.resourceItems || []);
  const qrCodeUrl = buildShareQrCodeDataUrl(SHARE_BRAND_LINK, {
    size: 88,
    darkColor: '#111827',
    lightColor: '#ffffff',
  });
  const fontVars = getResolvedShareFontVariables();
  const fontSans = fontVars['--share-font-sans'] || 'sans-serif';
  const fontMono = fontVars['--share-font-mono'] || 'monospace';

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: dark;
        --share-font-sans: ${fontSans};
        --share-font-mono: ${fontMono};
      }
      body {
        margin: 0;
        padding: 20px;
        background: #0b0d12;
      }
      .share-root {
        width: 760px;
        box-sizing: border-box;
        background: linear-gradient(145deg, #090b0f 0%, #131820 48%, #1a1f29 100%);
        color: #fafafa;
        padding: 20px;
        border: 2px solid #3f3f46;
        display: flex;
        flex-direction: column;
        gap: 16px;
        font-family: var(--share-font-sans);
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid #3f3f46;
      }
      .eyebrow {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.24em;
        color: #a1a1aa;
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
        color: #d4d4d8;
        font-weight: 600;
      }
      .brand {
        width: 236px;
        border: 1px solid #3f3f46;
        background: rgba(24, 24, 27, 0.92);
        padding: 8px;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .brand-text {
        flex: 1;
        min-width: 0;
      }
      .brand-name {
        font-size: 16px;
        line-height: 1.15;
        font-weight: 900;
      }
      .brand-url {
        margin-top: 4px;
        font-size: 9px;
        color: #facc15;
        font-family: var(--share-font-mono);
        white-space: nowrap;
      }
      .brand-tagline {
        margin-top: 4px;
        font-size: 10px;
        line-height: 1.35;
        color: #a1a1aa;
      }
      .qr-wrap {
        border: 1px solid #3f3f46;
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
        text-transform: uppercase;
      }
      .panel {
        border: 1px solid #3f3f46;
        background: rgba(24, 24, 27, 0.94);
        padding: 12px;
      }
      .section-title {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.2em;
        color: #a1a1aa;
        text-transform: uppercase;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .metric-pill {
        border: 1px solid #3f3f46;
        background: rgba(39,39,42,0.92);
        padding: 10px;
      }
      .metric-label {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: #a1a1aa;
        text-transform: uppercase;
      }
      .metric-value {
        margin-top: 6px;
        font-size: 18px;
        line-height: 1.1;
        font-weight: 900;
        color: #fafafa;
        font-family: var(--share-font-mono);
      }
      .metric-hint {
        margin-top: 4px;
        font-size: 11px;
        color: #d4d4d8;
      }
      .timeline-title-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }
      .timeline-title {
        font-size: 22px;
        font-weight: 900;
        color: #fafafa;
      }
      .timeline-subtitle {
        margin-top: 6px;
        font-size: 12px;
        color: #d4d4d8;
      }
      .timeline-summary {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: #d4d4d8;
        font-family: var(--share-font-mono);
        text-align: right;
      }
      .timeline-section {
        border: 1px solid #3f3f46;
        background: rgba(24, 24, 27, 0.94);
        overflow: hidden;
      }
      .timeline-accent {
        height: 4px;
        width: 100%;
      }
      .timeline-section > .timeline-title-row,
      .timeline-section > .timeline-entry {
        padding: 0 12px;
      }
      .timeline-section > .timeline-title-row {
        padding-top: 12px;
      }
      .timeline-entry {
        padding-top: 12px;
        padding-bottom: 12px;
        border-top: 1px solid #27272a;
      }
      .timeline-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .timeline-stage {
        font-size: 14px;
        font-weight: 800;
      }
      .timeline-date {
        font-size: 12px;
        color: #a1a1aa;
        font-family: var(--share-font-mono);
      }
      .timeline-result {
        margin-top: 6px;
        font-size: 13px;
        line-height: 1.5;
        color: #d4d4d8;
      }
      .timeline-bar {
        position: relative;
        margin-top: 10px;
        height: 28px;
        border: 1px solid #3f3f46;
        background: #18181b;
        overflow: hidden;
      }
      .timeline-bar-fill {
        position: absolute;
        inset: 0 auto 0 0;
      }
      .timeline-bar-text {
        position: absolute;
        inset: 0 auto 0 12px;
        display: flex;
        align-items: center;
        font-size: 16px;
        font-weight: 900;
        color: #111827;
        font-family: var(--share-font-mono);
      }
      .footer {
        border-top: 1px solid #3f3f46;
        padding-top: 12px;
        font-size: 12px;
        color: #a1a1aa;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    </style>
  </head>
  <body>
    <div class="share-root">
      <div class="header">
        <div>
          <div class="eyebrow">ENDFIELD GACHA ANALYZER</div>
          <div class="title">${poolName}</div>
          <div class="subtitle">
            <span>${accountName}</span>
            <span>|</span>
            <span>${escapeHtml(payload?.poolTypeLabel || getPoolTypeLabel(detail?.pool?.pool_type))}</span>
            ${featured ? `<span>|</span><span>${featured}</span>` : ''}
          </div>
        </div>
        <div class="brand">
          <div class="brand-text">
            <div class="brand-name">终末地抽卡分析器</div>
            <div class="brand-url">${escapeHtml(SHARE_BRAND_URL)}</div>
            <div class="brand-tagline">导入 · 统计 · 模拟 · 分享</div>
          </div>
          <div class="qr-wrap">
            <img src="${qrCodeUrl}" alt="扫码访问网站" width="88" height="88" />
            <div class="qr-label">SCAN</div>
          </div>
        </div>
      </div>

      <section class="panel">
        <div class="section-title">核心统计</div>
        <div class="metrics">${summaryItems}</div>
      </section>

      ${payload?.averageItems?.length ? `
        <section class="panel">
          <div class="section-title">平均表现</div>
          <div class="metrics">${averageItems}</div>
        </section>
      ` : ''}

      ${payload?.resourceItems?.length ? `
        <section class="panel">
          <div class="section-title">资源摘要</div>
          <div class="metrics">${resourceItems}</div>
        </section>
      ` : ''}

      <section class="panel">
        <div class="section-title">时间线视图</div>
        <div class="timeline-subtitle">完整展示当前卡池的阶段节点与推进状态</div>
      </section>

      ${renderTimelineSections(sections)}

      <div class="footer">
        <div>${escapeHtml(payload?.notes || '已脱敏分享卡，不含 UID、卡池 ID、原始时间戳。')}</div>
        <div>继续分析：${escapeHtml(SHARE_BRAND_LINK)}</div>
      </div>
    </div>
  </body>
</html>`;
}

let playwrightBrowserPromise = null;

async function getPlaywrightBrowser() {
  if (!playwrightBrowserPromise) {
    playwrightBrowserPromise = import('playwright')
      .then(({ chromium }) => chromium.launch({ headless: true }))
      .catch((error) => {
        playwrightBrowserPromise = null;
        throw error;
      });
  }

  return playwrightBrowserPromise;
}

async function renderPoolShareCardAsset(detail, logger) {
  let browser;
  try {
    browser = await getPlaywrightBrowser();
  } catch (error) {
    logger?.error?.('Playwright not available for bot share card rendering', error);
    throw new EndfieldApiError('分享卡渲染环境未就绪，请先使用网页分享。', { status: 503 });
  }

  const html = buildShareCardHtml(detail);
  const fileBase = sanitizeFileNameSegment(
    `${detail?.account?.display_name || 'account'}-${detail?.pool?.display_name || 'pool'}`
  );
  const page = await browser.newPage({
    viewport: { width: 840, height: 1200, deviceScaleFactor: 1 },
  });

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const card = page.locator('.share-root');
    const buffer = await card.screenshot({ type: 'png' });
    return {
      kind: 'photo',
      buffer,
      mimeType: 'image/png',
      fileName: `${fileBase}.png`,
      caption: `${detail?.account?.display_name || '未命名账号'} · ${detail?.pool?.display_name || '未知卡池'}`,
    };
  } finally {
    await page.close();
  }
}

export function createBotShareCardService({
  apiClient,
  logger = { error: () => {} },
  renderAsset = renderPoolShareCardAsset,
}) {
  return {
    async buildPoolShareCard({ provider, platformUserId, gameUid, poolId }) {
      const detail = await apiClient.getPoolDetail({
        provider,
        platformUserId,
        gameUid,
        poolId,
      });

      if (!detail?.share_payload || !Array.isArray(detail?.timeline_sections) || detail.timeline_sections.length === 0) {
        throw new EndfieldApiError('当前卡池缺少可分享的时间线数据，请先使用网页查看。', { status: 404 });
      }

      return renderAsset(detail, logger);
    },
  };
}

export default {
  createBotShareCardService,
};
