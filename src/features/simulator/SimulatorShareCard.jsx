import React, { forwardRef, useMemo } from 'react';
import ShareBrandPanel from '../../components/share/ShareBrandPanel';
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  SHARE_FONT_MONO,
  SHARE_FONT_SANS
} from '../../utils/shareBranding';
import { RESOURCE_ICON_URLS } from '../../utils/resourceEconomy.js';
import { useI18n } from '../../i18n/index.js';

const cardStyles = {
  root: {
    width: `${SHARE_CARD_WIDTH}px`,
    height: `${SHARE_CARD_HEIGHT}px`,
    boxSizing: 'border-box',
    background: 'linear-gradient(148deg, #080b10 0%, #10151c 50%, #18222d 100%)',
    color: '#f5f5f5',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    fontFamily: SHARE_FONT_SANS,
    border: '2px solid #27272a',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundDecor: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 14% 16%, rgba(250, 204, 21, 0.16) 0%, rgba(250, 204, 21, 0) 30%), radial-gradient(circle at 86% 18%, rgba(56, 189, 248, 0.14) 0%, rgba(56, 189, 248, 0) 28%), linear-gradient(160deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 30%)',
    pointerEvents: 'none',
  },
  backgroundPanel: {
    position: 'absolute',
    top: '-92px',
    right: '-74px',
    width: '360px',
    height: '250px',
    borderRadius: '42px',
    transform: 'rotate(-14deg)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 52%, rgba(255, 255, 255, 0) 100%)',
    pointerEvents: 'none',
  },
  backgroundEdge: {
    position: 'absolute',
    bottom: '-120px',
    left: '-36px',
    width: '300px',
    height: '220px',
    borderRadius: '38px',
    transform: 'rotate(12deg)',
    border: '1px solid rgba(56, 189, 248, 0.08)',
    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.09) 0%, rgba(56, 189, 248, 0) 74%)',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '18px',
    position: 'relative',
    zIndex: 1,
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  eyebrow: {
    fontSize: '14px',
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
    color: '#facc15',
    fontWeight: 700,
  },
  title: {
    fontSize: '30px',
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: '#fafafa',
  },
  subTitle: {
    fontSize: '16px',
    color: '#d4d4d8',
    fontWeight: 600,
  },
  badges: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '12px',
  },
  badge: {
    border: '1px solid #3f3f46',
    background: 'rgba(12, 14, 18, 0.86)',
    color: '#facc15',
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  mutedBadge: {
    color: '#d4d4d8',
  },
  statsPanel: {
    position: 'relative',
    zIndex: 1,
    border: '1px solid #27272a',
    background: 'rgba(12, 14, 18, 0.9)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  statsPanelTitle: {
    fontSize: '11px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#a1a1aa',
    fontWeight: 800,
  },
  statsRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  statPill: {
    flex: '1 1 120px',
    minWidth: 0,
    border: '1px solid #3f3f46',
    background: 'rgba(14, 17, 22, 0.88)',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statPillHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
  },
  statPillIcon: {
    width: '16px',
    height: '16px',
    objectFit: 'contain',
    flexShrink: 0,
  },
  statPillLabel: {
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#a1a1aa',
    fontWeight: 700,
  },
  statPillValue: {
    fontSize: '18px',
    lineHeight: 1.1,
    fontWeight: 800,
    color: '#fafafa',
    fontFamily: SHARE_FONT_MONO,
  },
  statPillHint: {
    fontSize: '11px',
    lineHeight: 1.35,
    color: '#d4d4d8',
    fontWeight: 600,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
    position: 'relative',
    zIndex: 1,
  },
  metricCard: {
    border: '1px solid #27272a',
    background: 'rgba(14, 17, 22, 0.88)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minHeight: '108px',
  },
  metricLabel: {
    fontSize: '12px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#a1a1aa',
    fontWeight: 700,
  },
  metricValue: {
    fontSize: '34px',
    lineHeight: 1,
    fontWeight: 800,
    color: '#fafafa',
    fontFamily: SHARE_FONT_MONO,
  },
  metricSub: {
    fontSize: '15px',
    color: '#e4e4e7',
    fontWeight: 600,
  },
  footerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
    position: 'relative',
    zIndex: 1,
  },
  footerCard: {
    borderTop: '2px solid #facc15',
    background: 'rgba(10, 12, 16, 0.92)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  footerLabel: {
    fontSize: '12px',
    color: '#a1a1aa',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  footerValue: {
    fontSize: '22px',
    color: '#fafafa',
    fontWeight: 800,
    fontFamily: SHARE_FONT_MONO,
  },
  footerHint: {
    fontSize: '13px',
    color: '#d4d4d8',
  },
  legal: {
    position: 'relative',
    zIndex: 1,
    borderTop: '1px solid #27272a',
    paddingTop: '14px',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px',
    fontSize: '13px',
    color: '#a1a1aa',
  },
  legalTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  timelineWrap: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px',
  },
  timelineCount: {
    border: '1px solid #27272a',
    background: 'rgba(14, 17, 22, 0.88)',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#d4d4d8',
    fontFamily: SHARE_FONT_MONO,
  },
  timelineSection: {
    border: '1px solid #27272a',
    background: 'rgba(12, 14, 18, 0.9)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  timelineSectionTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#fafafa',
  },
  timelineSectionMeta: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#a1a1aa',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  timelineEntry: {
    display: 'flex',
    gap: '12px',
    borderTop: '1px solid #27272a',
    paddingTop: '12px',
  },
  timelinePortraitWrap: {
    width: '74px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  timelinePortrait: {
    width: '68px',
    height: '68px',
    border: '1px solid #3f3f46',
    background: '#18181b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  timelinePortraitFallback: {
    fontSize: '22px',
    fontWeight: 900,
    color: '#fafafa',
  },
  timelinePortraitBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    background: '#fafafa',
    color: '#111827',
    fontSize: '8px',
    fontWeight: 900,
    padding: '2px 4px',
  },
  timelineDate: {
    fontSize: '10px',
    fontWeight: 800,
    color: '#a1a1aa',
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
  },
  timelineStageTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  timelineStageChip: {
    border: '1px solid #3f3f46',
    background: '#18181b',
    color: '#a1a1aa',
    padding: '3px 6px',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  timelineResult: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f5f5f5',
  },
  timelineMeta: {
    marginTop: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#a1a1aa',
  },
  timelineBarTrack: {
    position: 'relative',
    height: '38px',
    marginTop: '10px',
    border: '1px solid #3f3f46',
    background: '#18181b',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '360px',
  },
  timelineBarFill: {
    position: 'absolute',
    inset: 0,
    left: 0,
  },
  timelineBarValue: {
    position: 'absolute',
    inset: 0,
    left: '14px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '24px',
    fontWeight: 900,
    color: '#09090b',
  },
  timelineBadgeRow: {
    marginTop: '10px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  timelineBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: '1px solid #3f3f46',
    background: '#18181b',
    padding: '4px 8px 4px 4px',
  },
  timelineBadgeThumb: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    background: '#27272a',
    color: '#fafafa',
    fontSize: '10px',
    fontWeight: 900,
  },
  timelineBadgeLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#d4d4d8',
  },
};

function getAccentColor(poolType) {
  if (poolType === 'weapon') {
    return '#38bdf8';
  }

  if (poolType === 'standard') {
    return '#f97316';
  }

  return '#facc15';
}

function getPoolTypeChipLabel(poolType, t) {
  if (poolType === 'weapon') {
    return t('dashboard.timeline.section.weapon');
  }

  if (poolType === 'standard') {
    return t('dashboard.timeline.section.standard');
  }

  return t('dashboard.timeline.section.limited');
}

function getLeadBadge(entry, featured) {
  return entry?.leadBadge || entry?.dropBadges?.[0] || {
    label: featured || '?',
    rarity: 0,
    avatarUrl: null,
  };
}

function getTimelineBarColor(sectionType, entry) {
  if (entry?.stageKind === 'gift') {
    return '#34d399';
  }

  if (entry?.stageKind === 'offStandard' || entry?.stageKind === 'offLimited') {
    return '#fb7185';
  }

  if (sectionType === 'weapon') {
    return '#f59e0b';
  }

  if (sectionType === 'standard') {
    return '#60a5fa';
  }

  return '#facc15';
}

function formatAveragePulls(value, locale, t) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '--';
  }

  return `${numericValue.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${t('simulator.analysis.pullUnit')}`;
}

function getResourceIcon(itemId) {
  if (itemId === 'jade-spent') {
    return RESOURCE_ICON_URLS.jade;
  }

  if (itemId === 'originite-equivalent') {
    return RESOURCE_ICON_URLS.originite;
  }

  if (itemId === 'arsenal-gained' || itemId === 'arsenal-spent') {
    return RESOURCE_ICON_URLS.arsenalQuota;
  }

  return null;
}

function StatPill({ item, accentColor }) {
  return (
    <div
      style={{
        ...cardStyles.statPill,
        borderColor: item.accent ? accentColor : '#3f3f46'
      }}
    >
      <div style={cardStyles.statPillHeader}>
        {item.icon ? (
          <img src={item.icon} alt={item.label} style={cardStyles.statPillIcon} />
        ) : null}
        <div style={cardStyles.statPillLabel}>{item.label}</div>
      </div>
      <div style={{ ...cardStyles.statPillValue, color: item.accent ? accentColor : cardStyles.statPillValue.color }}>
        {item.value}
      </div>
      {item.hint ? (
        <div style={cardStyles.statPillHint}>{item.hint}</div>
      ) : null}
    </div>
  );
}

const SimulatorShareCard = forwardRef(function SimulatorShareCard({ payload, sections = [] }, ref) {
  const { t, locale } = useI18n();
  const accentColor = getAccentColor(payload?.poolType);
  const totalNodes = sections.reduce((sum, section) => sum + (section?.entries?.length || 0), 0);
  const brandChips = [
    t('share.card.desensitized'),
    payload?.poolTypeLabel || t('simulator.shareCard.defaultTitle'),
    payload?.poolName || t('simulator.toast.noSelection')
  ].filter(Boolean);
  const statRows = useMemo(() => {
    const upLabel = payload?.poolType === 'standard' ? payload?.guaranteeProgress?.label : t('simulator.shareCard.upResult');
    const upValue = payload?.poolType === 'standard'
      ? payload?.guaranteeProgress?.summary
      : payload?.upSixStarCount !== null
        ? `${payload?.upSixStarCount} / ${payload?.sixStarCount}`
        : '--';
    const upSub = payload?.poolType === 'standard'
      ? t('simulator.shareCard.standardGuarantee')
      : payload?.winRate !== null
        ? `${t('dashboard.analysis.winRate')} ${payload?.winRate}%`
        : t('simulator.shareCard.noUpStats');
    const averageHint = payload?.poolType === 'standard'
      ? t('simulator.shareCard.averageHintStandard')
      : t('simulator.shareCard.averageHintUp');

    const combinedPity = {
      id: 'current-pity',
      label: t('simulator.shareCard.currentPity'),
      value: `${payload?.currentPity6 ?? 0}/${payload?.currentPity5 ?? 0}`,
      hint: t('simulator.shareCard.pityHint'),
      accent: true,
    };

    return [
      [
        {
          id: 'total-pulls',
          label: t('dashboard.timeline.metric.total'),
          value: payload?.totalPulls ?? 0,
          hint: `${t('dashboard.analysis.currentPool')} ${payload?.poolName || t('simulator.toast.noSelection')}`,
          accent: true,
        },
        {
          id: 'six-star',
          label: '6★',
          value: payload?.sixStarCount ?? 0,
          hint: `${t('dashboard.overview.ratio', { percent: payload?.sixStarRate || '0.00' })}`,
        },
        {
          id: 'five-star',
          label: '5★',
          value: payload?.fiveStarCount ?? 0,
          hint: `${t('dashboard.overview.ratio', { percent: payload?.fiveStarRate || '0.00' })}`,
        },
        {
          id: 'up-result',
          label: upLabel,
          value: upValue,
          hint: upSub,
        },
      ],
      [
        {
          ...combinedPity,
        },
        {
          id: 'avg-six',
          label: t('simulator.shareCard.averagePulls'),
          value: payload?.avgPullsPerSixStar ? `${payload.avgPullsPerSixStar} ${t('simulator.analysis.pullUnit')}` : '--',
          hint: averageHint,
        },
        {
          id: 'guarantee',
          label: payload?.guaranteeProgress?.label || t('simulator.shareCard.standardGuarantee'),
          value: payload?.guaranteeProgress?.summary || '0/0',
          hint: payload?.guaranteeProgress?.achieved ? t('simulator.shareCard.nodeCompleted') : t('simulator.shareCard.nodeProgressing'),
          accent: true,
        },
      ],
      (payload?.resourceItems || []).map((item) => ({
        ...item,
        icon: getResourceIcon(item.id)
      }))
    ];
  }, [payload, t]);

  return (
    <div ref={ref} style={{ ...cardStyles.root, height: 'auto', minHeight: `${SHARE_CARD_HEIGHT}px` }}>
      <div style={cardStyles.backgroundDecor} />
      <div style={cardStyles.backgroundPanel} />
      <div style={cardStyles.backgroundEdge} />

      <div style={cardStyles.header}>
        <div style={cardStyles.titleBlock}>
          <div style={cardStyles.eyebrow}>ENDFIELD GACHA ANALYZER</div>
          <div style={cardStyles.title}>{payload?.poolTypeLabel || t('simulator.shareCard.defaultTitle')}</div>
          <div style={cardStyles.subTitle}>
            {payload?.upCharacter
              ? `${t('pool.card.currentUp')}: ${payload.upCharacter}`
              : t('simulator.shareCard.snapshotSubtitle')}
          </div>
        </div>

        <div style={cardStyles.badges}>
          {brandChips.map((chip) => (
            <div key={chip} style={cardStyles.badge}>
              {chip}
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyles.statsPanel}>
        <div style={cardStyles.statsPanelTitle}>{t('simulator.shareCard.coreStats')}</div>
        <div style={cardStyles.statsRows}>
          {statRows.filter((row) => Array.isArray(row) && row.length > 0).map((row, rowIndex) => (
            <div key={`stats-row-${rowIndex}`} style={cardStyles.statsRow}>
              {row.map((item) => (
                <StatPill key={item.id} item={item} accentColor={accentColor} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {sections.length > 0 && (
        <div style={cardStyles.timelineWrap}>
          <div style={cardStyles.timelineHeader}>
            <div>
              <div style={cardStyles.eyebrow}>{t('dashboard.timeline.header')}</div>
              <div style={{ ...cardStyles.metricSub, fontSize: '18px' }}>{t('dashboard.timeline.subtitle.single')}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={cardStyles.timelineCount}>{t('simulator.shareCard.stagePools', { count: new Intl.NumberFormat(locale).format(sections.length) })}</div>
              <div style={cardStyles.timelineCount}>{t('simulator.shareCard.timelineNodes', { count: new Intl.NumberFormat(locale).format(totalNodes) })}</div>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.id} style={cardStyles.timelineSection}>
              <div>
                <div style={cardStyles.timelineSectionTitle}>{section.title}</div>
                <div style={cardStyles.timelineSectionMeta}>
                  <span>{section.period}</span>
                  <span>·</span>
                  <span>{getPoolTypeChipLabel(section.type || payload?.poolType, t)}</span>
                  <span>·</span>
                  <span>{section.featured || payload?.upCharacter || t('simulator.shareCard.currentTarget')}</span>
                  <span>·</span>
                  <span>{t('dashboard.timeline.metric.total')} {new Intl.NumberFormat(locale).format(section.totalPulls)} {t('simulator.analysis.pullUnit')}</span>
                  <span>·</span>
                  <span>{t('dashboard.timeline.metric.pity')} {section.hidePityState ? t('dashboard.timeline.multiAccount') : `${section.currentPity}/${section.currentPity5}`}</span>
                  <span>·</span>
                  <span>{t('dashboard.timeline.metric.avgSix')} {formatAveragePulls(section.avgSixStarPulls, locale, t)}</span>
                  <span>·</span>
                  <span>
                    {section.type === 'standard' ? t('dashboard.timeline.metric.avgFive') : t('dashboard.timeline.metric.avgUp')}{' '}
                    {section.type === 'standard'
                      ? formatAveragePulls(section.avgFiveStarPulls, locale, t)
                      : formatAveragePulls(section.avgUpPulls, locale, t)}
                  </span>
                </div>
              </div>

              {section.entries.map((entry) => {
                const leadBadge = getLeadBadge(entry, section.featured);
                const barWidth = Math.max(12, Math.min(100, ((entry?.pulls || 0) / Math.max(entry?.targetPulls || 1, 1)) * 100));
                return (
                  <div key={entry.id} style={cardStyles.timelineEntry}>
                    <div style={cardStyles.timelinePortraitWrap}>
                      <div style={cardStyles.timelinePortrait}>
                        {leadBadge.avatarUrl ? (
                          <img src={leadBadge.avatarUrl} alt={leadBadge.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={cardStyles.timelinePortraitFallback}>{leadBadge.label?.slice(0, 1) || '?'}</span>
                        )}
                        <span style={cardStyles.timelinePortraitBadge}>{leadBadge.rarity > 0 ? `${leadBadge.rarity}★` : t('dashboard.timeline.badge.stage')}</span>
                      </div>
                      <span style={cardStyles.timelineDate}>{entry.dateLabel}</span>
                    </div>

                    <div style={cardStyles.timelineBody}>
                      <div style={cardStyles.timelineStageTop}>
                        <span style={cardStyles.timelineStageChip}>{entry.stageLabel}</span>
                        <span style={cardStyles.timelineResult}>{entry.resultSummary}</span>
                      </div>
                      <div style={cardStyles.timelineBarTrack}>
                        <div
                          style={{
                            ...cardStyles.timelineBarFill,
                            width: `${barWidth}%`,
                            background: getTimelineBarColor(section.type, entry)
                          }}
                        />
                        <div style={cardStyles.timelineBarValue}>
                          {entry.pulls}
                          <span style={{ marginLeft: '4px', fontSize: '12px', fontWeight: 700 }}>{t('simulator.analysis.pullUnit')}</span>
                        </div>
                      </div>
                      {entry.dropBadges?.length > 0 && (
                        <div style={cardStyles.timelineBadgeRow}>
                          {entry.dropBadges.map((badge) => (
                            <div key={`${entry.id}-${badge.label}`} style={cardStyles.timelineBadge}>
                              <div style={cardStyles.timelineBadgeThumb}>
                                {badge.avatarUrl ? (
                                  <img src={badge.avatarUrl} alt={badge.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  badge.label.slice(0, 1)
                                )}
                              </div>
                              <span style={cardStyles.timelineBadgeLabel}>
                                {badge.label}{badge.count > 1 ? ` x${badge.count}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div style={cardStyles.legal}>
        <div style={cardStyles.legalTextWrap}>
          <span>{t('share.simulator.noteDesensitized')}</span>
          <span>{t('simulator.shareCard.localOnly')}</span>
        </div>
        <ShareBrandPanel
          theme="dark"
          accentColor={accentColor}
          compact
          showChips={false}
          showHeader={false}
          qrSize={88}
          style={{ width: '236px', marginLeft: 'auto' }}
        />
      </div>
    </div>
  );
});

export default SimulatorShareCard;
