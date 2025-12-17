import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Star, User, Cloud, Layers, Search, RefreshCw, Swords } from 'lucide-react';
import { RARITY_CONFIG } from '../constants';

const SummaryView = React.memo(({ history, pools, globalStats, globalStatsLoading, user }) => {
  // 状态管理：数据源和卡池类型筛选
  const [dataSource, setDataSource] = useState('global'); // 'global' | 'local'
  const [poolTypeFilter, setPoolTypeFilter] = useState('all'); // 'all' | 'character' | 'limited' | 'weapon' | 'standard'

  // 检测暗色模式 - 响应式监听主题变化
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const tooltipStyle = {
    borderRadius: '0px',
    border: isDark ? '1px solid #3f3f46' : '1px solid #e4e4e7',
    boxShadow: isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    color: isDark ? '#e4e4e7' : '#27272a'
  };

  // 过滤当前用户的卡池和历史记录
  const myPools = useMemo(() => {
    if (!pools) return [];
    // 未登录时，不显示"我的数据"（避免读取localStorage数据）
    if (!user) return [];
    // 登录后，只显示当前用户创建的数据（严格匹配 user_id）
    return pools.filter(pool => pool.user_id === user.id);
  }, [pools, user]);

  const myHistory = useMemo(() => {
    if (!history) return [];
    // 未登录时，不显示"我的数据"（避免读取localStorage数据）
    if (!user) return [];
    // 登录后，只显示当前用户创建的数据（严格匹配 user_id）
    return history.filter(h => h.user_id === user.id);
  }, [history, user]);

  // 计算当前用户统计数据（只使用过滤后的数据）
  const localStats = useMemo(() => {
    const data = {
      total: 0,
      sixStar: 0,
      fiveStar: 0,
      counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 },
      byType: {
        limited: { total: 0, six: 0, limitedSix: 0, counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 }, pityList: [] },
        weapon: { total: 0, six: 0, limitedSix: 0, counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 }, pityList: [] },
        standard: { total: 0, six: 0, counts: { 6: 0, '6_std': 0, 5: 0, 4: 0 }, pityList: [] }
      },
      pityStats: { distribution: [] },
      chartData: []
    };

    const poolTypeMap = new Map();
    myPools.forEach(p => poolTypeMap.set(p.id, p.type));

    // 1. 分组（使用过滤后的当前用户数据）
    const pullsByPool = {};
    myHistory.forEach(item => {
      if (!pullsByPool[item.poolId]) pullsByPool[item.poolId] = [];
      pullsByPool[item.poolId].push(item);
    });

    const allSixStarPulls = [];
    let charGiftCount = 0;
    let weaponGiftLimitedCount = 0;
    let weaponGiftStandardCount = 0;

    // 2. 遍历每个池子计算垫刀和赠送
    Object.keys(pullsByPool).forEach(poolId => {
      const type = poolTypeMap.get(poolId) || 'standard';
      const sortedPulls = pullsByPool[poolId].sort((a, b) => a.id - b.id);
      const validPulls = sortedPulls.filter(i => i.specialType !== 'gift');
      const poolTotal = validPulls.length;

      // 计算该卡池的赠送数量
      if (type === 'limited') {
        charGiftCount += Math.floor(poolTotal / 240);
      } else if (type === 'weapon') {
        if (poolTotal >= 100) weaponGiftStandardCount += 1 + Math.floor((poolTotal - 100) / 160);
        if (poolTotal >= 180) weaponGiftLimitedCount += 1 + Math.floor((poolTotal - 180) / 160);
      }

      let tempCounter = 0;
      validPulls.forEach(pull => {
        tempCounter++;
        if (pull.rarity === 6) {
          allSixStarPulls.push({
            count: tempCounter,
            isStandard: pull.isStandard,
            isGuaranteed: pull.specialType === 'guaranteed'
          });
          data.byType[type].pityList.push({
            count: tempCounter,
            isStandard: pull.isStandard
          });
          tempCounter = 0;
        }
      });
    });

    // 辅助：生成分布数据
    const generateDist = (list) => {
      if (!list || list.length === 0) return [];
      const maxPity = Math.max(...list.map(i => i.count), 80);
      const max = Math.ceil(maxPity / 10) * 10;
      const dist = [];
      for(let i=0; i<max; i+=10) {
         const rangeStart = i + 1;
         const rangeEnd = i + 10;
         const items = list.filter(p => p.count >= rangeStart && p.count <= rangeEnd);
         dist.push({
           range: `${rangeStart}-${rangeEnd}`,
           rangeStart,
           count: items.length,
           limited: items.filter(p => !p.isStandard).length,
           standard: items.filter(p => p.isStandard).length
         });
      }
      // 按 rangeStart 排序确保顺序正确
      return dist.sort((a, b) => a.rangeStart - b.rangeStart);
    };

    // 辅助：生成饼图数据
    const generatePieData = (counts) => [
      { name: '6星(限定)', value: counts[6], color: RARITY_CONFIG[6].color },
      { name: '6星(常驻)', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color },
      { name: '5星', value: counts[5], color: RARITY_CONFIG[5].color },
      { name: '4星', value: counts[4], color: RARITY_CONFIG[4].color },
    ].filter(item => item.value > 0);

    // 3. 全局统计 & 分类计数（使用过滤后的当前用户数据）
    myHistory.forEach(item => {
      const type = poolTypeMap.get(item.poolId) || 'standard';
      const typeData = data.byType[type];

      if (item.specialType !== 'gift') {
         data.total++;
         typeData.total++;
      }

      let r = item.rarity;
      // 排除赠送的6星统计
      if (r === 6 && item.specialType !== 'gift') {
        if (item.isStandard) {
           data.counts['6_std']++;
           typeData.counts['6_std']++;
        } else {
           data.counts[6]++;
           typeData.counts[6]++;
        }
        data.sixStar++;
        typeData.six++;
        if (!item.isStandard && typeData.limitedSix !== undefined) {
           typeData.limitedSix++;
        }
      } else if (r !== 6) {
        if (r === 5) {
           data.fiveStar++;
           data.counts[5]++;
           typeData.counts[5]++;
        } else {
           if (r < 4) r = 4;
           data.counts[r]++;
           typeData.counts[r]++;
        }
      }
    });

    // 4. 生成图表数据
    data.chartData = generatePieData(data.counts);

    ['limited', 'weapon', 'standard'].forEach(t => {
       data.byType[t].distribution = generateDist(data.byType[t].pityList);
       data.byType[t].chartData = generatePieData(data.byType[t].counts);
    });

    // 5. 全局分布
    if (allSixStarPulls.length > 0) {
      const maxPity = Math.max(...allSixStarPulls.map(p => p.count), 80);
      const maxRange = Math.ceil(maxPity / 10) * 10;
      for (let i = 0; i < maxRange; i += 10) {
        const rangeStart = i + 1;
        const rangeEnd = i + 10;
        const items = allSixStarPulls.filter(p => p.count >= rangeStart && p.count <= rangeEnd);
        data.pityStats.distribution.push({
          range: `${rangeStart}-${rangeEnd}`,
          count: items.length,
          limited: items.filter(p => !p.isStandard).length,
          standard: items.filter(p => p.isStandard).length,
          guaranteed: items.filter(p => p.isGuaranteed).length
        });
      }
    }

    // 6. 计算合并的角色池数据（限定+常驻）
    const characterCounts = {
      6: data.byType.limited.counts[6] + data.byType.standard.counts[6],
      '6_std': data.byType.limited.counts['6_std'] + data.byType.standard.counts['6_std'],
      5: data.byType.limited.counts[5] + data.byType.standard.counts[5],
      4: data.byType.limited.counts[4] + data.byType.standard.counts[4]
    };
    const characterPityList = [...data.byType.limited.pityList, ...data.byType.standard.pityList];

    data.byType.character = {
      total: data.byType.limited.total + data.byType.standard.total,
      six: data.byType.limited.six + data.byType.standard.six,
      limitedSix: data.byType.limited.limitedSix,
      counts: characterCounts,
      pityList: characterPityList,
      distribution: generateDist(characterPityList),
      chartData: generatePieData(characterCounts)
    };

    // 计算平均出货
    data.avgPity = allSixStarPulls.length > 0
      ? (allSixStarPulls.reduce((sum, p) => sum + p.count, 0) / allSixStarPulls.length).toFixed(1)
      : '-';

    // 赠送数量
    data.charGift = charGiftCount;
    data.weaponGiftLimited = weaponGiftLimitedCount;
    data.weaponGiftStandard = weaponGiftStandardCount;
    data.giftTotal = charGiftCount + weaponGiftLimitedCount + weaponGiftStandardCount;

    return data;
  }, [myHistory, myPools]);

  // 根据数据源和筛选条件获取当前显示的统计数据
  const currentStats = useMemo(() => {
    const isGlobal = dataSource === 'global' && globalStats;
    const baseStats = isGlobal ? globalStats : localStats;

    if (!baseStats) return null;

    // 根据筛选条件返回对应数据
    if (poolTypeFilter === 'all') {
      return {
        title: isGlobal ? '全服数据' : '我的数据',
        subtitle: '全部卡池',
        total: baseStats.totalPulls ?? baseStats.total,
        sixStar: baseStats.sixStarTotal ?? baseStats.sixStar,
        sixStarLimited: baseStats.sixStarLimited ?? baseStats.counts?.[6],
        sixStarStandard: baseStats.sixStarStandard ?? baseStats.counts?.['6_std'],
        avgPity: baseStats.avgPity,
        counts: baseStats.counts,
        byType: baseStats.byType,
        totalUsers: baseStats.totalUsers,
        charGift: baseStats.charGift || 0,
        weaponGiftLimited: baseStats.weaponGiftLimited || 0,
        weaponGiftStandard: baseStats.weaponGiftStandard || 0,
        giftTotal: baseStats.giftTotal || 0
      };
    }

    // 特定卡池类型
    const typeData = baseStats.byType?.[poolTypeFilter];
    if (!typeData) return null;

    const typeNames = {
      character: '角色池（限定+常驻）',
      limited: '限定角色池',
      weapon: '武器池',
      standard: '常驻池'
    };

    // 计算平均出货：优先使用 avgPity，其次从 pityList 计算（本地数据）
    let avgPity = '-';
    if (typeData.avgPity) {
      avgPity = typeData.avgPity;
    } else if (typeData.pityList?.length > 0) {
      avgPity = (typeData.pityList.reduce((sum, p) => sum + p.count, 0) / typeData.pityList.length).toFixed(1);
    }

    return {
      title: isGlobal ? '全服数据' : '我的数据',
      subtitle: typeNames[poolTypeFilter],
      total: typeData.total,
      sixStar: typeData.six ?? typeData.sixStar,
      sixStarLimited: typeData.limitedSix ?? typeData.sixStarLimited ?? typeData.counts?.[6],
      sixStarStandard: typeData.counts?.['6_std'] ?? typeData.sixStarStandard,
      avgPity: avgPity,
      counts: typeData.counts,
      distribution: typeData.distribution,
      chartData: typeData.chartData,
      totalUsers: baseStats.totalUsers
    };
  }, [dataSource, poolTypeFilter, globalStats, localStats]);

  // 获取图表显示数据
  const chartDisplayData = useMemo(() => {
    const isGlobal = dataSource === 'global' && globalStats;
    const baseStats = isGlobal ? globalStats : localStats;

    if (!baseStats) return { charts: [], isGlobal };

    // 如果选择了特定类型，只显示该类型
    if (poolTypeFilter !== 'all') {
      const typeData = baseStats.byType?.[poolTypeFilter];
      if (!typeData) return { charts: [], isGlobal };

      const typeNames = {
        character: '角色池',
        limited: '限定池',
        weapon: '武器池',
        standard: '常驻池'
      };
      const typeColors = {
        character: 'rainbow-text',
        limited: 'rainbow-text',
        weapon: 'text-slate-500',
        standard: 'text-indigo-500'
      };

      return {
        isGlobal,
        charts: [{
          title: typeNames[poolTypeFilter],
          color: typeColors[poolTypeFilter],
          data: typeData
        }]
      };
    }

    // 全部数据时：角色池（合并）+ 武器池
    return {
      isGlobal,
      charts: [
        {
          title: '角色池',
          subtitle: '限定 + 常驻',
          color: 'text-violet-500',
          data: baseStats.byType?.character || {
            total: (baseStats.byType?.limited?.total || 0) + (baseStats.byType?.standard?.total || 0),
            six: (baseStats.byType?.limited?.six || 0) + (baseStats.byType?.standard?.six || 0),
            counts: {
              6: (baseStats.byType?.limited?.counts?.[6] || 0) + (baseStats.byType?.standard?.counts?.[6] || 0),
              '6_std': (baseStats.byType?.limited?.counts?.['6_std'] || 0) + (baseStats.byType?.standard?.counts?.['6_std'] || 0),
              5: (baseStats.byType?.limited?.counts?.[5] || 0) + (baseStats.byType?.standard?.counts?.[5] || 0),
              4: (baseStats.byType?.limited?.counts?.[4] || 0) + (baseStats.byType?.standard?.counts?.[4] || 0)
            },
            distribution: [...(baseStats.byType?.limited?.distribution || [])],
            chartData: baseStats.byType?.limited?.chartData || []
          }
        },
        {
          title: '武器池',
          color: 'text-slate-500',
          data: baseStats.byType?.weapon || { total: 0, six: 0, counts: {}, distribution: [], chartData: [] }
        }
      ]
    };
  }, [dataSource, poolTypeFilter, globalStats, localStats]);

  // 侧边栏选项组件
  const SidebarItem = ({ label, icon: Icon, isActive, onClick, indent = false, count }) => (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
        indent ? 'pl-8' : ''
      } ${
        isActive
          ? 'bg-endfield-yellow text-black font-bold'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      {Icon && <Icon size={14} />}
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className={`text-xs ${isActive ? 'text-black/60' : 'text-zinc-600'}`}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );

  // 图表区块组件
  const ChartSection = ({ title, subtitle, color, data, isGlobal }) => {
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className={`font-bold text-lg ${color}`}>{title}</h3>
          {subtitle && <span className="text-xs text-zinc-500">({subtitle})</span>}
          <span className="ml-auto text-sm text-zinc-500">{data.total?.toLocaleString()} 抽</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 饼图 */}
          <div className="h-52 relative">
            <p className="text-[10px] font-bold text-zinc-500 mb-2">稀有度分布</p>
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                    labelStyle={{ color: isDark ? '#a1a1aa' : '#71717a' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={10}
                    wrapperStyle={{
                      fontSize: '11px',
                      color: isDark ? '#a1a1aa' : '#71717a'
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 侧边栏 + 内容区（两列布局）*/}
      <div className="flex gap-6">
        {/* 左侧边栏 - 数据源选择 */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-zinc-900 border border-zinc-800 sticky top-4">
            {/* 全服数据分组 */}
            <div className="border-b border-zinc-800">
              <SidebarItem
                label="全服数据"
                icon={Cloud}
                isActive={dataSource === 'global' && poolTypeFilter === 'all'}
                onClick={() => { setDataSource('global'); setPoolTypeFilter('all'); }}
                count={globalStats?.totalPulls}
              />
              {dataSource === 'global' && (
                <div className="bg-zinc-950">
                  <SidebarItem
                    label="限定池"
                    icon={Star}
                    indent
                    isActive={dataSource === 'global' && poolTypeFilter === 'limited'}
                    onClick={() => { setDataSource('global'); setPoolTypeFilter('limited'); }}
                    count={globalStats?.byType?.limited?.total}
                  />
                  <SidebarItem
                    label="常驻池"
                    icon={Layers}
                    indent
                    isActive={dataSource === 'global' && poolTypeFilter === 'standard'}
                    onClick={() => { setDataSource('global'); setPoolTypeFilter('standard'); }}
                    count={globalStats?.byType?.standard?.total}
                  />
                  <SidebarItem
                    label="武器池"
                    icon={Search}
                    indent
                    isActive={dataSource === 'global' && poolTypeFilter === 'weapon'}
                    onClick={() => { setDataSource('global'); setPoolTypeFilter('weapon'); }}
                    count={globalStats?.byType?.weapon?.total}
                  />
                </div>
              )}
            </div>

            {/* 我的数据分组 */}
            <div>
              <SidebarItem
                label="我的数据"
                icon={User}
                isActive={dataSource === 'local' && poolTypeFilter === 'all'}
                onClick={() => { setDataSource('local'); setPoolTypeFilter('all'); }}
                count={localStats.total}
              />
              {dataSource === 'local' && (
                <div className="bg-zinc-950">
                  <SidebarItem
                    label="限定池"
                    icon={Star}
                    indent
                    isActive={dataSource === 'local' && poolTypeFilter === 'limited'}
                    onClick={() => { setDataSource('local'); setPoolTypeFilter('limited'); }}
                    count={localStats.byType.limited.total}
                  />
                  <SidebarItem
                    label="常驻池"
                    icon={Layers}
                    indent
                    isActive={dataSource === 'local' && poolTypeFilter === 'standard'}
                    onClick={() => { setDataSource('local'); setPoolTypeFilter('standard'); }}
                    count={localStats.byType.standard.total}
                  />
                  <SidebarItem
                    label="武器池"
                    icon={Search}
                    indent
                    isActive={dataSource === 'local' && poolTypeFilter === 'weapon'}
                    onClick={() => { setDataSource('local'); setPoolTypeFilter('weapon'); }}
                    count={localStats.byType.weapon.total}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 space-y-6">
          {/* 统计信息卡片 */}
        {globalStatsLoading && dataSource === 'global' ? (
          <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 text-white flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-zinc-500" />
            <span className="ml-2 text-zinc-500">加载全服数据...</span>
          </div>
        ) : currentStats ? (
          <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              {/* 标题 */}
              <div className="flex items-center gap-2 mb-4">
                {dataSource === 'global' ? (
                  <Cloud size={20} className="text-indigo-400" />
                ) : (
                  <User size={20} className="text-endfield-yellow" />
                )}
                <h2 className={`font-bold text-sm uppercase tracking-wider ${dataSource === 'global' ? 'text-indigo-400' : 'text-endfield-yellow'}`}>
                  {currentStats.title}
                </h2>
                <span className="text-zinc-500 text-xs">/ {currentStats.subtitle}</span>
                {currentStats.totalUsers && (
                  <span className="text-zinc-600 text-xs ml-auto">({currentStats.totalUsers} 位用户)</span>
                )}
              </div>

              {/* 统计数据 */}
              {poolTypeFilter === 'all' ? (
                /* 全部卡池时：分区显示角色池和武器池 */
                <div className="space-y-4">
                  {/* 总览 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4">
                      <div className="text-zinc-400 text-xs mb-1">总抽数</div>
                      <div className="text-3xl font-black">{(currentStats.total || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-white/5 p-4">
                      <div className="text-zinc-400 text-xs mb-1">参与用户</div>
                      <div className="text-3xl font-black text-zinc-300">{currentStats.totalUsers || '-'}</div>
                    </div>
                  </div>

                  {/* 角色池统计（限定+常驻） */}
                  <div className="bg-white/5 p-4">
                    <div className="rainbow-text text-xs font-bold mb-3 flex items-center gap-2">
                      <Star size={14} />
                      角色池（限定+常驻）
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-zinc-500 text-[10px]">总抽数</div>
                        <div className="text-xl font-bold">{((currentStats.byType?.limited?.total || 0) + (currentStats.byType?.standard?.total || 0)).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">6星出货</div>
                        <div className="text-xl font-bold text-yellow-400">
                          {(currentStats.byType?.limited?.six || 0) + (currentStats.byType?.standard?.six || 0)}
                          {currentStats.charGift > 0 && (
                            <span className="text-purple-400 text-sm ml-1">+{currentStats.charGift}赠</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">平均出货</div>
                        <div className="text-xl font-bold text-indigo-400">
                          {(() => {
                            const limitedAvg = currentStats.byType?.limited?.avgPity;
                            const standardAvg = currentStats.byType?.standard?.avgPity;
                            const limitedSix = currentStats.byType?.limited?.six || 0;
                            const standardSix = currentStats.byType?.standard?.six || 0;
                            if (limitedSix + standardSix === 0) return '-';
                            const weighted = ((parseFloat(limitedAvg) || 0) * limitedSix + (parseFloat(standardAvg) || 0) * standardSix) / (limitedSix + standardSix);
                            return weighted.toFixed(1);
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">限定/常驻(不歪率)</div>
                        <div className="text-lg font-bold">
                          {(() => {
                            const limitedPool = currentStats.byType?.limited || {};
                            const standardPool = currentStats.byType?.standard || {};
                            const limitedUp = (limitedPool.sixStarLimited ?? limitedPool.limitedSix ?? 0);
                            const standardUp = (standardPool.sixStarLimited ?? standardPool.limitedSix ?? 0);
                            const totalLimited = limitedUp + standardUp;
                            const limitedStd = (limitedPool.six || 0) - limitedUp;
                            const standardStd = (standardPool.six || 0) - standardUp;
                            const totalStd = limitedStd + standardStd;
                            const totalSix = (limitedPool.six || 0) + (standardPool.six || 0);
                            const rate = totalSix > 0 ? ((totalLimited / totalSix) * 100).toFixed(1) : 0;
                            return (
                              <>
                                <span className="rainbow-text">{totalLimited}</span>
                                <span className="text-zinc-600 mx-1">/</span>
                                <span className="text-red-400">{totalStd}</span>
                                <span className="text-zinc-500 text-xs ml-2">({rate}%)</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* 限定池 vs 常驻池细分 */}
                    <div className="mt-3 pt-3 border-t border-zinc-700 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="rainbow-text font-medium mb-1">限定池</div>
                        <div className="text-zinc-400">
                          {(currentStats.byType?.limited?.total || 0).toLocaleString()}抽 |
                          <span className="text-yellow-400 ml-1">{currentStats.byType?.limited?.six || 0}</span>
                          {currentStats.charGift > 0 && <span className="text-purple-400">+{currentStats.charGift}赠</span>}
                          <span>个6星 |</span>
                          平均<span className="text-indigo-400 ml-1">{currentStats.byType?.limited?.avgPity || '-'}</span>抽
                        </div>
                      </div>
                      <div>
                        <div className="text-indigo-500 font-medium mb-1">常驻池</div>
                        <div className="text-zinc-400">
                          {(currentStats.byType?.standard?.total || 0).toLocaleString()}抽 |
                          <span className="text-yellow-400 ml-1">{currentStats.byType?.standard?.six || 0}</span>个6星 |
                          平均<span className="text-indigo-400 ml-1">{currentStats.byType?.standard?.avgPity || '-'}</span>抽
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 武器池统计 */}
                  <div className="bg-white/5 p-4">
                    <div className="text-slate-400 text-xs font-bold mb-3 flex items-center gap-2">
                      <Swords size={14} />
                      武器池
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-zinc-500 text-[10px]">总抽数</div>
                        <div className="text-xl font-bold">{(currentStats.byType?.weapon?.total || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">6星出货</div>
                        <div className="text-xl font-bold text-yellow-400">
                          {currentStats.byType?.weapon?.six || 0}
                          {(currentStats.weaponGiftLimited > 0 || currentStats.weaponGiftStandard > 0) && (
                            <span className="text-purple-400 text-sm ml-1">+{currentStats.weaponGiftLimited + currentStats.weaponGiftStandard}赠</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">平均出货</div>
                        <div className="text-xl font-bold text-indigo-400">{currentStats.byType?.weapon?.avgPity || '-'}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">限定/常驻(不歪率)</div>
                        <div className="text-lg font-bold">
                          {(() => {
                            const weapon = currentStats.byType?.weapon || {};
                            const limitedUp = (weapon.sixStarLimited ?? weapon.limitedSix ?? 0);
                            const totalSix = weapon.six || 0;
                            const stdSix = totalSix - limitedUp;
                            const rate = totalSix > 0 ? ((limitedUp / totalSix) * 100).toFixed(1) : 0;
                            return (
                              <>
                                <span className="rainbow-text">{limitedUp}</span>
                                <span className="text-zinc-600 mx-1">/</span>
                                <span className="text-red-400">{stdSix}</span>
                                <span className="text-zinc-500 text-xs ml-2">({rate}%)</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* 特定卡池类型时：原有显示 */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 p-4">
                    <div className="text-zinc-400 text-xs mb-1">总抽数</div>
                    <div className="text-3xl font-black">{(currentStats.total || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-white/5 p-4">
                    <div className="text-zinc-400 text-xs mb-1">6星出货</div>
                    <div className="text-3xl font-black text-yellow-400">{currentStats.sixStar || 0}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      出货率 {currentStats.total > 0 ? ((currentStats.sixStar / currentStats.total) * 100).toFixed(2) : 0}%
                    </div>
                  </div>
                  <div className="bg-white/5 p-4">
                    <div className="text-zinc-400 text-xs mb-1">平均出货</div>
                    <div className="text-3xl font-black text-indigo-400">{currentStats.avgPity || '-'}</div>
                    <div className="text-xs text-zinc-500 mt-1">抽/只</div>
                  </div>
                  <div className="bg-white/5 p-4">
                    <div className="text-zinc-400 text-xs mb-1">限定/常驻</div>
                    <div className="text-lg font-bold">
                      <span className="rainbow-text">{currentStats.sixStarLimited || 0}</span>
                      <span className="text-zinc-600 mx-1">/</span>
                      <span className="text-red-400">{currentStats.sixStarStandard || 0}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      不歪率 {currentStats.sixStar > 0 ? ((currentStats.sixStarLimited / currentStats.sixStar) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute -right-10 -bottom-10 text-zinc-700 opacity-20">
              <Star size={200} />
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 p-8 text-center text-zinc-500">
            暂无数据
          </div>
        )}

          {/* 图表区域 */}
          <div className="space-y-6">
            {chartDisplayData.charts.map((chart, index) => (
              <ChartSection
                key={index}
                title={chart.title}
                subtitle={chart.subtitle}
                color={chart.color}
                data={chart.data}
                isGlobal={chartDisplayData.isGlobal}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SummaryView;
