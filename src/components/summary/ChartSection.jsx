import React from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Cloud } from 'lucide-react';
import { DistributionAreaChart, RainbowGradientDefs } from '../charts';
import { useI18n } from '../../i18n/index.js';

const PIE_LABEL_MIN_PERCENT = 0.05;
const PIE_LABEL_RADIAN = Math.PI / 180;

function resolvePieLabelColor(fill, isDark) {
  if (typeof fill !== 'string' || !fill.startsWith('#')) {
    return isDark ? '#fafafa' : '#ffffff';
  }

  const hex = fill.slice(1);
  const normalized = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex;

  if (normalized.length !== 6) {
    return isDark ? '#fafafa' : '#ffffff';
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luma = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return luma > 170 ? '#111827' : '#ffffff';
}

function renderPiePercentLabel(isDark) {
  return ({ cx, cy, midAngle, innerRadius, outerRadius, percent, fill }) => {
    if (!Number.isFinite(percent) || percent < PIE_LABEL_MIN_PERCENT) {
      return null;
    }

    const radius = innerRadius + ((outerRadius - innerRadius) * 0.58);
    const x = cx + (radius * Math.cos(-midAngle * PIE_LABEL_RADIAN));
    const y = cy + (radius * Math.sin(-midAngle * PIE_LABEL_RADIAN));

    return (
      <text
        x={x}
        y={y}
        fill={resolvePieLabelColor(fill, isDark)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
        style={{ pointerEvents: 'none' }}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };
}

/**
 * 图表区块组件
 * 显示稀有度饼图和 6 星出货趋势图
 */
const ChartSection = ({ title, subtitle, color, data, isGlobal, tooltipStyle, isDark }) => {
  const { t, formatNumber } = useI18n();
  const tt = (key, fallback, params = {}) => t(key, params, fallback);
  // 检查是否有详细图表数据
  const hasChartData = data?.chartData && data.chartData.length > 0;
  const hasDistribution = data?.distribution && data.distribution.length > 0;
  const hasDetailedData = hasChartData || hasDistribution;

  if (!data || data.total === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 min-w-0">
        <h3 className={`font-bold text-lg ${color} mb-4`}>{title}</h3>
        <div className="h-48 flex items-center justify-center text-zinc-400">
          {tt('summary.empty', '暂无数据')}
        </div>
      </div>
    );
  }

  // 全服数据没有详细图表数据时显示提示
  if (isGlobal && !hasDetailedData) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 min-w-0">
        <div className="flex items-center gap-2 mb-4">
          <h3 className={`font-bold text-lg ${color}`}>{title}</h3>
          {subtitle && <span className="text-xs text-zinc-500">({subtitle})</span>}
          <span className="ml-auto text-sm text-zinc-500">{formatNumber(data.total || 0)} {tt('summary.metric.pullsUnit', '抽')}</span>
        </div>
        <div className="h-32 flex items-center justify-center text-zinc-500 bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-300 dark:border-zinc-700">
          <div className="text-center">
            <Cloud size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{tt('summary.notice.globalOnly', '全服统计数据')}</p>
            <p className="text-xs text-zinc-400 mt-1">{tt('summary.notice.globalOnlyHint', '详细图表请切换到「我的数据」查看')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 relative group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors min-w-0">
      {/* 顶部装饰条 */}
      <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-${color.replace('text-', '')}/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity`}></div>

      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-1 h-4 ${color.replace('text-', 'bg-')}`}></div>
          <h3 className={`font-bold text-base ${color} uppercase tracking-wider`}>{title}</h3>
          {subtitle && <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono border-l border-zinc-200 dark:border-zinc-700 pl-3">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <span>{tt('summary.metric.totalShort', '总计')}</span>
          <span className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-sm text-zinc-700 dark:text-zinc-300 font-bold min-w-[3rem] text-center">
            {formatNumber(data.total || 0)}
          </span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 min-w-0">
        {/* 饼图 */}
        <div className="h-52 relative min-w-0">
          <p className="text-[10px] font-bold text-zinc-500 mb-2">{tt('summary.section.rarityDistribution', '稀有度分布')}</p>
          {hasChartData ? (
            <div className="flex h-full items-center justify-center overflow-hidden">
              <PieChart width={320} height={208}>
                <RainbowGradientDefs />
                <Pie
                  data={data.chartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={32}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="displayValue"
                  labelLine={false}
                  label={renderPiePercentLabel(isDark)}
                >
                  {data.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                  labelStyle={{ color: isDark ? '#a1a1aa' : '#71717a' }}
                  formatter={(value, name, props) => {
                    const originalValue = props.payload.value;
                    const total = data.chartData.reduce((sum, d) => sum + d.value, 0);
                    return [
                      `${formatNumber(originalValue)} ${tt('summary.metric.itemsUnit', '个')} (${total > 0 ? (originalValue/total*100).toFixed(1) : 0}%)`,
                      name
                    ];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconSize={10}
                  wrapperStyle={{
                    fontSize: '11px',
                    color: isDark ? '#a1a1aa' : '#71717a'
                  }}
                  formatter={(value) => {
                    const item = data.chartData.find(d => d.name === value);
                    return `${value} (${formatNumber(item?.value || 0)})`;
                  }}
                />
              </PieChart>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-400">{tt('summary.empty', '暂无数据')}</div>
          )}
        </div>

        {/* 面积图 */}
        <div className="h-52 relative min-w-0">
          <p className="text-[10px] font-bold text-zinc-500 mb-2">{tt('summary.section.sixStarTrend', '6★ 出货趋势')}</p>
          {hasDistribution ? (
            <div className="flex h-full items-center justify-center overflow-hidden">
              <DistributionAreaChart
                data={data.distribution}
                isDark={isDark}
                tooltipStyle={tooltipStyle}
                variant={data.distributionVariant}
                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-400">{tt('summary.empty', '暂无数据')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
