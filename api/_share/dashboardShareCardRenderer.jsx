import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardShareCard from '../../src/components/dashboard/DashboardShareCard.jsx';
import { I18nProvider, normalizeLocale } from '../../src/i18n/index.js';

export function renderDashboardShareCardMarkup({
  payload,
  sections = [],
  theme = 'dark',
  locale = 'zh-CN',
  showFiveStarDrops = true
} = {}) {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={normalizeLocale(locale)}>
      <DashboardShareCard
        payload={payload}
        sections={sections}
        theme={theme}
        showFiveStarDrops={showFiveStarDrops}
      />
    </I18nProvider>
  );
}

export default {
  renderDashboardShareCardMarkup
};
