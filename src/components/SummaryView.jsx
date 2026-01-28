import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Star, User, Cloud, Layers, Search, RefreshCw, Swords, Trophy } from 'lucide-react';
import { RARITY_CONFIG } from '../constants';
import RainbowGradientDefs from './charts/RainbowGradientDefs';
import { characterCache } from '../utils/characterUtils';
import { getCharacterRankingStats, getUserRankingStats } from '../services/statsService';

const SummaryView = React.memo(({ history, pools, globalStats, globalStatsLoading, user }) => {
  // 状态管理：数据源和卡池类型筛选
  const [dataSource, setDataSource] = useState('global'); // 'global' | 'local'
  const [poolTypeFilter, setPoolTypeFilter] = useState('all'); // 'all' | 'character' | 'limited' | 'weapon' | 'standard'

  // 角色排名统计
  const [characterRanking, setCharacterRanking] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  // 用户个人排名统计
  const [userRanking, setUserRanking] = useState(null);
  const [userRankingLoading, setUserRankingLoading] = useState(false);

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

  // 加载角色排名统计（仅全服数据时加载）
  useEffect(() => {
    if (dataSource === 'global' && !characterRanking && !rankingLoading) {
      setRankingLoading(true);
      getCharacterRankingStats()
        .then(data => {
          setCharacterRanking(data);
        })
        .finally(() => {
          setRankingLoading(false);
        });
    }
  }, [dataSource, characterRanking, rankingLoading]);

  // 加载用户个人排名统计
  useEffect(() => {
    if (dataSource === 'local' && user?.id && !userRanking && !userRankingLoading) {
      setUserRankingLoading(true);
      getUserRankingStats(user.id)
        .then(data => {
          setUserRanking(data);
        })
        .finally(() => {
          setUserRankingLoading(false);
        });
    }
  }, [dataSource, user, userRanking, userRankingLoading]);

  // 当用户变更时重置个人排名
  useEffect(() => {
    setUserRanking(null);
  }, [user?.id]);

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

    // 类型映射：将不同的池子类型映射到三种基本类型
    const normalizePoolType = (type) => {
      if (type === 'limited' || type === 'limited_character') return 'limited';
      if (type === 'weapon' || type === 'limited_weapon') return 'weapon';
      return 'standard'; // standard, beginner 等都归为 standard
    };

    // 1. 分组（使用过滤后的当前用户数据）
    const pullsByPool = {};
    myHistory.forEach(item => {
      if (!pullsByPool[item.poolId]) pullsByPool[item.poolId] = [];
      pullsByPool[item.poolId].push(item);
    });

    const allSixStarPulls = [];
    const allSixStarPullsExcludingFree = []; // 不含免费十连的6星记录
    let charGiftCount = 0;
    let weaponGiftLimitedCount = 0;
    let weaponGiftStandardCount = 0;

    // 2. 遍历每个池子计算垫刀和赠送
    Object.keys(pullsByPool).forEach(poolId => {
      const rawType = poolTypeMap.get(poolId) || 'standard';
      const type = normalizePoolType(rawType);
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
      let tempCounterExcludingFree = 0; // 不含免费十连的计数器
      validPulls.forEach(pull => {
        const isFree = pull.isFree || pull.is_free;
        tempCounter++;
        if (!isFree) {
          tempCounterExcludingFree++;
        }

        if (pull.rarity === 6) {
          allSixStarPulls.push({
            count: tempCounter,
            isStandard: pull.isStandard,
            isGuaranteed: pull.specialType === 'guaranteed',
            isFree: isFree
          });

          // 不含免费十连的记录
          if (!isFree) {
            allSixStarPullsExcludingFree.push({
              count: tempCounterExcludingFree,
              isStandard: pull.isStandard,
              isGuaranteed: pull.specialType === 'guaranteed'
            });
            // 只有非免费的才重置计数器
            tempCounterExcludingFree = 0;
          }

          data.byType[type].pityList.push({
            count: tempCounter,
            isStandard: pull.isStandard,
            isFree: isFree
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

    // 辅助：生成饼图数据（带增强显示值）
    const generatePieData = (counts) => {
      const rawData = [
        { name: '6星(限定)', value: counts[6], color: RARITY_CONFIG[6].color },
        { name: '6星(常驻)', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color },
        { name: '5星', value: counts[5], color: RARITY_CONFIG[5].color },
        { name: '4星', value: counts[4], color: RARITY_CONFIG[4].color },
      ].filter(item => item.value > 0);

      // 增强稀有度显示占比：6星最小15%，5星最小20%
      const totalValue = rawData.reduce((sum, d) => sum + d.value, 0);
      return rawData.map(item => {
        const currentPercent = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
        let minPercent = 0;
        if (item.name.includes('6星')) minPercent = 15;
        else if (item.name.includes('5星')) minPercent = 20;

        if (currentPercent < minPercent && totalValue > 0) {
          return { ...item, displayValue: Math.ceil(totalValue * minPercent / 100) };
        }
        return { ...item, displayValue: item.value };
      });
    };

    // 3. 全局统计 & 分类计数（使用过滤后的当前用户数据）
    myHistory.forEach(item => {
      const rawType = poolTypeMap.get(item.poolId) || 'standard';
      const type = normalizePoolType(rawType);
      const typeData = data.byType[type];

      if (!typeData) {
        console.warn('[SummaryView] 未知的卡池类型:', rawType, '-> 映射为:', type);
        return;
      }

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
       // 计算平均出货
       if (data.byType[t].pityList.length > 0) {
         data.byType[t].avgPity = (data.byType[t].pityList.reduce((sum, p) => sum + p.count, 0) / data.byType[t].pityList.length).toFixed(1);
       }
       // 限定池计算不含免费十连的平均出货
       if (t === 'limited') {
         const nonFreeList = data.byType[t].pityList.filter(p => !p.isFree);
         if (nonFreeList.length > 0) {
           data.byType[t].avgPityExcludingFree = (nonFreeList.reduce((sum, p) => sum + p.count, 0) / nonFreeList.length).toFixed(1);
         }
       }
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

    // 计算不含免费十连的 pityList（限定池专用）
    const limitedPityListExcludingFree = data.byType.limited.pityList.filter(p => !p.isFree);
    const characterPityListExcludingFree = characterPityList.filter(p => !p.isFree);

    data.byType.character = {
      total: data.byType.limited.total + data.byType.standard.total,
      six: data.byType.limited.six + data.byType.standard.six,
      limitedSix: data.byType.limited.limitedSix,
      counts: characterCounts,
      pityList: characterPityList,
      pityListExcludingFree: characterPityListExcludingFree,
      distribution: generateDist(characterPityList),
      chartData: generatePieData(characterCounts),
      // 计算角色池平均出货
      avgPity: characterPityList.length > 0
        ? (characterPityList.reduce((sum, p) => sum + p.count, 0) / characterPityList.length).toFixed(1)
        : '-',
      // 计算不含免费十连的平均出货
      avgPityExcludingFree: characterPityListExcludingFree.length > 0
        ? (characterPityListExcludingFree.reduce((sum, p) => sum + p.count, 0) / characterPityListExcludingFree.length).toFixed(1)
        : null
    };

    // 为限定池添加不含免费十连的 pityList
    data.byType.limited.pityListExcludingFree = limitedPityListExcludingFree;

    // 计算平均出货
    data.avgPity = allSixStarPulls.length > 0
      ? (allSixStarPulls.reduce((sum, p) => sum + p.count, 0) / allSixStarPulls.length).toFixed(1)
      : '-';

    // 计算不含免费十连的平均出货
    data.avgPityExcludingFree = allSixStarPullsExcludingFree.length > 0
      ? (allSixStarPullsExcludingFree.reduce((sum, p) => sum + p.count, 0) / allSixStarPullsExcludingFree.length).toFixed(1)
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

    // 计算不含免费十连的平均出货（仅限定池和角色池需要）
    let avgPityExcludingFree = null;
    if (poolTypeFilter === 'limited' || poolTypeFilter === 'character') {
      if (typeData.avgPityExcludingFree) {
        avgPityExcludingFree = typeData.avgPityExcludingFree;
      } else if (typeData.pityListExcludingFree?.length > 0) {
        avgPityExcludingFree = (typeData.pityListExcludingFree.reduce((sum, p) => sum + p.count, 0) / typeData.pityListExcludingFree.length).toFixed(1);
      } else if (typeData.pityList?.length > 0) {
        // 如果没有 pityListExcludingFree，从 pityList 过滤
        const nonFreeList = typeData.pityList.filter(p => !p.isFree);
        if (nonFreeList.length > 0) {
          avgPityExcludingFree = (nonFreeList.reduce((sum, p) => sum + p.count, 0) / nonFreeList.length).toFixed(1);
        }
      }
    }

    return {
      title: isGlobal ? '全服数据' : '我的数据',
      subtitle: typeNames[poolTypeFilter],
      total: typeData.total,
      sixStar: typeData.six ?? typeData.sixStar,
      sixStarLimited: typeData.limitedSix ?? typeData.sixStarLimited ?? typeData.counts?.[6],
      sixStarStandard: typeData.counts?.['6_std'] ?? typeData.sixStarStandard,
      avgPity: avgPity,
      avgPityExcludingFree: avgPityExcludingFree,
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
      className={`w-full text-left px-4 py-3 text-sm transition-all flex items-center gap-3 relative group overflow-hidden ${
        indent ? 'pl-10' : ''
      } ${
        isActive
          ? 'bg-endfield-yellow text-black font-bold'
          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
      }`}
    >
      {/* 激活状态左侧装饰条 */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-black/20"></div>
      )}
      
      {/* 图标 */}
      {Icon && <Icon size={16} className={`transition-transform group-hover:scale-110 ${isActive ? 'text-black' : 'text-zinc-500 group-hover:text-zinc-300'}`} />}
      
      <span className="flex-1 tracking-wide">{label}</span>
      
      {/* 计数 */}
      {count !== undefined && (
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded-sm ${
          isActive 
            ? 'bg-black/10 text-black/70' 
            : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-400'
        }`}>
          {count.toLocaleString()}
        </span>
      )}
      
      {/* 悬停时的右侧箭头提示 */}
      {!isActive && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-endfield-yellow opacity-0 group-hover:opacity-100 transition-opacity"></div>
      )}
    </button>
  );

  // 排名卡片组件 - 可复用
  const RankingCard = ({ ranking, loading, poolType, title }) => {
    // 根据 poolType 获取对应的排名数据
    const getRankingData = () => {
      if (!ranking) return { sixStar: [], fiveStar: [] };
      if (poolType === 'limited') return ranking.limited || { sixStar: [], fiveStar: [] };
      if (poolType === 'standard') return ranking.standard || { sixStar: [], fiveStar: [] };
      if (poolType === 'weapon') return ranking.weapon || { sixStar: [], fiveStar: [] };
      // all: 合并限定池和常驻池
      return {
        sixStar: [...(ranking.limited?.sixStar || []), ...(ranking.standard?.sixStar || [])].sort((a, b) => b.count - a.count).slice(0, 3),
        fiveStar: [...(ranking.limited?.fiveStar || []), ...(ranking.standard?.fiveStar || [])].sort((a, b) => b.count - a.count).slice(0, 3)
      };
    };

    const rankData = getRankingData();
    const hasSixStar = rankData.sixStar?.length > 0;
    const hasFiveStar = rankData.fiveStar?.length > 0;

    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
          <RefreshCw size={14} className="animate-spin mr-2" />
          加载排名...
        </div>
      );
    }

    if (!ranking || (!hasSixStar && !hasFiveStar)) {
      return (
        <div className="flex items-center justify-center h-full text-zinc-400 text-xs italic">
          暂无排名数据
        </div>
      );
    }

    // 获取颜色配置
    const getColorConfig = (rarity, pType) => {
      if (rarity === 6) {
        if (pType === 'limited') return { bg: 'from-orange-400 to-pink-500', text: 'text-amber-500', isGradient: true };
        if (pType === 'standard') return { bg: 'bg-indigo-200 dark:bg-indigo-800', text: 'text-indigo-500', isGradient: false };
        if (pType === 'weapon') return { bg: 'bg-emerald-200 dark:bg-emerald-800', text: 'text-emerald-500', isGradient: false };
        return { bg: 'from-orange-400 to-pink-500', text: 'text-amber-500', isGradient: true };
      } else {
        if (pType === 'limited') return { bg: 'bg-purple-200 dark:bg-purple-800', text: 'text-purple-500', isGradient: false };
        if (pType === 'standard') return { bg: 'bg-blue-200 dark:bg-blue-800', text: 'text-blue-500', isGradient: false };
        if (pType === 'weapon') return { bg: 'bg-teal-200 dark:bg-teal-800', text: 'text-teal-500', isGradient: false };
        return { bg: 'bg-purple-200 dark:bg-purple-800', text: 'text-purple-500', isGradient: false };
      }
    };

    const renderRankingRow = (items, rarity, label, pTypeForColor) => {
      if (!items || items.length === 0) return null;
      // 颜色映射
      const borderMap = {
        limited: 'border-orange-400',
        standard: 'border-indigo-400',
        weapon: 'border-slate-400'
      };
      const textMap = {
        limited: 'text-orange-600 dark:text-orange-400',
        standard: 'text-indigo-600 dark:text-indigo-400',
        weapon: 'text-slate-600 dark:text-slate-400'
      };
      const borderColor = borderMap[pTypeForColor] || 'border-zinc-400';
      const titleColor = textMap[pTypeForColor] || 'text-zinc-500';

      return (
        <div className="space-y-2 mb-4">
          <div className={`text-[10px] ${titleColor} font-bold uppercase tracking-wider pl-1 border-l-2 ${borderColor.replace('border-', 'border-l-')}`}>{label}</div>
          <div className="grid grid-cols-1 gap-2">
            {items.slice(0, 3).map((char, idx) => {
              const charData = characterCache.searchByName(char.name, false);
              const avatarUrl = charData?.avatar_url;
              return (
                <div key={char.name} className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden">
                  {/* Rank Badge */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-zinc-400' : 'bg-orange-700'}`}></div>
                  
                  {/* Avatar */}
                  <div className={`w-10 h-10 flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 border-2 ${borderColor} flex items-center justify-center relative overflow-hidden ml-2`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className="text-zinc-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex justify-between items-center">
                    <div className="flex flex-col">
                       <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{char.name}</span>
                       <span className={`text-[10px] font-bold ${idx === 0 ? 'text-amber-500' : 'text-zinc-500'}`}>NO.{idx + 1}</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                       ×{char.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold">
          <Trophy size={12} />
          <span>{title || '出货排名 TOP3'}</span>
        </div>
        {poolType === 'all' ? (
          <>
            {renderRankingRow(ranking.limited?.sixStar, 6, '限定池 6★', 'limited')}
            {renderRankingRow(ranking.limited?.fiveStar, 5, '限定池 5★', 'limited')}
            {renderRankingRow(ranking.standard?.sixStar, 6, '常驻池 6★', 'standard')}
            {renderRankingRow(ranking.standard?.fiveStar, 5, '常驻池 5★', 'standard')}
          </>
        ) : (
          <>
            {renderRankingRow(rankData.sixStar, 6, `${poolType === 'limited' ? '限定池' : poolType === 'standard' ? '常驻池' : '武器池'} 6★`, poolType)}
            {renderRankingRow(rankData.fiveStar, 5, `${poolType === 'limited' ? '限定池' : poolType === 'standard' ? '常驻池' : '武器池'} 5★`, poolType)}
          </>
        )}
      </div>
    );
  };

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
                    formatter={(value, entry) => {
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
          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-12 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw size={32} className="animate-spin text-zinc-400" />
            <span className="text-sm font-mono text-zinc-500 uppercase tracking-widest">Loading Global Data...</span>
          </div>
        ) : currentStats ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
            {/* 背景装饰网格 */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
            
            {/* 顶部黄色装饰条 */}
            <div className="h-1 w-full bg-endfield-yellow"></div>

            <div className="relative z-10 p-6">
              {/* 标题 */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-sm ${dataSource === 'global' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500'}`}>
                    {dataSource === 'global' ? <Cloud size={20} /> : <User size={20} />}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      {currentStats.title}
                      <span className="px-1.5 py-0.5 text-[10px] border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded-sm font-mono">
                        {dataSource === 'global' ? '全服' : '本地'}
                      </span>
                    </h2>
                    <span className="text-zinc-500 text-xs font-mono block mt-0.5">TARGET // {currentStats.subtitle}</span>
                  </div>
                </div>
                {currentStats.totalUsers && (
                  <div className="text-right">
                    <span className="block text-[10px] text-zinc-400 uppercase font-mono tracking-widest">贡献人数</span>
                    <span className="text-xl font-bold text-slate-700 dark:text-zinc-300 font-mono">{currentStats.totalUsers.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* 统计数据 */}
              {poolTypeFilter === 'all' ? (
                /* 全部卡池时：分区显示角色池和武器池 */
                <div className="space-y-4">
                  {/* 总览 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4 relative overflow-hidden group/stat">
                      <div className="absolute right-0 top-0 p-2 text-zinc-200 dark:text-zinc-800 group-hover/stat:scale-110 transition-transform"><Layers size={40} /></div>
                      <div className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">总抽数</div>
                      <div className="text-3xl font-black text-slate-800 dark:text-white font-mono">{(currentStats.total || 0).toLocaleString()}</div>
                    </div>
                    {/* 第二个卡片：角色出货排名 */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                      {dataSource === 'global' && characterRanking ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold">
                            <Trophy size={12} />
                            <span>全服出货排名 TOP3</span>
                          </div>
                          {/* 限定池 6★ 排名 */}
                          <div className="space-y-1">
                            <div className="text-[10px] text-amber-500 font-bold">限定池 6★</div>
                            <div className="flex gap-2 flex-wrap">
                              {characterRanking.limited?.sixStar?.slice(0, 3).map((char, idx) => {
                                const charData = characterCache.searchByName(char.name, false);
                                const avatarUrl = charData?.avatar_url;
                                return (
                                  <div key={char.name} className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2 py-1 border border-zinc-200 dark:border-zinc-700">
                                    <span className={`text-[10px] font-bold ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-zinc-400' : 'text-orange-700'}`}>
                                      #{idx + 1}
                                    </span>
                                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0">
                                      {avatarUrl ? (
                                        <img src={avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <User size={10} className="text-white/80" />
                                      )}
                                    </div>
                                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-[4rem]">{char.name}</span>
                                    <span className="text-[10px] font-mono text-zinc-400">×{char.count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* 限定池 5★ 排名 */}
                          {characterRanking.limited?.fiveStar?.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] text-purple-500 font-bold">限定池 5★</div>
                              <div className="flex gap-2 flex-wrap">
                                {characterRanking.limited?.fiveStar?.slice(0, 3).map((char, idx) => {
                                  const charData = characterCache.searchByName(char.name, false);
                                  const avatarUrl = charData?.avatar_url;
                                  return (
                                    <div key={char.name} className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2 py-1 border border-zinc-200 dark:border-zinc-700">
                                      <span className={`text-[10px] font-bold ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-zinc-400' : 'text-orange-700'}`}>
                                        #{idx + 1}
                                      </span>
                                      <div className="w-5 h-5 rounded-full overflow-hidden bg-purple-200 dark:bg-purple-800 flex items-center justify-center shrink-0">
                                        {avatarUrl ? (
                                          <img src={avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <User size={10} className="text-purple-600 dark:text-purple-300" />
                                        )}
                                      </div>
                                      <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-[4rem]">{char.name}</span>
                                      <span className="text-[10px] font-mono text-zinc-400">×{char.count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* 常驻池 6★ 排名 */}
                          <div className="space-y-1">
                            <div className="text-[10px] text-indigo-500 font-bold">常驻池 6★</div>
                            <div className="flex gap-2 flex-wrap">
                              {characterRanking.standard?.sixStar?.slice(0, 3).map((char, idx) => {
                                const charData = characterCache.searchByName(char.name, false);
                                const avatarUrl = charData?.avatar_url;
                                return (
                                  <div key={char.name} className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2 py-1 border border-zinc-200 dark:border-zinc-700">
                                    <span className={`text-[10px] font-bold ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-zinc-400' : 'text-orange-700'}`}>
                                      #{idx + 1}
                                    </span>
                                    <div className="w-5 h-5 rounded-full overflow-hidden bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center shrink-0">
                                      {avatarUrl ? (
                                        <img src={avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <User size={10} className="text-indigo-600 dark:text-indigo-300" />
                                      )}
                                    </div>
                                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-[4rem]">{char.name}</span>
                                    <span className="text-[10px] font-mono text-zinc-400">×{char.count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* 常驻池 5★ 排名 */}
                          {characterRanking.standard?.fiveStar?.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] text-blue-500 font-bold">常驻池 5★</div>
                              <div className="flex gap-2 flex-wrap">
                                {characterRanking.standard?.fiveStar?.slice(0, 3).map((char, idx) => {
                                  const charData = characterCache.searchByName(char.name, false);
                                  const avatarUrl = charData?.avatar_url;
                                  return (
                                    <div key={char.name} className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2 py-1 border border-zinc-200 dark:border-zinc-700">
                                      <span className={`text-[10px] font-bold ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-zinc-400' : 'text-orange-700'}`}>
                                        #{idx + 1}
                                      </span>
                                      <div className="w-5 h-5 rounded-full overflow-hidden bg-blue-200 dark:bg-blue-800 flex items-center justify-center shrink-0">
                                        {avatarUrl ? (
                                          <img src={avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <User size={10} className="text-blue-600 dark:text-blue-300" />
                                        )}
                                      </div>
                                      <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-[4rem]">{char.name}</span>
                                      <span className="text-[10px] font-mono text-zinc-400">×{char.count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : rankingLoading ? (
                        <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
                          <RefreshCw size={14} className="animate-spin mr-2" />
                          加载排名...
                        </div>
                      ) : dataSource === 'local' ? (
                        <RankingCard
                          ranking={userRanking}
                          loading={userRankingLoading}
                          poolType="all"
                          title="我的出货排名 TOP3"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-zinc-400 text-xs italic">
                          请登录查看个人排名
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 角色池统计（限定+常驻） */}
                  <div className="bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                      <Star size={16} className="text-violet-500" />
                      <h4 className="font-bold text-sm text-slate-700 dark:text-zinc-300 uppercase tracking-wide">角色池数据</h4>
                      <span className="text-[10px] text-zinc-400 ml-auto font-mono">限定 + 常驻</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold">总抽数</div>
                        <div className="text-xl font-bold font-mono text-slate-700 dark:text-zinc-200">{((currentStats.byType?.limited?.total || 0) + (currentStats.byType?.standard?.total || 0)).toLocaleString()}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold">6★ 数量</div>
                        <div className="text-xl font-bold font-mono text-amber-500">
                          {(() => {
                            // 优先显示不含免费的6★数量
                            const limitedSixTotal = currentStats.byType?.limited?.six || 0;
                            const standardSixTotal = currentStats.byType?.standard?.six || 0;
                            const totalSix = limitedSixTotal + standardSixTotal;

                            // 从characterRanking获取不含免费的数量（如果有）
                            const limitedSixExcl = characterRanking?.limited?.sixStarExcludingFree;
                            const hasExclData = limitedSixExcl !== undefined && limitedSixExcl !== null;

                            if (hasExclData) {
                              // 显示不含免费的数量（限定池不含免费 + 常驻池全部）
                              return limitedSixExcl + standardSixTotal;
                            }
                            return totalSix;
                          })()}
                          {currentStats.charGift > 0 && (
                            <span className="text-xs text-purple-500 ml-1">+{currentStats.charGift}</span>
                          )}
                        </div>
                        {/* 含免费的6★数量（如果与不含免费不同则显示） */}
                        {(() => {
                          const limitedSixTotal = currentStats.byType?.limited?.six || 0;
                          const standardSixTotal = currentStats.byType?.standard?.six || 0;
                          const totalSix = limitedSixTotal + standardSixTotal;
                          const limitedSixExcl = characterRanking?.limited?.sixStarExcludingFree;

                          if (limitedSixExcl === undefined || limitedSixExcl === null) return null;

                          const totalExcl = limitedSixExcl + standardSixTotal;
                          if (totalExcl === totalSix) return null;

                          return (
                            <div className="text-[10px] text-zinc-500 font-mono">
                              含免费: <span className="text-zinc-400">{totalSix}</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="space-y-1">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold">平均出货</div>
                        <div className="text-xl font-bold font-mono text-indigo-500">
                          {(() => {
                            // 优先显示不含免费的平均出货
                            const limitedAvgExcl = currentStats.byType?.limited?.avgPityExcludingFree;
                            const standardAvgExcl = currentStats.byType?.standard?.avgPityExcludingFree || currentStats.byType?.standard?.avgPity;
                            const limitedSix = currentStats.byType?.limited?.six || 0;
                            const standardSix = currentStats.byType?.standard?.six || 0;

                            if (limitedSix + standardSix === 0) return '-';

                            // 如果有不含免费的数据，优先使用
                            if (limitedAvgExcl) {
                              const weighted = ((parseFloat(limitedAvgExcl) || 0) * limitedSix + (parseFloat(standardAvgExcl) || 0) * standardSix) / (limitedSix + standardSix);
                              return weighted.toFixed(1);
                            }

                            // 否则回退到含免费的
                            const limitedAvg = currentStats.byType?.limited?.avgPity;
                            const standardAvg = currentStats.byType?.standard?.avgPity;
                            const weighted = ((parseFloat(limitedAvg) || 0) * limitedSix + (parseFloat(standardAvg) || 0) * standardSix) / (limitedSix + standardSix);
                            return weighted.toFixed(1);
                          })()}
                        </div>
                        {/* 含免费十连的平均出货（如果与不含免费不同则显示） */}
                        {(() => {
                          const limitedAvgExcl = currentStats.byType?.limited?.avgPityExcludingFree;
                          const limitedAvg = currentStats.byType?.limited?.avgPity;
                          const standardAvg = currentStats.byType?.standard?.avgPity;
                          const limitedSix = currentStats.byType?.limited?.six || 0;
                          const standardSix = currentStats.byType?.standard?.six || 0;

                          if (limitedSix + standardSix === 0 || !limitedAvgExcl) return null;

                          const weightedWithFree = ((parseFloat(limitedAvg) || 0) * limitedSix + (parseFloat(standardAvg) || 0) * standardSix) / (limitedSix + standardSix);
                          const standardAvgExcl = currentStats.byType?.standard?.avgPityExcludingFree || standardAvg;
                          const weightedExclFree = ((parseFloat(limitedAvgExcl) || 0) * limitedSix + (parseFloat(standardAvgExcl) || 0) * standardSix) / (limitedSix + standardSix);

                          // 如果差异小于0.1，不显示
                          if (Math.abs(weightedWithFree - weightedExclFree) < 0.1) return null;

                          return (
                            <div className="text-[10px] text-zinc-500 font-mono">
                              含免费: <span className="text-zinc-400">{weightedWithFree.toFixed(1)}</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="space-y-1">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold">比率 (不歪/歪)</div>
                        <div className="text-lg font-bold font-mono">
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
                                <span className="text-emerald-500">{totalLimited}</span>
                                <span className="text-zinc-400 mx-1">/</span>
                                <span className="text-rose-500">{totalStd}</span>
                                <span className="text-zinc-400 text-xs ml-1">({rate}%)</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* 限定池 vs 常驻池细分 */}
                    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/50 grid grid-cols-2 gap-4 text-xs font-mono">
                      <div className="flex items-center gap-2 text-zinc-500 flex-wrap">
                        <span className="w-2 h-2 bg-emerald-500/50 rounded-sm flex-shrink-0"></span>
                        <span>限定池: {(currentStats.byType?.limited?.total || 0).toLocaleString()} 抽</span>
                        <span className="ml-auto flex items-center gap-1">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {currentStats.byType?.limited?.avgPityExcludingFree || currentStats.byType?.limited?.avgPity || '-'} 平均
                          </span>
                          {currentStats.byType?.limited?.avgPityExcludingFree &&
                           currentStats.byType?.limited?.avgPity &&
                           currentStats.byType?.limited?.avgPityExcludingFree !== currentStats.byType?.limited?.avgPity && (
                            <span className="text-zinc-400">
                              (含免费: {currentStats.byType?.limited?.avgPity})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500">
                        <span className="w-2 h-2 bg-indigo-500/50 rounded-sm flex-shrink-0"></span>
                        <span>常驻池: {(currentStats.byType?.standard?.total || 0).toLocaleString()} 抽</span>
                        <span className="ml-auto text-indigo-600 dark:text-indigo-400">{currentStats.byType?.standard?.avgPity || '-'} 平均</span>
                      </div>
                    </div>
                  </div>

                  {/* 武器池统计 */}
                  <div className="bg-zinc-50 dark:bg-zinc-950/30 border border-zinc-200 dark:border-zinc-800 p-5">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800 border-dashed">
                      <Swords size={16} className="text-slate-500" />
                      <h4 className="font-bold text-sm text-slate-700 dark:text-zinc-300 uppercase tracking-wide">武器池数据</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold">总抽数</div>
                        <div className="text-xl font-bold font-mono text-slate-700 dark:text-zinc-200">{(currentStats.byType?.weapon?.total || 0).toLocaleString()}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold">6★ 数量</div>
                        <div className="text-xl font-bold font-mono text-amber-500">
                          {currentStats.byType?.weapon?.six || 0}
                          {(currentStats.weaponGiftLimited > 0 || currentStats.weaponGiftStandard > 0) && (
                            <span className="text-xs text-purple-500 ml-1">+{currentStats.weaponGiftLimited + currentStats.weaponGiftStandard}</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold">平均出货</div>
                        <div className="text-xl font-bold font-mono text-indigo-500">{currentStats.byType?.weapon?.avgPity || '-'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-zinc-400 text-[10px] uppercase font-bold">比率 (不歪/歪)</div>
                        <div className="text-lg font-bold font-mono">
                          {(() => {
                            const weapon = currentStats.byType?.weapon || {};
                            const limitedUp = (weapon.sixStarLimited ?? weapon.limitedSix ?? 0);
                            const totalSix = weapon.six || 0;
                            const stdSix = totalSix - limitedUp;
                            const rate = totalSix > 0 ? ((limitedUp / totalSix) * 100).toFixed(1) : 0;
                            return (
                              <>
                                <span className="text-emerald-500">{limitedUp}</span>
                                <span className="text-zinc-400 mx-1">/</span>
                                <span className="text-rose-500">{stdSix}</span>
                                <span className="text-zinc-400 text-xs ml-1">({rate}%)</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* 特定卡池类型时：优化后的显示 */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                    <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">总抽数</div>
                    <div className="text-3xl font-black font-mono text-slate-800 dark:text-white">{(currentStats.total || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                    <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">6★ 数量</div>
                    <div className="text-3xl font-black font-mono text-amber-500">{currentStats.sixStar || 0}</div>
                    <div className="text-xs text-zinc-500 mt-1 font-mono">
                      概率: {currentStats.total > 0 ? ((currentStats.sixStar / currentStats.total) * 100).toFixed(2) : 0}%
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                    <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">平均出货</div>
                    <div className="text-3xl font-black font-mono text-indigo-500">
                      {/* 优先显示不含免费的平均出货 */}
                      {(poolTypeFilter === 'limited' || poolTypeFilter === 'character')
                        ? (currentStats.avgPityExcludingFree || currentStats.avgPity || '-')
                        : (currentStats.avgPity || '-')
                      }
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 font-mono">抽/6★</div>
                    {/* 含免费十连的平均出货（仅限定池和角色池显示，如果与不含免费不同） */}
                    {(poolTypeFilter === 'limited' || poolTypeFilter === 'character') && (() => {
                      const avgExcl = currentStats.avgPityExcludingFree;
                      const avgNormal = currentStats.avgPity;
                      if (!avgExcl || avgExcl === '-' || avgExcl === avgNormal) return null;
                      return (
                        <div className="text-[10px] text-zinc-500 font-mono mt-1 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                          含免费: <span className="text-zinc-400">{avgNormal}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 p-4">
                    <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">不歪/歪</div>
                    <div className="text-xl font-black font-mono mt-1">
                      <span className="text-emerald-500">{currentStats.sixStarLimited || 0}</span>
                      <span className="text-zinc-400 mx-1">/</span>
                      <span className="text-rose-500">{currentStats.sixStarStandard || 0}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 font-mono">
                      不歪率: {currentStats.sixStar > 0 ? ((currentStats.sixStarLimited / currentStats.sixStar) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* 底部装饰斜纹 */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_20px)]"></div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 p-12 text-center text-zinc-500 font-mono">
            NO DATA AVAILABLE
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
