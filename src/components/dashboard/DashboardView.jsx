import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Star, FileText, Sparkles, User, TrendingUp, Layers, PieChart as PieChartIcon, Clock, Upload, BarChart3, LayoutGrid } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { RARITY_CONFIG, getCurrentUpPool } from '../../constants';
import RainbowGradientDefs from '../charts/RainbowGradientDefs';
import { useHistoryStore, usePoolStore, useAuthStore } from '../../stores';
import PoolSelector from '../pool/PoolSelector';
import PoolAnalysisCard from './PoolAnalysisCard';
import { characterCache } from '../../utils/characterUtils';
import CharacterWaterfallChart from './CharacterWaterfallChart';

/**
 * 仪表盘小统计卡片 (Updated Style)
 */
const StatBox = ({ title, value, subValue, colorClass, icon: Icon, isAnimated }) => (
  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 relative overflow-hidden group hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
    {isAnimated && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>}
    
    <div className="flex justify-between items-start mb-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-bold">{title}</div>
      {Icon && <Icon size={14} className="text-slate-400 dark:text-zinc-600" />}
    </div>
    
    <div className="flex items-baseline gap-2">
      <div className={`text-2xl font-bold font-mono ${colorClass || 'text-slate-800 dark:text-zinc-100'}`}>
        {value}
      </div>
    </div>
    
    {subValue && <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 font-mono">{subValue}</div>}
  </div>
);

/**
 * 仪表盘视图组件
 */
const DashboardView = ({
  currentPool,
  stats,
  effectivePity
}) => {
  // 从 store 获取历史数据和当前选中的游戏账号
  const history = useHistoryStore(state => state.history);
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const user = useAuthStore(state => state.user);

  // 角色出货视图模式: 'card' | 'waterfall'
  const [charViewMode, setCharViewMode] = useState('card');

  // 检查是否有卡池数据
  const hasPoolData = pools && pools.length > 0;

  // 检测暗色模式
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

  // 当前卡池历史（按用户与账号筛选）
  const currentPoolHistory = useMemo(() => {
    let poolHistory = history.filter(h => h.poolId === currentPoolId && h.user_id === user?.id);
    if (currentGameUid) {
      poolHistory = poolHistory.filter(h => h.game_uid === currentGameUid);
    }
    return poolHistory;
  }, [history, currentPoolId, currentGameUid, user]);

  // 归一化 isStandard，基于 UP 角色匹配重新计算（不信任数据库原值）
  const normalizedPoolHistory = useMemo(() => {
    const poolType = currentPool?.type;
    const upCharacter = currentPool?.up_character;

    return currentPoolHistory.map(h => {
      const characterName = h.character_name || h.item_name || h.name || '';
      let isStd;

      // 根据卡池类型和 UP 角色判断
      if (poolType === 'standard' || poolType === 'beginner') {
        // 常驻池/新手池的6星都算常驻
        isStd = true;
      } else if (poolType === 'limited' || poolType === 'limited_character' || poolType === 'weapon' || poolType === 'limited_weapon') {
        // 限定池/武器池：检查是否匹配UP角色
        if (upCharacter && h.rarity === 6) {
          // 如果角色名不匹配UP角色，则为常驻（被歪了）
          isStd = !characterName.includes(upCharacter) && !upCharacter.includes(characterName);
        } else if (h.rarity === 6) {
          // 没有UP角色信息的6星，默认为限定
          isStd = false;
        } else {
          // 非6星保持原值或默认 false
          isStd = h.isStandard ?? false;
        }
      } else {
        // 其他类型，保持原值
        isStd = h.isStandard ?? false;
      }

      return { ...h, isStandard: isStd };
    });
  }, [currentPoolHistory, currentPool?.type, currentPool?.up_character]);

  // 计算角色出货统计（按游戏账号筛选）
  const characterStats = useMemo(() => {
    const currentPoolHistory = normalizedPoolHistory;

    const characters = new Map();

    let pullIndex = 0;
    let sixStarPityCounter = 0;  // 6星保底计数
    let fiveStarPityCounter = 0; // 5星保底计数

    // 按时间排序
    const sortedHistory = [...currentPoolHistory].sort((a, b) => {
      const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    sortedHistory.forEach(item => {
      if (item.specialType === 'gift') return;
      const isFree = item.isFree || item.is_free;
      if (!isFree) {
        pullIndex++;
        sixStarPityCounter++;
        fiveStarPityCounter++;
      }

      if (item.rarity >= 5) {
        const name = item.character_name || item.item_name || item.name || '未知';
        const pityValue = isFree ? 'free' : (item.rarity === 6 ? sixStarPityCounter : fiveStarPityCounter);

        const existing = characters.get(name);
        if (existing) {
          existing.count++;
          existing.pullIndices.push(isFree ? 'free' : pullIndex);
          existing.pities.push(pityValue);
          existing.freeCount = (existing.freeCount || 0) + (isFree ? 1 : 0);
        } else {
          characters.set(name, {
            name,
            count: 1,
            rarity: item.rarity,
            isStandard: item.isStandard,
            isLimited: !item.isStandard && item.rarity === 6,
            pullIndices: [isFree ? 'free' : pullIndex],
            pities: [pityValue],
            freeCount: isFree ? 1 : 0
          });
        }

        // 重置对应的保底计数器
        if (!isFree) {
          if (item.rarity === 6) {
            sixStarPityCounter = 0;
          }
          if (item.rarity >= 5) {
            fiveStarPityCounter = 0;
          }
        }
      }
    });

    const result = Array.from(characters.values()).sort((a, b) => {
      if (a.rarity === 6 && !a.isStandard && (b.rarity !== 6 || b.isStandard)) return -1;
      if (b.rarity === 6 && !b.isStandard && (a.rarity !== 6 || a.isStandard)) return 1;
      if (a.rarity === 6 && a.isStandard && b.rarity !== 6) return -1;
      if (b.rarity === 6 && b.isStandard && a.rarity !== 6) return 1;
      if (a.rarity === b.rarity && a.isStandard === b.isStandard) return b.count - a.count;
      return b.rarity - a.rarity;
    });

    return result;
  }, [normalizedPoolHistory, currentPool?.up_character]);

  const totalCharacterCount = useMemo(() => characterStats.reduce((sum, char) => sum + char.count, 0), [characterStats]);

  const tooltipStyle = {
    borderRadius: '0px',
    border: isDark ? '1px solid #3f3f46' : '1px solid #e4e4e7',
    boxShadow: isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    color: isDark ? '#e4e4e7' : '#27272a'
  };

  const isLimited = currentPool.type === 'limited';

  // 计算累计抽数时排除免费十连
  const validPullCount = useMemo(() => {
    return normalizedPoolHistory.filter(h => h.specialType !== 'gift' && !h.isFree && !h.is_free).length;
  }, [normalizedPoolHistory]);

  // 检测限定逻辑
  const checkLimitedInFirstN = useMemo(() => {
    const sorted = [...normalizedPoolHistory].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    let pullCount = 0;
    let firstLimitedIndex120 = 0;
    let firstLimitedIndex80 = 0;

    for (const item of sorted) {
      if (item.specialType === 'gift' || item.isFree || item.is_free) continue;
      pullCount++;
      if (item.rarity === 6 && !item.isStandard) {
        if (firstLimitedIndex120 === 0 && pullCount <= 120) firstLimitedIndex120 = pullCount;
        if (firstLimitedIndex80 === 0 && pullCount <= 80) firstLimitedIndex80 = pullCount;
      }
    }
    return { firstLimitedIndex120, firstLimitedIndex80, validPullCount: pullCount };
  }, [history, currentPoolId]);

  const hasReceivedFreeTen = useMemo(() => {
    const currentPoolHistory = history.filter(h => h.poolId === currentPoolId);
    return currentPoolHistory.some(h => h.isFree || h.is_free);
  }, [history, currentPoolId]);

  // 如果用户没有任何卡池数据，只显示卡池选择器（导入提示）
  if (!hasPoolData) {
    return (
      <div className="space-y-6">
        {/* 卡池选择器 - 显示导入提示 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <PoolSelector />
        </div>

        {/* 欢迎提示 */}
        {user && (
          <div className="bg-gradient-to-br from-zinc-50 to-slate-50 dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload size={28} className="text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-700 dark:text-zinc-300 mb-2">开始记录您的抽卡数据</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-500 max-w-md mx-auto">
              点击上方的「导入数据」按钮，通过官方 API 导入您的抽卡记录。
              <br/>导入后即可查看详细的统计分析。
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 卡池选择器 & 顶部状态栏 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <PoolSelector />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 左列：保底机制分析 (New Component) */}
        <div className="md:col-span-1 space-y-6">
          <PoolAnalysisCard 
            currentPool={currentPool}
            stats={stats}
            effectivePity={effectivePity}
            checkLimitedInFirstN={checkLimitedInFirstN}
            hasReceivedFreeTen={hasReceivedFreeTen}
          />
          
          {/* 平均出货消耗 (Mini Card) */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
            <h3 className="text-xs uppercase font-bold text-slate-500 dark:text-zinc-500 mb-3 tracking-wider">平均出货成本</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">综合6星</span>
                <span className="font-mono font-bold text-slate-800 dark:text-zinc-100">{stats.avgPullCost[6]} <span className="text-xs font-normal text-slate-400">抽</span></span>
              </div>
              <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full bg-slate-600 dark:bg-slate-400" style={{width: `${Math.min((stats.avgPullCost[6] / 80) * 100, 100)}%`}}></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">5星</span>
                <span className="font-mono font-bold text-slate-800 dark:text-zinc-100">{stats.avgPullCost[5]} <span className="text-xs font-normal text-slate-400">抽</span></span>
              </div>
              <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full bg-amber-500" style={{width: `${Math.min((stats.avgPullCost[5] / 10) * 100, 100)}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 右列：详细数据与图表 */}
        <div className="md:col-span-2 space-y-6">
          
          {/* 总投入 Banner */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-zinc-50 dark:from-zinc-800 to-transparent"></div>
            <div className="relative z-10">
              <h3 className="text-xs text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-1">当前卡池总投入</h3>
              <div className="text-4xl font-black font-mono text-slate-800 dark:text-zinc-100 flex items-baseline gap-2">
                {stats.total}
                <span className="text-lg font-medium text-slate-400 dark:text-zinc-600">PULLS</span>
              </div>
            </div>
            <div className="relative z-10 h-12 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-sm flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:bg-slate-200 dark:group-hover:bg-zinc-700 transition-colors">
              <Layers size={24} />
            </div>
          </div>

          {/* 核心数据网格 */}
          <div className={`grid grid-cols-2 ${currentPool.type !== 'standard' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
            {currentPool.type !== 'standard' && (
              <StatBox
                title="限定6星"
                value={stats.counts[6]}
                subValue={(() => {
                  let bonusCount = 0;
                  if (currentPool.type === 'limited') {
                    bonusCount = Math.floor(stats.total/240);
                  } else if (currentPool.type === 'weapon') {
                     // 简单估算武器池赠送
                     if (stats.total >= 180) bonusCount = 1 + Math.floor((stats.total - 180) / 160);
                  }
                  return bonusCount > 0 ? `含赠送 ${bonusCount}` : `占比 ${(stats.winRate)}%`;
                })()}
                colorClass={currentPool.type === 'limited' ? 'rainbow-text' : 'text-slate-700 dark:text-zinc-300'}
                icon={Star}
                isAnimated={currentPool.type === 'limited'}
              />
            )}
            <StatBox
              title="常驻6星"
              value={stats.counts['6_std']}
              subValue={currentPool.type === 'standard' && stats.total >= 300 ? "含赠送 1" : "歪"}
              colorClass="text-red-600 dark:text-red-400"
              icon={Star}
            />
            <StatBox 
              title="5星总数" 
              value={stats.counts[5]} 
              subValue={`占比 ${(stats.total > 0 ? stats.counts[5]/stats.total*100 : 0).toFixed(1)}%`} 
              colorClass="text-amber-600 dark:text-amber-400" 
              icon={Star} 
            />
            <StatBox 
              title="4星总数" 
              value={stats.counts[4]} 
              subValue={`占比 ${(stats.total > 0 ? stats.counts[4]/stats.total*100 : 0).toFixed(1)}%`} 
              colorClass="text-purple-600 dark:text-purple-400" 
              icon={Star} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* 概率分布 (Pie) */}
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                     <PieChartIcon size={16} />
                     分布概览
                   </h3>
                </div>
                <div className="h-64 w-full">
                   {stats.total === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-300 dark:text-zinc-700 text-sm">暂无数据</div>
                   ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RainbowGradientDefs />
                          <Pie
                            data={stats.chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="displayValue"
                          >
                            {stats.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value, name, props) => [`${props.payload.value} (${(props.payload.value/stats.total*100).toFixed(1)}%)`, name]}
                            contentStyle={tooltipStyle}
                            itemStyle={{ color: isDark ? '#e4e4e7' : '#27272a' }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            iconSize={8}
                            formatter={(value, entry) => <span className="text-xs text-slate-500 dark:text-zinc-400 ml-1">{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                   )}
                </div>
             </div>

             {/* 6星分布直方图 */}
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                     <TrendingUp size={16} />
                     出货分布
                   </h3>
                </div>
                <div className="h-64 w-full">
                   {stats.pityStats.history.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-300 dark:text-zinc-700 text-sm">暂无6星记录</div>
                   ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.pityStats.distribution} stackOffset="sign" margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                          <RainbowGradientDefs />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#f4f4f5'} />
                          <XAxis dataKey="range" tick={{fontSize: 10, fill: isDark ? '#71717a' : '#a1a1aa'}} interval={0} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{fontSize: 10, fill: isDark ? '#71717a' : '#a1a1aa'}} axisLine={false} tickLine={false} />
                          <RechartsTooltip contentStyle={tooltipStyle} cursor={{fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'}} />
                          <Bar dataKey="limited" stackId="a" fill={RARITY_CONFIG[6].color} name="限定" radius={[0, 0, 2, 2]} />
                          <Bar dataKey="standard" stackId="a" fill={RARITY_CONFIG['6_std'].color} name="常驻" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                   )}
                </div>
             </div>
          </div>

          {/* 角色出货列表 (Updated Style) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <User size={18} className="text-slate-400 dark:text-zinc-500" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">角色出货统计</h3>
              <div className="ml-auto flex items-center gap-2">
                {/* 视图切换按钮组 */}
                {characterStats.length > 0 && (
                  <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-sm overflow-hidden">
                    <button
                      onClick={() => setCharViewMode('card')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
                        charViewMode === 'card'
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                          : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <LayoutGrid size={14} />
                      卡片
                    </button>
                    <button
                      onClick={() => setCharViewMode('waterfall')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
                        charViewMode === 'waterfall'
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                          : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <BarChart3 size={14} />
                      时间线
                    </button>
                  </div>
                )}
                {totalCharacterCount > 0 && (
                  <span className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
                    Total: {totalCharacterCount}
                  </span>
                )}
              </div>
            </div>

            {characterStats.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-zinc-600 text-sm">
                暂无5星及以上记录
              </div>
            ) : charViewMode === 'waterfall' ? (
              <CharacterWaterfallChart characterStats={characterStats} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {characterStats.map((char) => {
                  const isSixStar = char.rarity === 6;
                  const isLimitedChar = isSixStar && !char.isStandard;
                  const isStandardChar = isSixStar && char.isStandard;

                  // 生成出货抽数描述
                  // 格式：68抽(#120), 24抽(#300) - 保底计数(总抽数位置)
                  const pullInfoParts = char.pullIndices.map((idx, i) => {
                    const pity = char.pities[i];
                    const isFree = idx === 'free' || pity === 'free';

                    if (isFree) {
                      return { type: 'free', text: '免费' };
                    }

                    if (pity) {
                      // 显示 保底计数(#总抽数位置)
                      return { type: 'normal', text: `${pity}抽(#${idx})` };
                    } else {
                      // 没有保底数据时只显示总抽数位置
                      return { type: 'normal', text: `#${idx}` };
                    }
                  });

                  return (
                    <div
                      key={char.name}
                      className={`
                        relative flex flex-col justify-between p-3 border transition-all h-full
                        hover:translate-y-[-1px] hover:shadow-sm
                        ${isLimitedChar
                          ? 'bg-zinc-50 dark:bg-zinc-900/50 border-orange-200 dark:border-orange-900/30'
                          : isStandardChar
                            ? 'bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/20'
                            : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'
                        }
                      `}
                    >
                      {/* 左侧颜色条 */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        isLimitedChar ? 'rainbow-bg' : isStandardChar ? 'bg-red-500' : 'bg-amber-400'
                      }`}></div>

                      {/* 角色头像和信息 */}
                      <div className="ml-2 mb-2 flex items-start gap-2">
                        {/* 角色头像 */}
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden
                          ${isLimitedChar
                            ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
                            : isStandardChar
                              ? 'bg-red-200 dark:bg-red-800 text-red-600 dark:text-red-300'
                              : 'bg-amber-200 dark:bg-amber-800 text-amber-600 dark:text-amber-300'
                          }
                        `}>
                          {(() => {
                            const charData = characterCache.searchByName(char.name, false);
                            const avatarUrl = charData?.avatar_url;
                            if (avatarUrl) {
                              return (
                                <img
                                  src={avatarUrl}
                                  alt={char.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              );
                            }
                            return null;
                          })()}
                          <div className={`w-full h-full items-center justify-center ${
                            characterCache.searchByName(char.name, false)?.avatar_url ? 'hidden' : 'flex'
                          }`}>
                            <User size={18} />
                          </div>
                        </div>

                        {/* 角色名和星星 */}
                        <div className="flex-1 min-w-0">
                           <div className={`text-sm font-bold truncate ${
                               isLimitedChar ? 'text-slate-800 dark:text-zinc-200' : 'text-slate-700 dark:text-zinc-400'
                            }`}>
                              {char.name}
                            </div>
                            <div className="flex gap-0.5 mt-0.5">
                               {Array.from({length: char.rarity}).map((_,i)=>(
                                 <Star key={i} size={8} className={`${isSixStar ? 'text-orange-400' : 'text-amber-400'} fill-current`} />
                               ))}
                            </div>
                        </div>
                      </div>

                      {/* 底部信息栏：抽数详情 + 数量 */}
                      <div className="ml-2 mt-auto">
                         {/* 抽数详情 - 允许换行，但每项作为整体 */}
                         <div className="text-xs font-mono leading-relaxed mb-1">
                           {pullInfoParts.map((part, i) => (
                             <span key={i}>
                               <span className="whitespace-nowrap">
                                 {part.type === 'free' ? (
                                   <span className="text-blue-500 font-bold">{part.text}</span>
                                 ) : (
                                   <span className="text-slate-400 dark:text-zinc-600">{part.text}</span>
                                 )}
                               </span>
                               {i < pullInfoParts.length - 1 && (
                                 <span className="text-slate-400 dark:text-zinc-600">, </span>
                               )}
                             </span>
                           ))}
                         </div>
                         {/* 数量标签 - 右下角 */}
                         <div className="flex justify-end">
                           <div className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                               isLimitedChar ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                               isStandardChar ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                               'bg-zinc-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500'
                            }`}>
                              x{char.count}
                           </div>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;