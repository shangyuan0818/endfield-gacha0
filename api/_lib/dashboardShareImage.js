import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardShareCard from '../../src/components/dashboard/DashboardShareCard.jsx';
import { I18nProvider } from '../../src/i18n/index.js';
import { buildDashboardShareCardFileName } from '../../src/utils/dashboardShare.js';
import {
  SHARE_CARD_EXPORT_PIXEL_RATIO,
  SHARE_CARD_WIDTH,
  getResolvedShareFontVariables,
} from '../../src/utils/shareBranding.js';

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

function buildShareCardHtml({ payload, sections, theme }) {
  const fontVariables = getResolvedShareFontVariables();
  const markup = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(
        'div',
        { className: 'share-card-capture-root' },
        React.createElement(DashboardShareCard, {
          payload,
          sections,
          theme,
          showFiveStarDrops: true,
        })
      )
    )
  );

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: ${theme === 'dark' ? 'dark' : 'light'};
        --share-font-sans: ${fontVariables['--share-font-sans']};
        --share-font-mono: ${fontVariables['--share-font-mono']};
      }
      body {
        margin: 0;
        padding: 24px;
        background: transparent;
      }
      .share-card-capture-root {
        width: ${SHARE_CARD_WIDTH}px;
      }
    </style>
  </head>
  <body>${markup}</body>
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
  } catch {
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
    await page.setContent(buildShareCardHtml({ payload, sections, theme, locale }), {
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
  renderDashboardShareCardImage,
};
