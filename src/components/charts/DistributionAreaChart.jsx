import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { RARITY_CONFIG } from '../../constants';
import { useI18n } from '../../i18n/index.js';

const DEFAULT_MARGIN = { top: 10, right: 10, left: -20, bottom: 0 };

function getTooltipStyle(isDark, tooltipStyle) {
  if (tooltipStyle) {
    return tooltipStyle;
  }

  return {
    backgroundColor: isDark ? '#18181b' : '#fff',
    border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
    borderRadius: 0,
    fontSize: 12
  };
}

function getSeriesLabels(variant, t) {
  return {
    limited: t(`chart.distribution.${variant}.limited`, {}, t('chart.distribution.character.limited', {}, 'UP')),
    standard: t(`chart.distribution.${variant}.standard`, {}, t('chart.distribution.character.standard', {}, '歪'))
  };
}

const DistributionAreaChart = ({
  data,
  isDark = false,
  tooltipStyle,
  variant = 'character',
  margin = DEFAULT_MARGIN
}) => {
  const { t } = useI18n();
  const gradientId = React.useId().replace(/:/g, '');
  const axisColor = isDark ? '#71717a' : '#a1a1aa';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.12)';
  const labels = getSeriesLabels(variant, t);

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={160}>
        <AreaChart data={data} margin={margin}>
          <defs>
            <linearGradient id={`distribution-limited-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={RARITY_CONFIG[6].color} stopOpacity={0.72} />
              <stop offset="95%" stopColor={RARITY_CONFIG[6].color} stopOpacity={0.08} />
            </linearGradient>
            <linearGradient id={`distribution-standard-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={RARITY_CONFIG['6_std'].color} stopOpacity={0.68} />
              <stop offset="95%" stopColor={RARITY_CONFIG['6_std'].color} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#f4f4f5'} />
          <XAxis
            dataKey="range"
            tick={{ fontSize: 10, fill: axisColor }}
            interval={0}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <RechartsTooltip
            cursor={{ stroke: tooltipBorder, strokeWidth: 1, strokeDasharray: '3 3' }}
            contentStyle={getTooltipStyle(isDark, tooltipStyle)}
            itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
            labelStyle={{ color: isDark ? '#a1a1aa' : '#71717a' }}
            labelFormatter={(label, payload) => {
              const total = Array.isArray(payload)
                ? payload.reduce((sum, item) => sum + (Number(item?.value) || 0), 0)
                : 0;
              return t('chart.distribution.tooltip.range', {
                range: label,
                count: total
              }, `${label} 抽区间 · 共 ${total} 个`);
            }}
            formatter={(value, name) => [
              t('chart.distribution.tooltip.count', {
                count: Number(value) || 0
              }, `${Number(value) || 0} 个`),
              name
            ]}
          />
          <Area
            type="linear"
            dataKey="standard"
            name={labels.standard}
            stroke={RARITY_CONFIG['6_std'].color}
            strokeWidth={2}
            fill={`url(#distribution-standard-${gradientId})`}
            fillOpacity={0.5}
            activeDot={{ r: 4 }}
          />
          <Area
            type="linear"
            dataKey="limited"
            name={labels.limited}
            stroke={RARITY_CONFIG[6].color}
            strokeWidth={2}
            fill={`url(#distribution-limited-${gradientId})`}
            fillOpacity={0.58}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DistributionAreaChart;
