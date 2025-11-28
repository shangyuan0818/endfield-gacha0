import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plus, Trash2, Settings, History, Save, RotateCcw, BarChart3, Star, Calculator, Search, Download, Layers, FolderPlus, ChevronDown, X, AlertCircle, Upload, FileJson, CheckCircle2 } from 'lucide-react';

// --- 配置与常量 ---
const RARITY_CONFIG = {
  6: { color: '#FF5F00', label: '6星(限定)', value: 6 }, // UP
  '6_std': { color: '#EF4444', label: '6星(常驻)', value: 6 }, // 歪
  5: { color: '#FFB800', label: '5星', value: 5 },
  4: { color: '#A855F7', label: '4星', value: 4 },
};

const DEFAULT_DISPLAY_PITY = 80;
const DEFAULT_POOL_ID = 'default_pool';

// 优化：独立的录入组件，避免编辑时触发父组件重绘
const InputSection = React.memo(({ currentPool, poolStatsTotal, onAddSingle, onSubmitBatch, onDeletePool }) => {
  const [batchInput, setBatchInput] = useState(Array(10).fill({ rarity: 4, isStandard: false }));

  const cycleBatchItem = (index) => {
    setBatchInput(prev => {
      const next = [...prev];
      const current = next[index];
      const isLimitedOrWeapon = currentPool.type === 'limited' || currentPool.type === 'weapon';
      
      let newItem;
      if (current.rarity === 4) {
        newItem = { rarity: 5, isStandard: false };
      } else if (current.rarity === 5) {
        if (isLimitedOrWeapon) {
          newItem = { rarity: 6, isStandard: false }; 
        } else {
          newItem = { rarity: 6, isStandard: true }; 
        }
      } else if (current.rarity === 6) {
        if (isLimitedOrWeapon && !current.isStandard) {
           newItem = { rarity: 6, isStandard: true };
        } else {
           newItem = { rarity: 4, isStandard: false };
        }
      } else {
        newItem = { rarity: 4, isStandard: false };
      }
      
      next[index] = newItem;
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmitBatch(batchInput);
    setBatchInput(Array(10).fill({ rarity: 4, isStandard: false })); // Reset
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
         <Star size={120} />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
         <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Plus size={20} className="text-indigo-500"/>
          <span>录入数据</span>
          <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            当前: {currentPool.name}
          </span>
        </h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：十连模拟器 */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-slate-600">十连编辑器</span>
            <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border">默认全4星</span>
          </div>
          
          <div className="grid grid-cols-5 gap-3 mb-4">
            {batchInput.map((item, idx) => (
              <button
                key={idx}
                onClick={() => cycleBatchItem(idx)}
                className={`
                  aspect-square rounded-lg flex flex-col items-center justify-center transition-all transform active:scale-95 border-2 relative overflow-hidden
                  ${item.rarity === 4 ? 'bg-purple-50 border-purple-200 text-purple-600 shadow-sm' : ''}
                  ${item.rarity === 5 ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm ring-1 ring-amber-100' : ''}
                  ${item.rarity === 6 && !item.isStandard ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-md ring-2 ring-orange-100' : ''}
                  ${item.rarity === 6 && item.isStandard ? 'bg-red-50 border-red-200 text-red-600 shadow-md ring-2 ring-red-100' : ''}
                `}
              >
                <Star size={item.rarity >= 5 ? 20 : 16} fill={item.rarity >= 5 ? "currentColor" : "none"} />
                <span className="text-xs font-bold mt-1">
                  {item.rarity}星
                </span>
                {item.rarity === 6 && (
                  <span className="absolute bottom-0 w-full text-[9px] bg-black/5 text-center leading-3 py-0.5">
                    {item.isStandard ? '常驻' : '限定'}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button 
            onClick={handleSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm active:translate-y-0.5"
          >
            <Save size={18} />
            确认保存这十连
          </button>
        </div>

        {/* 右侧：单抽快速入口 */}
        <div className="flex flex-col justify-center">
          <p className="text-sm text-slate-500 mb-3">单抽快速补录：</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button onClick={() => onAddSingle(4)} className="h-12 border border-purple-200 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-bold transition-colors">4星</button>
            <button onClick={() => onAddSingle(5)} className="h-12 border border-amber-200 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 font-bold transition-colors">5星</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {currentPool.type === 'limited' || currentPool.type === 'weapon' ? (
              <>
                <button onClick={() => onAddSingle(6, false)} className="h-12 border border-orange-200 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 font-bold transition-colors shadow-sm flex items-center justify-center gap-1">
                  6星 (限定UP)
                </button>
                <button onClick={() => onAddSingle(6, true)} className="h-12 border border-red-200 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold transition-colors shadow-sm flex items-center justify-center gap-1">
                  6星 (常驻歪)
                </button>
              </>
            ) : (
              <button onClick={() => onAddSingle(6, true)} className="col-span-2 h-12 border border-red-200 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold transition-colors shadow-sm flex items-center justify-center gap-1">
                6星 (常驻)
              </button>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
             <div className="text-xs text-slate-400">
                当前池样本数: <span className="font-mono text-slate-600 text-base">{poolStatsTotal}</span>
             </div>
             <div className="flex gap-2">
               <button onClick={onDeletePool} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 px-3 py-1 hover:bg-red-50 rounded transition-colors">
                 <Trash2 size={12}/> 清空当前池
               </button>
             </div>
          </div>
        </div>
      </div>
    </section>
  );
});

  const BatchCard = React.memo(({ group, onEdit, onDeleteGroup, poolType }) => {
    // 统计该组信息
    const counts = { 6: 0, 5: 0, 4: 0 };
    group.forEach(i => {
      if (i.rarity >= 6) counts[6]++;
      else if (i.rarity === 5) counts[5]++;
      else counts[4]++;
    });
    
    const isBatch = group.length >= 5; // 5连以上视为Batch展示
    
    return (
      <div className="bg-white border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
           {/* Header Info */}
           <div className="w-32 shrink-0">
             <div className="text-sm font-black text-slate-700 font-mono mb-1">
               No.{group[0].globalIndex} - {group[group.length - 1].globalIndex}
             </div>
             <div className="text-[10px] text-slate-400 font-mono mb-2">
               {new Date(group[0].timestamp).toLocaleString()}
             </div>
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                   {isBatch ? '十连/多抽' : '单抽'}
                </span>
                {isBatch && (
                  <button 
                    onClick={() => onDeleteGroup(group)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1 z-10 relative cursor-pointer"
                    title="删除整组"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
             </div>
           </div>
           
           {/* Items Grid */}
           <div className="flex-1">
              <div className="flex flex-wrap gap-2">
                {group.map((item, idx) => {
                  const isLimitedUp = item.rarity === 6 && !item.isStandard;
                  const isStandardSpook = item.rarity === 6 && item.isStandard;
                  const isGift = item.specialType === 'gift';
                  const isGuaranteed = item.specialType === 'guaranteed';
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => onEdit(item)}
                      className={`
                        relative w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all hover:scale-105
                        ${isGift ? 'bg-purple-50 border-purple-400 text-purple-600 ring-2 ring-purple-100' : ''}
                        ${!isGift && isLimitedUp ? 'bg-orange-50 border-orange-600 text-white shadow-md glow-border overflow-hidden' : ''}
                        ${!isGift && isStandardSpook ? 'bg-red-100 border-red-300 text-red-700' : ''}
                        ${item.rarity === 5 ? 'bg-amber-50 border-amber-200 text-amber-600' : ''}
                        ${item.rarity === 4 ? 'bg-purple-50 border-purple-200 text-purple-600' : ''}
                      `}
                      title="点击修改"
                    >
                      {!isGift && isLimitedUp && <div className="absolute inset-0 shine-effect"></div>}
                      
                      <Star size={item.rarity >= 5 ? 14 : 12} fill="currentColor" className="relative z-10" />
                      
                      {item.rarity === 6 && poolType !== 'standard' && (
                         <div className={`absolute -top-1 -right-1 px-1 h-3 flex items-center justify-center rounded-full text-[8px] font-bold border border-white relative z-10 
                           ${isGift ? 'bg-purple-500 text-white' : 
                             isGuaranteed ? 'bg-green-500 text-white' :
                             isLimitedUp ? 'bg-white text-orange-600' : 'bg-red-500 text-white'
                           }`}>
                           {isGift ? '赠送' : isGuaranteed ? '保底' : isLimitedUp ? 'UP' : '歪'}
                         </div>
                      )}
                      {item.rarity === 6 && poolType === 'standard' && (isGift || isGuaranteed) && (
                         <div className={`absolute -top-1 -right-1 px-1 h-3 flex items-center justify-center rounded-full text-[8px] font-bold border border-white relative z-10 
                           ${isGift ? 'bg-purple-500 text-white' : 'bg-green-500 text-white'
                           }`}>
                           {isGift ? '赠送' : '保底'}
                         </div>
                      )}
                    </button>
                  );
                })}
              </div>
           </div>
        </div>
      </div>
    );
  });

export default function GachaAnalyzer() {
  // --- State ---
  
  // 1. 卡池列表
  const [pools, setPools] = useState(() => {
    try {
      const saved = localStorage.getItem('gacha_pools');
      let parsed = saved ? JSON.parse(saved) : [{ id: DEFAULT_POOL_ID, name: '常驻/默认池', type: 'standard' }];
      // 迁移数据：如果没有 type 字段，根据名字猜测或默认为 limited
      return parsed.map(p => ({
        ...p,
        type: p.type || (p.name.includes('常驻') || p.id === DEFAULT_POOL_ID ? 'standard' : 'limited')
      }));
    } catch (e) {
      return [{ id: DEFAULT_POOL_ID, name: '常驻/默认池', type: 'standard' }];
    }
  });

  // 2. 当前选中卡池ID
  const [currentPoolId, setCurrentPoolId] = useState(() => {
    return localStorage.getItem('gacha_current_pool_id') || DEFAULT_POOL_ID;
  });
  
  const currentPool = useMemo(() => pools.find(p => p.id === currentPoolId) || pools[0], [pools, currentPoolId]);

  // 3. 历史记录 (增加 isStandard 字段标识常驻)
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('gacha_history_v2');
      let data = saved ? JSON.parse(saved) : [];
      
      // 数据迁移：
      // 1. 如果老数据没有 poolId，赋予默认 poolId
      // 2. 如果是6星且没有 isStandard 字段，默认设为 false (假设之前的都是限定，或者让用户自己改)
      let hasMigration = false;
      const migratedData = data.map(item => {
        let newItem = { ...item };
        if (!newItem.poolId) {
          hasMigration = true;
          newItem.poolId = DEFAULT_POOL_ID;
        }
        if (newItem.rarity === 6 && newItem.isStandard === undefined) {
          // 老数据兼容，默认为限定(false)
          newItem.isStandard = false; 
        }
        return newItem;
      });
      
      if (hasMigration) {
        localStorage.setItem('gacha_history_v2', JSON.stringify(migratedData));
      }
      
      return migratedData;
    } catch (e) {
      return [];
    }
  });
  
  const [manualPityLimit, setManualPityLimit] = useState(DEFAULT_DISPLAY_PITY);
  
  // 列表分页状态
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(20);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPoolMenu, setShowPoolMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 弹窗状态
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [newPoolNameInput, setNewPoolNameInput] = useState('');
  const [newPoolTypeInput, setNewPoolTypeInput] = useState('limited'); // 'limited' | 'standard'
  const [editItemState, setEditItemState] = useState(null); // { id, rarity, isStandard } or null

  // 文件上传 Ref
  const fileInputRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('gacha_history_v2', JSON.stringify(history));
    }, 1000);
    return () => clearTimeout(timer);
  }, [history]);

  useEffect(() => {
    localStorage.setItem('gacha_pools', JSON.stringify(pools));
  }, [pools]);

  useEffect(() => {
    localStorage.setItem('gacha_current_pool_id', currentPoolId);
  }, [currentPoolId]);

  // --- 核心计算逻辑 ---
  const currentPoolHistory = useMemo(() => {
    // 加上全局序号 (第几抽)
    return history
      .filter(item => item.poolId === currentPoolId)
      .map((item, index) => ({ ...item, globalIndex: index + 1 }));
  }, [history, currentPoolId]);

  // 将历史记录按时间戳聚合，用于展示十连
  const groupedHistory = useMemo(() => {
    const groups = [];
    // 优化：数据默认按录入时间顺序，直接倒序即可，避免耗时的 sort
    const sorted = [...currentPoolHistory].reverse();
    
    if (sorted.length === 0) return [];

    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1];
      const curr = sorted[i];
      
      // 简单判断：如果时间戳完全相同，视为同一批次
      // 也可以放宽到 1秒内，但目前的录入逻辑是完全相同的字符串
      if (curr.timestamp === prev.timestamp) {
        currentGroup.push(curr);
      } else {
        groups.push(currentGroup);
        currentGroup = [curr];
      }
    }
    groups.push(currentGroup);
    
    // 组与组之间按时间倒序（最新的组在前面）
    // 但组内元素，我们需要恢复为时间正序（从左到右显示 第1抽->第10抽）
    return groups.map(g => g.reverse());
  }, [currentPoolHistory]);

  const stats = useMemo(() => {
    // 过滤掉赠送的记录来计算有效抽数
    const validPullsList = currentPoolHistory.filter(item => item.specialType !== 'gift');
    const total = validPullsList.length;
    
    // 统计 counts (包含赠送，展示用)
    const counts = { 6: 0, '6_std': 0, 5: 0, 4: 0 };
    // 统计 gift 数量
    const giftCounts = { 6: 0 }; 

    let currentPity = 0;
    let currentPity5 = 0;
    
    // 1. 计算当前6星保底 (忽略 gift)
    // 我们需要在完整历史中倒序查找，遇到 gift 跳过，遇到非 gift 的 6星 则停止
    for (let i = currentPoolHistory.length - 1; i >= 0; i--) {
      const item = currentPoolHistory[i];
      if (item.specialType === 'gift') continue; // 跳过赠送，不影响垫刀
      
      if (item.rarity === 6) {
        break; // 遇到非赠送的6星，保底重置
      }
      currentPity++;
    }

    // 2. 计算当前5星保底 (忽略 gift)
    for (let i = currentPoolHistory.length - 1; i >= 0; i--) {
      const item = currentPoolHistory[i];
      if (item.specialType === 'gift') continue;

      if (item.rarity >= 5) {
        break;
      }
      currentPity5++;
    }

    // 3. 统计各稀有度数量
    currentPoolHistory.forEach(pull => {
      let r = pull.rarity;
      
      if (pull.specialType === 'gift') {
        if (r === 6) giftCounts[6]++;
      }

      if (r === 6) {
        if (pull.isStandard) {
          counts['6_std']++;
        } else {
          counts[6]++;
        }
      } else {
        if (r < 4) r = 4;
        if (counts[r] !== undefined) counts[r]++;
      }
    });

    const totalSixStar = counts[6] + counts['6_std'];
    const validSixStar = totalSixStar - giftCounts[6]; // (这个变量暂时没用到，但逻辑是对的)
    
    // --- 修正不歪率计算 ---
    // 必须排除手动录入的 gift 和后续计算的 bonus gift
    // 我们重新统计一下“真实抽到的”数量
    let realLimited = 0;
    let realStandard = 0;
    currentPoolHistory.forEach(pull => {
       if (pull.rarity === 6 && pull.specialType !== 'gift') {
          if (pull.isStandard) realStandard++;
          else realLimited++;
       }
    });
    const realTotalSix = realLimited + realStandard;
    const winRate = realTotalSix > 0 ? (realLimited / realTotalSix * 100).toFixed(1) : 0;

    // 计算额外赠送机制 (240抽 / 武器池)
    let bonusGiftsLimited = 0;
    let bonusGiftsStandard = 0;

    if (currentPool.type === 'limited') {
      bonusGiftsLimited = Math.floor(total / 240);
    } else if (currentPool.type === 'weapon') {
      // 武器池赠送逻辑：100(常) -> 180(限) -> 260(常) -> 340(限) ...
      if (total >= 100) bonusGiftsStandard++; // 100抽送常驻
      if (total >= 180) {
        bonusGiftsLimited++; // 180抽送限定
        
        // 超过180后，每80抽交替
        const extraPulls = total - 180;
        const extraCycles = Math.floor(extraPulls / 80);
        
        // 循环顺序：常驻(260), 限定(340), 常驻(420)...
        // cycle 1 (260): Standard
        // cycle 2 (340): Limited
        bonusGiftsStandard += Math.ceil(extraCycles / 2);
        bonusGiftsLimited += Math.floor(extraCycles / 2);
      }
    } else if (currentPool.type === 'standard') {
      // 常驻池：首次300抽赠送
      if (total >= 300) {
        bonusGiftsStandard++;
      }
    }

    // 将机制赠送加到显示统计中
    counts[6] += bonusGiftsLimited;
    counts['6_std'] += bonusGiftsStandard;
    
    const displayTotalSixStar = totalSixStar + bonusGiftsLimited + bonusGiftsStandard;

    // 4. 统计历史6星出货分布 (仅统计非赠送)
    const sixStarPulls = [];
    let tempCounter = 0;
    
    // 正序遍历计算垫刀
    // 需要注意：gift 不占位，不重置
    // 我们可以只遍历 validPullsList
    validPullsList.forEach(pull => {
      tempCounter++;
      if (pull.rarity === 6) {
        sixStarPulls.push({ 
          count: tempCounter, 
          isStandard: pull.isStandard,
          isGuaranteed: pull.specialType === 'guaranteed'
        });
        tempCounter = 0;
      }
    });

    // 计算推测数据
    const pullCounts = sixStarPulls.map(s => s.count);
    const maxPityRecorded = pullCounts.length > 0 ? Math.max(...pullCounts) : 0;
    const minPityRecorded = pullCounts.length > 0 ? Math.min(...pullCounts) : 0;
    const avgPityRecorded = pullCounts.length > 0 
      ? (pullCounts.reduce((a, b) => a + b, 0) / pullCounts.length).toFixed(1) 
      : 0;

    // 5. 计算平均出货抽数 (排除赠送)
    const avgPullCost = {
      6: validSixStar > 0 ? (total / validSixStar).toFixed(2) : '0', 
      5: counts[5] > 0 ? (total / counts[5]).toFixed(2) : '0',
    };

    // 6. 饼图数据
    const chartData = [
      ...(currentPool.type !== 'standard' ? [{ name: '6星(限定)', value: counts[6], color: RARITY_CONFIG[6].color }] : []),
      { name: '6星(常驻)', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color },
      { name: '5星', value: counts[5], color: RARITY_CONFIG[5].color },
      { name: '4星', value: counts[4], color: RARITY_CONFIG[4].color },
    ].filter(item => item.value > 0);

    // 7. 出货分布直方图
    const distributionData = [];
    if (sixStarPulls.length > 0) {
      const maxRange = Math.ceil(Math.max(manualPityLimit, maxPityRecorded) / 10) * 10;
      for (let i = 0; i < maxRange; i += 10) {
        const rangeStart = i + 1;
        const rangeEnd = i + 10;
        const items = sixStarPulls.filter(p => p.count >= rangeStart && p.count <= rangeEnd);
        distributionData.push({
          range: `${rangeStart}-${rangeEnd}`,
          count: items.length,
          limited: items.filter(p => !p.isStandard).length,
          standard: items.filter(p => p.isStandard).length,
          guaranteed: items.filter(p => p.isGuaranteed).length
        });
      }
    }

    return { 
      total, // 有效抽数
      counts, // 包含赠送的总数
      totalSixStar,
      validSixStar,
      winRate, // 使用修正后的不歪率
      currentPity,
      currentPity5,
      avgPullCost, 
      chartData,
      pityStats: {
        history: sixStarPulls,
        max: maxPityRecorded,
        min: minPityRecorded,
        avg: avgPityRecorded,
        distribution: distributionData
      }
    };
  }, [currentPoolHistory, manualPityLimit]);

  // --- 操作函数 ---

  const openCreatePoolModal = () => {
    setNewPoolNameInput('');
    setNewPoolTypeInput('limited');
    setModalState({ type: 'createPool', data: null });
    setShowPoolMenu(false);
  };

  const confirmCreatePool = () => {
    if (!newPoolNameInput.trim()) return;
    const newId = 'pool_' + Date.now();
    setPools(prev => [...prev, { 
      id: newId, 
      name: newPoolNameInput.trim(),
      type: newPoolTypeInput 
    }]);
    setCurrentPoolId(newId);
    setModalState({ type: null, data: null });
  };

  const openEditPoolModal = (e, pool) => {
    e.stopPropagation();
    setNewPoolNameInput(pool.name);
    setNewPoolTypeInput(pool.type || 'standard');
    setModalState({ type: 'editPool', data: pool });
    setShowPoolMenu(false);
  };

  const confirmEditPool = () => {
     if (!newPoolNameInput.trim() || !modalState.data) return;
     
     setPools(prev => prev.map(p => {
       if (p.id === modalState.data.id) {
         return { ...p, name: newPoolNameInput.trim(), type: newPoolTypeInput };
       }
       return p;
     }));
     setModalState({ type: null, data: null });
  };

  const openDeleteConfirmModal = () => {
    const currentPoolName = pools.find(p=>p.id===currentPoolId)?.name;
    setModalState({ type: 'deleteConfirm', data: { poolName: currentPoolName } });
  };

  const confirmDeleteData = () => {
    setHistory(prev => prev.filter(item => item.poolId !== currentPoolId));
    setModalState({ type: null, data: null });
  };

  const closeModal = () => {
    setModalState({ type: null, data: null });
    setEditItemState(null);
  };

  // 添加单抽 (支持 isStandard)
  const addSinglePull = (rarity, isStandard = false) => {
    const currentPoolPulls = history.filter(h => h.poolId === currentPoolId);
    const currentPoolTotal = currentPoolPulls.length;
    const isLimitedPool = currentPool.type === 'limited';
    const isWeaponPool = currentPool.type === 'weapon';
    let specialType = null;

    // 辅助函数：检查前 N 抽是否已经出过限定
    const hasLimitedInFirstN = (n) => {
      // 注意：这里 currentPoolPulls 是乱序的还是按时间？
      // history 是 append 的，filter 出来的应该大体有序，但最好 sort 一下确保准确
      // 不过这里主要是 check 是否存在，顺序不严格影响“是否存在”，
      // 关键是 index < n。
      // 更严谨的做法：
      const sorted = [...currentPoolPulls].sort((a, b) => a.id - b.id); // 假设id是递增的(timestamp可能重复)
      // 或者直接用 slice(0, n) 如果我们认为 filter 顺序就是录入顺序
      return sorted.slice(0, n).some(item => item.rarity === 6 && !item.isStandard);
    };

    // 限定池 120 抽保底 (如果前119抽没出过限定)
    if (isLimitedPool && (currentPoolTotal + 1) === 120 && rarity === 6) {
       if (!hasLimitedInFirstN(119)) {
         specialType = 'guaranteed';
       }
    }
    
    // 武器池 80 抽首轮保底 (如果前79抽没出过限定)
    if (isWeaponPool && (currentPoolTotal + 1) === 80 && rarity === 6) {
       if (!hasLimitedInFirstN(79)) {
         specialType = 'guaranteed';
       }
    }

    const newPull = {
      id: Date.now() + Math.random(),
      rarity: rarity,
      isStandard: isStandard,
      specialType: specialType,
      timestamp: new Date().toISOString(),
      poolId: currentPoolId 
    };
    setHistory(prev => [...prev, newPull]);
  };

  // 提交十连
  const submitBatch = (inputData) => {
    const nowStr = new Date().toISOString(); // 确保同一批次时间戳完全一致
    const currentPoolPulls = history.filter(h => h.poolId === currentPoolId);
    const currentPoolTotal = currentPoolPulls.length; // 已有的数量
    const isLimitedPool = currentPool.type === 'limited';
    const isWeaponPool = currentPool.type === 'weapon';

    // 检查已有记录中，前 N 抽是否包含限定
    const hasLimitedInExisting = (n) => {
       const sorted = [...currentPoolPulls].sort((a, b) => a.id - b.id);
       return sorted.slice(0, n).some(item => item.rarity === 6 && !item.isStandard);
    };

    // 此次十连中是否已经出现了限定 (用于判断同一十连中后续的保底失效)
    let limitedFoundInBatch = false;

    const newPulls = inputData.map((item, index) => {
      let specialType = item.specialType || null;
      const globalIndex = currentPoolTotal + index + 1; // 1-based
      
      const isLimitedItem = item.rarity === 6 && !item.isStandard;

      // 限定池 120 抽保底
      if (isLimitedPool && globalIndex === 120 && item.rarity === 6) {
         // 检查：已有记录前119没有 && 本次十连前面的也没有
         const alreadyHad = hasLimitedInExisting(119);
         if (!alreadyHad && !limitedFoundInBatch) {
            specialType = 'guaranteed';
         }
      }
      
      // 武器池 80 抽首轮保底
      if (isWeaponPool && globalIndex === 80 && item.rarity === 6) {
         // 检查：已有记录前79没有 && 本次十连前面的也没有
         const alreadyHad = hasLimitedInExisting(79);
         if (!alreadyHad && !limitedFoundInBatch) {
            specialType = 'guaranteed';
         }
      }

      // 如果当前这个就是限定，标记 flag，后续（index更大）的即使到了阈值也不能算保底了
      if (isLimitedItem) {
        limitedFoundInBatch = true;
      }

      return {
        id: Date.now() + index,
        rarity: item.rarity,
        isStandard: item.isStandard,
        specialType: specialType,
        timestamp: nowStr,
        poolId: currentPoolId
      };
    });
    setHistory(prev => [...prev, ...newPulls]);
  };

  // 编辑记录
  const handleUpdateItem = (id, newConfig) => {
    setHistory(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, ...newConfig };
      }
      return item;
    }));
    setEditItemState(null);
  };

  // 删除单条记录 (触发弹窗)
  const handleDeleteItem = (id) => {
    setModalState({ type: 'deleteItem', data: id });
  };

  const confirmRealDeleteItem = () => {
    const idToDelete = modalState.data;
    setHistory(prev => prev.filter(item => item.id !== idToDelete));
    setEditItemState(null);
    setModalState({ type: null, data: null });
  };

  // 删除整组记录 (触发弹窗)
  const handleDeleteGroup = (items) => {
    setModalState({ type: 'deleteGroup', data: items });
  };

  const confirmRealDeleteGroup = () => {
    const itemsToDelete = modalState.data;
    const idsToDelete = new Set(itemsToDelete.map(i => i.id));
    setHistory(prev => prev.filter(item => !idsToDelete.has(item.id)));
    setModalState({ type: null, data: null });
  };


  // 通用导出函数
  const handleExportJSON = (scope) => {
    let exportPools = pools;
    let exportHistory = history;

    if (scope === 'current') {
      exportPools = pools.filter(p => p.id === currentPoolId);
      exportHistory = history.filter(h => h.poolId === currentPoolId);
    }

    const exportObj = {
      version: "2.0",
      scope: scope,
      exportTime: new Date().toISOString(),
      pools: exportPools,
      history: exportHistory
    };
    
    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gacha_backup_${scope}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportCSV = (scope) => {
    let dataToExport = [];
    let fileName = '';

    if (scope === 'current') {
      if (currentPoolHistory.length === 0) return alert("当前卡池无数据");
      dataToExport = currentPoolHistory; // 已经带有 globalIndex
      fileName = `gacha_pool_${currentPool.name}`;
    } else {
      if (history.length === 0) return alert("无数据可导出");
      // 全部导出时，重新按卡池分组计算 index 有点复杂，或者直接导出原始数据
      // 为了简单，全部导出时 No. 字段可能只代表在该池中的序号（需要实时计算）
      // 这里我们简单做：按时间排序，No. 留空或者显示 global index?
      // 更好的做法：复用 currentPoolHistory 的逻辑对每个池子生成一遍
      // 但为了性能，我们简单导出，加上 Pool Name 列
      dataToExport = history.map(h => ({...h, globalIndex: '-'})).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      fileName = `gacha_all_pools`;
    }
    
    const headers = ["Pool", "No", "Rarity", "Type", "Special", "Time"];
    const rows = dataToExport.map(item => {
      const poolName = pools.find(p => p.id === item.poolId)?.name || 'Unknown';
      let typeStr = 'Standard';
      if (item.rarity === 6) {
        typeStr = item.isStandard ? 'Spook(Standard)' : 'Limited';
      } else {
        typeStr = '-';
      }
      
      let specialStr = item.specialType || '-';
      if (specialStr === 'guaranteed') specialStr = 'Spark/Pity';
      if (specialStr === 'gift') specialStr = 'Gift';

      return [
        poolName,
        item.globalIndex, // 如果是 'all'，这里暂时是 '-'，如果用户非常需要，可以后续优化
        item.rarity,
        typeStr,
        specialStr,
        new Date(item.timestamp).toLocaleString()
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // 导入数据处理
  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // 简单验证
        if (!importedData.pools || !importedData.history) {
          alert("文件格式不正确，缺少关键数据字段。");
          return;
        }

        if (!confirm(`解析成功！\n包含 ${importedData.pools.length} 个卡池和 ${importedData.history.length} 条记录。\n\n是否合并到当前数据中？(相同ID的记录会被跳过)`)) {
          return;
        }

        // 1. 合并 Pools (去重)
        const newPools = [...pools];
        importedData.pools.forEach(impPool => {
          if (!newPools.some(p => p.id === impPool.id)) {
            newPools.push(impPool);
          }
        });

        // 2. 合并 History (去重)
        const newHistory = [...history];
        const existingIds = new Set(newHistory.map(h => h.id));
        let addedCount = 0;
        
        importedData.history.forEach(impItem => {
          if (!existingIds.has(impItem.id)) {
            newHistory.push(impItem);
            addedCount++;
          }
        });

        setPools(newPools);
        setHistory(newHistory);
        alert(`导入完成！新增了 ${addedCount} 条记录。`);
        
      } catch (error) {
        console.error(error);
        alert("导入失败：文件解析错误。请确保是合法的JSON文件。");
      }
      // 清空 input 允许重复导入同一文件
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  // --- 组件 ---
  
  const EditItemModal = React.memo(({ item, onClose, onUpdate, onDelete }) => {
     if (!item) return null;
     const isLimitedOrWeapon = currentPool.type === 'limited' || currentPool.type === 'weapon';
     
     return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700">编辑记录</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-2">修改为</label>
                 <div className="grid grid-cols-2 gap-2">
                   <button
                     onClick={() => onUpdate(item.id, { rarity: 4, isStandard: false })}
                     className={`py-3 rounded-lg border text-sm font-bold transition-colors ${item.rarity === 4 
                       ? 'bg-purple-50 border-purple-500 text-purple-700' 
                       : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                   >
                     4星
                   </button>
                   <button
                     onClick={() => onUpdate(item.id, { rarity: 5, isStandard: false })}
                     className={`py-3 rounded-lg border text-sm font-bold transition-colors ${item.rarity === 5 
                       ? 'bg-amber-50 border-amber-500 text-amber-700' 
                       : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                   >
                     5星
                   </button>

                   {isLimitedOrWeapon ? (
                     <>
                       <button
                         onClick={() => onUpdate(item.id, { rarity: 6, isStandard: false })}
                         className={`py-3 rounded-lg border text-sm font-bold transition-colors ${item.rarity === 6 && !item.isStandard
                           ? 'bg-orange-50 border-orange-500 text-orange-700' 
                           : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                       >
                         6星 (限定UP)
                       </button>
                       <button
                         onClick={() => onUpdate(item.id, { rarity: 6, isStandard: true })}
                         className={`py-3 rounded-lg border text-sm font-bold transition-colors ${item.rarity === 6 && item.isStandard
                           ? 'bg-red-50 border-red-500 text-red-700' 
                           : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                       >
                         6星 (常驻歪)
                       </button>
                     </>
                   ) : (
                     <button
                       onClick={() => onUpdate(item.id, { rarity: 6, isStandard: true })}
                       className={`col-span-2 py-3 rounded-lg border text-sm font-bold transition-colors ${item.rarity === 6
                         ? 'bg-red-50 border-red-500 text-red-700' 
                         : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                     >
                       6星 (常驻)
                     </button>
                   )}
                 </div>
               </div>

               {item.rarity === 6 && (
                 <div className="pt-4 border-t border-slate-100">
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">特殊标记</label>
                   <div className="flex gap-2">
                     <button
                       onClick={() => onUpdate(item.id, { specialType: null })}
                       className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${!item.specialType
                         ? 'bg-slate-800 text-white border-slate-800' 
                         : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                     >
                       正常获取
                     </button>
                     <button
                       onClick={() => onUpdate(item.id, { specialType: 'guaranteed' })}
                       className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${item.specialType === 'guaranteed'
                         ? 'bg-green-500 text-white border-green-500' 
                         : 'bg-white border-slate-200 text-green-600 hover:bg-green-50'}`}
                     >
                       120抽保底
                     </button>
                     <button
                       onClick={() => onUpdate(item.id, { specialType: 'gift' })}
                       className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${item.specialType === 'gift'
                         ? 'bg-purple-500 text-white border-purple-500' 
                         : 'bg-white border-slate-200 text-purple-600 hover:bg-purple-50'}`}
                     >
                       额外赠送
                     </button>
                   </div>
                   {item.specialType === 'gift' && (
                     <p className="text-[10px] text-slate-400 mt-2">
                       * “额外赠送”不占用抽数，不重置当前垫刀，不计入平均出货花费。
                     </p>
                   )}
                 </div>
               )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between">
               <button 
                 onClick={() => onDelete(item.id)}
                 className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-2 rounded hover:bg-red-50 transition-colors flex items-center gap-1"
               >
                 <Trash2 size={16}/> 删除
               </button>
               <button 
                 onClick={onClose}
                 className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-6 py-2 rounded-lg transition-colors shadow-sm"
               >
                 完成
               </button>
            </div>
          </div>
        </div>
     );
  });

  // ... (inside GachaAnalyzer render)
  const PityAnalysisCard = () => {
    const isLimited = currentPool.type === 'limited';
    const isWeapon = currentPool.type === 'weapon';
    
    // 武器池参数
    const maxPity = isWeapon ? 40 : 80;
    const poolColor = isWeapon ? 'bg-slate-700' : (isLimited ? 'bg-orange-500' : 'bg-indigo-500');
    const textColor = isWeapon ? 'text-slate-700' : (isLimited ? 'text-orange-500' : 'text-indigo-500');
    const progressColor = isWeapon ? 'bg-slate-600' : (stats.currentPity >= 60 ? 'bg-red-500' : 'bg-indigo-500');

    // 计算武器池下一档赠送
    let nextWeaponGift = 0;
    let nextWeaponGiftType = ''; // 'standard' or 'limited'
    if (isWeapon) {
      if (stats.total < 100) {
        nextWeaponGift = 100;
        nextWeaponGiftType = 'standard';
      } else if (stats.total < 180) {
        nextWeaponGift = 180;
        nextWeaponGiftType = 'limited';
      } else {
        // 180以后，每80抽一档：260(std), 340(ltd), 420(std)...
        const base = 180;
        const cycle = Math.floor((stats.total - base) / 80) + 1;
        nextWeaponGift = base + cycle * 80;
        nextWeaponGiftType = cycle % 2 !== 0 ? 'standard' : 'limited';
      }
    }

    // 检查是否已达成硬保底 (首轮限定)
    const sortedHistory = [...currentPoolHistory].sort((a, b) => a.id - b.id);
    
    // 限定池 120 抽逻辑
    const firstLimitedIn120 = isLimited ? sortedHistory.slice(0, 120).find(i => i.rarity === 6 && !i.isStandard) : null;
    const firstLimitedIndex120 = firstLimitedIn120 ? sortedHistory.indexOf(firstLimitedIn120) + 1 : 0;
    const hasLimitedInFirst120 = firstLimitedIndex120 > 0;

    // 武器池 80 抽逻辑
    const firstLimitedIn80 = isWeapon ? sortedHistory.slice(0, 80).find(i => i.rarity === 6 && !i.isStandard) : null;
    const firstLimitedIndex80 = firstLimitedIn80 ? sortedHistory.indexOf(firstLimitedIn80) + 1 : 0;
    const hasLimitedInFirst80 = firstLimitedIndex80 > 0;
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden transition-all hover:shadow-md">
        <div className={`absolute top-0 left-0 w-2 h-full ${isLimited ? 'bg-orange-500' : isWeapon ? 'bg-slate-700' : 'bg-indigo-500'}`}></div>
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-slate-700 text-lg font-bold flex items-center gap-2">
              <Calculator size={20} className={textColor}/>
              {isWeapon ? '武器池分析' : isLimited ? '限定池分析' : '常驻池分析'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              当前: <span className={`font-medium ${isLimited ? 'text-orange-600' : isWeapon ? 'text-slate-700' : 'text-indigo-600'}`}>{currentPool.name}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 relative overflow-hidden">
             <div className="text-xs text-slate-500 mb-1 relative z-10">距离6星保底 ({maxPity})</div>
             <div className="text-3xl font-bold text-slate-800 relative z-10">
               {Math.max(maxPity - stats.currentPity, 0)} <span className="text-sm font-normal text-slate-400">抽</span>
             </div>
             <div className="absolute bottom-0 left-0 h-1 bg-slate-200 w-full">
               <div 
                 className={`h-full transition-all duration-500 ${progressColor}`} 
                 style={{ width: `${Math.min((stats.currentPity / maxPity) * 100, 100)}%` }}
               ></div>
             </div>
             <div className="text-[10px] text-slate-400 mt-1 relative z-10">当前垫刀: {stats.currentPity}</div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 relative overflow-hidden">
             <div className="text-xs text-slate-500 mb-1 relative z-10">距离5星保底 (10)</div>
             <div className="text-3xl font-bold text-slate-800 relative z-10">
               {Math.max(10 - stats.currentPity5, 0)} <span className="text-sm font-normal text-slate-400">抽</span>
             </div>
             <div className="absolute bottom-0 left-0 h-1 bg-slate-200 w-full">
               <div 
                 className="h-full bg-amber-500 transition-all duration-500" 
                 style={{ width: `${Math.min((stats.currentPity5 / 10) * 100, 100)}%` }}
               ></div>
             </div>
             <div className="text-[10px] text-slate-400 mt-1 relative z-10">当前垫刀: {stats.currentPity5}</div>
          </div>
        </div>

        {isLimited && (
          <div className="mb-6 space-y-4">
            {/* 120 Spark - One Time Only */}
            <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 flex items-center">
                    必出限定 (120抽)
                    {hasLimitedInFirst120 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
                 </span>
                                  <span className="text-slate-400">
                                     {hasLimitedInFirst120 ? firstLimitedIndex120 : Math.min(stats.total, 120)} / 120
                                  </span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                     className={`h-full transition-all duration-500 ${hasLimitedInFirst120 ? 'bg-green-500' : 'bg-gradient-to-r from-orange-300 to-orange-500'}`}
                                     style={{ width: `${hasLimitedInFirst120 ? 100 : Math.min((stats.total / 120) * 100, 100)}%` }}
                                  ></div>               </div>
            </div>

            {/* 240 Bonus - Recurring */}
            <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 flex items-center">
                    赠送角色 (每240抽)
                    {Math.floor(stats.total / 240) > 0 && (
                        <span className="ml-2 flex items-center gap-1 text-purple-600 font-bold bg-purple-50 px-1.5 rounded text-[10px] border border-purple-100">
                           已获 x {Math.floor(stats.total / 240)}
                        </span>
                    )}
                 </span>
                 <span className="text-slate-400">{stats.total % 240} / 240</span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-gradient-to-r from-purple-300 to-purple-500 transition-all duration-500" 
                   style={{ width: `${((stats.total % 240) / 240) * 100}%` }}
                 ></div>
               </div>
            </div>
          </div>
        )}

        {isWeapon && (
          <div className="mb-6 space-y-4">
             {/* 80 Spark - One Time Only */}
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 flex items-center">
                    首轮限定必出 (80抽)
                    {hasLimitedInFirst80 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
                 </span>
                 <span className="text-slate-400">
                    {hasLimitedInFirst80 ? firstLimitedIndex80 : Math.min(stats.total, 80)} / 80
                 </span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                 <div 
                    className={`h-full transition-all duration-500 ${hasLimitedInFirst80 ? 'bg-green-500' : 'bg-gradient-to-r from-slate-400 to-slate-600'}`} 
                    style={{ width: `${hasLimitedInFirst80 ? 100 : Math.min((stats.total / 80) * 100, 100)}%` }}
                 ></div>
               </div>
             </div>

             {/* Weapon Gifts - Dynamic */}
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 flex items-center gap-2">
                    下一档赠送
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${nextWeaponGiftType === 'limited' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                      {nextWeaponGiftType === 'limited' ? '限定' : '常驻'}武器
                    </span>
                 </span>
                 <span className="text-slate-400">{stats.total} / {nextWeaponGift}</span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                 <div 
                   className={`h-full transition-all duration-500 ${nextWeaponGiftType === 'limited' ? 'bg-orange-400' : 'bg-red-400'}`} 
                   style={{ width: `${Math.min((stats.total / nextWeaponGift) * 100, 100)}%` }}
                 ></div>
               </div>
               <div className="mt-1 text-[10px] text-slate-400 flex gap-2">
                  <span>已领:</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>{Math.floor(stats.counts['6_std'] - stats.pityStats.history.filter(h=>h.isStandard).length)} 常</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>{Math.floor(stats.counts[6] - stats.pityStats.history.filter(h=>!h.isStandard).length)} 限</span>
               </div>
             </div>
          </div>
        )}

        {!isLimited && !isWeapon && (
          // 常驻池
          <div className="mb-6">
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="font-bold text-slate-600 flex items-center">
                    首次赠送自选 (300抽)
                    {stats.total >= 300 && <span className="ml-2 text-green-600 font-bold bg-green-50 px-1.5 rounded text-[10px] border border-green-100">已达成</span>}
                 </span>
                 <span className="text-slate-400">
                    {Math.min(stats.total, 300)} / 300
                 </span>
               </div>
               <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                 <div 
                    className={`h-full transition-all duration-500 ${stats.total >= 300 ? 'bg-green-500' : 'bg-gradient-to-r from-red-300 to-red-500'}`} 
                    style={{ width: `${Math.min((stats.total / 300) * 100, 100)}%` }}
                 ></div>
               </div>
             </div>
          </div>
        )}

        {stats.pityStats.history.length === 0 ? (
          <div className="bg-slate-50 rounded-lg p-6 text-center text-slate-400 text-sm border border-dashed border-slate-200">
            <div className="mb-2">⚠️ 数据不足</div>
            暂无6星记录，无法分析本卡池的概率模型。<br/>请继续录入数据。
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 text-center">
                <div className="text-xs text-orange-600 mb-1">最非记录</div>
                <div className="text-lg font-bold text-orange-700">{stats.pityStats.max} 抽</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-center">
                <div className="text-xs text-green-600 mb-1">最欧记录</div>
                <div className="text-lg font-bold text-green-700">{stats.pityStats.min} 抽</div>
              </div>
              {isLimited ? (
                 <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
                   <div className="text-xs text-blue-600 mb-1">不歪率</div>
                   <div className="text-lg font-bold text-blue-700">{stats.winRate}%</div>
                 </div>
              ) : (
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                   <div className="text-xs text-slate-500 mb-1">总6星数</div>
                   <div className="text-lg font-bold text-slate-700">{stats.totalSixStar}</div>
                 </div>
              )}
            </div>

            <div className="h-40 w-full mt-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">6星分布趋势</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.pityStats.distribution} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="range" tick={{fontSize: 10}} interval={0} />
                  <YAxis allowDecimals={false} tick={{fontSize: 10}} />
                  <RechartsTooltip 
                     cursor={{fill: '#f1f5f9'}}
                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  {/* 堆叠柱状图：限定在下，常驻在上 */}
                  <Bar dataKey="limited" stackId="a" fill={RARITY_CONFIG[6].color} name="限定UP" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="standard" stackId="a" fill={RARITY_CONFIG['6_std'].color} name="常驻歪" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    );
  };

  const StatBox = ({ title, value, subValue, colorClass, icon: Icon, isAnimated }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4 relative overflow-hidden">
      <div className={`
        p-3 rounded-lg ${colorClass} relative shadow-sm
        ${isAnimated ? 'glow-border' : ''}
      `}>
        {isAnimated && <div className="absolute inset-0 shine-effect rounded-lg"></div>}
        {Icon && <Icon size={24} className="text-white relative z-10" />}
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase font-bold">{title}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {subValue && <p className="text-xs text-slate-400">{subValue}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20 md:pb-10 relative">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* 左侧：Logo + 卡池切换器 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <BarChart3 />
              <h1 className="font-bold text-xl hidden sm:block">抽卡分析</h1>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowPoolMenu(!showPoolMenu)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 transition-colors"
              >
                <Layers size={16} />
                <span className="max-w-[100px] sm:max-w-[200px] truncate">
                  {pools.find(p => p.id === currentPoolId)?.name}
                </span>
                <ChevronDown size={14} className={`transition-transform ${showPoolMenu ? 'rotate-180' : ''}`}/>
              </button>

              {showPoolMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowPoolMenu(false)}></div>
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-2 animate-fade-in">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">切换卡池</div>
                    {pools.map(pool => (
                      <div
                        key={pool.id}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50 group/item ${currentPoolId === pool.id ? 'bg-indigo-50' : ''}`}
                      >
                        <button
                          onClick={() => {
                            setCurrentPoolId(pool.id);
                            setShowPoolMenu(false);
                          }}
                          className={`flex-1 text-left truncate ${currentPoolId === pool.id ? 'text-indigo-600 font-bold' : 'text-slate-600'}`}
                        >
                          {pool.name}
                        </button>
                        
                        <div className="flex items-center gap-2">
                          {currentPoolId === pool.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>}
                          <button
                            onClick={(e) => openEditPoolModal(e, pool)}
                            className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-200 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                            title="编辑卡池"
                          >
                            <Settings size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-slate-100 my-1"></div>
                    <button 
                      onClick={openCreatePoolModal}
                      className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-medium"
                    >
                      <Plus size={16} />
                      新建卡池...
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 sm:gap-4">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
            >
              看板
            </button>
            <button 
              onClick={() => {
                setActiveTab('history');
                setVisibleHistoryCount(20); // 切换回记录页时重置分页，防止卡顿
              }}
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
            >
              记录
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* 数据录入区域 */}
        <InputSection 
          currentPool={currentPool}
          poolStatsTotal={stats.total}
          onAddSingle={addSinglePull}
          onSubmitBatch={submitBatch}
          onDeletePool={openDeleteConfirmModal}
        />

        {activeTab === 'dashboard' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {/* 左列：保底机制分析 */}
            <div className="md:col-span-1 space-y-6">
              <PityAnalysisCard />
              
              {/* 平均出货消耗 */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-slate-700 font-bold mb-4">平均出货消耗</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <span className="text-indigo-700 font-medium">综合6星</span>
                    <div className="text-right">
                       <span className="text-xl font-bold text-indigo-800">{stats.avgPullCost[6]}</span>
                       <span className="text-xs text-indigo-600 ml-1">抽/只</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-amber-700 font-medium">5星</span>
                    <div className="text-right">
                       <span className="text-xl font-bold text-amber-800">{stats.avgPullCost[5]}</span>
                       <span className="text-xs text-amber-600 ml-1">抽/只</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 中右列：图表与详细数据 */}
            <div className="md:col-span-2 space-y-6">
              
              {/* 总抽数概览 */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-slate-500 font-bold text-sm uppercase tracking-wider">当前卡池总投入</h3>
                  <div className="text-4xl font-black text-slate-800 mt-1 flex items-baseline gap-2">
                    {stats.total}
                    <span className="text-lg font-medium text-slate-400">抽</span>
                  </div>
                </div>
                <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                  <Layers size={24} />
                </div>
              </div>

              {/* 核心数据概览 */}
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
                           if (stats.total >= 180) {
                             bonusCount++;
                             const extraPulls = stats.total - 180;
                             const extraCycles = Math.floor(extraPulls / 80);
                             bonusCount += Math.floor(extraCycles / 2);
                           }
                        }
                        return bonusCount > 0 ? `含赠送 ${bonusCount}` : `占6星 ${(stats.winRate)}%`;
                     })()}
                     colorClass="bg-orange-500" 
                     icon={Star} 
                     isAnimated={true}
                   />
                 )}
                 <StatBox 
                   title="常驻6星" 
                   value={stats.counts['6_std']} 
                   subValue={
                     currentPool.type !== 'standard' 
                       ? "歪了" 
                       : (currentPool.type === 'standard' && stats.total >= 300 ? "含赠送 1" : "总数")
                   } 
                   colorClass="bg-red-500" 
                   icon={Star} 
                 />
                 <StatBox title="5星总数" value={stats.counts[5]} subValue={`占比 ${(stats.total > 0 ? stats.counts[5]/stats.total*100 : 0).toFixed(2)}%`} colorClass="bg-amber-400" icon={Star} />
                 <StatBox title="4星总数" value={stats.counts[4]} subValue={`占比 ${(stats.total > 0 ? stats.counts[4]/stats.total*100 : 0).toFixed(2)}%`} colorClass="bg-purple-500" icon={Star} />
              </div>

              {/* 饼图 */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-slate-700 font-bold">概率分布概览</h3>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">仅显示当前卡池</span>
                </div>
                <div className="flex-1 w-full h-full relative">
                  {stats.total === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                      暂无数据，请在上方录入
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={stats.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {stats.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value, name) => [
                            `${value}个 (${(value/stats.total*100).toFixed(1)}%)`, 
                            name
                          ]}
                          contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in relative">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
               <div className="flex items-center gap-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <History size={18} /> 详细日志
                  </h3>
                  <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md">
                    {pools.find(p => p.id === currentPoolId)?.name}
                  </span>
               </div>
               
               <div className="flex gap-2">
                 {/* 导入按钮 */}
                 <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                 >
                   <Upload size={14} /> 
                   导入
                 </button>
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleImportFile} 
                   className="hidden" 
                   accept=".json"
                 />

                 {/* 导出菜单 */}
                 <div className="relative">
                   <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="text-xs bg-slate-800 text-white hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                   >
                     <Download size={14} /> 
                     导出...
                   </button>
                   
                   {showExportMenu && (
                     <>
                       <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                       <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-2 animate-fade-in overflow-hidden">
                         <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">JSON 备份</div>
                         <button onClick={() => handleExportJSON('all')} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between">
                           全部卡池 <FileJson size={14}/>
                         </button>
                         <button onClick={() => handleExportJSON('current')} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between">
                           当前卡池 <FileJson size={14}/>
                         </button>
                         
                         <div className="border-t border-slate-100 my-1"></div>
                         
                         <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">CSV 表格</div>
                         <button onClick={() => handleExportCSV('all')} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-green-50 hover:text-green-600 flex items-center justify-between">
                           全部卡池 <FileJson size={14}/>
                         </button>
                         <button onClick={() => handleExportCSV('current')} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-green-50 hover:text-green-600 flex items-center justify-between">
                           当前卡池 <FileJson size={14}/>
                         </button>
                       </div>
                     </>
                   )}
                 </div>
               </div>
             </div>
             
             <div className="max-h-[800px] overflow-y-auto bg-slate-50/50">
               {groupedHistory.length === 0 ? (
                 <div className="p-12 text-center text-slate-400">当前卡池暂无记录</div>
               ) : (
                 <div className="divide-y divide-slate-100">
                   {groupedHistory.slice(0, visibleHistoryCount).map((group, idx) => (
                     <BatchCard 
                       key={idx} 
                       group={group} 
                       onEdit={setEditItemState}
                       onDeleteGroup={handleDeleteGroup}
                       poolType={currentPool.type}
                     />
                   ))}
                   
                   {visibleHistoryCount < groupedHistory.length && (
                     <div className="p-4 flex justify-center">
                       <button 
                         onClick={() => setVisibleHistoryCount(prev => prev + 20)}
                         className="text-sm text-slate-500 hover:text-indigo-600 font-medium px-6 py-2 rounded-full border border-slate-200 hover:border-indigo-200 bg-white hover:bg-indigo-50 transition-all shadow-sm"
                       >
                         加载更多历史记录 ({groupedHistory.length - visibleHistoryCount} 条剩余)
                       </button>
                     </div>
                   )}
                 </div>
               )}
             </div>

             {/* 编辑弹窗 */}
             {editItemState && (
               <EditItemModal 
                 item={editItemState} 
                 onClose={() => setEditItemState(null)}
                 onUpdate={handleUpdateItem}
                 onDelete={handleDeleteItem}
               />
             )}
          </div>
        )}
      </main>

      {/* --- 全局弹窗 --- */}
      {(modalState.type === 'createPool' || modalState.type === 'editPool') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700">{modalState.type === 'createPool' ? '创建新卡池' : '编辑卡池'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">卡池名称</label>
                <input 
                  type="text" 
                  value={newPoolNameInput}
                  onChange={(e) => setNewPoolNameInput(e.target.value)}
                  placeholder="例如：限定池-海滨假日"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && (modalState.type === 'createPool' ? confirmCreatePool() : confirmEditPool())}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">卡池类型</label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${newPoolTypeInput === 'limited' ? 'bg-orange-50 border-orange-500 text-orange-700 font-bold ring-1 ring-orange-200' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    <input 
                      type="radio" 
                      name="poolType" 
                      value="limited"
                      checked={newPoolTypeInput === 'limited'}
                      onChange={() => setNewPoolTypeInput('limited')}
                      className="hidden"
                    />
                    <Star size={16} />
                    限定池
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${newPoolTypeInput === 'standard' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold ring-1 ring-indigo-200' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    <input 
                      type="radio" 
                      name="poolType" 
                      value="standard"
                      checked={newPoolTypeInput === 'standard'}
                      onChange={() => setNewPoolTypeInput('standard')}
                      className="hidden"
                    />
                    <Layers size={16} />
                    常驻池
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${newPoolTypeInput === 'weapon' ? 'bg-slate-800 border-slate-600 text-white font-bold ring-1 ring-slate-500' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    <input 
                      type="radio" 
                      name="poolType" 
                      value="weapon"
                      checked={newPoolTypeInput === 'weapon'}
                      onChange={() => setNewPoolTypeInput('weapon')}
                      className="hidden"
                    />
                    <Search size={16} />
                    武器池
                  </label>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {newPoolTypeInput === 'limited' && '包含限定与歪，统计大小保底、硬保底(120)及赠送(240)。'}
                  {newPoolTypeInput === 'standard' && '仅统计常驻6星，不区分限定/歪，无大小保底统计。'}
                  {newPoolTypeInput === 'weapon' && '6星40抽保底，首轮80抽必出限定。赠送：100(常)->180(限)->+80交替。'}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button 
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={modalState.type === 'createPool' ? confirmCreatePool : confirmEditPool}
                disabled={!newPoolNameInput.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
              >
                {modalState.type === 'createPool' ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalState.type === 'deleteConfirm' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
             <div className="p-6 text-center">
               <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertCircle size={24} />
               </div>
               <h3 className="text-lg font-bold text-slate-800 mb-2">确定清空数据？</h3>
               <p className="text-sm text-slate-500">
                 您正在清空 <span className="font-bold text-slate-700">{modalState.data?.poolName}</span> 的所有记录。
                 <br/>此操作<span className="text-red-500 font-bold">无法撤销</span>。
               </p>
             </div>
             <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-center">
              <button 
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                再想想
              </button>
              <button 
                onClick={confirmDeleteData}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-all"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除单条记录确认 */}
      {modalState.type === 'deleteItem' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" style={{zIndex: 60}}> 
          {/* zIndex 60 to sit above EditItemModal (if open) */}
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
             <div className="p-6 text-center">
               <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={24} />
               </div>
               <h3 className="text-lg font-bold text-slate-800 mb-2">删除这条记录？</h3>
               <p className="text-sm text-slate-500">
                 此操作将从历史记录中移除该条目。
               </p>
             </div>
             <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-center">
              <button 
                onClick={() => setModalState({ type: null, data: null })}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmRealDeleteItem}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-all"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除整组确认 */}
      {modalState.type === 'deleteGroup' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
             <div className="p-6 text-center">
               <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={24} />
               </div>
               <h3 className="text-lg font-bold text-slate-800 mb-2">删除这 {modalState.data?.length} 条记录？</h3>
               <p className="text-sm text-slate-500">
                 您正在删除一组记录（例如一次十连）。
               </p>
             </div>
             <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-center">
              <button 
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmRealDeleteGroup}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-all"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-up {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
        .animate-scale-up {
          animation: scale-up 0.2s ease-out forwards;
        }
        
        @keyframes shine {
          0% { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
        .shine-effect {
          background: linear-gradient(
            120deg, 
            rgba(255,255,255,0) 30%, 
            rgba(255, 215, 0, 0.5) 40%, 
            rgba(255, 0, 128, 0.5) 50%, 
            rgba(0, 255, 255, 0.5) 60%, 
            rgba(255,255,255,0) 70%
          );
          background-size: 200% 100%;
          animation: shine 3s infinite linear;
        }
        
        .glow-border {
           box-shadow: 0 0 8px rgba(255, 165, 0, 0.6);
        }
      `}</style>
    </div>
  );
}