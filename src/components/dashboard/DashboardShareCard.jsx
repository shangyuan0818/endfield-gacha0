import React, { forwardRef } from 'react';
import ShareBrandPanel from '../share/ShareBrandPanel';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../../utils/shareBranding';

function getThemeTokens(theme = 'light') {
  if (theme === 'dark') {
    return {
      rootBackground: 'linear-gradient(180deg, #09090b 0%, #18181b 100%)',
      gridLine: 'rgba(255,255,255,0.04)',
      border: '#3f3f46',
      subtleBorder: '#27272a',
      panelBackground: 'rgba(24,24,27,0.94)',
      panelMutedBackground: 'rgba(39,39,42,0.92)',
      textPrimary: '#fafafa',
      textSecondary: '#d4d4d8',
      textMuted: '#a1a1aa',
      textWeak: '#71717a',
      iconBackground: '#27272a',
      barTrack: '#18181b',
      chipBackground: 'rgba(39,39,42,0.92)',
      footerText: '#a1a1aa',
      rarityBadgeBackground: '#fafafa',
      rarityBadgeText: '#111827'
    };
  }

  return {
    rootBackground: 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)',
    gridLine: 'rgba(24,24,27,0.03)',
    border: '#d4d4d8',
    subtleBorder: '#e4e4e7',
    panelBackground: '#ffffff',
    panelMutedBackground: '#fafafa',
    textPrimary: '#18181b',
    textSecondary: '#52525b',
    textMuted: '#71717a',
    textWeak: '#a1a1aa',
    iconBackground: '#e4e4e7',
    barTrack: '#f4f4f5',
    chipBackground: '#fafafa',
    footerText: '#71717a',
    rarityBadgeBackground: '#18181b',
    rarityBadgeText: '#fafafa'
  };
}

const styles = {
  root: {
    width: `${SHARE_CARD_WIDTH}px`,
    minHeight: `${SHARE_CARD_HEIGHT}px`,
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)',
    color: '#18181b',
    padding: '20px',
    fontFamily: '"Microsoft YaHei UI", "Segoe UI", sans-serif',
    border: '2px solid #d4d4d8',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'relative'
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(24,24,27,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.03) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    pointerEvents: 'none'
  },
  header: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    borderBottom: '1px solid #d4d4d8',
    paddingBottom: '12px'
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0
  },
  eyebrow: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.24em',
    color: '#71717a',
    textTransform: 'uppercase'
  },
  title: {
    fontSize: '30px',
    lineHeight: 1.08,
    fontWeight: 900,
    letterSpacing: '-0.04em',
    color: '#18181b'
  },
  subtitle: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
    fontSize: '13px',
    color: '#52525b',
    fontWeight: 600
  },
  tagColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '8px',
    flexShrink: 0
  },
  badge: {
    border: '1px solid #d4d4d8',
    background: '#ffffff',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#27272a'
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.2em',
    color: '#71717a',
    textTransform: 'uppercase'
  },
  summaryGrid: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px'
  },
  statCard: {
    border: '1px solid #d4d4d8',
    background: '#ffffff',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minHeight: '96px'
  },
  statLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.14em',
    color: '#71717a',
    textTransform: 'uppercase'
  },
  statValue: {
    fontSize: '28px',
    lineHeight: 1,
    fontWeight: 900,
    color: '#111827'
  },
  statHint: {
    fontSize: '13px',
    color: '#52525b',
    fontWeight: 600
  },
  midGrid: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '14px'
  },
  panel: {
    border: '1px solid #d4d4d8',
    background: '#ffffff',
    padding: '12px'
  },
  averageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '12px'
  },
  averageCard: {
    border: '1px solid #e4e4e7',
    background: '#fafafa',
    padding: '12px'
  },
  averageLabel: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#71717a'
  },
  averageValue: {
    marginTop: '8px',
    fontSize: '21px',
    lineHeight: 1,
    fontWeight: 900,
    color: '#18181b'
  },
  averageNote: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#71717a',
    lineHeight: 1.5
  },
  pityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '12px'
  },
  pityCard: {
    border: '1px solid #e4e4e7',
    background: '#fafafa',
    padding: '12px'
  },
  pityValue: {
    marginTop: '8px',
    fontSize: '23px',
    lineHeight: 1,
    fontWeight: 900,
    color: '#111827'
  },
  timelineWrap: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px'
  },
  counts: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  countBox: {
    border: '1px solid #d4d4d8',
    background: '#ffffff',
    padding: '8px 10px',
    fontSize: '12px',
    color: '#52525b',
    fontWeight: 700
  },
  sectionCard: {
    border: '1px solid #d4d4d8',
    background: '#ffffff',
    overflow: 'hidden'
  },
  sectionInner: {
    padding: '16px'
  },
  sectionMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '12px'
  },
  metricCell: {
    borderLeft: '1px solid #d4d4d8',
    paddingLeft: '10px'
  },
  metricValue: {
    marginTop: '6px',
    fontSize: '20px',
    fontWeight: 900,
    color: '#18181b'
  },
  entryRow: {
    display: 'flex',
    gap: '14px',
    borderTop: '1px solid #f4f4f5',
    paddingTop: '14px',
    marginTop: '14px'
  },
  portrait: {
    width: '68px',
    height: '68px',
    border: '1px solid #d4d4d8',
    background: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0
  },
  portraitRarity: {
    position: 'absolute',
    top: '0',
    right: '0',
    background: '#18181b',
    color: '#fafafa',
    fontSize: '8px',
    fontWeight: 900,
    padding: '2px 4px'
  },
  portraitLabel: {
    fontSize: '22px',
    fontWeight: 900,
    color: '#18181b'
  },
  dateLabel: {
    marginTop: '6px',
    fontSize: '10px',
    fontWeight: 800,
    color: '#71717a',
    textAlign: 'center'
  },
  entryBody: {
    flex: 1,
    minWidth: 0
  },
  stageTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  stageChip: {
    border: '1px solid #d4d4d8',
    background: '#fafafa',
    color: '#71717a',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '3px 6px'
  },
  resultText: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#27272a'
  },
  metaText: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#71717a',
    fontWeight: 600
  },
  barRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '10px'
  },
  barTrack: {
    position: 'relative',
    flex: '0 1 360px',
    width: '100%',
    maxWidth: '360px',
    height: '34px',
    border: '1px solid #d4d4d8',
    background: '#f4f4f5',
    overflow: 'hidden'
  },
  barFill: {
    position: 'absolute',
    inset: 0,
    width: '0%'
  },
  barFillPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent 100%)',
    backgroundSize: '12px 12px'
  },
  barValue: {
    position: 'absolute',
    inset: '0 auto 0 12px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '20px',
    fontWeight: 900,
    color: '#111827'
  },
  stamp: {
    width: '42px',
    height: '42px',
    borderRadius: '999px',
    transform: 'rotate(14deg)',
    border: '2px solid #d4d4d8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 900,
    color: '#27272a',
    background: '#ffffff',
    flexShrink: 0
  },
  badgeList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px'
  },
  dropBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: '1px solid #d4d4d8',
    background: '#fafafa',
    padding: '4px 8px'
  },
  dropThumb: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#e4e4e7',
    color: '#27272a',
    fontSize: '10px',
    fontWeight: 900
  },
  footer: {
    position: 'relative',
    zIndex: 1,
    borderTop: '1px solid #d4d4d8',
    paddingTop: '12px',
    fontSize: '12px',
    color: '#71717a',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  footerTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  }
};

function getSectionTone(type) {
  if (type === 'weapon') {
    return {
      accent: '#f59e0b',
      soft: '#fef3c7'
    };
  }

  if (type === 'standard') {
    return {
      accent: '#3b82f6',
      soft: '#dbeafe'
    };
  }

  return {
    accent: '#d946ef',
    soft: '#fae8ff'
  };
}

function getSectionTypeLabel(type) {
  if (type === 'weapon') {
    return '武器池';
  }

  if (type === 'standard') {
    return '常驻角色池';
  }

  return '限定角色池';
}

function getBarColor(entry, sectionType) {
  if (entry.stageKind === 'gift') {
    return '#34d399';
  }

  if (entry.stageKind === 'fiveStar') {
    return '#fbbf24';
  }

  if (entry.stageKind === 'offStandard' || entry.stageKind === 'offLimited') {
    return '#fb7185';
  }

  if (sectionType === 'weapon') {
    return '#f59e0b';
  }

  if (sectionType === 'standard') {
    return '#3b82f6';
  }

  return '#d946ef';
}

function getStamp(entry, sectionType) {
  if (entry.stageKind === 'gift') {
    return { label: '免', color: '#34d399', bg: '#ecfdf5' };
  }

  if (entry.stageKind === 'up') {
    return { label: 'UP', color: '#f59e0b', bg: '#fffbeb' };
  }

  if (entry.stageKind === 'offStandard' || entry.stageKind === 'offLimited') {
    if (sectionType === 'standard') {
      return null;
    }

    return { label: '歪', color: '#fb7185', bg: '#fff1f2' };
  }

  if (entry.isCurrentStage) {
    return { label: '进', color: '#52525b', bg: '#fafafa' };
  }

  return null;
}

function formatAverage(value) {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }

  return `${Number(value).toFixed(1)} 抽`;
}

function getStatusText(status) {
  if (!status?.isTimed) {
    return '长期开放';
  }

  if (status.isActive) {
    return status.remainingLabel || '进行中';
  }

  if (status.isUpcoming) {
    return status.remainingLabel || '即将开启';
  }

  return '已结束';
}

function SummaryCard({ item, tokens }) {
  return (
    <div style={{ ...styles.statCard, borderColor: tokens.border, background: tokens.panelBackground }}>
      <div style={{ ...styles.statLabel, color: tokens.textMuted }}>{item.label}</div>
      <div style={{ ...styles.statValue, color: tokens.textPrimary }}>{item.value}</div>
      <div style={{ ...styles.statHint, color: tokens.textSecondary }}>{item.hint}</div>
    </div>
  );
}

function TimelineEntry({ entry, section, tokens }) {
  const scaleBase = Math.max(Number(section.scaleMax) || 1, 1);
  const widthPercent = Math.max(12, Math.min(100, ((entry.pulls || 0) / scaleBase) * 100));
  const fillColor = getBarColor(entry, section.type);
  const stamp = getStamp(entry, section.type);
  const leadBadge = entry.leadBadge || entry.dropBadges?.[0] || { label: '?', rarity: 0 };

  return (
    <div style={{ ...styles.entryRow, borderTopColor: tokens.subtleBorder }}>
      <div style={{ width: '80px', flexShrink: 0 }}>
        <div style={{ ...styles.portrait, borderColor: tokens.border, background: tokens.panelMutedBackground, overflow: 'hidden' }}>
          <div style={{ ...styles.portraitRarity, background: tokens.rarityBadgeBackground, color: tokens.rarityBadgeText }}>
            {leadBadge.rarity > 0 ? `${leadBadge.rarity}★` : '阶段'}
          </div>
          {leadBadge.avatarUrl ? (
            <img
              src={leadBadge.avatarUrl}
              alt={leadBadge.label}
              style={{ width: '68px', height: '68px', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ ...styles.portraitLabel, color: tokens.textPrimary }}>{String(leadBadge.label || '?').slice(0, 1)}</div>
          )}
        </div>
        <div style={{ ...styles.dateLabel, color: tokens.textMuted }}>{entry.dateLabel}</div>
      </div>

      <div style={styles.entryBody}>
        <div style={styles.stageTop}>
          <div style={{ ...styles.stageChip, borderColor: tokens.border, background: tokens.chipBackground, color: tokens.textMuted }}>{entry.stageLabel}</div>
          <div style={{ ...styles.resultText, color: tokens.textPrimary }}>{entry.resultSummary}</div>
        </div>
        <div style={{ ...styles.metaText, color: tokens.textMuted }}>{entry.metaSummary || `${entry.targetPulls} 抽阶段`}</div>

        <div style={styles.barRow}>
          <div style={{ ...styles.barTrack, borderColor: tokens.border, background: tokens.barTrack }}>
            <div
              style={{
                ...styles.barFill,
                width: `${widthPercent}%`,
                background: fillColor
              }}
            >
              <div style={styles.barFillPattern} />
            </div>
            <div style={{ ...styles.barValue, color: tokens.textPrimary }}>
              {entry.pulls}
              <span style={{ marginLeft: '4px', fontSize: '12px', fontWeight: 700 }}>抽</span>
            </div>
          </div>

          {stamp && (
            <div
              style={{
                ...styles.stamp,
                borderColor: stamp.color,
                color: stamp.color,
                background: stamp.bg
              }}
            >
              {stamp.label}
            </div>
          )}
        </div>

        {entry.dropBadges?.length > 0 && (
          <div style={styles.badgeList}>
            {entry.dropBadges.map((badge) => (
              <div key={`${entry.id}-${badge.label}`} style={{ ...styles.dropBadge, borderColor: tokens.border, background: tokens.panelMutedBackground }}>
                <div style={{ ...styles.dropThumb, background: tokens.iconBackground, color: tokens.textPrimary, overflow: 'hidden' }}>
                  {badge.avatarUrl ? (
                    <img
                      src={badge.avatarUrl}
                      alt={badge.label}
                      style={{ width: '20px', height: '20px', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    String(badge.label || '?').slice(0, 1)
                  )}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.textPrimary }}>
                  {badge.label}
                  <span style={{ marginLeft: '6px', color: tokens.textMuted }}>x{badge.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineSection({ section, tokens }) {
  const tone = getSectionTone(section.type);
  const secondaryLabel = section.type === 'standard' ? '平均 5★' : '平均 UP';
  const secondaryValue = section.type === 'standard'
    ? formatAverage(section.avgFiveStarPulls)
    : formatAverage(section.avgUpPulls);

  return (
    <div style={{ ...styles.sectionCard, borderColor: tokens.border, background: tokens.panelBackground }}>
      <div style={{ height: '4px', width: '100%', background: tone.accent }} />
      <div style={styles.sectionInner}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: tokens.textPrimary }}>{section.title}</div>
              <div
                style={{
                  ...styles.badge,
                  padding: '4px 8px',
                  fontSize: '10px',
                  color: tone.accent,
                  borderColor: tone.accent,
                  background: tone.soft
                }}
              >
                {getSectionTypeLabel(section.type)}
              </div>
              {section.featured && (
                <div
                  style={{
                    ...styles.badge,
                    padding: '4px 8px',
                    fontSize: '10px',
                    color: tone.accent,
                    borderColor: tone.accent,
                    background: tone.soft
                  }}
                >
                  {section.featured}
                </div>
              )}
            </div>
            <div style={{ ...styles.subtitle, marginTop: '6px', color: tokens.textSecondary }}>
              <span>{section.period}</span>
              <span>|</span>
              <span style={{ color: tone.accent }}>{getStatusText(section.status)}</span>
            </div>
          </div>

          <div style={styles.sectionMeta}>
            <div style={styles.metricCell}>
              <div style={{ ...styles.statLabel, color: tokens.textMuted }}>合计</div>
              <div style={{ ...styles.metricValue, color: tokens.textPrimary }}>{section.totalPulls} 抽</div>
            </div>
            <div style={styles.metricCell}>
              <div style={{ ...styles.statLabel, color: tokens.textMuted }}>垫刀</div>
              <div style={{ ...styles.metricValue, color: tokens.textPrimary }}>
                {section.hidePityState ? '多账号' : `${section.currentPity} / ${section.currentPity5}`}
              </div>
            </div>
            <div style={styles.metricCell}>
              <div style={{ ...styles.statLabel, color: tokens.textMuted }}>平均 6★</div>
              <div style={{ ...styles.metricValue, color: tokens.textPrimary }}>{formatAverage(section.avgSixStarPulls)}</div>
            </div>
            <div style={styles.metricCell}>
              <div style={{ ...styles.statLabel, color: tokens.textMuted }}>{secondaryLabel}</div>
              <div style={{ ...styles.metricValue, color: tokens.textPrimary }}>{secondaryValue}</div>
            </div>
          </div>
        </div>

        {section.entries.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} section={section} tokens={tokens} />
        ))}
      </div>
    </div>
  );
}

const DashboardShareCard = forwardRef(function DashboardShareCard({ payload, sections = [], theme = 'light' }, ref) {
  const tokens = getThemeTokens(theme);
  const brandChips = [
    '已脱敏分享卡',
    theme === 'dark' ? '暗色主题' : '亮色主题',
    payload?.overviewFilterLabel && payload.overviewFilterLabel !== '全部卡池' ? `筛选 ${payload.overviewFilterLabel}` : null,
    payload?.featured ? `目标 ${payload.featured}` : null
  ].filter(Boolean);
  const accentColor = getSectionTone(payload?.poolType).accent;

  return (
    <div ref={ref} style={{ ...styles.root, background: tokens.rootBackground, borderColor: tokens.border, color: tokens.textPrimary }}>
      <div
        style={{
          ...styles.grid,
          backgroundImage: `linear-gradient(${tokens.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${tokens.gridLine} 1px, transparent 1px)`
        }}
      />

      <div style={{ ...styles.header, borderBottomColor: tokens.border }}>
        <div style={styles.titleWrap}>
          <div style={{ ...styles.eyebrow, color: tokens.textMuted }}>ENDFIELD GACHA ANALYZER</div>
          <div style={{ ...styles.title, color: tokens.textPrimary }}>{payload?.poolName || '卡池详情分享'}</div>
          <div style={{ ...styles.subtitle, color: tokens.textSecondary }}>
            <span>{payload?.scopeLabel || '卡池详情'}</span>
            <span>|</span>
            <span>{payload?.poolTypeLabel || '卡池'}</span>
            <span>|</span>
            <span>{payload?.periodLabel || '长期开放'}</span>
          </div>
        </div>

        <div style={styles.tagColumn}>
          <ShareBrandPanel
            theme={theme}
            accentColor={accentColor}
            chips={brandChips}
            style={{ width: '240px' }}
          />
        </div>
      </div>

      <div>
        <div style={{ ...styles.sectionTitle, color: tokens.textMuted }}>核心统计</div>
        {Array.isArray(payload?.summaryGroups) && payload.summaryGroups.length > 0 ? (
          <div style={{ ...styles.summaryGrid, marginTop: '10px' }}>
            {payload.summaryGroups.map((group) => (
              <div key={group.id} style={{ ...styles.panel, borderColor: tokens.border, background: tokens.panelBackground }}>
                <div style={{ ...styles.sectionTitle, color: tokens.textMuted }}>{group.label}</div>
                <div style={{ ...styles.summaryGrid, marginTop: '10px' }}>
                  {group.items.map((item) => (
                    <SummaryCard key={`${group.id}-${item.id}`} item={item} tokens={tokens} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...styles.summaryGrid, marginTop: '10px' }}>
            {payload?.summaryItems?.map((item) => (
              <SummaryCard key={item.id} item={item} tokens={tokens} />
            ))}
          </div>
        )}
      </div>

      <div style={styles.midGrid}>
        <div style={{ ...styles.panel, borderColor: tokens.border, background: tokens.panelBackground }}>
          <div style={{ ...styles.sectionTitle, color: tokens.textMuted }}>平均出货</div>
          {Array.isArray(payload?.averageGroups) && payload.averageGroups.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: '12px' }}>
              {payload.averageGroups.map((group) => (
                <div key={group.id} style={{ ...styles.averageCard, borderColor: tokens.subtleBorder, background: tokens.panelMutedBackground }}>
                  <div style={{ ...styles.sectionTitle, color: tokens.textMuted }}>{group.label}</div>
                  <div style={styles.averageGrid}>
                    {group.items.map((item) => (
                      <div key={`${group.id}-${item.id}`} style={{ ...styles.averageCard, borderColor: tokens.subtleBorder, background: tokens.panelBackground }}>
                        <div style={{ ...styles.averageLabel, color: tokens.textMuted }}>{item.label}</div>
                        <div style={{ ...styles.averageValue, color: tokens.textPrimary }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.averageGrid}>
              {payload?.averageItems?.map((item) => (
                <div key={item.id} style={{ ...styles.averageCard, borderColor: tokens.subtleBorder, background: tokens.panelMutedBackground }}>
                  <div style={{ ...styles.averageLabel, color: tokens.textMuted }}>{item.label}</div>
                  <div style={{ ...styles.averageValue, color: tokens.textPrimary }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ ...styles.averageNote, color: tokens.textMuted }}>
            口径：排除赠送与免费十连；情报书计入有效抽数。
          </div>
        </div>

        <div style={{ ...styles.panel, borderColor: tokens.border, background: tokens.panelBackground }}>
          <div style={{ ...styles.sectionTitle, color: tokens.textMuted }}>当前状态</div>
          {payload?.pitySummary ? (
            <>
              <div style={styles.pityGrid}>
                <div style={{ ...styles.pityCard, borderColor: tokens.subtleBorder, background: tokens.panelMutedBackground }}>
                  <div style={{ ...styles.averageLabel, color: tokens.textMuted }}>当前 6★ 保底</div>
                  <div style={{ ...styles.pityValue, color: tokens.textPrimary }}>{payload.pitySummary.current6}/{payload.pitySummary.max6}</div>
                  <div style={{ ...styles.averageNote, color: tokens.textMuted }}>
                    {payload.pitySummary.inherited6 ? '含跨池继承' : '当前池内累计'}
                  </div>
                </div>
                <div style={{ ...styles.pityCard, borderColor: tokens.subtleBorder, background: tokens.panelMutedBackground }}>
                  <div style={{ ...styles.averageLabel, color: tokens.textMuted }}>当前 5★ 保底</div>
                  <div style={{ ...styles.pityValue, color: tokens.textPrimary }}>{payload.pitySummary.current5}/{payload.pitySummary.max5}</div>
                  <div style={{ ...styles.averageNote, color: tokens.textMuted }}>
                    {payload.pitySummary.inherited5 ? '含跨池继承' : '当前池内累计'}
                  </div>
                </div>
              </div>
              <div style={{ ...styles.averageNote, color: tokens.textMuted }}>
                {payload.pitySummary.probabilityHint || '当前未进入额外概率提升区间。'}
              </div>
            </>
          ) : (
            <div style={{ ...styles.averageNote, marginTop: '12px', color: tokens.textMuted }}>
              {payload?.notes || '当前状态已按多账号/总览边界隐藏。'}
            </div>
          )}
        </div>
      </div>

      <div style={styles.timelineWrap}>
        <div style={styles.timelineHeader}>
          <div>
            <div style={{ ...styles.sectionTitle, color: tokens.textMuted }}>时间线视图</div>
            <div style={{ marginTop: '6px', fontSize: '14px', color: tokens.textSecondary, fontWeight: 600 }}>
              完整整合当前页面的时间线阶段回顾。
            </div>
          </div>
          <div style={styles.counts}>
            <div style={{ ...styles.countBox, borderColor: tokens.border, background: tokens.panelBackground, color: tokens.textSecondary }}>{payload?.totalSections || 0} 个阶段卡池</div>
            <div style={{ ...styles.countBox, borderColor: tokens.border, background: tokens.panelBackground, color: tokens.textSecondary }}>{payload?.totalNodes || 0} 个时间节点</div>
          </div>
        </div>

        {sections.map((section) => (
          <TimelineSection key={section.id} section={section} tokens={tokens} />
        ))}
      </div>

      <div style={{ ...styles.footer, borderTopColor: tokens.border, color: tokens.footerText }}>
        <div style={styles.footerTextWrap}>
          <span>{payload?.notes || '已脱敏分享卡，不含账号、UID、时间戳与原始抽卡明细。'}</span>
          <span>扫码或访问站点即可直接查看完整功能；分享卡仅在本地生成，不创建公共链接。</span>
        </div>
      </div>
    </div>
  );
});

export default DashboardShareCard;
