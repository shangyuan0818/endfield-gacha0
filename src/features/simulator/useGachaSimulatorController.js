import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSimulator } from '../../utils/gachaSimulator';
import { getCurrentUpPool, WEAPON_POOL_RULES } from '../../constants';
import { useAuthStore, useHistoryStore, usePoolStore } from '../../stores';
import { getBootstrapVisiblePools } from '../../services/bootstrapService';
import { loadVisiblePools } from '../../services/poolReadService';
import { supabase } from '../../supabaseClient';
import {
  buildSimulatorStorageScope,
  getSimulatorCurrentPoolStorageKey,
  migrateLegacySimulatorStorageToScope,
  clearSimulatorResourceSettings,
  clearInfoBookState,
  clearSharedPityState,
  clearSimulatorState,
  copyToClipboard,
  downloadAnalysisReport,
  downloadSimulatorData,
  generateShareText,
  loadSimulatorResourceSettings,
  loadInfoBookState,
  loadSharedPityState,
  loadSimulatorState,
  saveSimulatorResourceSettings,
  saveInfoBookState,
  saveSharedPityState,
  saveSimulatorState
} from '../../utils/simulatorStorage';
import {
  buildSimulatorResourceLedger,
  canAffordSimulatorPull,
  getOriginiteConversionPlanForJadeCost,
  getSimulatorPullCost,
  normalizeResourceSettings
} from '../../utils/resourceEconomy';
import { buildDashboardStats, buildPityInfoWithGuarantee, processHistoryGroups } from './simulatorViewUtils';
import {
  buildInheritedSimulatorSnapshot,
  normalizeSimulatorPoolType
} from './simulatorInheritance';
import {
  getLatestPendingInfoBook,
  reconcileInfoBookState,
  sortLimitedPoolsByStartTime
} from './simulatorInfoBook';

const getWeaponPoolRules = (pool) => (
  pool?.isLimitedWeapon !== false
    ? WEAPON_POOL_RULES
    : {
        ...WEAPON_POOL_RULES,
        giftInterval: Infinity
      }
);

const getCustomRulesForPool = (pool) => (
  normalizeSimulatorPoolType(pool?.type) === 'weapon' ? getWeaponPoolRules(pool) : null
);

const ORIGINITE_PROMPT_SUPPRESS_KEY = 'simulator_originite_prompt_suppress_date';

function getTodayPromptKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStoredPoolId(value) {
  if (!value || value === 'null' || value === 'undefined') {
    return null;
  }

  return value;
}

export function useGachaSimulatorController() {
  const currentUserId = useAuthStore((state) => state.user?.id || null);
  const history = useHistoryStore((state) => state.history);
  const getGameAccountsFromHistory = useHistoryStore((state) => state.getGameAccountsFromHistory);
  const storePools = usePoolStore((state) => state.pools);
  const currentGameUid = usePoolStore((state) => state.currentGameUid);
  const switchGameAccount = usePoolStore((state) => state.switchGameAccount);
  const simulatorStorageScope = useMemo(() => buildSimulatorStorageScope({
    currentUserId,
    currentGameUid
  }), [currentGameUid, currentUserId]);
  const simulatorCurrentPoolStorageKey = useMemo(
    () => getSimulatorCurrentPoolStorageKey(simulatorStorageScope),
    [simulatorStorageScope]
  );
  const [publicPools, setPublicPools] = useState([]);
  const realPools = storePools.length > 0 ? storePools : publicPools;

  useEffect(() => {
    if (storePools.length > 0) {
      return undefined;
    }

    let cancelled = false;

    const loadPublicPools = async () => {
      try {
        const directPools = await loadVisiblePools().catch(() => null);
        if (!cancelled && Array.isArray(directPools) && directPools.length > 0) {
          setPublicPools(directPools);
          return;
        }

        const bootstrapPools = await getBootstrapVisiblePools().catch(() => null);
        if (!cancelled && Array.isArray(bootstrapPools) && bootstrapPools.length > 0) {
          setPublicPools(bootstrapPools);
        }
      } catch (error) {
        console.warn('加载公开卡池失败，继续使用本地/已缓存卡池:', error);
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
  const [showOriginitePrompt, setShowOriginitePrompt] = useState(null);
  const [disableOriginitePromptToday, setDisableOriginitePromptToday] = useState(false);
  const [resetAllPools, setResetAllPools] = useState(false);
  const [resetSettings, setResetSettings] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(() => localStorage.getItem('simulator_skipAnimation') === 'true');
  const [multipleFreeTen, setMultipleFreeTen] = useState(() => localStorage.getItem('simulator_multipleFreeTen') === 'true');
  const [showPoolMenu, setShowPoolMenu] = useState(false);
  const [selectedLimitedPool, setSelectedLimitedPool] = useState(() => getCurrentUpPool().name);
  const [resourceSettings, setResourceSettings] = useState(() => loadSimulatorResourceSettings(simulatorStorageScope));
  const [currentSimulatorState, setCurrentSimulatorState] = useState(() => simulator.getState());

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

  const [currentSimPoolId, setCurrentSimPoolId] = useState(() => normalizeStoredPoolId(localStorage.getItem(simulatorCurrentPoolStorageKey)));
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (simulatorPools.length === 0) {
      return;
    }

    migrateLegacySimulatorStorageToScope({
      scope: simulatorStorageScope,
      poolIds: simulatorPools.map((pool) => pool.id)
    });
  }, [simulatorPools, simulatorStorageScope]);

  useEffect(() => {
    const fallbackUpPool = getCurrentUpPool().name;
    const nextSimulator = createSimulator('limited', null, fallbackUpPool, null);
    const nextResourceSettings = loadSimulatorResourceSettings(simulatorStorageScope);
    const nextPoolId = normalizeStoredPoolId(localStorage.getItem(simulatorCurrentPoolStorageKey));
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setResourceSettings(nextResourceSettings);
      setCurrentSimPoolId(nextPoolId);
      setSimulator(nextSimulator);
      setCurrentSimulatorState(nextSimulator.getState());
      setStats(nextSimulator.getStatistics());
      setPityInfo(nextSimulator.getPityInfo());
      setPullHistory([]);
      setLastResults(null);
      setExpandedTenPulls(new Set());
      setAvailableFreePulls(0);
      setInfoBookTenPullAvailable(false);
      setPoolCharactersList(null);
      setSelectedLimitedPool(fallbackUpPool);
      setIsInitialized(false);
    });

    return () => {
      cancelled = true;
    };
  }, [simulatorCurrentPoolStorageKey, simulatorStorageScope]);

  const currentSimPool = useMemo(
    () => simulatorPools.find((pool) => pool.id === currentSimPoolId),
    [simulatorPools, currentSimPoolId]
  );
  const currentPoolType = normalizeSimulatorPoolType(currentSimPool?.type || 'limited');
  const allSimulatorStates = useMemo(() => simulatorPools.map((pool) => {
    if (pool.id === currentSimPoolId && simulator) {
      return {
        poolType: pool.type,
        ...(currentSimulatorState || simulator.exportState())
      };
    }

    return loadSimulatorState(pool.id, simulatorStorageScope) || {
      poolType: pool.type,
      pullHistory: []
    };
  }), [currentSimPoolId, currentSimulatorState, simulator, simulatorPools, simulatorStorageScope]);
  const poolPullCounts = useMemo(() => simulatorPools.reduce((accumulator, pool, index) => {
    accumulator[pool.id] = allSimulatorStates[index]?.pullHistory?.length || 0;
    return accumulator;
  }, {}), [allSimulatorStates, simulatorPools]);
  const resourceLedger = useMemo(
    () => buildSimulatorResourceLedger(allSimulatorStates, resourceSettings),
    [allSimulatorStates, resourceSettings]
  );
  const currentPullCosts = useMemo(() => {
    const normalizedSettings = normalizeResourceSettings(resourceSettings);
    const tenPullContext = {
      poolType: currentPoolType,
      pullType: 'ten',
      settings: normalizedSettings,
      isFree: availableFreePulls > 0 && currentPoolType === 'limited',
      isInfoBook: infoBookTenPullAvailable && currentPoolType === 'limited'
    };

    return {
      single: getSimulatorPullCost({
        poolType: currentPoolType,
        pullType: 'single',
        settings: normalizedSettings
      }),
      ten: getSimulatorPullCost(tenPullContext),
      settings: normalizedSettings
    };
  }, [availableFreePulls, currentPoolType, infoBookTenPullAvailable, resourceSettings]);
  const canAffordSinglePull = canAffordSimulatorPull(resourceLedger, currentPullCosts.single);
  const canAffordTenPull = canAffordSimulatorPull(resourceLedger, currentPullCosts.ten);
  const getPullDisabledReason = useCallback((cost, canAfford) => {
    if (isAnimating) {
      return '正在播放寻访动画';
    }

    if (!poolCharactersList) {
      return '正在同步卡池数据';
    }

    if (canAfford) {
      return '';
    }

    if (cost?.resource === 'arsenalQuota') {
      const shortfall = Math.max(Number(cost.amount || 0) - Math.max(Number(resourceLedger?.arsenalBalance || 0), 0), 0);
      return `武库配额不足，还差 ${shortfall.toLocaleString()} 配额`;
    }

    const shortfall = Math.max(Number(cost?.amount || 0) - Math.max(Number(resourceLedger?.availableJadeBudget || 0), 0), 0);
    return `嵌晶玉与衍质源石不足，还差 ${shortfall.toLocaleString()} 嵌晶玉等价`;
  }, [isAnimating, poolCharactersList, resourceLedger]);
  const singlePullDisabledReason = getPullDisabledReason(currentPullCosts.single, canAffordSinglePull);
  const tenPullDisabledReason = getPullDisabledReason(currentPullCosts.ten, canAffordTenPull);

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
      localStorage.setItem(simulatorCurrentPoolStorageKey, currentSimPoolId);
      return;
    }

    if (isInitialized) {
      localStorage.removeItem(simulatorCurrentPoolStorageKey);
    }
  }, [currentSimPoolId, isInitialized, simulatorCurrentPoolStorageKey]);

  const getDefaultPool = useCallback(() => {
    if (simulatorPools.length === 0) {
      return null;
    }

    return simulatorPools.find((pool) => normalizeSimulatorPoolType(pool.type) === 'limited') || simulatorPools[0];
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
    saveSimulatorResourceSettings(resourceSettings, simulatorStorageScope);
  }, [resourceSettings, simulatorStorageScope]);

  useEffect(() => {
    if (simulatorPools.length === 0 || isInitialized) {
      return;
    }

    const savedPoolId = normalizeStoredPoolId(localStorage.getItem(simulatorCurrentPoolStorageKey));
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
      const savedState = loadSimulatorState(targetPoolId, simulatorStorageScope);
      const upCharacter = normalizeSimulatorPoolType(targetPool.type) === 'limited'
        ? (targetPool.up_character || getCurrentUpPool().name)
        : null;
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
        setCurrentSimulatorState(nextSimulator.getState());
        setStats(nextSimulator.getStatistics());
        setPityInfo(nextSimulator.getPityInfo());
        if (normalizeSimulatorPoolType(targetPool.type) === 'limited') {
          setSelectedLimitedPool(upCharacter || getCurrentUpPool().name);
        }
      });
    }

    queueMicrotask(() => {
      setIsInitialized(true);
    });
  }, [getDefaultPool, isInitialized, poolCharactersList, simulatorCurrentPoolStorageKey, simulatorPools, simulatorStorageScope]);

  useEffect(() => {
    const updateUI = () => {
      const state = simulator.getState();
      setCurrentSimulatorState(state);
      setStats(simulator.getStatistics());
      setPityInfo(simulator.getPityInfo());
      setPullHistory(state.pullHistory || []);

      if (normalizeSimulatorPoolType(simulator.poolType) === 'limited') {
        const nextStats = simulator.getStatistics();
        const earnedFreePulls = nextStats.freeTenPulls?.count || 0;
        const usedFreePulls = state.freeTenPullsReceived || 0;
        const maxFreePulls = multipleFreeTen ? earnedFreePulls : Math.min(earnedFreePulls, 1);
        setAvailableFreePulls(Math.max(0, maxFreePulls - usedFreePulls));

        const limitedPools = sortLimitedPoolsByStartTime(simulatorPools);
        const storedInfoBooks = loadInfoBookState(simulatorStorageScope);
        let nextInfoBooks = reconcileInfoBookState(storedInfoBooks, limitedPools);

        if (state.hasUnactivatedInfoBook && !nextInfoBooks[currentSimPoolId]) {
          const currentIndex = limitedPools.findIndex((pool) => pool.id === currentSimPoolId);
          if (currentIndex !== -1) {
            const nextPool = limitedPools[currentIndex + 1];
            nextInfoBooks = reconcileInfoBookState({
              ...nextInfoBooks,
              [currentSimPoolId]: {
                activated: false,
                used: false,
                targetPoolId: nextPool?.id || null,
                obtainedAt: Date.now()
              }
            }, limitedPools);
          }
        }

        if (JSON.stringify(nextInfoBooks) !== JSON.stringify(storedInfoBooks)) {
          saveInfoBookState(nextInfoBooks, simulatorStorageScope);
        }

        const latestInfoBook = getLatestPendingInfoBook(nextInfoBooks, limitedPools);
        const isInfoBookAvailable = Boolean(
          latestInfoBook &&
          latestInfoBook.targetPoolId === currentSimPoolId &&
          latestInfoBook.activated &&
          !latestInfoBook.used
        );
        setInfoBookTenPullAvailable(isInfoBookAvailable);

        if (state.infoBookTenPullAvailable !== isInfoBookAvailable) {
          simulator.updateState({
            infoBookTenPullAvailable: isInfoBookAvailable
          });
        }

        saveSharedPityState({
          sixStarPity: state.sixStarPity,
          fiveStarPity: state.fiveStarPity,
          guaranteedLimitedPity: state.guaranteedLimitedPity,
          hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited
        }, simulatorStorageScope);
      } else {
        setAvailableFreePulls(0);
        setInfoBookTenPullAvailable(false);
      }

      if (currentSimPoolId) {
        saveSimulatorState(currentSimPoolId, simulator.exportState(), simulatorStorageScope);
      }
    };

    simulator.addListener(updateUI);
    updateUI();
    return () => simulator.removeListener(updateUI);
  }, [currentSimPoolId, multipleFreeTen, simulator, simulatorPools, simulatorStorageScope]);

  const showToastMessage = useCallback((message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  const adjustResourceAmount = useCallback((resourceKey, mode, amount) => {
    const normalizedAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (!normalizedAmount && (mode === 'add' || mode === 'convertOriginite')) {
      return;
    }

    setResourceSettings((current) => {
      const normalized = normalizeResourceSettings(current);

      if (resourceKey === 'jade') {
        if (mode === 'convertOriginite') {
          const currentOriginiteBalance = Math.max(Number(resourceLedger?.originiteBalance || 0), 0);
          if (normalizedAmount > currentOriginiteBalance) {
            showToastMessage(`可用衍质源石不足，当前仅剩 ${currentOriginiteBalance.toLocaleString()} 颗`);
            return normalized;
          }

          return normalizeResourceSettings({
            ...normalized,
            manualConvertedOriginite: normalized.manualConvertedOriginite + normalizedAmount
          });
        }

        const nextBaseJade = mode === 'add'
          ? normalized.baseJade + normalizedAmount
          : normalizedAmount + Number(resourceLedger?.jadeSpent || 0) - Number(resourceLedger?.convertedJade || 0);

        return normalizeResourceSettings({
          ...normalized,
          baseJade: nextBaseJade
        });
      }

      if (resourceKey === 'originite') {
        const nextBaseOriginite = mode === 'add'
          ? normalized.baseOriginite + normalizedAmount
          : Math.max(0, normalizedAmount + Number(resourceLedger?.originiteSpent || 0));

        return normalizeResourceSettings({
          ...normalized,
          baseOriginite: nextBaseOriginite
        });
      }

      if (resourceKey === 'arsenalQuota') {
        const nextBaseArsenalQuota = mode === 'add'
          ? normalized.baseArsenalQuota + normalizedAmount
          : normalizedAmount + Number(resourceLedger?.arsenalSpent || 0) - Number(resourceLedger?.arsenalGained || 0);

        return normalizeResourceSettings({
          ...normalized,
          baseArsenalQuota: nextBaseArsenalQuota
        });
      }

      return normalized;
    });
  }, [resourceLedger, showToastMessage]);

  const executeResolvedPull = useCallback((type, options = {}) => {
    const {
      isInfoBookPull = false,
      isFreePull = false,
      conversionPlan = null
    } = options;

    if (conversionPlan?.originiteNeeded > 0) {
      adjustResourceAmount('jade', 'convertOriginite', conversionPlan.originiteNeeded);
    }

    setIsAnimating(true);
    setLastResults(null);

    const animationDelay = skipAnimation ? 0 : 2500;
    setTimeout(() => {
      let results;

      if (type === 'single') {
        results = [simulator.pullSingle()];
      } else if (isInfoBookPull) {
        const limitedPools = sortLimitedPoolsByStartTime(simulatorPools);
        const infoBooks = reconcileInfoBookState(loadInfoBookState(simulatorStorageScope), limitedPools);
        const latestInfoBook = getLatestPendingInfoBook(infoBooks, limitedPools);
        const sourcePoolId = latestInfoBook?.targetPoolId === currentSimPoolId && latestInfoBook?.activated
          ? latestInfoBook.sourcePoolId
          : null;

        if (sourcePoolId) {
          saveInfoBookState({
            ...infoBooks,
            [sourcePoolId]: {
              ...infoBooks[sourcePoolId],
              used: true
            }
          }, simulatorStorageScope);
        }

        setInfoBookTenPullAvailable(false);
        results = simulator.pullInfoBookTen();
        showToastMessage('使用情报书十连！（计入保底）');
      } else if (isFreePull) {
        results = simulator.pullFreeTen();
        showToastMessage('使用免费十连！（不计入保底）');
      } else {
        results = simulator.pullTen();
      }

      setLastResults(results);
      setIsAnimating(false);
    }, animationDelay);
  }, [
    adjustResourceAmount,
    currentSimPoolId,
    simulatorPools,
    simulatorStorageScope,
    showToastMessage,
    simulator,
    skipAnimation
  ]);

  const closeOriginiteConversionPrompt = useCallback(() => {
    setShowOriginitePrompt(null);
    setDisableOriginitePromptToday(false);
  }, []);

  const confirmOriginiteConversionPrompt = useCallback(() => {
    if (!showOriginitePrompt) {
      return;
    }

    if (disableOriginitePromptToday) {
      localStorage.setItem(ORIGINITE_PROMPT_SUPPRESS_KEY, getTodayPromptKey());
    }

    const pendingPrompt = showOriginitePrompt;
    setShowOriginitePrompt(null);
    setDisableOriginitePromptToday(false);
    executeResolvedPull(pendingPrompt.type, pendingPrompt);
  }, [disableOriginitePromptToday, executeResolvedPull, showOriginitePrompt]);

  const handlePull = useCallback((type) => {
    if (isAnimating) {
      return;
    }

    const isInfoBookPull = type === 'ten' && infoBookTenPullAvailable && normalizeSimulatorPoolType(simulator.poolType) === 'limited';
    const isFreePull = !isInfoBookPull && type === 'ten' && availableFreePulls > 0 && normalizeSimulatorPoolType(simulator.poolType) === 'limited';
    const pullCost = getSimulatorPullCost({
      poolType: simulator.poolType,
      pullType: type,
      settings: currentPullCosts.settings,
      isFree: isFreePull,
      isInfoBook: isInfoBookPull
    });

    if (!canAffordSimulatorPull(resourceLedger, pullCost)) {
      if (pullCost.resource === 'arsenalQuota') {
        const shortfall = Math.max(pullCost.amount - Math.max(resourceLedger.arsenalBalance, 0), 0);
        showToastMessage(`武库配额不足，还差 ${shortfall.toLocaleString()} 配额`);
      } else {
        const shortfall = Math.max(pullCost.amount - Math.max(resourceLedger.availableJadeBudget, 0), 0);
        showToastMessage(`资源不足，还差 ${shortfall.toLocaleString()} 嵌晶玉等价`);
      }
      return;
    }

    let conversionPlan = null;
    if (!isFreePull && !isInfoBookPull && pullCost.resource === 'jade') {
      conversionPlan = getOriginiteConversionPlanForJadeCost({
        ledger: resourceLedger,
        jadeCost: pullCost.amount,
        settings: currentPullCosts.settings
      });

      if (conversionPlan.canConvert && conversionPlan.originiteNeeded > 0) {
        const actionLabel = type === 'ten' ? '十连寻访' : '单次寻访';
        const suppressToday = localStorage.getItem(ORIGINITE_PROMPT_SUPPRESS_KEY) === getTodayPromptKey();

        if (!suppressToday) {
          setDisableOriginitePromptToday(false);
          setShowOriginitePrompt({
            type,
            isInfoBookPull,
            isFreePull,
            conversionPlan,
            message: `当前嵌晶玉不足。\n继续 ${actionLabel} 需要额外消耗 ${conversionPlan.originiteNeeded.toLocaleString()} 颗衍质源石，兑换 ${(
              conversionPlan.originiteNeeded * conversionPlan.rate
            ).toLocaleString()} 嵌晶玉。`
          });
          return;
        }
      }
    }

    executeResolvedPull(type, {
      isInfoBookPull,
      isFreePull,
      conversionPlan
    });
  }, [
    availableFreePulls,
    currentPullCosts.settings,
    infoBookTenPullAvailable,
    isAnimating,
    resourceLedger,
    executeResolvedPull,
    showToastMessage,
    simulator.poolType
  ]);

  const handleReset = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const handleInheritRealState = useCallback((selectedAccount = null) => {
    if (!currentSimPoolId || !currentSimPool) {
      showToastMessage('当前没有可继承的模拟卡池');
      return;
    }

    const availableAccounts = getGameAccountsFromHistory();
    const resolvedAccount = selectedAccount
      || (currentGameUid ? availableAccounts.find((account) => account.gameUid === currentGameUid) : null)
      || (availableAccounts.length === 1 ? availableAccounts[0] : null);
    const selectedGameUid = resolvedAccount?.gameUid || resolvedAccount?.game_uid || null;
    const selectedAccountName = resolvedAccount?.nickName || resolvedAccount?.nick_name || selectedGameUid;

    if (!selectedGameUid) {
      showToastMessage('请选择一个具体账号后再继承');
      return;
    }

    const targetStorageScope = buildSimulatorStorageScope({
      currentUserId,
      currentGameUid: selectedGameUid
    });
    const targetCurrentPoolStorageKey = getSimulatorCurrentPoolStorageKey(targetStorageScope);

    const inheritedSnapshot = buildInheritedSimulatorSnapshot({
      history,
      realPools,
      currentGameUid: selectedGameUid,
      currentUserId,
      currentSimPoolId
    });

    if (!inheritedSnapshot.hasAnyData) {
      showToastMessage(`${selectedAccountName} 没有可继承的真实记录`);
      return;
    }

    simulatorPools.forEach((pool) => {
      clearSimulatorState(pool.id, targetStorageScope);
    });

    Object.entries(inheritedSnapshot.statesByPoolId).forEach(([poolId, state]) => {
      saveSimulatorState(poolId, state, targetStorageScope);
    });

    clearSharedPityState(targetStorageScope);
    if (inheritedSnapshot.sharedPityState) {
      saveSharedPityState(inheritedSnapshot.sharedPityState, targetStorageScope);
    }

    clearInfoBookState(targetStorageScope);
    if (Object.keys(inheritedSnapshot.infoBooks).length > 0) {
      saveInfoBookState(inheritedSnapshot.infoBooks, targetStorageScope);
    }

    const targetResourceSettings = selectedGameUid === currentGameUid
      ? resourceSettings
      : loadSimulatorResourceSettings(targetStorageScope);
    const inheritedLedger = buildSimulatorResourceLedger(
      Object.values(inheritedSnapshot.statesByPoolId),
      targetResourceSettings
    );

    if (Number(inheritedLedger?.arsenalBalance || 0) < 0) {
      const nextResourceSettings = normalizeResourceSettings({
        ...targetResourceSettings,
        baseArsenalQuota: Number(targetResourceSettings?.baseArsenalQuota || 0) + Math.abs(Number(inheritedLedger.arsenalBalance || 0))
      });

      saveSimulatorResourceSettings(nextResourceSettings, targetStorageScope);

      if (selectedGameUid === currentGameUid) {
        setResourceSettings(nextResourceSettings);
      }
    }

    localStorage.setItem(targetCurrentPoolStorageKey, currentSimPoolId);

    if (selectedGameUid !== currentGameUid) {
      switchGameAccount(selectedGameUid);
      showToastMessage(`已继承 ${selectedAccountName} 的全部模拟卡池`);
      return;
    }

    const inheritedState = inheritedSnapshot.statesByPoolId[currentSimPoolId];
    const normalizedPoolType = normalizeSimulatorPoolType(currentSimPool.type);
    const upCharacter = normalizedPoolType === 'limited'
      ? (currentSimPool.up_character || getCurrentUpPool().name)
      : null;
    const nextSimulator = createSimulator(currentSimPool.type, getCustomRulesForPool(currentSimPool), upCharacter, poolCharactersList);

    if (inheritedState) {
      nextSimulator.importState(inheritedState);
    }
    if (upCharacter) {
      nextSimulator.setCurrentUpCharacter(upCharacter);
      setSelectedLimitedPool(upCharacter);
    }
    if (poolCharactersList) {
      nextSimulator.setPoolCharactersList(poolCharactersList);
    }
    setExpandedTenPulls(new Set());
    setLastResults(null);
    setSimulator(nextSimulator);
    setCurrentSimulatorState(nextSimulator.getState());
    setStats(nextSimulator.getStatistics());
    setPityInfo(nextSimulator.getPityInfo());
    setPullHistory(nextSimulator.getState().pullHistory || []);
    showToastMessage(`已继承 ${selectedAccountName} 的全部模拟卡池`);
  }, [
    currentGameUid,
    currentSimPool,
    currentSimPoolId,
    currentUserId,
    getGameAccountsFromHistory,
    history,
    poolCharactersList,
    realPools,
    resourceSettings,
    simulatorPools,
    showToastMessage,
    switchGameAccount
  ]);

  const closeResetDialog = useCallback(() => {
    setShowResetConfirm(false);
    setResetAllPools(false);
    setResetSettings(false);
  }, []);

  const confirmReset = useCallback(() => {
    if (resetAllPools) {
      simulatorPools.forEach((pool) => {
        clearSimulatorState(pool.id, simulatorStorageScope);
      });
      clearSharedPityState(simulatorStorageScope);
      clearInfoBookState(simulatorStorageScope);
      showToastMessage('已重置所有类型的卡池');
    } else {
      const type = normalizeSimulatorPoolType(currentSimPool?.type || 'limited');
      simulatorPools
        .filter((pool) => normalizeSimulatorPoolType(pool.type) === type)
        .forEach((pool) => {
          clearSimulatorState(pool.id, simulatorStorageScope);
        });

      if (type === 'limited') {
        clearSharedPityState(simulatorStorageScope);
        clearInfoBookState(simulatorStorageScope);
      }

      const typeName = type === 'limited' ? '限定角色池' : type === 'weapon' ? '武器池' : '常驻池';
      showToastMessage(`已重置所有${typeName}`);
    }

    simulator.reset();
    setCurrentSimulatorState(simulator.getState());
    setPullHistory([]);
    setAvailableFreePulls(0);
    setInfoBookTenPullAvailable(false);
    setLastResults(null);
    clearSimulatorResourceSettings(simulatorStorageScope);
    setResourceSettings((current) => normalizeResourceSettings({
      ...current,
      baseJade: 0,
      baseOriginite: 0,
      baseArsenalQuota: 0,
      manualConvertedOriginite: 0
    }));

    if (resetSettings) {
      setSkipAnimation(false);
      setMultipleFreeTen(false);
      localStorage.removeItem('simulator_skipAnimation');
      localStorage.removeItem('simulator_multipleFreeTen');
    }

    closeResetDialog();
  }, [closeResetDialog, currentSimPool?.type, resetAllPools, resetSettings, showToastMessage, simulator, simulatorPools, simulatorStorageScope]);

  const switchPool = useCallback((poolId) => {
    if (currentSimPoolId === poolId) {
      return;
    }

    const targetPool = simulatorPools.find((pool) => pool.id === poolId);
    if (!targetPool) {
      return;
    }

    saveSimulatorState(currentSimPoolId, simulator.exportState(), simulatorStorageScope);

    if (normalizeSimulatorPoolType(simulator.poolType) === 'limited') {
      const state = simulator.getState();
      saveSharedPityState({
        sixStarPity: state.sixStarPity,
        fiveStarPity: state.fiveStarPity,
        guaranteedLimitedPity: state.guaranteedLimitedPity,
        hasReceivedGuaranteedLimited: state.hasReceivedGuaranteedLimited
      }, simulatorStorageScope);
    }

    setPoolCharactersList(null);

    const savedState = loadSimulatorState(poolId, simulatorStorageScope);
    const upCharacter = normalizeSimulatorPoolType(targetPool.type) === 'limited'
      ? (targetPool.up_character || selectedLimitedPool)
      : null;
    const nextSimulator = createSimulator(targetPool.type, getCustomRulesForPool(targetPool), upCharacter, null);

    if (savedState) {
      nextSimulator.importState(savedState);
      if (upCharacter) {
        nextSimulator.setCurrentUpCharacter(upCharacter);
      }
    }

    if (normalizeSimulatorPoolType(targetPool.type) === 'limited') {
      const sharedPity = loadSharedPityState(simulatorStorageScope);
      if (sharedPity) {
        nextSimulator.updateState(sharedPity);
      }

      const limitedPools = sortLimitedPoolsByStartTime(simulatorPools);
      const infoBooks = reconcileInfoBookState(loadInfoBookState(simulatorStorageScope), limitedPools);
      const latestInfoBook = getLatestPendingInfoBook(infoBooks, limitedPools);

      if (JSON.stringify(infoBooks) !== JSON.stringify(loadInfoBookState(simulatorStorageScope))) {
        saveInfoBookState(infoBooks, simulatorStorageScope);
      }

      if (latestInfoBook?.targetPoolId === poolId && !latestInfoBook.activated) {
        saveInfoBookState({
          ...infoBooks,
          [latestInfoBook.sourcePoolId]: {
            ...infoBooks[latestInfoBook.sourcePoolId],
            activated: true
          }
        }, simulatorStorageScope);
        showToastMessage('情报书已激活！可使用情报书十连');
        nextSimulator.updateState({
          infoBookTenPullAvailable: true
        });
      } else {
        nextSimulator.updateState({
          infoBookTenPullAvailable: Boolean(
            latestInfoBook &&
            latestInfoBook.targetPoolId === poolId &&
            latestInfoBook.activated &&
            !latestInfoBook.used
          )
        });
      }
    }

    if (normalizeSimulatorPoolType(targetPool.type) === 'limited' && targetPool.up_character) {
      setSelectedLimitedPool(targetPool.up_character);
    }

    setCurrentSimPoolId(poolId);
    setSimulator(nextSimulator);
    setCurrentSimulatorState(nextSimulator.getState());
    setLastResults(null);
    setStats(nextSimulator.getStatistics());
    setPityInfo(nextSimulator.getPityInfo());
    setShowPoolMenu(false);
  }, [currentSimPoolId, selectedLimitedPool, showToastMessage, simulator, simulatorPools, simulatorStorageScope]);

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
    type: normalizeSimulatorPoolType(simulator.poolType),
    isLimitedWeapon: currentSimPool?.isLimitedWeapon !== false,
    name: currentSimPool?.name || '未选择',
    up_character: currentSimPool?.up_character
  }), [currentSimPool?.isLimitedWeapon, currentSimPool?.name, currentSimPool?.up_character, simulator.poolType]);
  const effectivePityObj = {
    pity6: pityInfo.sixStar.current,
    pity5: pityInfo.fiveStar.current,
    isInherited: false
  };

  return {
    availableFreePulls,
    adjustResourceAmount,
    canAffordSinglePull,
    canAffordTenPull,
    closeOriginiteConversionPrompt,
    closeResetDialog,
    confirmOriginiteConversionPrompt,
    confirmReset,
    currentPullCosts,
    currentPoolObj,
    currentPoolType,
    currentSimPool,
    currentSimPoolId,
    dashboardStats,
    effectivePityObj,
    expandedTenPulls,
    handleExportData,
    handleExportReport,
    handleInheritRealState,
    handlePull,
    handleReset,
    handleShare,
    historyGroups,
    infoBookTenPullAvailable,
    isAnimating,
    lastResults,
    multipleFreeTen,
    pityInfoWithGuarantee,
    poolPullCounts,
    poolCharactersList,
    pullHistory,
    resourceLedger,
    resourceSettings,
    resetAllPools,
    resetSettings,
    setDisableOriginitePromptToday,
    setLastResults,
    setMultipleFreeTen,
    setResourceSettings,
    setResetAllPools,
    setResetSettings,
    setShowPoolMenu,
    setSkipAnimation,
    showOriginitePrompt,
    showPoolMenu,
    showResetConfirm,
    showToast,
    singlePullDisabledReason,
    simulator,
    simulatorPools,
    skipAnimation,
    switchPool,
    tenPullDisabledReason,
    toastMessage,
    toggleTenPull,
    updateResourceSetting: adjustResourceAmount
  };
}

export default useGachaSimulatorController;
