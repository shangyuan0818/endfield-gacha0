import React from 'react';
import {
  SHARE_BRAND_LINK,
  SHARE_BRAND_URL,
  buildShareQrCodeDataUrl
} from '../../utils/shareBranding';
import { useI18n } from '../../i18n/index.js';

function getThemeTokens(theme) {
  if (theme === 'dark') {
    return {
      background: 'rgba(9, 12, 16, 0.9)',
      border: '#3f3f46',
      textPrimary: '#fafafa',
      textSecondary: '#d4d4d8',
      textMuted: '#a1a1aa',
      chipBackground: 'rgba(24, 24, 27, 0.92)',
      qrBackground: '#f4f4f5',
      qrForeground: '#09090b',
      qrLabel: '#111827'
    };
  }

  return {
    background: '#ffffff',
    border: '#d4d4d8',
    textPrimary: '#18181b',
    textSecondary: '#52525b',
    textMuted: '#71717a',
    chipBackground: '#fafafa',
    qrBackground: '#ffffff',
    qrForeground: '#111827',
    qrLabel: '#374151'
  };
}

const ShareBrandPanel = ({
  theme = 'light',
  accentColor = '#f59e0b',
  chips = [],
  style = {},
  qrSize = 104,
  compact = false,
  showChips = true,
  showHeader = true
}) => {
  const { t } = useI18n();
  const tokens = getThemeTokens(theme);
  const qrCodeUrl = React.useMemo(
    () => buildShareQrCodeDataUrl(SHARE_BRAND_LINK, {
      size: qrSize,
      darkColor: tokens.qrForeground,
      lightColor: tokens.qrBackground
    }),
    [qrSize, tokens.qrBackground, tokens.qrForeground]
  );
  const panelPadding = compact ? '8px' : '12px';

  return (
    <div
      style={{
        border: `1px solid ${tokens.border}`,
        background: tokens.background,
        padding: panelPadding,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '7px' : '10px',
        minWidth: compact ? '208px' : '220px',
        ...style
      }}
    >
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.18em', color: tokens.textMuted, textTransform: 'uppercase' }}>
            {t('share.brand.scanHeader')}
          </div>
          <div style={{ width: compact ? '26px' : '36px', height: '3px', background: accentColor }} />
        </div>
      )}

      {showChips && chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {chips.map((chip) => (
            <div
              key={chip}
              style={{
                border: `1px solid ${tokens.border}`,
                background: tokens.chipBackground,
                color: tokens.textSecondary,
                padding: '4px 7px',
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: compact ? '8px' : '12px', alignItems: 'center' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: compact ? '16px' : '20px', lineHeight: 1.15, fontWeight: 900, color: tokens.textPrimary }}>
            {t('share.brand.name')}
          </div>
          <div
            style={{
              fontSize: compact ? '9px' : '11px',
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: compact ? '0.01em' : '0.03em',
              color: accentColor,
              whiteSpace: 'nowrap'
            }}
          >
            {SHARE_BRAND_URL}
          </div>
          <div style={{ fontSize: compact ? '10px' : '12px', lineHeight: 1.35, color: tokens.textMuted }}>
            {t('share.brand.tagline')}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            border: `1px solid ${tokens.border}`,
            background: tokens.qrBackground,
            padding: compact ? '4px' : '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <img
            src={qrCodeUrl}
            alt={t('share.brand.qrAlt')}
            width={qrSize}
            height={qrSize}
            style={{ width: `${qrSize}px`, height: `${qrSize}px`, display: 'block' }}
          />
          <div style={{ fontSize: compact ? '9px' : '10px', fontWeight: 800, color: tokens.qrLabel, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('share.brand.scanCta')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareBrandPanel;
