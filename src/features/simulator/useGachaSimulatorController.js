import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSimulator } from '../../utils/gachaSimulator';
import { getCurrentUpPool, WEAPON_POOL_RULES } from '../../constants';
import { usePoolStore } from '../../stores';
import { loadVisiblePools } from '../../services/poolReadService';
import { supabase } from '../../supabaseClient';
import {
  clearInfoBookState,
  clearSharedPityState,
  clearSimulatorState,
  copyToClipboard,
  downloadAnalysisReport,
  downloadSimulatorData,
  generateShareText,
  loadInfoBookState,
  loadSharedPityState,
  loadSimulatorState,
  saveInfoBookState,
  saveSharedPityState,
  saveSimulatorState
} from '../../utils/simulatorStorage';
import { buildDashboardStats, buildPityInfoWithGuarantee, processHistoryGroups } from './simulatorViewUtils';

const getWeaponPoolRules = (pool) => (
  pool?.isLimitedWeapon !== false
    ? WEAPON_POOL_RULES
    : {
        ...WEAPON_POOL_RULES,
        giftInterval: Infinity
      }
);

const getCustomRulesForPool = (pool) => (
  pool?.type === 'weapon' ? getWeaponPoolRules(pool) : null
);

function sortLimitedPools(pools) {
  return pools
    .filter((pool) => pool.type === 'limited' || pool.type === 'limited_character')
    .sort((left, right) => {
      const leftTime = left.start_time ? new Date(left.start_time).getTime() : 0;
      const rightTime = right.start_time ? new Date(right.start_time).getTime() : 0;
      return leftTime - rightTime;
    });
}

export function useGachaSimulatorController() {
  const storePools = usePoolStore((state) => state.pools);
  const [publicPools, setPublicPools] = useState([]);
  const realPools = storePools.length > 0 ? storePools : publicPools;

  useEffect(() => {
    if (storePools.length > 0) {
      return undefined;
    }

    let cancelled = false;

    const loadPublicPools = async () => {
      try {
        const visiblePools = await loadVisiblePools();
        if (!cancelled && visiblePools.length > 0) {
          setPublicPools(visiblePools);
        }
      } catch (error) {
        console.error('加载公开卡池异常:', error);
      }
    };

    loadPublicPools();
    return () => {
      cancelled = true;
    };
  }, [storePools.length]);

  const [poolCharactersList, setPoolCharactersList] = useState(null);
  const [simulator, setSimulator] = useState(() => {
    const currentUp = getCurrentUpPool();
    return createSimulator('limited', null, currentUp.name, null);
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastResults, setLastResults] = useState(null);
  const [stats, setStats] = useState(simulator.getStatistics());
  const [pityInfo, setPityInfo] = useState(simulator.getPityInfo());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [pullHistory, setPullHistory] = useState([]);
  const [expandedTenPulls, setExpandedTenPulls] = useState(new Set());
  const [availableFreePulls, setAvailableFreePulls] = useState(0);
  const [infoBookTenPullAvailable, setInfoBookTenPullAvailable] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetAllPools, setResetAllPools] = useState(false);
  const [resetSettings, setResetSettings] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(() => localStorage.getItem('simulator_skipAnimation') === 'true');
  const [multipleFreeTen, setMultipleFreeTen] = useState(() => localStorage.getItem('simulator_multipleFreeTen') === 'true');
  const [showPoolMenu, setShowPoolMenu] = useState(false);
  const [selectedLimitedPool, setSelectedLimitedPool] = useState(() => getCurrentUpPool().name);

  const simulatorPools = useMemo(() => {
    const poolsArray = Array.isArray(realPools) ? realPools : [];
    const sortedPools = [...poolsArray].sort((left, right) => {
      if (!left.start_time && !right.start_time) return 0;
      if (!left.start_time) return 1;
      if (!right.start_time) return -1;
      return new Date(left.start_time).getTime() - new Date(right.start_time).getTime();
    });

    return sortedPools.map((pool) => ({
      ...pool,
      id: `sim_${pool.id}`,
      name: `${pool.name} [模拟]`,
      isSimulator: true
    }));
  }, [realPools]);

  const [currentSimPoolId, setCurrentSimPoolId] = useState(() => localStorage.getItem('simulator_currentPoolId') || null);
  const [isInitialized, setIsInitialized] = useState(false);
  const currentSimPool = useMemo(
    () => simulatorPools.find((pool) => pool.id === currentSimPoolId),
    [simulatorPools, currentSimPoolId]
  );
  const currentPoolType = currentSimPool?.type || 'limited';

  useEffect(() => {
    if (!currentSimPool?.id) {
      return undefined;
    }

    let cancelled = false;

    const loadPoolCharacters = async () => {
      const expectedType = currentPoolType === 'weapon' ? 'weapon' : 'character';
      const upCharName = currentSimPool.up_character;
      const lists = {
        up: [],
        offBanner: [],
        fiveStar: [],
        fourStar: []
      };
      const realPoolId = currentSimPool.id.replace(/^sim_/, '');

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

      if (!error && data && data.length > 0) {
        data.forEach((item) => {
          const character = item.characters;
          if (!character || character.type !== expectedType) {
            return;
          }

          const isActuallyUp = upCharName && character.name === upCharName;
          if (isActuallyUp) {
            lists.up.push(character);
          } else if (character.rarity === 6) {
            lists.offBanner.push(character);
          } else if (character.rarity === 5) {
            lists.fiveStar.push(character);
          } else if (character.rarity === 4) {
            lists.fourStar.push(character);
          }
        });

        if (!cancelled) {
          setPoolCharactersList(lists);
        }
        return;
      }

      console.log('[GachaSimulator] pool_characters 查询失败或为空，使用 characters 表后备');

      const { data: allCharacters, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('type', expectedType);

      if (charError || !allCharacters) {
        console.error('加载角色列表失败:', charError);
        if (!cancelled) {
          setPoolCharactersList(null);
        }
        return;
      }

      const poolTypeKey = currentPoolType === 'weapon' ? 'weapon' : 'limited';
      allCharacters.forEach((character) => {
        const pools = character.pool_config?.pools || [];
        if (!pools.includes(poolTypeKey) && !pools.includes('standard')) {
          return;
        }

        const isActuallyUp = upCharName && character.name === upCharName;
        if (isActuallyUp) {
          lists.up.push(character);
        } else if (character.rarity === 6) {
          lists.offBanner.push(character);
        } else if (character.rarity === 5) {
          lists.fiveStar.push(character);
        } else if (character.rarity === 4) {
          lists.fourStar.push(character);
        }
      });

      if (!cancelled) {
        setPoolCharactersList(lists);
      }
    };

    loadPoolCharacters();
    return () => {
      cancelled = true;
    };
  }, [currentPoolType, currentSimPool?.id, currentSimPool?.up_character]);

  useEffect(() => {
    if (currentSimPoolId && isInitialized) {
      localStorage.setItem('simulator_currentPoolId', currentSimPoolId);
    }
  }, [currentSimPoolId, isInitialized]);

  const getDefaultPool = useCallback(() => {
    if (simulatorPools.length === 0) {
      return null;
    }

    return simulatorPools.find((pool) => pool.type === 'limited') || simulatorPools[0];
  }, [simulatorPools]);

  useEffect(() => {
    if (poolCharactersList && simulator) {
      simulator.setPoolCharactersList(poolCharactersList);
    }
  }, [poolCharactersList, simulator]);

  useEffect(() => {
    localStorage.setItem('simulator_skipAnimation', skipAnimation);
  }, [skipAnimation]);

  useEffect(() => {
    localStorage.setItem('simulator_multipleFreeTen', multipleFreeTen);
  }, [multipleFreeTen]);

  useEffect(() => {
    if (simulatorPools.length === 0 || isInitialized) {
      return;
    }

    const savedPoolId = localStorage.getItem('simulator_currentPoolId');
    let targetPool = null;
    let targetPoolId = null;

    if (savedPoolId) {
      targetPool = simulatorPools.find((pool) => pool.id === savedPoolId);
      if (targetPool) {
        targetPoolId = savedPoolId;
      }
    }

    if (!targetPool) {
      targetPool = getDefaultPool();
      targetPoolId = targetPool?.id || null;
    }

    if (targetPool && targetPoolId) {
      const savedState = loadSimulatorState(targetPoolId);
      const upCharacter = targetPool.type === 'limited' ? (targetPool.up_character || getCurrentUpPool().name) : null;
      const nextSimulator = createSimulator(targetPool.type, getCustomRulesForPool(targetPool), upCharacter, poolCharactersList);

      if (savedState) {
        nextSimulator.importState(savedState);
      }
      if (poolCharactersList) {
        nextSimulator.setPoolCharactersList(poolCharactersList);
      }

      queueMicrotask(() => {
        setCurrentSimPoolId(targetPoolId);
        setSimulator(nextSimulator);
        setStats(nextSimulator.getStatistics());
        setPityInfo(nextSimulator.getPityInfo());
        if (targetPool.type === 'limited') {
          setSelectedLimitedPool(upCharacter || getCurrentUpPool().name);
        }
      });
    }

    queueMicrotask(() => {
      setIsInitialized(true);
    });
  }, [getDefaultPool, isInitialized, poolCharactersList, simulatorPools]);

  useEffect(() => {
    const updateUI = () => {
      setStats(simulator.getStatistics());
      setPityInfo(simulator.getPityInfo());
      setPullHistory(simulator.getState().pullHistory || []);

      if (simulator.poolType === 'limited') {
        const nextStats = simulator.getStatistics();
        const state = simulator.getState();
        const earnedFreePulls = nextStats.freeTenPulls?.count || 0;
        const usedFreePulls = state.freeTenPullsReceived || 0;
        const maxFreePulls = multipleFreeTen ? earnedFreePulls : Math.min(earnedFreePulls, 1);
        setAvailableFreePulls(Math.max(0, maxFreePulls - usedFreePulls));

        const infoBooks = loadInfoBookState();
        if (state.hasUnactivatedInfoBook && !infoBooks[currentSimPoolId]) {
          const limitedPools = sortLimitedPools(simulatorPools);
          const currentIndex = limitedPools.findIndex((pool) => pool.id === currentSimPoolId);
          if (currentIndex !== -1) {
            const nextPool = limitedPools[currentIndex + 1];
            saveInfoBookState({
              ...infoBooks,
              [currentSimPoolId]: {
                activated: false,
                used: false,
                targetPoolId: nextPool?.id || null,
                obtainedAt: Date.now()
              }
            });
          }
        }

        const availableInfoBook = Object.entries(loadInfoBookState()).find(
          ([, book]) => book.targetPoolId === currentSimPoolId && book.activated && !book.used
        );
        const isInfoBookAvailable = Boolean(availableInfoBook);
        setInfoBookTenPullAvailable(isInfoBookAvailable);

        if (state.infoBookTenPullAvailable !== isInfoBookAvailable) {
          simulator.updateState({
            infoBookTenPullAvailable: isInfoBookAvailable
          });
        }

        saveSharedPityState({
          sixStarPity: state.sixStarPity,
          fiveStarPity: state.fiveStarPity
        });
      } else {
        setAvailableFreePulls(0);
        setInfoBookTenPullAvailable(false);
      }

      if (currentSimPoolId) {
        saveSimulatorState(currentSimPoolId, simulator.exportState());
      }
    };

    simulator.addListener(updateUI);
    updateUI();
    return () => simulator.removeListener(updateUI);
  }, [currentSimPoolId, multipleFreeTen, simulator, simulatorPools]);

  const showToastMessage = useCallback((message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  const handlePull = useCallback((type) => {
    if (isAnimating) {
      return;
    }

    setIsAnimating(true);
    setLastResults(null);

    const animationDelay = skipAnimation ? 0 : 2500;
    setTimeout(() => {
      let results;

      if (type === 'single') {
        results = [simulator.pullSingle()];
      } else if (infoBookTenPullAvailable && simulator.poolType === 'limited') {
        const infoBooks = loadInfoBookState();
        const sourcePoolId = Object.keys(infoBooks).find(
          (poolId) => infoBooks[poolId].targetPoolId === currentSimPoolId && infoBooks[poolId].activated && !infoBooks[poolId].used
        );

        if (sourcePoolId) {
          saveInfoBookState({
            ...infoBooks,
            [sourcePoolId]: {
              ...infoBooks[sourcePoolId],
              used: true
            }
          });
        }

        setInfoBookTenPullAvailable(false);
        results = simulator.pullInfoBookTen();
        showToastMessage('使用情报书十连！（计入保底）');
      } else if (availableFreePulls > 0 && simulator.poolType === 'limited') {
        results = simulator.pullFreeTen();
        showToastMessage('使用免费十连！（不计入保底）');
      } else {
        results = simulator.pullTen();
      }

      setLastResults(results);
      setIsAnimating(false);
    }, animationDelay);
  }, [availableFreePulls, currentSimPoolId, infoBookTenPullAvailable, isAnimating, showToastMessage, simulator, skipAnimation]);

  const handleReset = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const closeResetDialog = useCallback(() => {
    setShowResetConfirm(false);
    setResetAllPools(false);
    setResetSettings(false);
  }, []);

  const confirmReset = useCallback(() => {
    if (resetAllPools) {
      simulatorPools.forEach((pool) => {
        clearSimulatorState(pool.id);
      });
      clearSharedPityState();
      clearInfoBookState();
      showToastMessage('已重置所有类型的卡池');
    } else {
      const type = currentSimPool?.type || 'limited';
      simulatorPools
        .filter((pool) => pool.type === type)
        .forEach((pool) => {
          clearSimulatorState(pool.id);
        });

      if (type === 'limited') {
        clearSharedPityState();
        clearInfoBookState();
      }

      const typeName = type === 'limited' ? '限定角色池' : type === 'weapon' ? '武器池' : '常驻池';
      showToastMessage(`已重置所有${typeName}`);
    }

    simulator.reset();
    setLastResults(null);

    if (resetSettings) {
      setSkipAnimation(false);
      setMultipleFreeTen(false);
      localStorage.removeItem('simulator_skipAnimation');
      localStorage.removeItem('simulator_multipleFreeTen');
    }

    closeResetDialog();
  }, [closeResetDialog, currentSimPool?.type, resetAllPools, resetSettings, showToastMessage, simulator, simulatorPools]);

  const switchPool = useCallback((poolId) => {
    if (currentSimPoolId === poolId) {
      return;
    }

    const targetPool = simulatorPools.find((pool) => pool.id === poolId);
    if (!targetPool) {
      return;
    }

    saveSimulatorState(currentSimPoolId, simulator.exportState());

    if (simulator.poolType === 'limited') {
      const state = simulator.getState();
      saveSharedPityState({
        sixStarPity: state.sixStarPity,
        fiveStarPity: state.fiveStarPity
      });
    }

    setPoolCharactersList(null);

    const savedState = loadSimulatorState(poolId);
    const upCharacter = targetPool.type === 'limited' ? (targetPool.up_character || selectedLimitedPool) : null;
    const nextSimulator = createSimulator(targetPool.type, getCustomRulesForPool(targetPool), upCharacter, null);

    if (savedState) {
      nextSimulator.importState(savedState);
      if (upCharacter) {
        nextSimulator.setCurrentUpCharacter(upCharacter);
      }
    }

    if (targetPool.type === 'limited') {
      const sharedPity = loadSharedPityState();
      if (sharedPity) {
        nextSimulator.updateState(sharedPity);
      }

      const infoBooks = loadInfoBookState();
      let hasUpdated = false;
      const limitedPools = sortLimitedPools(simulatorPools);

      Object.keys(infoBooks).forEach((sourcePoolId) => {
        const book = infoBooks[sourcePoolId];
        if (book.targetPoolId === null && !book.used) {
          const sourceIndex = limitedPools.findIndex((pool) => pool.id === sourcePoolId);
          if (sourceIndex !== -1 && sourceIndex + 1 < limitedPools.length) {
            infoBooks[sourcePoolId] = {
              ...book,
              targetPoolId: limitedPools[sourceIndex + 1].id
            };
            hasUpdated = true;
          }
        }
      });

      if (hasUpdated) {
        saveInfoBookState(infoBooks);
      }

      const sourcePoolId = Object.keys(infoBooks).find(
        (sourceId) => infoBooks[sourceId].targetPoolId === poolId && !infoBooks[sourceId].activated
      );

      if (sourcePoolId) {
        saveInfoBookState({
          ...infoBooks,
          [sourcePoolId]: {
            ...infoBooks[sourcePoolId],
            activated: true
          }
        });
        showToastMessage('情报书已激活！可使用情报书十连');
        nextSimulator.updateState({
          infoBookTenPullAvailable: true
        });
      }
    }

    if (targetPool.type === 'limited' && targetPool.up_character) {
      setSelectedLimitedPool(targetPool.up_character);
    }

    setCurrentSimPoolId(poolId);
    setSimulator(nextSimulator);
    setLastResults(null);
    setStats(nextSimulator.getStatistics());
    setPityInfo(nextSimulator.getPityInfo());
    setShowPoolMenu(false);
  }, [currentSimPoolId, selectedLimitedPool, showToastMessage, simulator, simulatorPools]);

  const handleExportReport = useCallback(() => {
    downloadAnalysisReport(stats, pityInfo, currentPoolType);
    showToastMessage('分析报告已导出');
  }, [currentPoolType, pityInfo, showToastMessage, stats]);

  const handleExportData = useCallback((format) => {
    const poolName = currentSimPool?.name || '模拟池';
    downloadSimulatorData(simulator.getState().pullHistory, currentSimPoolId, poolName, currentPoolType, format);
    showToastMessage(`已导出${format.toUpperCase()}格式数据`);
  }, [currentPoolType, currentSimPool?.name, currentSimPoolId, showToastMessage, simulator]);

  const handleShare = useCallback(async () => {
    const shareText = generateShareText(stats, currentPoolType);
    const success = await copyToClipboard(shareText);
    showToastMessage(success ? '已复制到剪贴板' : '复制失败，请手动复制');
  }, [currentPoolType, showToastMessage, stats]);

  const toggleTenPull = useCallback((id) => {
    setExpandedTenPulls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const historyGroups = useMemo(() => processHistoryGroups(pullHistory), [pullHistory]);
  const dashboardStats = useMemo(() => buildDashboardStats(stats, pityInfo, simulator), [stats, pityInfo, simulator]);
  const pityInfoWithGuarantee = useMemo(() => buildPityInfoWithGuarantee(stats, simulator), [stats, simulator]);
  const currentPoolObj = useMemo(() => ({
    type: simulator.poolType,
    isLimitedWeapon: currentSimPool?.isLimitedWeapon !== false,
    name: currentSimPool?.name || '未选择',
    up_character: currentSimPool?.up_character
  }), [currentSimPool?.isLimitedWeapon, currentSimPool?.name, currentSimPool?.up_character, simulator.poolType]);
  const effectivePityObj = useMemo(() => ({
    pity6: pityInfo.sixStar.current,
    pity5: pityInfo.fiveStar.current,
    isInherited: false
  }), [pityInfo.fiveStar.current, pityInfo.sixStar.current]);

  return {
    availableFreePulls,
    closeResetDialog,
    confirmReset,
    currentPoolObj,
    currentPoolType,
    currentSimPool,
    currentSimPoolId,
    dashboardStats,
    effectivePityObj,
    expandedTenPulls,
    handleExportData,
    handleExportReport,
    handlePull,
    handleReset,
    handleShare,
    historyGroups,
    infoBookTenPullAvailable,
    isAnimating,
    lastResults,
    multipleFreeTen,
    pityInfoWithGuarantee,
    poolCharactersList,
    pullHistory,
    resetAllPools,
    resetSettings,
    setLastResults,
    setMultipleFreeTen,
    setResetAllPools,
    setResetSettings,
    setShowPoolMenu,
    setSkipAnimation,
    showPoolMenu,
    showResetConfirm,
    showToast,
    simulator,
    simulatorPools,
    skipAnimation,
    switchPool,
    toastMessage,
    toggleTenPull
  };
}

export default useGachaSimulatorController;
