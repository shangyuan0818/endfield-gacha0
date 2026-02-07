import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Cloud } from 'lucide-react';
import { RARITY_CONFIG } from '../../constants';
import RainbowGradientDefs from '../charts/RainbowGradientDefs';

/**
 * 图表区块组件
 * 显示稀有度饼图和6星出货分布柱状图
 */
const ChartSection = ({ title, subtitle, color, data, isGlobal, tooltipStyle, isDark }) => {
  // 检查是否有详细图表数据
  const hasChartData = data?.chartData && data.chartData.length > 0;
  const hasDistribution = data?.distribution && data.distribution.length > 0;
  const hasDetailedData = hasChartData || hasDistribution;

  if (!data || data.total === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className={`font-bold text-lg ${color} mb-4`}>{title}</h3>
        <div className="h-48 flex items-center justify-center text-zinc-400">
          暂无数据
        </div>
      </div>
    );
  }

  // 全服数据没有详细图表数据时显示提示
  if (isGlobal && !hasDetailedData) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className={`font-bold text-lg ${color}`}>{title}</h3>
          {subtitle && <span className="text-xs text-zinc-500">({subtitle})</span>}
          <span className="ml-auto text-sm text-zinc-500">{data.total?.toLocaleString()} 抽</span>
        </div>
        <div className="h-32 flex items-center justify-center text-zinc-500 bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-300 dark:border-zinc-700">
          <div className="text-center">
            <Cloud size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">全服统计数据</p>
            <p className="text-xs text-zinc-400 mt-1">详细图表请切换到「我的数据」查看</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 relative group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      {/* 顶部装饰条 */}
      <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-${color.replace('text-', '')}/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity`}></div>

      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-1 h-4 ${color.replace('text-', 'bg-')}`}></div>
          <h3 className={`font-bold text-base ${color} uppercase tracking-wider`}>{title}</h3>
          {subtitle && <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono border-l border-zinc-200 dark:border-zinc-700 pl-3">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
          <span>总计</span>
          <span className="bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-sm text-zinc-700 dark:text-zinc-300 font-bold min-w-[3rem] text-center">
            {data.total?.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 饼图 */}
        <div className="h-52 relative">
          <p className="text-[10px] font-bold text-zinc-500 mb-2">稀有度分布</p>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <RainbowGradientDefs />
                <Pie
                  data={data.chartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="displayValue"
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
                      `${originalValue}个 (${total > 0 ? (originalValue/total*100).toFixed(1) : 0}%)`,
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
                    return `${value} (${item?.value || 0})`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-400">暂无数据</div>
          )}
        </div>

        {/* 柱状图 */}
        <div className="h-52 relative">
          <p className="text-[10px] font-bold text-zinc-500 mb-2">6星出货分布</p>
          {hasDistribution ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.distribution} margin={{top: 10, right: 0, left: -20, bottom: 0}}>
                <RainbowGradientDefs />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#3f3f46' : '#e4e4e7'} />
                <XAxis dataKey="range" tick={{fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a'}} interval={0} />
                <YAxis allowDecimals={false} tick={{fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a'}} />
                <RechartsTooltip
                  cursor={{fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                  labelStyle={{ color: isDark ? '#a1a1aa' : '#71717a' }}
                />
                <Bar dataKey="limited" stackId="a" fill={RARITY_CONFIG[6].color} name="限定UP" />
                <Bar dataKey="standard" stackId="a" fill={RARITY_CONFIG['6_std'].color} name="常驻歪" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-zinc-400">暂无数据</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
