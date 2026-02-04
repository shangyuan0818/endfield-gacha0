import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Layers, Search, History, Star, Download, Share2, ChevronDown, Zap, Check } from 'lucide-react';
import { createSimulator } from '../../utils/gachaSimulator';
import SimulatorResults from './SimulatorResults';
import SimulatorControls from './SimulatorControls';
import PullAnimation from './PullAnimation';
import LimitedPoolAnalysis from './LimitedPoolAnalysis'; // 新增：限定池分析组件
import CharacterStats from './CharacterStats'; // 新增：角色统计组件
import PoolSelector from '../../components/pool/PoolSelector'; // 新增：卡池选择器
import ConfirmDialog from '../../components/ui/ConfirmDialog'; // 新增：确认对话框
import { LIMITED_POOL_SCHEDULE, getCurrentUpPool, WEAPON_POOL_RULES } from '../../constants';
import { calculateCurrentProbability } from '../../utils/validators';
import { usePoolStore } from '../../stores'; // 新增：获取真实卡池列表
import { supabase } from '../../supabaseClient';
import {
  saveSimulatorState,
  loadSimulatorState,
  clearSimulatorState,
  downloadAnalysisReport,
  downloadSimulatorData,
  generateShareText,
  copyToClipboard,
  saveSharedPityState,
  loadSharedPityState,
  clearSharedPityState,
  saveInfoBookState,
  loadInfoBookState,
  clearInfoBookState
} from '../../utils/simulatorStorage';

const POOL_NAMES = {
  limited: '限定寻访',
  weapon: '武器寻访',
  standard: '常驻寻访'
};

const GachaSimulator = () => {
  // 从 store 获取真实卡池列表
  const realPools = usePoolStore(state => state.pools);

  // 存储当前卡池的角色列表（从 pool_characters 表加载）
  const [poolCharactersList, setPoolCharactersList] = useState(null);

  // 模拟器实例及相关状态（尽早声明，避免 TDZ）
  const [simulator, setSimulator] = useState(() => {
    // 初始化时先创建一个默认的限定池模拟器
    // 实际的卡池同步会在 useEffect 中完成
    const currentUp = getCurrentUpPool();
    const sim = createSimulator('limited', null, currentUp.name, null);
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
  const [infoBookTenPullAvailable, setInfoBookTenPullAvailable] = useState(false); // 情报书十连是否可用
  const [showResetConfirm, setShowResetConfirm] = useState(false); // 重置确认对话框状态
  const [resetAllPools, setResetAllPools] = useState(false); // 是否重置所有卡池
  const [resetSettings, setResetSettings] = useState(false); // 是否重置开关设置

  // 创建模拟池列表（为每个真实卡池添加 [模拟] 标识）
  const simulatorPools = useMemo(() => {
    const poolsArray = Array.isArray(realPools) ? realPools : [];

    // 按照 start_time 排序（时间早的在前，没有时间的放最后）
    const sortedPools = [...poolsArray].sort((a, b) => {
      // 如果都没有 start_time，保持原顺序
      if (!a.start_time && !b.start_time) return 0;
      // 如果 a 没有 start_time，放在后面
      if (!a.start_time) return 1;
      // 如果 b 没有 start_time，放在后面
      if (!b.start_time) return -1;
      // 都有 start_time，按时间排序
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });

    return sortedPools.map(pool => ({
      ...pool,
      id: `sim_${pool.id}`,  // 模拟池ID前缀
      name: `${pool.name} [模拟]`,  // 名称添加标识
      isSimulator: true  // 标记为模拟池
    }));
  }, [realPools]);

  // 当前选中的模拟池ID（从 localStorage 恢复）
  const [currentSimPoolId, setCurrentSimPoolId] = useState(() => {
    // 尝试从 localStorage 读取上次选择的卡池ID
    const savedPoolId = localStorage.getItem('simulator_currentPoolId');
    if (savedPoolId) {
      return savedPoolId;
    }
    // 新用户没有保存的ID，返回 null，稍后在 useEffect 中处理
    return null;
  });

  // 标记是否已完成初始化同步
  const [isInitialized, setIsInitialized] = useState(false);

  // 获取当前模拟池对象（必须在使用 currentSimPool 的 useEffect 之前声明）
  const currentSimPool = simulatorPools.find(p => p.id === currentSimPoolId);
  const currentPoolType = currentSimPool?.type || 'limited';

  // 加载当前卡池的角色列表（从 pool_characters 表）
  useEffect(() => {
    if (!currentSimPool?.id) {
      setPoolCharactersList(null);
      return;
    }

    // 移除 "sim_" 前缀以获取真实卡池ID
    const realPoolId = currentSimPool.id.replace(/^sim_/, '');

    const loadPoolCharacters = async () => {
      const expectedType = currentPoolType === 'weapon' ? 'weapon' : 'character';
      const { data, error } = await supabase
        .from('pool_characters')
        .select(`
          character_id,
          is_up,
          characters (
            id,
            name,
            rarity,
            type,
            is_limited
          )
        `)
        .eq('pool_id', realPoolId);

      if (error) {
        console.error('加载卡池角色列表失败:', error);
        setPoolCharactersList(null);
        return;
      }

      // 按稀有度和是否UP分组
      const lists = {
        up: [],      // UP角色/武器
        offBanner: [], // 非UP的6星
        fiveStar: [],  // 5星
        fourStar: []   // 4星
      };

      // 根据 pools.up_character 动态判断 UP（不依赖 pool_characters.is_up）
      const upCharName = currentSimPool.up_character;
      
      data.forEach((item) => {
        const char = item.characters;
        if (!char) return;
        if (char.type !== expectedType) {
          return;
        }

        // 根据角色/武器名称与 up_character 匹配来判断是否为 UP
        const isActuallyUp = upCharName && char.name === upCharName;

        if (isActuallyUp) {
          lists.up.push(char);
        } else if (char.rarity === 6) {
          lists.offBanner.push(char);
        } else if (char.rarity === 5) {
          lists.fiveStar.push(char);
        } else if (char.rarity === 4) {
          lists.fourStar.push(char);
        }
      });

      setPoolCharactersList(lists);
    };

    loadPoolCharacters();
  }, [currentSimPool?.id]);

  // 保存当前选择的卡池ID到 localStorage
  useEffect(() => {
    if (currentSimPoolId && isInitialized) {
      localStorage.setItem('simulator_currentPoolId', currentSimPoolId);
    }
  }, [currentSimPoolId, isInitialized]);

  const [skipAnimation, setSkipAnimation] = useState(() => {
    const saved = localStorage.getItem('simulator_skipAnimation');
    return saved === 'true';
  }); // 跳过动画选项
  const [multipleFreeTen, setMultipleFreeTen] = useState(() => {
    const saved = localStorage.getItem('simulator_multipleFreeTen');
    return saved === 'true';
  }); // 多次免费十连（BUG特性）
  const [showPoolMenu, setShowPoolMenu] = useState(false); // 卡池菜单显示状态

  // 限定卡池选择（默认最新的卡池）
  const [selectedLimitedPool, setSelectedLimitedPool] = useState(() => {
    // 获取当前UP池作为默认值
    const currentUp = getCurrentUpPool();
    return currentUp.name;
  });

  // 获取默认卡池（优先选择限定角色池）
  const getDefaultPool = useCallback(() => {
    if (simulatorPools.length === 0) return null;
    // 优先找限定角色池
    const limitedPool = simulatorPools.find(p => p.type === 'limited');
    if (limitedPool) return limitedPool;
    // 否则返回第一个
    return simulatorPools[0];
  }, [simulatorPools]);

  // 同步卡池角色列表到模拟器
  useEffect(() => {
    if (poolCharactersList && simulator) {
      simulator.setPoolCharactersList(poolCharactersList);
    }
  }, [poolCharactersList, simulator]);

  // 保存开关状态到 localStorage
  useEffect(() => {
    localStorage.setItem('simulator_skipAnimation', skipAnimation);
  }, [skipAnimation]);

  useEffect(() => {
    localStorage.setItem('simulator_multipleFreeTen', multipleFreeTen);
  }, [multipleFreeTen]);

  // 当卡池列表加载完成后，初始化或恢复卡池选择
  useEffect(() => {
    if (simulatorPools.length === 0 || isInitialized) return;

    const savedPoolId = localStorage.getItem('simulator_currentPoolId');
    let targetPool = null;
    let targetPoolId = null;

    if (savedPoolId) {
      // 检查保存的卡池ID是否存在于当前卡池列表中
      targetPool = simulatorPools.find(p => p.id === savedPoolId);
      if (targetPool) {
        targetPoolId = savedPoolId;
      }
    }

    // 如果没有有效的保存卡池，使用默认卡池
    if (!targetPool) {
      targetPool = getDefaultPool();
      targetPoolId = targetPool?.id || null;
    }

    if (targetPool && targetPoolId) {
      
      // 设置当前卡池ID
      setCurrentSimPoolId(targetPoolId);
      
      // 加载对应的模拟器状态
      const savedState = loadSimulatorState(targetPoolId);
      const upChar = targetPool.type === 'limited' ? (targetPool.up_character || getCurrentUpPool().name) : null;
      const newSim = createSimulator(targetPool.type, null, upChar, poolCharactersList);
      if (savedState) {
        newSim.importState(savedState);
      }
      // 同步卡池角色列表到模拟器
      if (poolCharactersList) {
        newSim.setPoolCharactersList(poolCharactersList);
      }
      setSimulator(newSim);
      setStats(newSim.getStatistics());
      setPityInfo(newSim.getPityInfo());
      
      // 更新限定池UP角色状态
      if (targetPool.type === 'limited') {
        setSelectedLimitedPool(upChar || getCurrentUpPool().name);
      }
    }

    // 标记初始化完成
    setIsInitialized(true);
  }, [simulatorPools.length, isInitialized, getDefaultPool]); // 只在卡池列表变化时执行

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
        // 默认只能获得1次免费十连，开启"多次免费十连"后可以获得多次
        const maxFreePulls = multipleFreeTen ? earnedFreePulls : Math.min(earnedFreePulls, 1);
        setAvailableFreePulls(Math.max(0, maxFreePulls - usedFreePulls));

        // 检查情报书状态
        const state = simulator.getState();
        const infoBooks = loadInfoBookState();

        // 如果当前池获得了情报书，保存到全局映射表
        if (state.hasUnactivatedInfoBook && !infoBooks[currentSimPoolId]) {
          // 获取所有限定池，按开始时间排序
          const limitedPools = simulatorPools
            .filter(p => p.type === 'limited' || p.type === 'limited_character')
            .sort((a, b) => {
              const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
              const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
              return timeA - timeB;
            });

          // 找到当前卡池的索引和下一个卡池
          const currentIndex = limitedPools.findIndex(p => p.id === currentSimPoolId);
          if (currentIndex !== -1) {
            const nextPool = limitedPools[currentIndex + 1];

            // 保存情报书到映射表（即使没有下一个卡池也保存）
            const updatedInfoBooks = { ...infoBooks };
            updatedInfoBooks[currentSimPoolId] = {
              activated: false,
              used: false,
              targetPoolId: nextPool?.id || null,  // 允许null（等待新卡池上线）
              obtainedAt: Date.now()
            };
            saveInfoBookState(updatedInfoBooks);
          }
        }

        // 检查当前卡池是否有可用的情报书十连
        const availableInfoBook = Object.entries(infoBooks).find(
          ([_, book]) => book.targetPoolId === currentSimPoolId && book.activated && !book.used
        );
        const isInfoBookAvailable = !!availableInfoBook;
        setInfoBookTenPullAvailable(isInfoBookAvailable);

        // 同步到模拟器内部状态
        if (state.infoBookTenPullAvailable !== isInfoBookAvailable) {
          simulator.updateState({
            infoBookTenPullAvailable: isInfoBookAvailable
          });
        }

        // 保存共享保底状态（不包括120抽硬保底）
        saveSharedPityState({
          sixStarPity: state.sixStarPity,
          fiveStarPity: state.fiveStarPity
        });
      } else {
        setAvailableFreePulls(0);
        setInfoBookTenPullAvailable(false);
      }

      // 自动保存状态（使用卡池ID作为key，确保每个卡池独立存储）
      if (currentSimPoolId) {
        saveSimulatorState(currentSimPoolId, simulator.exportState());
      }
    };
    simulator.addListener(updateUI);
    // 初始化时也更新一次
    updateUI();
    return () => simulator.removeListener(updateUI);
  }, [simulator, currentPoolType, multipleFreeTen]);

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
        // 优先级：情报书十连 > 免费十连 > 普通十连
        if (infoBookTenPullAvailable && simulator.poolType === 'limited') {
          // 找到当前卡池可用的情报书并标记为已使用
          const infoBooks = loadInfoBookState();
          const sourcePoolId = Object.keys(infoBooks).find(
            poolId => infoBooks[poolId].targetPoolId === currentSimPoolId &&
                     infoBooks[poolId].activated &&
                     !infoBooks[poolId].used
          );

          if (sourcePoolId) {
            const updatedInfoBooks = { ...infoBooks };
            updatedInfoBooks[sourcePoolId].used = true;
            saveInfoBookState(updatedInfoBooks);
          }

          // 立即更新UI状态
          setInfoBookTenPullAvailable(false);

          // 然后执行抽卡
          results = simulator.pullInfoBookTen();
          showToastMessage('使用情报书十连！（计入保底）');
        } else if (availableFreePulls > 0 && simulator.poolType === 'limited') {
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
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    if (resetAllPools) {
      // 重置所有类型的卡池
      simulatorPools.forEach(pool => {
        clearSimulatorState(pool.id);
      });
      // 清除全局状态
      clearSharedPityState();
      clearInfoBookState();
      showToastMessage('已重置所有类型的卡池');
    } else {
      // 重置当前类型的所有卡池
      const currentType = currentSimPool?.type || 'limited';
      simulatorPools
        .filter(pool => pool.type === currentType)
        .forEach(pool => {
          clearSimulatorState(pool.id);
        });

      // 如果是限定池，清除限定池专属的全局状态
      if (currentType === 'limited') {
        clearSharedPityState();
        clearInfoBookState();
      }

      const typeName = currentType === 'limited' ? '限定角色池' : currentType === 'weapon' ? '武器池' : '常驻池';
      showToastMessage(`已重置所有${typeName}`);
    }

    // 重置当前模拟器
    simulator.reset();
    setLastResults(null);

    // 重置开关设置
    if (resetSettings) {
      setSkipAnimation(false);
      setMultipleFreeTen(false);
      localStorage.removeItem('simulator_skipAnimation');
      localStorage.removeItem('simulator_multipleFreeTen');
    }

    setShowResetConfirm(false);
    setResetAllPools(false);
    setResetSettings(false);
  };

  const switchPool = (poolId) => {
    if (currentSimPoolId === poolId) return;

    // 找到目标模拟池
    const targetPool = simulatorPools.find(p => p.id === poolId);
    if (!targetPool) return;

    // 保存当前卡池状态
    saveSimulatorState(currentSimPoolId, simulator.exportState());

    // 如果当前是限定池，保存共享保底状态（不包括120抽硬保底）
    if (simulator.poolType === 'limited') {
      const currentState = simulator.getState();
      saveSharedPityState({
        sixStarPity: currentState.sixStarPity,
        fiveStarPity: currentState.fiveStarPity
      });
    }

    // 🔧 修复：立即清空旧卡池的角色列表，防止新模拟器使用旧数据
    setPoolCharactersList(null);

    // 加载新卡池状态
    const savedState = loadSimulatorState(poolId);
    // 如果是限定池，使用目标卡池的UP角色
    const upChar = targetPool.type === 'limited' ? (targetPool.up_character || selectedLimitedPool) : null;
    // 🔧 修复：创建新模拟器时不传入旧的 poolCharactersList，传入 null
    const newSim = createSimulator(targetPool.type, null, upChar, null);
    if (savedState) {
      newSim.importState(savedState);
      // 重要：importState 后需要重新设置 UP 角色
      if (upChar) {
        newSim.setCurrentUpCharacter(upChar);
      }
      // 🔧 修复：不在这里设置角色列表，等待 useEffect 加载新卡池的角色列表
    }

    // 如果切换到限定池，加载共享保底状态和情报书状态
    if (targetPool.type === 'limited') {
      const sharedPity = loadSharedPityState();
      if (sharedPity) {
        // 应用共享保底状态（不包括120抽硬保底，每个池独立）
        newSim.updateState({
          sixStarPity: sharedPity.sixStarPity,
          fiveStarPity: sharedPity.fiveStarPity
        });
      }

      // 自动更新待激活的情报书（targetPoolId 为 null 的情报书）
      const infoBooks = loadInfoBookState();
      let hasUpdated = false;

      // 获取所有限定池，按开始时间排序
      const limitedPools = simulatorPools
        .filter(p => p.type === 'limited' || p.type === 'limited_character')
        .sort((a, b) => {
          const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
          const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
          return timeA - timeB;
        });

      // 检查所有情报书，更新 targetPoolId 为 null 的
      Object.keys(infoBooks).forEach(sourcePoolId => {
        const book = infoBooks[sourcePoolId];
        if (book.targetPoolId === null && !book.used) {
          // 找到源卡池的索引
          const sourceIndex = limitedPools.findIndex(p => p.id === sourcePoolId);
          if (sourceIndex !== -1 && sourceIndex + 1 < limitedPools.length) {
            // 找到下一个卡池
            const nextPool = limitedPools[sourceIndex + 1];
            book.targetPoolId = nextPool.id;
            hasUpdated = true;
          }
        }
      });

      // 如果有更新，保存到存储
      if (hasUpdated) {
        saveInfoBookState(infoBooks);
      }

      // 检查并激活情报书
      const sourcePoolId = Object.keys(infoBooks).find(
        sourceId => infoBooks[sourceId].targetPoolId === poolId && !infoBooks[sourceId].activated
      );

      if (sourcePoolId) {
        // 激活情报书
        const updatedInfoBooks = { ...infoBooks };
        updatedInfoBooks[sourcePoolId].activated = true;
        saveInfoBookState(updatedInfoBooks);

        showToastMessage('情报书已激活！可使用情报书十连');

        // 同步到模拟器状态
        newSim.updateState({
          infoBookTenPullAvailable: true
        });
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
      upSixStarCount: stats.upSixStarCount || 0,  // 新增：UP 6星数量（用于不歪率显示）
      sixStarCount: stats.sixStarCount || 0,      // 新增：总6星数量（用于不歪率显示）
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
      freeTenPulls: {
        ...stats.freeTenPulls,
        received: simulator.getState().freeTenPullsReceived  // 添加已领取次数
      },
      // 240抽赠送信息
      gifts: stats.gifts
  };

  // 计算硬保底机制（限定池120抽 / 武器池80抽）
  const pityInfoWithGuarantee = (() => {
    // 限定池：120抽必出限定
    if (simulator.poolType === 'limited') {
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
    }

    // 武器池：80抽首轮必出限定
    if (simulator.poolType === 'weapon') {
      // 检测前80抽内是否已经获得了限定6星武器
      let cumulativePulls = 0;
      let hasReceivedLimitedInFirst80 = false;

      // 遍历所有6星历史记录
      for (const item of stats.sixStarHistory) {
        cumulativePulls += (item.pityWhenPulled || 1);

        // 如果在80抽内获得了限定6星（isUp为true），触发机制
        if (cumulativePulls <= 80 && item.isUp) {
          hasReceivedLimitedInFirst80 = true;
          break;
        }

        // 如果累计抽数超过80，停止检测
        if (cumulativePulls > 80) break;
      }

      return {
        guaranteedUp: {
          current: Math.min(stats.totalPulls, 80),
          hasReceived: hasReceivedLimitedInFirst80
        }
      };
    }

    // 其他卡池类型：返回空对象
    return {};
  })();

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
          {/* 多次免费十连 - 技术风开关（仅限定池显示） */}
          {simulator.poolType === 'limited' && (
            <div
              onClick={() => setMultipleFreeTen(!multipleFreeTen)}
              className={`
                flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border select-none
                ${multipleFreeTen
                  ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700'
                }
              `}
              title="多次十连是BUG（划掉）特性哦~"
            >
              <div className={`w-3 h-3 border flex items-center justify-center transition-colors ${multipleFreeTen ? 'border-blue-500 bg-blue-500' : 'border-current'}`}>
                {multipleFreeTen && <Check size={10} className="text-white" strokeWidth={4} />}
              </div>
              <span className="text-xs font-bold uppercase">多次免费十连</span>
            </div>
          )}

          {/* 跳过动画 - 技术风开关 */}
                    <div
                      onClick={() => setSkipAnimation(!skipAnimation)}
                      className={`
                        flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border select-none
                        ${skipAnimation 
                          ? 'bg-yellow-50 dark:bg-endfield-yellow/10 border-yellow-600 dark:border-endfield-yellow text-yellow-700 dark:text-endfield-yellow' 
                          : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700'
                        }
                      `}
                    >
                      <div className={`w-3 h-3 border flex items-center justify-center transition-colors ${skipAnimation ? 'border-yellow-600 dark:border-endfield-yellow bg-yellow-500 dark:bg-endfield-yellow' : 'border-current'}`}>
                        {skipAnimation && <Check size={10} className="text-white dark:text-black" strokeWidth={4} />}
                      </div>
                      <span className="text-xs font-bold uppercase">跳过动画</span>
                    </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-[32fr_48fr_20fr] gap-6 mb-8 flex-1">
        {/* 左侧：限定池分析 */}
        <div className="space-y-4">
           {/* 限定池分析卡片 */}
           <LimitedPoolAnalysis
              currentPool={currentPoolObj}
              stats={dashboardStats}
              effectivePity={effectivePityObj}
              pityInfo={pityInfoWithGuarantee}
              multipleFreeTen={multipleFreeTen}
           />
        </div>

        {/* 中间：主视觉区 (Banner) */}
        <div className="relative flex flex-col">
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
               disabled={isAnimating || !poolCharactersList}
               jadeCost={600}
               availableFreePulls={availableFreePulls}
               infoBookTenPullAvailable={infoBookTenPullAvailable}
             />
          </div>
        </div>

        {/* 右侧：历史记录 + 模拟器专属统计 */}
        <div className="flex flex-col gap-4">
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

      {/* 重置确认对话框 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-md w-full mx-4">
            {/* 标题栏 */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-red-50 dark:bg-red-900/20">
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                重置模拟器
              </h3>
            </div>

            {/* 内容区 */}
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                {resetAllPools
                  ? '确定要重置所有类型的卡池吗？所有数据将被清空。'
                  : `确定要重置所有${currentSimPool?.type === 'limited' ? '限定角色池' : currentSimPool?.type === 'weapon' ? '武器池' : '常驻池'}吗？该类型的所有卡池数据将被清空。`
                }
              </p>

              {/* 复选框：重置所有类型的卡池 */}
              <div
                onClick={() => setResetAllPools(!resetAllPools)}
                className={`
                  flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border select-none
                  ${resetAllPools
                    ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }
                `}
              >
                <div className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${resetAllPools ? 'border-red-500 bg-red-500' : 'border-current'}`}>
                  {resetAllPools && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">重置所有类型的卡池</div>
                  <div className="text-xs opacity-75 mt-0.5">清空限定、武器、常驻所有类型的卡池数据</div>
                </div>
              </div>

              {/* 复选框：重置开关设置 */}
              <div
                onClick={() => setResetSettings(!resetSettings)}
                className={`
                  flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border select-none
                  ${resetSettings
                    ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }
                `}
              >
                <div className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${resetSettings ? 'border-red-500 bg-red-500' : 'border-current'}`}>
                  {resetSettings && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">重置开关设置</div>
                  <div className="text-xs opacity-75 mt-0.5">恢复"跳过动画"和"多次免费十连"为默认状态</div>
                </div>
              </div>
            </div>

            {/* 按钮区 */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 justify-end bg-zinc-50 dark:bg-zinc-950">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetAllPools(false);
                  setResetSettings(false);
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmReset}
                className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                确认重置
              </button>
            </div>
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
        /* 动画已移至 index.css (使用 animate-fade-in-up-small) */
      `}</style>
    </div>
  );
};

export default GachaSimulator;
