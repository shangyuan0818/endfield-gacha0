import React, { forwardRef, useMemo } from 'react';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../../utils/simulatorShare';

const SHARE_WATERMARK_NAME = '终末地抽卡分析器';
const SHARE_WATERMARK_URL = 'ef-gacha.mogujun.icu';

const cardStyles = {
  root: {
    width: `${SHARE_CARD_WIDTH}px`,
    height: `${SHARE_CARD_HEIGHT}px`,
    boxSizing: 'border-box',
    background: 'linear-gradient(135deg, #0a0a0b 0%, #12151a 45%, #111827 100%)',
    color: '#f5f5f5',
    padding: '36px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    fontFamily: '"Microsoft YaHei UI", "Segoe UI", sans-serif',
    border: '2px solid #27272a',
    position: 'relative',
    overflow: 'hidden',
  },
  gridOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    pointerEvents: 'none',
  },
  glow: {
    position: 'absolute',
    top: '-80px',
    right: '-20px',
    width: '320px',
    height: '320px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255, 250, 0, 0.18) 0%, rgba(255, 250, 0, 0) 72%)',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '24px',
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
    fontSize: '42px',
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: '#fafafa',
  },
  subTitle: {
    fontSize: '20px',
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
    padding: '8px 14px',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  mutedBadge: {
    color: '#d4d4d8',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '18px',
    position: 'relative',
    zIndex: 1,
  },
  metricCard: {
    border: '1px solid #27272a',
    background: 'rgba(14, 17, 22, 0.88)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minHeight: '148px',
  },
  metricLabel: {
    fontSize: '14px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#a1a1aa',
    fontWeight: 700,
  },
  metricValue: {
    fontSize: '46px',
    lineHeight: 1,
    fontWeight: 800,
    color: '#fafafa',
  },
  metricSub: {
    fontSize: '18px',
    color: '#e4e4e7',
    fontWeight: 600,
  },
  footerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '14px',
    position: 'relative',
    zIndex: 1,
  },
  footerCard: {
    borderTop: '2px solid #facc15',
    background: 'rgba(10, 12, 16, 0.92)',
    padding: '14px 16px',
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
    fontSize: '26px',
    color: '#fafafa',
    fontWeight: 800,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    fontSize: '13px',
    color: '#a1a1aa',
  },
  legalTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  watermarkBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
    textAlign: 'right',
  },
  watermarkName: {
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#fafafa',
  },
  watermarkUrl: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#a1a1aa',
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
    fontSize: '20px',
    fontWeight: 800,
    color: '#fafafa',
  },
  timelineSectionMeta: {
    fontSize: '12px',
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
    width: '58px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  timelinePortrait: {
    width: '52px',
    height: '52px',
    border: '1px solid #3f3f46',
    background: '#18181b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  timelinePortraitFallback: {
    fontSize: '18px',
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
    maxWidth: '88%',
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
    fontSize: '22px',
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

const SimulatorShareCard = forwardRef(function SimulatorShareCard({ payload, sections = [] }, ref) {
  const accentColor = getAccentColor(payload?.poolType);
  const totalNodes = sections.reduce((sum, section) => sum + (section?.entries?.length || 0), 0);
  const primaryCards = useMemo(() => {
    const upLabel = payload?.poolType === 'standard' ? payload?.guaranteeProgress?.label : 'UP 结果';
    const upValue = payload?.poolType === 'standard'
      ? payload?.guaranteeProgress?.summary
      : payload?.upSixStarCount !== null
        ? `${payload?.upSixStarCount} / ${payload?.sixStarCount}`
        : '--';
    const upSub = payload?.poolType === 'standard'
      ? '常驻池保底节点'
      : payload?.winRate !== null
        ? `不歪率 ${payload?.winRate}%`
        : '当前池型无 UP 统计';

    return [
      {
        label: '总抽数',
        value: payload?.totalPulls ?? 0,
        subValue: `当前卡池：${payload?.poolName || '未选择卡池'}`,
      },
      {
        label: '6星',
        value: payload?.sixStarCount ?? 0,
        subValue: `出率 ${payload?.sixStarRate || '0.00'}%`,
      },
      {
        label: '5星',
        value: payload?.fiveStarCount ?? 0,
        subValue: `出率 ${payload?.fiveStarRate || '0.00'}%`,
      },
      {
        label: upLabel,
        value: upValue,
        subValue: upSub,
      },
    ];
  }, [payload]);

  return (
    <div ref={ref} style={{ ...cardStyles.root, height: 'auto', minHeight: `${SHARE_CARD_HEIGHT}px` }}>
      <div style={cardStyles.gridOverlay} />
      <div style={cardStyles.glow} />

      <div style={cardStyles.header}>
        <div style={cardStyles.titleBlock}>
          <div style={cardStyles.eyebrow}>ENDFIELD GACHA ANALYZER</div>
          <div style={cardStyles.title}>{payload?.poolTypeLabel || '模拟分享卡'}</div>
          <div style={cardStyles.subTitle}>
            {payload?.upCharacter
              ? `当前 UP：${payload.upCharacter}`
              : '当前卡池统计快照'}
          </div>
        </div>

        <div style={cardStyles.badges}>
          <div style={{ ...cardStyles.badge, borderColor: accentColor, color: accentColor }}>
            {payload?.poolName || '未选择卡池'}
          </div>
          <div style={{ ...cardStyles.badge, ...cardStyles.mutedBadge }}>
            已脱敏分享卡
          </div>
        </div>
      </div>

      <div style={{ ...cardStyles.metricGrid, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {primaryCards.map((card) => (
          <div key={card.label} style={{ ...cardStyles.metricCard, borderColor: accentColor }}>
            <div style={cardStyles.metricLabel}>{card.label}</div>
            <div style={{ ...cardStyles.metricValue, color: accentColor }}>{card.value}</div>
            <div style={cardStyles.metricSub}>{card.subValue}</div>
          </div>
        ))}
      </div>

      <div style={cardStyles.footerGrid}>
        <div style={cardStyles.footerCard}>
          <div style={cardStyles.footerLabel}>当前 6 星保底</div>
          <div style={cardStyles.footerValue}>{payload?.currentPity6 ?? 0}</div>
          <div style={cardStyles.footerHint}>距离下一次高稀有度出货的累计垫刀</div>
        </div>

        <div style={cardStyles.footerCard}>
          <div style={cardStyles.footerLabel}>当前 5 星保底</div>
          <div style={cardStyles.footerValue}>{payload?.currentPity5 ?? 0}</div>
          <div style={cardStyles.footerHint}>10 抽小保底进度</div>
        </div>

        <div style={cardStyles.footerCard}>
          <div style={cardStyles.footerLabel}>平均出货</div>
          <div style={cardStyles.footerValue}>{payload?.avgPullsPerSixStar ?? '0.00'}</div>
          <div style={cardStyles.footerHint}>按全部 6 星统计，单位：抽/个</div>
        </div>

        <div style={cardStyles.footerCard}>
          <div style={cardStyles.footerLabel}>{payload?.guaranteeProgress?.label || '保底节点'}</div>
          <div style={cardStyles.footerValue}>{payload?.guaranteeProgress?.summary || '0/0'}</div>
          <div style={cardStyles.footerHint}>
            {payload?.guaranteeProgress?.achieved ? '当前节点已完成' : '当前节点尚未完成'}
          </div>
        </div>
      </div>

      {sections.length > 0 && (
        <div style={cardStyles.timelineWrap}>
          <div style={cardStyles.timelineHeader}>
            <div>
              <div style={cardStyles.eyebrow}>TIMELINE SNAPSHOT</div>
              <div style={{ ...cardStyles.metricSub, fontSize: '18px' }}>完整整合当前模拟时间线</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={cardStyles.timelineCount}>{sections.length} 个阶段卡池</div>
              <div style={cardStyles.timelineCount}>{totalNodes} 个时间节点</div>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.id} style={cardStyles.timelineSection}>
              <div>
                <div style={cardStyles.timelineSectionTitle}>{section.title}</div>
                <div style={cardStyles.timelineSectionMeta}>
                  <span>{section.period}</span>
                  <span>·</span>
                  <span>{section.featured || payload?.upCharacter || '当前目标'}</span>
                  <span>·</span>
                  <span>合计 {section.totalPulls} 抽</span>
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
                        <span style={cardStyles.timelinePortraitBadge}>{leadBadge.rarity > 0 ? `${leadBadge.rarity}★` : '阶段'}</span>
                      </div>
                      <span style={cardStyles.timelineDate}>{entry.dateLabel}</span>
                    </div>

                    <div style={cardStyles.timelineBody}>
                      <div style={cardStyles.timelineStageTop}>
                        <span style={cardStyles.timelineStageChip}>{entry.stageLabel}</span>
                        <span style={cardStyles.timelineResult}>{entry.resultSummary}</span>
                      </div>
                      <div style={cardStyles.timelineMeta}>
                        阶段上限 {entry.targetPulls} 抽{entry.metaSummary ? ` · ${entry.metaSummary}` : ''}
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
                          <span style={{ marginLeft: '4px', fontSize: '12px', fontWeight: 700 }}>抽</span>
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
          <span>本分享卡仅保留模拟器汇总统计，不含账号、UID、时间戳与资源账本。</span>
          <span>仅限本地生成，不创建公共链接。</span>
        </div>
        <div style={cardStyles.watermarkBlock}>
          <span style={cardStyles.watermarkName}>{SHARE_WATERMARK_NAME}</span>
          <span style={cardStyles.watermarkUrl}>{SHARE_WATERMARK_URL}</span>
        </div>
      </div>
    </div>
  );
});

export default SimulatorShareCard;
