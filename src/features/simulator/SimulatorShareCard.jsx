import React, { forwardRef, useMemo } from 'react';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../../utils/simulatorShare';

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

const SimulatorShareCard = forwardRef(function SimulatorShareCard({ payload }, ref) {
  const accentColor = getAccentColor(payload?.poolType);
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
    <div ref={ref} style={cardStyles.root}>
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

      <div style={cardStyles.legal}>
        <span>本分享卡仅保留模拟器汇总统计，不含账号、UID、时间戳与资源账本。</span>
        <span>仅限本地生成，不创建公共链接。</span>
      </div>
    </div>
  );
});

export default SimulatorShareCard;
