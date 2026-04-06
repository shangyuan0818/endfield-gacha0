import React from 'react';
import {
  SHARE_BRAND_LINK,
  SHARE_BRAND_NAME,
  SHARE_BRAND_TAGLINE,
  SHARE_BRAND_URL,
  buildShareQrCodeDataUrl
} from '../../utils/shareBranding';

function getThemeTokens(theme) {
  if (theme === 'dark') {
    return {
      background: 'rgba(12, 14, 18, 0.92)',
      border: '#3f3f46',
      textPrimary: '#fafafa',
      textSecondary: '#d4d4d8',
      textMuted: '#a1a1aa',
      chipBackground: 'rgba(24, 24, 27, 0.92)',
      qrBackground: '#ffffff'
    };
  }

  return {
    background: '#ffffff',
    border: '#d4d4d8',
    textPrimary: '#18181b',
    textSecondary: '#52525b',
    textMuted: '#71717a',
    chipBackground: '#fafafa',
    qrBackground: '#ffffff'
  };
}

const ShareBrandPanel = ({
  theme = 'light',
  accentColor = '#f59e0b',
  chips = [],
  style = {},
  qrSize = 104
}) => {
  const tokens = getThemeTokens(theme);
  const qrCodeUrl = React.useMemo(() => buildShareQrCodeDataUrl(SHARE_BRAND_LINK, { size: qrSize }), [qrSize]);

  return (
    <div
      style={{
        border: `1px solid ${tokens.border}`,
        background: tokens.background,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '220px',
        ...style
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.18em', color: tokens.textMuted, textTransform: 'uppercase' }}>
          Scan To Open
        </div>
        <div style={{ width: '36px', height: '3px', background: accentColor }} />
      </div>

      {chips.length > 0 && (
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

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '20px', lineHeight: 1.15, fontWeight: 900, color: tokens.textPrimary }}>
            {SHARE_BRAND_NAME}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: accentColor }}>
            {SHARE_BRAND_URL}
          </div>
          <div style={{ fontSize: '12px', lineHeight: 1.5, color: tokens.textMuted }}>
            {SHARE_BRAND_TAGLINE}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            border: `1px solid ${tokens.border}`,
            background: tokens.qrBackground,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <img
            src={qrCodeUrl}
            alt="终末地抽卡分析器站点二维码"
            width={qrSize}
            height={qrSize}
            style={{ width: `${qrSize}px`, height: `${qrSize}px`, display: 'block' }}
          />
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            扫码直达
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareBrandPanel;
