import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Layers, Search, History, Star, Download, Share2, ChevronDown, Zap } from 'lucide-react';
import { createSimulator } from '../../utils/gachaSimulator';
import SimulatorResults from './SimulatorResults';
import SimulatorControls from './SimulatorControls';
import PullAnimation from './PullAnimation';
import LimitedPoolAnalysis from './LimitedPoolAnalysis'; // 新增：限定池分析组件
import CharacterStats from './CharacterStats'; // 新增：角色统计组件
import PoolSelector from '../../components/pool/PoolSelector'; // 新增：卡池选择器
import { LIMITED_POOL_SCHEDULE, getCurrentUpPool, WEAPON_POOL_RULES } from '../../constants';
import { calculateCurrentProbability } from '../../utils/validators';
import { usePoolStore } from '../../stores'; // 新增：获取真实卡池列表
import {
  saveSimulatorState,
  loadSimulatorState,
  clearSimulatorState,
  downloadAnalysisReport,
  downloadSimulatorData,
  generateShareText,
  copyToClipboard
} from '../../utils/simulatorStorage';

const POOL_NAMES = {
  limited: '限定寻访',
  weapon: '武器寻访',
  standard: '常驻寻访'
};

const GachaSimulator = () => {
  // 从 store 获取真实卡池列表
  const realPools = usePoolStore(state => state.pools);

  // 创建模拟池列表（为每个真实卡池添加 [模拟] 标识）
  const simulatorPools = useMemo(() => {
    return realPools.map(pool => ({
      ...pool,
      id: `sim_${pool.id}`,  // 模拟池ID前缀
      name: `${pool.name} [模拟]`,  // 名称添加标识
      isSimulator: true  // 标记为模拟池
    }));
  }, [realPools]);

  // 当前选中的模拟池ID
  const [currentSimPoolId, setCurrentSimPoolId] = useState(() => {
    const firstPool = simulatorPools[0];
    return firstPool ? firstPool.id : null;
  });

  // 获取当前模拟池对象
  const currentSimPool = simulatorPools.find(p => p.id === currentSimPoolId);
  const currentPoolType = currentSimPool?.type || 'limited';

  const [skipAnimation, setSkipAnimation] = useState(false); // 跳过动画选项
  const [showPoolMenu, setShowPoolMenu] = useState(false); // 卡池菜单显示状态

  // 限定卡池选择（默认最新的卡池）
  const [selectedLimitedPool, setSelectedLimitedPool] = useState(() => {
    // 获取当前UP池作为默认值
    const currentUp = getCurrentUpPool();
    return currentUp.name;
  });

  const [simulator, setSimulator] = useState(() => {
    // 尝试从localStorage加载状态
    const savedState = loadSimulatorState('limited');
    const currentUp = getCurrentUpPool();
    const sim = createSimulator('limited', null, currentUp.name);
    if (savedState) {
      sim.importState(savedState);
    }
    return sim;
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastResults, setLastResults] = useState(null);
  const [stats, setStats] = useState(simulator.getStatistics());
  const [pityInfo, setPityInfo] = useState(simulator.getPityInfo());
  const [isLimitedWeapon, setIsLimitedWeapon] = useState(true); // Default true for weapon pool
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [pullHistory, setPullHistory] = useState([]);
  const [expandedTenPulls, setExpandedTenPulls] = useState(new Set()); // 记录展开的十连ID
  const [availableFreePulls, setAvailableFreePulls] = useState(0); // 可用的免费十连次数

  // 监听模拟器状态变化
  useEffect(() => {
    const updateUI = () => {
      setStats(simulator.getStatistics());
      setPityInfo(simulator.getPityInfo());
      setPullHistory(simulator.getState().pullHistory || []);

      // 计算可用的免费十连次数（仅限定池）
      if (simulator.poolType === 'limited') {
        const stats = simulator.getStatistics();
        const earnedFreePulls = stats.freeTenPulls?.count || 0;
        const usedFreePulls = simulator.getState().freeTenPullsReceived || 0;
        setAvailableFreePulls(Math.max(0, earnedFreePulls - usedFreePulls));
      } else {
        setAvailableFreePulls(0);
      }

      // 自动保存状态
      saveSimulatorState(currentPoolType, simulator.exportState());
    };
    simulator.addListener(updateUI);
    // 初始化时也更新一次
    updateUI();
    return () => simulator.removeListener(updateUI);
  }, [simulator, currentPoolType]);

  // Handle limited weapon toggle
  // 武器池限定/常驻切换时更新规则，但保留历史
  useEffect(() => {
    if (simulator.poolType === 'weapon') {
      // 只更新规则，不重置状态
      // 限定/常驻仅影响赠送内容，不影响基础抽卡逻辑
      const newRules = isLimitedWeapon ? WEAPON_POOL_RULES : {
        ...WEAPON_POOL_RULES,
        // 常驻武器池无赠送机制
        giftInterval: Infinity
      };
      simulator.rules = newRules;
      // 不重置模拟器，保留历史记录
    }
  }, [isLimitedWeapon, simulator]);


  const handlePull = async (type) => {
    if (isAnimating) return;

    setIsAnimating(true);
    setLastResults(null); // Clear previous results immediately

    // 根据是否跳过动画决定延迟时间
    const animationDelay = skipAnimation ? 0 : 2500;

    // 模拟网络延迟/动画时间
    setTimeout(() => {
      let results;
      if (type === 'single') {
        const res = simulator.pullSingle();
        results = [res];
      } else {
        // 检查是否使用免费十连
        if (availableFreePulls > 0 && simulator.poolType === 'limited') {
          results = simulator.pullFreeTen();
          showToastMessage('使用免费十连！（不计入保底）');
        } else {
          results = simulator.pullTen();
        }
      }

      setLastResults(results);
      setIsAnimating(false);
    }, animationDelay); // 可跳过的动画时间
  };

  const handleReset = () => {
    if (window.confirm('确定要重置模拟器状态吗？所有数据将被清空。')) {
      simulator.reset();
      setLastResults(null);
      clearSimulatorState(currentPoolType);
      showToastMessage('模拟器已重置');
    }
  };

  const switchPool = (poolId) => {
    if (currentSimPoolId === poolId) return;

    // 找到目标模拟池
    const targetPool = simulatorPools.find(p => p.id === poolId);
    if (!targetPool) return;

    // 保存当前卡池状态
    saveSimulatorState(currentSimPoolId, simulator.exportState());

    // 加载新卡池状态
    const savedState = loadSimulatorState(poolId);
    // 如果是限定池，使用目标卡池的UP角色
    const upChar = targetPool.type === 'limited' ? (targetPool.up_character || selectedLimitedPool) : null;
    const newSim = createSimulator(targetPool.type, null, upChar);
    if (savedState) {
      newSim.importState(savedState);
      // 重要：importState 后需要重新设置 UP 角色
      if (upChar) {
        newSim.setCurrentUpCharacter(upChar);
      }
    }

    // 更新选中的UP角色状态（如果是限定池）
    if (targetPool.type === 'limited' && targetPool.up_character) {
      setSelectedLimitedPool(targetPool.up_character);
    }

    setCurrentSimPoolId(poolId);
    setSimulator(newSim);
    setLastResults(null);
    setStats(newSim.getStatistics());
    setPityInfo(newSim.getPityInfo());
    setShowPoolMenu(false); // 关闭菜单
  };

  // 切换限定卡池（只在限定池生效）
  const switchLimitedPool = (poolName) => {
    if (currentPoolType !== 'limited') return;

    setSelectedLimitedPool(poolName);
    // 更新模拟器的当前UP角色
    simulator.setCurrentUpCharacter(poolName);
    showToastMessage(`已切换至${poolName}UP池`);
  };

  // Toast提示
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // 导出分析报告
  const handleExportReport = () => {
    downloadAnalysisReport(stats, pityInfo, currentPoolType);
    showToastMessage('分析报告已导出');
  };

  // 导出可导入数据
  const handleExportData = (format) => {
    const poolName = currentSimPool?.name || '模拟池';
    downloadSimulatorData(simulator.getState().pullHistory, currentSimPoolId, poolName, currentPoolType, format);
    showToastMessage(`已导出${format.toUpperCase()}格式数据`);
  };

  // 分享功能
  const handleShare = async () => {
    const shareText = generateShareText(stats, currentPoolType);
    const success = await copyToClipboard(shareText);
    if (success) {
      showToastMessage('已复制到剪贴板');
    } else {
      showToastMessage('复制失败，请手动复制');
    }
  };

  // 处理十连记录分组
  const processHistoryGroups = (history) => {
    const groups = [];
    let currentTenPull = null;

    // 先正序处理，分组后再反转
    for (let i = 0; i < history.length; i++) {
      const record = history[i];

      if (record.isTenPull) {
        // 如果是十连的第一抽（batchIndex === 0）
        if (record.batchIndex === 0) {
          // 保存之前的十连组
          if (currentTenPull && currentTenPull.pulls.length > 0) {
            groups.push(currentTenPull);
          }
          // 创建新的十连组
          currentTenPull = {
            type: 'tenPull',
            id: record.timestamp, // 使用第一抽的timestamp作为组ID
            pulls: [record],
            startPullNumber: record.pullNumber
          };
        } else if (currentTenPull) {
          // 添加到当前十连组
          currentTenPull.pulls.push(record);
        } else {
          // 不应该发生的情况：batchIndex > 0 但没有当前组
          // 创建新组以容错
          currentTenPull = {
            type: 'tenPull',
            id: record.timestamp,
            pulls: [record],
            startPullNumber: record.pullNumber
          };
        }
      } else {
        // 单抽记录
        // 先保存之前未完成的十连组
        if (currentTenPull && currentTenPull.pulls.length > 0) {
          groups.push(currentTenPull);
          currentTenPull = null;
        }
        groups.push({
          type: 'single',
          ...record
        });
      }
    }

    // 保存最后一个十连组
    if (currentTenPull && currentTenPull.pulls.length > 0) {
      groups.push(currentTenPull);
    }

    // 反转分组顺序（最新的在前）
    return groups.reverse();
  };

  // 切换十连展开/折叠
  const toggleTenPull = (id) => {
    setExpandedTenPulls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Convert simulator stats to format expected by DashboardView
  const dashboardStats = {
      total: stats.totalPulls,
      currentPity: pityInfo.sixStar.current,        // 当前6星保底计数
      currentPity5: pityInfo.fiveStar.current,      // 当前5星保底计数
      counts: {
          // 模拟器特殊处理：对于武器池，counts应该包含抽到的+赠送的总和
          6: simulator.poolType === 'weapon' && stats.gifts
            ? stats.sixStarCount + (stats.gifts.limitedCount || 0)
            : stats.sixStarCount,
          // 武器池的常驻武器数量（仅赠送）
          '6_std': simulator.poolType === 'weapon' && stats.gifts
            ? (stats.gifts.standardCount || 0)
            : 0,
          5: stats.fiveStarCount,
          4: Math.max(0, stats.totalPulls - stats.sixStarCount - stats.fiveStarCount) // 确保不为负数
      },
      winRate: stats.upRate || '0.00',
      avgPullCost: {
          6: stats.avgPullsPerSixStar === '-' ? 0 : parseFloat(stats.avgPullsPerSixStar) || 0,
          5: stats.fiveStarRate && parseFloat(stats.fiveStarRate) > 0
            ? (100 / parseFloat(stats.fiveStarRate)).toFixed(2)
            : 0
      },
      chartData: [
          { name: '6星', value: stats.sixStarCount, color: '#FFFA00' },
          { name: '5星', value: stats.fiveStarCount, color: '#F59E0B' },
          { name: '4星及以下', value: Math.max(0, stats.totalPulls - stats.sixStarCount - stats.fiveStarCount), color: '#A855F7' }
      ],
      pityStats: {
          history: stats.sixStarHistory.map((item, index) => ({
              ...item,
              index: index + 1,
              isStandard: !item.isUp && simulator.poolType !== 'standard',
              count: item.pityWhenPulled || 1
          })),
          distribution: (() => {
            // 根据卡池类型决定分布范围
            const isWeapon = simulator.poolType === 'weapon';
            const ranges = isWeapon ? [
              // 武器池：40抽保底
              { range: '1-5', min: 1, max: 5, limited: 0, standard: 0 },
              { range: '6-10', min: 6, max: 10, limited: 0, standard: 0 },
              { range: '11-15', min: 11, max: 15, limited: 0, standard: 0 },
              { range: '16-20', min: 16, max: 20, limited: 0, standard: 0 },
              { range: '21-25', min: 21, max: 25, limited: 0, standard: 0 },
              { range: '26-30', min: 26, max: 30, limited: 0, standard: 0 },
              { range: '31-35', min: 31, max: 35, limited: 0, standard: 0 },
              { range: '36-40', min: 36, max: 40, limited: 0, standard: 0 }
            ] : [
              // 角色池：90抽保底
              { range: '1-10', min: 1, max: 10, limited: 0, standard: 0 },
              { range: '11-20', min: 11, max: 20, limited: 0, standard: 0 },
              { range: '21-30', min: 21, max: 30, limited: 0, standard: 0 },
              { range: '31-40', min: 31, max: 40, limited: 0, standard: 0 },
              { range: '41-50', min: 41, max: 50, limited: 0, standard: 0 },
              { range: '51-60', min: 51, max: 60, limited: 0, standard: 0 },
              { range: '61-70', min: 61, max: 70, limited: 0, standard: 0 },
              { range: '71-80', min: 71, max: 80, limited: 0, standard: 0 },
              { range: '81-90', min: 81, max: 90, limited: 0, standard: 0 }
            ];

            // 统计每个六星的垫刀数，区分限定和常驻
            stats.sixStarHistory.forEach(item => {
              const pity = item.pityWhenPulled || 0;
              const rangeItem = ranges.find(r => pity >= r.min && pity <= r.max);
              if (rangeItem) {
                if (item.isUp) {
                  rangeItem.limited++;
                } else {
                  rangeItem.standard++;
                }
              }
            });

            // 返回所有范围（包括为0的，保持图表完整性）
            return ranges.map(r => ({
              range: r.range,
              limited: r.limited,
              standard: r.standard
            }));
          })()
      },
      probabilityInfo: calculateCurrentProbability(pityInfo.sixStar.current, simulator.poolType),
      // 情报书信息（仅限定池）
      hasInfoBook: stats.hasReceivedInfoBook,
      pullsUntilInfoBook: simulator.poolType === 'limited' && !stats.hasReceivedInfoBook
        ? Math.max(0, 60 - stats.totalPulls)
        : 0,
      // 30抽赠送十连信息（仅限定池）
      freeTenPulls: stats.freeTenPulls,
      // 240抽赠送信息
      gifts: stats.gifts
  };

  // 计算120抽必出限定机制（仅限定池）
  const pityInfoWithGuarantee = simulator.poolType === 'limited' ? (() => {
    // 检测前120抽内是否已经获得了限定6星（排除免费十连）
    let cumulativePulls = 0;
    let hasReceivedLimitedInFirst120 = false;

    // 遍历所有抽取记录，但排除免费十连
    for (const item of stats.sixStarHistory) {
      // 跳过免费十连中的记录
      if (item.isFreePull) {
        continue;
      }

      cumulativePulls += (item.pityWhenPulled || 1);

      // 如果在120抽内获得了限定6星（isUp为true），触发机制
      if (cumulativePulls <= 120 && item.isUp) {
        hasReceivedLimitedInFirst120 = true;
        break;
      }

      // 如果累计抽数超过120，停止检测
      if (cumulativePulls > 120) break;
    }

    return {
      guaranteedUp: {
        current: Math.min(stats.totalPulls, 120),
        hasReceived: hasReceivedLimitedInFirst120
      }
    };
  })() : {};

  // Construct currentPool object for DashboardView
  const currentPoolObj = {
      type: simulator.poolType,
      isLimitedWeapon: isLimitedWeapon,
      name: currentSimPool?.name || '未选择',
      up_character: currentSimPool?.up_character
  };

  // Construct effectivePity object for DashboardView
  const effectivePityObj = {
      pity6: pityInfo.sixStar.current,
      pity5: pityInfo.fiveStar.current,
      isInherited: false
  };


  return (
    <div className="flex flex-col h-full text-slate-800 dark:text-zinc-100 font-sans max-w-7xl mx-auto w-full">
      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center justify-between mb-6 px-2 gap-4">
        <div className="flex items-center gap-4">
          {/* 模拟器卡池选择器（简化版，不需要编辑/删除功能） */}
          <div className="relative">
            <button
              onClick={() => setShowPoolMenu(!showPoolMenu)}
              className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-none text-sm font-medium text-slate-700 dark:text-zinc-300 transition-colors"
            >
              <Layers size={16} />
              <span className="max-w-[150px] sm:max-w-[250px] truncate">
                {currentSimPool?.name || '选择模拟卡池'}
              </span>
              <ChevronDown size={14} className={`transition-transform ${showPoolMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* 卡池选择菜单 */}
            {showPoolMenu && (
              <>
                {/* 背景遮罩 */}
                <div className="fixed inset-0 z-10" onClick={() => setShowPoolMenu(false)}></div>

                {/* 下拉菜单 */}
                <div className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 rounded-none shadow-xl border border-zinc-100 dark:border-zinc-800 z-20 animate-fade-in overflow-hidden">
                  {/* 卡池列表 - 按类型分组 */}
                  <div className="max-h-80 overflow-y-auto">
                    {simulatorPools.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400 dark:text-zinc-500">
                  暂无卡池，请先在卡池详情中创建卡池
                </div>
              ) : (
                // 按类型分组显示（和 PoolSelector 完全一致的逻辑）
                (() => {
                  // 统一类型映射后分组
                  const groups = {
                    limited: { label: '限定角色池', icon: <Star size={12} className="text-orange-500" />, pools: [] },
                    weapon: { label: '限定武器池', icon: <Layers size={12} className="text-slate-500" />, pools: [] },
                    standard: { label: '常驻池', icon: <Layers size={12} className="text-yellow-600" />, pools: [] }
                  };

                  simulatorPools.forEach(pool => {
                    let type = pool.type || 'standard';

                    // 统一类型映射：将新格式映射到分组键
                    if (type === 'limited_character' || type === 'limited') {
                      type = 'limited';
                    } else if (type === 'limited_weapon' || type === 'weapon') {
                      type = 'weapon';
                    } else {
                      type = 'standard';
                    }

                    if (groups[type]) {
                      groups[type].pools.push(pool);
                    } else {
                      groups.standard.pools.push(pool);
                    }
                  });

                  // 转换为数组并过滤空分组
                  return ['limited', 'weapon', 'standard']
                    .map(type => ({ type, ...groups[type] }))
                    .filter(group => group.pools.length > 0)
                    .map(group => (
                      <div key={group.type}>
                        {/* 类型分组标题 */}
                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider bg-slate-50 dark:bg-zinc-800/50 sticky top-0 flex items-center gap-2">
                          {group.icon}
                          {group.label}
                          <span className="text-slate-300 dark:text-zinc-600">({group.pools.length})</span>
                        </div>

                        {/* 该类型的卡池列表 */}
                        {group.pools.map(pool => {
                          const isSelected = currentSimPoolId === pool.id;
                          return (
                            <div
                              key={pool.id}
                              className={`w-full hover:bg-slate-50 dark:hover:bg-zinc-800 ${isSelected ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                            >
                              <button
                                onClick={() => switchPool(pool.id)}
                                className="w-full text-left"
                                title={pool.name}
                              >
                                {/* Banner 图片（如果存在）*/}
                                {pool.banner_url && (
                                  <div className="relative w-full h-16 overflow-hidden">
                                    <img
                                      src={pool.banner_url}
                                      alt={pool.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        // 图片加载失败时隐藏
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                    {/* 渐变遮罩，让文字更清晰 */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                  </div>
                                )}

                                {/* 卡池信息区域 */}
                                <div className="px-3 py-2 flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    {/* 卡池名称 */}
                                    <div className={`flex items-center gap-2 text-sm ${isSelected ? 'text-yellow-600 dark:text-endfield-yellow font-bold' : 'text-slate-600 dark:text-zinc-400'}`}>
                                      <span className="truncate">{pool.name}</span>
                                    </div>

                                    {/* UP 角色信息（如果存在）*/}
                                    {pool.up_character && (
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0">
                                          <Star size={10} className="text-white" fill="white" />
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-zinc-500 truncate">
                                          UP: {pool.up_character}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* 右侧：选中标记 */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-sm bg-endfield-yellow"></div>}
                                  </div>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ));
                })()
              )}
                  </div>
            </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          {/* 跳过动画复选框 */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipAnimation}
              onChange={(e) => setSkipAnimation(e.target.checked)}
              className="w-4 h-4 text-endfield-yellow bg-gray-100 border-gray-300 rounded focus:ring-endfield-yellow focus:ring-2"
            />
            <Zap size={14} className="text-slate-500 dark:text-zinc-500" />
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
              跳过动画
            </span>
          </label>

          <button
            onClick={handleShare}
            className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
            title="分享到剪贴板"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">分享</span>
          </button>

          {/* 导出按钮 - 支持多种格式 */}
          <div className="relative group">
            <button
              className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
              title="导出数据"
            >
              <Download size={14} />
              <span className="hidden sm:inline">导出</span>
              <ChevronDown size={12} />
            </button>

            {/* 导出格式下拉菜单 */}
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => handleExportData('json')}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                导出为 JSON（可导入）
              </button>
              <button
                onClick={() => handleExportData('csv')}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
              >
                导出为 CSV（可导入）
              </button>
              <button
                onClick={handleExportReport}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
              >
                导出统计报告
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">SYSTEM ONLINE</span>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-500 transition-colors"
            title="重置模拟器"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">重置</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 flex-1">
        {/* 左侧：限定池分析 */}
        <div className="lg:col-span-3 space-y-4">
           {/* 限定池分析卡片 */}
           <LimitedPoolAnalysis
              currentPool={currentPoolObj}
              stats={dashboardStats}
              effectivePity={effectivePityObj}
              pityInfo={pityInfoWithGuarantee}
           />
        </div>

        {/* 中间：主视觉区 (Banner) */}
        <div className="lg:col-span-6 relative flex flex-col">
          <div className="flex-1 bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800 relative overflow-hidden flex items-center justify-center min-h-[600px]">
            {/* 装饰性背景 */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                 style={{ 
                   backgroundImage: 'radial-gradient(circle at center, #333 1px, transparent 1px)', 
                   backgroundSize: '20px 20px' 
                 }} 
            />
            
            {/* 动画层 (绝对定位覆盖) */}
            {isAnimating && <PullAnimation />}

            {/* 内容区：结果展示 或 默认Banner */}
            {lastResults ? (
              <div className="relative z-20 w-full h-full animate-fade-in p-4">
                <SimulatorResults results={lastResults} onClose={() => setLastResults(null)} />
              </div>
            ) : !isAnimating && (
              <div className="relative z-10 text-center transform transition-all duration-500 animate-fade-in">
                <div className="w-24 h-24 mx-auto mb-6 border-2 border-endfield-yellow rotate-45 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                   {simulator.poolType === 'limited' && <Star size={40} className="text-endfield-yellow -rotate-45" />}
                   {simulator.poolType === 'weapon' && <Search size={40} className="text-endfield-yellow -rotate-45" />}
                   {simulator.poolType === 'standard' && <Layers size={40} className="text-endfield-yellow -rotate-45" />}
                </div>
                
                <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-2">
                  {simulator.poolType === 'limited' ? 'LIMITED HEADHUNTING' : 
                   simulator.poolType === 'weapon' ? 'WEAPON ARSENAL' : 'STANDARD HEADHUNTING'}
                </h1>
                <p className="text-sm font-mono text-endfield-yellow tracking-[0.2em] uppercase opacity-80 bg-black/80 px-2 py-1 rounded inline-block">
                  Probability Up Event
                </p>
              </div>
            )}
          </div>

          {/* 底部控制区 */}
          <div className="mt-4">
             <SimulatorControls
               onPullOne={() => handlePull('single')}
               onPullTen={() => handlePull('ten')}
               disabled={isAnimating}
               jadeCost={600}
               availableFreePulls={availableFreePulls}
             />
          </div>
        </div>

        {/* 右侧：历史记录 + 模拟器专属统计 */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* 抽卡记录 - 固定高度，显示所有记录 */}
          <div className="flex flex-col h-[400px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
              <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <History size={14} /> 抽卡记录
              </h3>
              <span className="text-xs font-mono text-slate-400">共 {pullHistory.length} 抽</span>
            </div>
            <div className="flex-1 overflow-y-auto p-0 scrollbar-thin min-h-0">
              {pullHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600 opacity-50 p-8">
                  <div className="w-12 h-1 bg-zinc-700 mb-2 rotate-45" />
                  <p className="text-xs">暂无数据</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                   {processHistoryGroups(pullHistory).map((group, groupIdx) => {
                     if (group.type === 'tenPull') {
                       // 十连组
                       const isExpanded = expandedTenPulls.has(group.id);
                       const sixStarCount = group.pulls.filter(p => p.rarity === 6).length;
                       const fiveStarCount = group.pulls.filter(p => p.rarity === 5).length;
                       const hasHighRarity = sixStarCount > 0 || fiveStarCount > 0;
                       const isFreePull = group.pulls[0]?.isFreePull; // 检查是否是免费十连

                       return (
                         <div key={`group-${group.id}`}>
                           {/* 十连折叠头部 */}
                           <button
                             onClick={() => toggleTenPull(group.id)}
                             className="w-full p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-2 group"
                           >
                             <div className={`w-1 h-6 shrink-0 ${isFreePull ? 'bg-blue-500' : 'bg-blue-500'}`} />
                             <div className="flex-1 min-w-0 text-left">
                               <div className="text-xs font-bold text-blue-500 flex items-center gap-2">
                                 <span>十连</span>
                                 {isFreePull && (
                                   <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded border border-blue-200 dark:border-blue-700">
                                     免费
                                   </span>
                                 )}
                                 {hasHighRarity && (
                                   <span className="text-[10px] font-normal">
                                     {sixStarCount > 0 && <span className="text-endfield-yellow">{sixStarCount}×6★</span>}
                                     {sixStarCount > 0 && fiveStarCount > 0 && <span className="text-slate-400 mx-1">·</span>}
                                     {fiveStarCount > 0 && <span className="text-amber-400">{fiveStarCount}×5★</span>}
                                   </span>
                                 )}
                               </div>
                               <div className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                                 第 {group.startPullNumber} - {group.startPullNumber + 9} 抽
                                 {isFreePull && <span className="ml-2 text-blue-500">（不计入保底）</span>}
                               </div>
                             </div>
                             <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                           </button>

                           {/* 十连详细内容 */}
                           {isExpanded && (
                             <div className="bg-zinc-50 dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
                               {group.pulls.map((record, idx) => {
                                 let rarityColor = 'text-slate-400';
                                 let bgColor = 'bg-slate-200 dark:bg-zinc-700';
                                 let rarityLabel = `${record.rarity}★`;

                                 if (record.rarity === 6) {
                                   if (record.isUp) {
                           rarityColor = 'text-endfield-yellow bg-black/90 px-1 rounded-sm inline-block';
                                     bgColor = 'bg-endfield-yellow';
                                     rarityLabel = 'UP 6★';
                                   } else {
                                     rarityColor = 'text-red-400';
                                     bgColor = 'bg-red-500';
                                     rarityLabel = '常驻 6★';
                                   }
                                 } else if (record.rarity === 5) {
                                   rarityColor = 'text-amber-400';
                                   bgColor = 'bg-amber-500';
                                 } else if (record.rarity === 4) {
                                   rarityColor = 'text-purple-400';
                                   bgColor = 'bg-purple-500';
                                 }

                                 return (
                                   <div key={`${record.timestamp}-${idx}`} className="p-2 pl-6 flex items-center gap-2">
                                     <div className={`w-0.5 h-5 ${bgColor} shrink-0`} />
                                     <div className="flex-1 min-w-0">
                                       <div className={`text-[11px] font-bold ${rarityColor} flex items-center gap-2`}>
                                         <span>{rarityLabel}</span>
                                         {record.characterName && (
                                           <span className="text-[9px] font-normal text-slate-600 dark:text-zinc-400 truncate">
                                             {record.characterName}
                                           </span>
                                         )}
                                       </div>
                                     </div>
                                   </div>
                                 );
                               })}
                             </div>
                           )}
                         </div>
                       );
                     } else {
                       // 单抽记录
                       const record = group;
                       let rarityColor = 'text-slate-400';
                       let bgColor = 'bg-slate-200 dark:bg-zinc-700';
                       let rarityLabel = `${record.rarity}★`;

                       if (record.rarity === 6) {
                         if (record.isUp) {
                           rarityColor = 'text-endfield-yellow';
                           bgColor = 'bg-endfield-yellow';
                           rarityLabel = 'UP 6★';
                         } else {
                           rarityColor = 'text-red-400';
                           bgColor = 'bg-red-500';
                           rarityLabel = '常驻 6★';
                         }
                       } else if (record.rarity === 5) {
                         rarityColor = 'text-amber-400';
                         bgColor = 'bg-amber-500';
                       } else if (record.rarity === 4) {
                         rarityColor = 'text-purple-400';
                         bgColor = 'bg-purple-500';
                       }

                       return (
                         <div key={`${record.timestamp}-${groupIdx}`} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-2 group">
                            <div className={`w-1 h-6 ${bgColor} shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-bold ${rarityColor} flex items-center gap-2`}>
                                <span>{rarityLabel}</span>
                                {record.characterName && (
                                  <span className="text-[10px] font-normal text-slate-600 dark:text-zinc-400 truncate">
                                    {record.characterName}
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono">
                                第 {record.pullNumber} 抽
                              </div>
                            </div>
                         </div>
                       );
                     }
                   })}
                </div>
              )}
            </div>
          </div>

          {/* 角色出货统计 */}
          <CharacterStats
              pullHistory={pullHistory}
              poolType={simulator.poolType}
           />
        </div>
      </div>

      {/* Toast 提示 */}
      {showToast && (
        <div className="fixed bottom-8 right-8 z-50 animate-fade-in">
          <div className="bg-endfield-yellow text-black px-6 py-3 shadow-lg border-2 border-black font-bold">
            {toastMessage}
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #333;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default GachaSimulator;
