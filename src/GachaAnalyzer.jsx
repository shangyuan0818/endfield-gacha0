import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plus, Trash2, Settings, History, Save, RotateCcw, BarChart3, Star, Calculator, Search, Download, Layers, FolderPlus, ChevronDown, X, AlertCircle, Upload, FileJson, CheckCircle2, LogIn, LogOut, User, Cloud, CloudOff, RefreshCw, UserPlus, Bell, FileText, Shield, Info, Moon, Sun, Monitor, Lock, ExternalLink, Heart, Code, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import AuthModal from './AuthModal';

// --- 配置与常量 ---
const RARITY_CONFIG = {
  6: { color: '#FF5F00', label: '6星(限定)', value: 6 }, // UP
  '6_std': { color: '#EF4444', label: '6星(常驻)', value: 6 }, // 歪
  5: { color: '#FFB800', label: '5星', value: 5 },
  4: { color: '#A855F7', label: '4星', value: 4 },
};

const DEFAULT_DISPLAY_PITY = 80;
const DEFAULT_POOL_ID = 'default_pool';

const PRESET_POOLS = [
  { label: '限定UP池：莱万汀', type: 'limited', charName: '莱万汀' },
  { label: '常驻卡池', type: 'standard', charName: '' },
  { label: '限定武器卡池：莱万汀专武', type: 'weapon', charName: '莱万汀专武' },
  { label: '常驻武器池1', type: 'standard', charName: '常驻武器1' },
  { label: '常驻武器池2', type: 'standard', charName: '常驻武器2' },
  { label: '常驻武器池3', type: 'standard', charName: '常驻武器3' },
  { label: '常驻武器池4', type: 'standard', charName: '常驻武器4' },
  { label: '常驻武器池5', type: 'standard', charName: '常驻武器5' },
];

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

  const BatchCard = React.memo(({ group, onEdit, onDeleteGroup, poolType, canEdit }) => {
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
                {isBatch && canEdit && (
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
                    <div
                      key={item.id}
                      onClick={canEdit ? () => onEdit(item) : undefined}
                      className={`
                        relative w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all
                        ${canEdit ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                        ${isGift ? 'bg-purple-50 border-purple-400 text-purple-600 ring-2 ring-purple-100' : ''}
                        ${!isGift && isLimitedUp ? 'bg-orange-50 border-orange-600 text-white shadow-md glow-border overflow-hidden' : ''}
                        ${!isGift && isStandardSpook ? 'bg-red-100 border-red-300 text-red-700' : ''}
                        ${item.rarity === 5 ? 'bg-amber-50 border-amber-200 text-amber-600' : ''}
                        ${item.rarity === 4 ? 'bg-purple-50 border-purple-200 text-purple-600' : ''}
                      `}
                      title={canEdit ? "点击修改" : undefined}
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
                    </div>
                  );
                })}
              </div>
           </div>
        </div>
      </div>
    );
  });

  const SummaryView = React.memo(({ history, pools }) => {
    const stats = useMemo(() => {
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
      pools.forEach(p => poolTypeMap.set(p.id, p.type));

      // 1. 分组
      const pullsByPool = {};
      history.forEach(item => {
        if (!pullsByPool[item.poolId]) pullsByPool[item.poolId] = [];
        pullsByPool[item.poolId].push(item);
      });

      const allSixStarPulls = [];

      // 2. 遍历每个池子计算垫刀
      Object.keys(pullsByPool).forEach(poolId => {
        const type = poolTypeMap.get(poolId) || 'standard';
        // pityList is already initialized

        // 按时间正序
        const sortedPulls = pullsByPool[poolId].sort((a, b) => a.id - b.id);
        const validPulls = sortedPulls.filter(i => i.specialType !== 'gift');
        
        let tempCounter = 0;
        validPulls.forEach(pull => {
          tempCounter++;
          if (pull.rarity === 6) {
            // 全局统计
            allSixStarPulls.push({
              count: tempCounter,
              isStandard: pull.isStandard,
              isGuaranteed: pull.specialType === 'guaranteed'
            });
            // 分类统计
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
             count: items.length,
             limited: items.filter(p => !p.isStandard).length,
             standard: items.filter(p => p.isStandard).length
           });
        }
        return dist;
      };

      // 辅助：生成饼图数据
      const generatePieData = (counts) => [
        { name: '6星(限定)', value: counts[6], color: RARITY_CONFIG[6].color },
        { name: '6星(常驻)', value: counts['6_std'], color: RARITY_CONFIG['6_std'].color },
        { name: '5星', value: counts[5], color: RARITY_CONFIG[5].color },
        { name: '4星', value: counts[4], color: RARITY_CONFIG[4].color },
      ].filter(item => item.value > 0);

      // 3. 全局统计 & 分类计数
      history.forEach(item => {
        // 分类统计引用
        const type = poolTypeMap.get(item.poolId) || 'standard';
        const typeData = data.byType[type];

        // 有效总抽数
        if (item.specialType !== 'gift') {
           data.total++;
           typeData.total++;
        }
        
        let r = item.rarity;
        if (r === 6) {
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
        } else {
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

      return data;
    }, [history, pools]);

    const PoolCategorySection = ({ title, color, data, icon: Icon, barColor }) => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 last:mb-0">
        <div className="flex flex-col md:flex-row gap-6">
           {/* Left: Stats Overview */}
           <div className="md:w-1/3 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-2">
                 <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('500', '50').replace('600', '50')} ${color}`}>
                   {Icon && <Icon size={20} />}
                 </div>
                 <h3 className={`font-bold text-lg ${color}`}>{title}</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">总投入</div>
                  <div className="text-2xl font-bold text-slate-800">{data.total}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">6星出货</div>
                  <div className="text-2xl font-bold text-slate-800">{data.six}</div>
                  <div className="text-[10px] text-slate-400">
                    {data.total > 0 ? ((data.six / data.total) * 100).toFixed(2) : 0}%
                  </div>
                </div>
                {data.limitedSix !== undefined && (
                  <div className="col-span-2 bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                     <div className="flex justify-between items-center">
                       <span className="text-xs text-orange-600 font-medium">限定出货</span>
                       <span className="text-xl font-bold text-orange-700">{data.limitedSix}</span>
                     </div>
                     <div className="text-[10px] text-orange-400 text-right mt-1">
                       占6星: {data.six > 0 ? ((data.limitedSix / data.six) * 100).toFixed(1) : 0}%
                     </div>
                  </div>
                )}
              </div>
           </div>

           {/* Right: Charts */}
           <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <div className="h-48 relative">
                 <p className="absolute top-0 left-0 text-[10px] font-bold text-slate-400 z-10">稀有度分布</p>
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {data.chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                      />
                      <Legend verticalAlign="bottom" iconSize={10} wrapperStyle={{fontSize: '11px'}}/>
                    </PieChart>
                 </ResponsiveContainer>
              </div>

              {/* Bar Chart */}
              <div className="h-48 relative">
                 <p className="absolute top-0 left-0 text-[10px] font-bold text-slate-400 z-10">6星出货分布</p>
                 {data.distribution && data.distribution.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={data.distribution} stackOffset="sign" margin={{top: 20, right: 0, left: -20, bottom: 0}}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <XAxis dataKey="range" tick={{fontSize: 10}} interval={0} />
                       <YAxis allowDecimals={false} tick={{fontSize: 10}} />
                       <RechartsTooltip 
                         cursor={{fill: '#f8fafc'}}
                         contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                       />
                       {/* Stacked Bars: Limited on bottom (usually preferred), Standard on top */}
                       <Bar dataKey="limited" stackId="a" fill={RARITY_CONFIG[6].color} name="限定UP" radius={[0, 0, 2, 2]} />
                       <Bar dataKey="standard" stackId="a" fill={RARITY_CONFIG['6_std'].color} name="常驻歪" radius={[2, 2, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="h-full flex items-center justify-center text-xs text-slate-300">
                     暂无数据
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
           <div className="relative z-10 flex justify-between items-center">
             <div>
               <h2 className="text-slate-400 font-medium mb-1">本网站已统计</h2>
               <div className="text-5xl font-black tracking-tight">{stats.total} <span className="text-2xl font-normal opacity-50">抽</span></div>
             </div>
             <div className="text-right">
               <div className="text-3xl font-bold text-yellow-400">{stats.sixStar}</div>
               <div className="text-sm text-slate-400">总六星数</div>
               <div className="text-xs text-slate-500 mt-1">平均 {(stats.total / (stats.sixStar || 1)).toFixed(1)} 抽/只</div>
             </div>
           </div>
           <div className="absolute -right-10 -bottom-10 text-slate-700 opacity-20">
             <Star size={200} />
           </div>
        </div>

        <PoolCategorySection title="限定角色池" color="text-orange-500" data={stats.byType.limited} icon={Star} barColor="#F97316" />
        <PoolCategorySection title="武器池" color="text-slate-600" data={stats.byType.weapon} icon={Search} barColor="#475569" />
        <PoolCategorySection title="常驻池" color="text-indigo-500" data={stats.byType.standard} icon={Layers} barColor="#6366F1" />
      </div>
    );
  });

// 超管管理面板组件
const AdminPanel = React.memo(() => {
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 加载数据
  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 获取所有用户
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        setUsers(profilesData || []);

        // 获取所有申请
        const { data: appsData } = await supabase
          .from('admin_applications')
          .select('*')
          .order('created_at', { ascending: false });

        setApplications(appsData || []);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 审批申请
  const handleApprove = async (appId, userId) => {
    if (!supabase) return;
    setActionLoading(appId);

    try {
      // 更新申请状态
      await supabase
        .from('admin_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', appId);

      // 更新用户角色
      await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userId);

      // 更新本地状态
      setApplications(prev => prev.map(a =>
        a.id === appId ? { ...a, status: 'approved' } : a
      ));
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: 'admin' } : u
      ));
    } catch (error) {
      console.error('审批失败:', error);
      alert('审批失败: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 拒绝申请
  const handleReject = async (appId) => {
    if (!supabase) return;
    setActionLoading(appId);

    try {
      await supabase
        .from('admin_applications')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', appId);

      setApplications(prev => prev.map(a =>
        a.id === appId ? { ...a, status: 'rejected' } : a
      ));
    } catch (error) {
      console.error('拒绝失败:', error);
      alert('拒绝失败: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 更改用户角色
  const handleChangeRole = async (userId, newRole) => {
    if (!supabase) return;
    setActionLoading(userId);

    try {
      await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));
    } catch (error) {
      console.error('更改角色失败:', error);
      alert('更改角色失败: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingApps = applications.filter(a => a.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Shield size={28} />
          超级管理员控制台
        </h2>
        <p className="text-red-100 mt-1">管理用户权限和审批申请</p>
      </div>

      {/* 待审批申请 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-amber-50 flex items-center gap-2">
          <Bell size={20} className="text-amber-600" />
          <h3 className="font-bold text-amber-800">待审批申请</h3>
          {pendingApps.length > 0 && (
            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
              {pendingApps.length}
            </span>
          )}
        </div>

        {pendingApps.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            暂无待审批申请
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingApps.map(app => {
              const appUser = users.find(u => u.id === app.user_id);
              return (
                <div key={app.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="font-medium text-slate-700">
                      {appUser?.username || '未知用户'}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      申请理由: {app.reason}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(app.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(app.id, app.user_id)}
                      disabled={actionLoading === app.id}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading === app.id ? '处理中...' : '通过'}
                    </button>
                    <button
                      onClick={() => handleReject(app.id)}
                      disabled={actionLoading === app.id}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 用户管理 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <User size={20} className="text-slate-600" />
          <h3 className="font-bold text-slate-700">用户管理</h3>
          <span className="text-slate-400 text-sm">({users.length} 人)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">用户名</th>
                <th className="px-4 py-3 text-left">角色</th>
                <th className="px-4 py-3 text-left">注册时间</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700">{u.username}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                      u.role === 'super_admin' ? 'bg-red-100 text-red-600' :
                      u.role === 'admin' ? 'bg-green-100 text-green-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {u.role === 'super_admin' ? '超级管理员' :
                       u.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'super_admin' && (
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        disabled={actionLoading === u.id}
                        className="text-sm border border-slate-200 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="user">普通用户</option>
                        <option value="admin">管理员</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 历史申请记录 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <History size={20} className="text-slate-600" />
          <h3 className="font-bold text-slate-700">申请历史</h3>
        </div>

        {applications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            暂无申请记录
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.map(app => {
              const appUser = users.find(u => u.id === app.user_id);
              return (
                <div key={app.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700">
                      {appUser?.username || '未知用户'}
                    </div>
                    <div className="text-sm text-slate-500">{app.reason}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(app.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    app.status === 'approved' ? 'bg-green-100 text-green-600' :
                    app.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    {app.status === 'approved' ? '已通过' :
                     app.status === 'rejected' ? '已拒绝' : '待审批'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// 设置页面组件
const SettingsPanel = React.memo(({ user, userRole, onPasswordChange }) => {
  const [themeMode, setThemeMode] = useState('system'); // 'light' | 'dark' | 'system'
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    if (passwordForm.new.length < 6) {
      setPasswordError('新密码至少需要6位字符');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new
      });

      if (error) throw error;

      setPasswordSuccess('密码修改成功！');
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      setPasswordError(error.message || '修改失败，请重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleInfo = (role) => {
    switch (role) {
      case 'super_admin':
        return { label: '超级管理员', color: 'bg-red-100 text-red-600 border-red-200', desc: '拥有所有权限，可管理用户和审批申请' };
      case 'admin':
        return { label: '管理员', color: 'bg-green-100 text-green-600 border-green-200', desc: '可录入和编辑抽卡数据' };
      default:
        return { label: '普通用户', color: 'bg-slate-100 text-slate-600 border-slate-200', desc: '可查看数据，需申请成为管理员才能录入' };
    }
  };

  const roleInfo = getRoleInfo(userRole);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Settings size={28} />
          设置
        </h2>
        <p className="text-slate-300 mt-1">管理您的账户和偏好设置</p>
      </div>

      {/* 账户信息 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <User size={20} className="text-slate-600" />
          <h3 className="font-bold text-slate-700">账户信息</h3>
        </div>
        <div className="p-6 space-y-4">
          {user ? (
            <>
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <span className="text-slate-600">邮箱地址</span>
                <span className="font-medium text-slate-800">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <span className="text-slate-600">当前权限</span>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
              <div className="py-3 border-b border-slate-100">
                <p className="text-sm text-slate-500">{roleInfo.desc}</p>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-slate-600">账户密码</span>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Lock size={16} />
                  修改密码
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <User size={48} className="mx-auto mb-3 opacity-50" />
              <p>请先登录以查看账户信息</p>
            </div>
          )}
        </div>
      </div>

      {/* 主题设置 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Moon size={20} className="text-slate-600" />
          <h3 className="font-bold text-slate-700">主题设置</h3>
          <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded ml-2">即将推出</span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setThemeMode('light')}
              disabled
              className={`p-4 rounded-xl border-2 transition-all opacity-50 cursor-not-allowed ${
                themeMode === 'light' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Sun size={24} className="mx-auto mb-2 text-amber-500" />
              <span className="text-sm font-medium text-slate-700">浅色模式</span>
            </button>
            <button
              onClick={() => setThemeMode('dark')}
              disabled
              className={`p-4 rounded-xl border-2 transition-all opacity-50 cursor-not-allowed ${
                themeMode === 'dark' ? 'border-slate-700 bg-slate-100' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Moon size={24} className="mx-auto mb-2 text-slate-700" />
              <span className="text-sm font-medium text-slate-700">深色模式</span>
            </button>
            <button
              onClick={() => setThemeMode('system')}
              disabled
              className={`p-4 rounded-xl border-2 transition-all opacity-50 cursor-not-allowed ${
                themeMode === 'system' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Monitor size={24} className="mx-auto mb-2 text-indigo-500" />
              <span className="text-sm font-medium text-slate-700">跟随系统</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">
            深色模式功能正在开发中，敬请期待...
          </p>
        </div>
      </div>

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Lock size={18} />
                修改密码
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-2 rounded-lg text-sm">
                  {passwordSuccess}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">新密码</label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                  placeholder="至少6位字符"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">确认新密码</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  placeholder="再次输入新密码"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 rounded-lg transition-colors"
              >
                {passwordLoading ? '修改中...' : '确认修改'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

// 关于页面组件
const AboutPanel = React.memo(() => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10">
          <Sparkles size={200} />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <BarChart3 size={32} />
            Endfield 抽卡分析器
          </h2>
          <p className="text-indigo-100">记录你的每一次命运邂逅</p>
          <div className="mt-4 text-sm text-indigo-200">
            版本 2.1.0 | 2025
          </div>
        </div>
      </div>

      {/* 作者信息 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Heart size={20} className="text-red-500" />
          <h3 className="font-bold text-slate-700">制作团队</h3>
        </div>
        <div className="p-6">
          {/* 主要作者 */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100 mb-4">
            <img
              src="/avatar.png"
              alt="蘑菇菌__"
              className="w-16 h-16 rounded-full object-cover shadow-lg"
            />
            <div className="flex-1">
              <h4 className="text-lg font-bold text-slate-800">蘑菇菌__</h4>
              <p className="text-sm text-slate-500 mb-2">项目发起人 & 产品设计</p>
              <a
                href="https://space.bilibili.com/14932613"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.659.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906L17.813 4.653zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773H5.333zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/>
                </svg>
                访问 B站主页
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* AI 助手 */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500 mb-3 flex items-center gap-2">
              <Code size={16} />
              AI 开发助手
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    C
                  </div>
                  <span className="font-bold text-slate-700">Claude</span>
                </div>
                <p className="text-xs text-slate-500">Anthropic Claude Opus 4.5</p>
                <p className="text-xs text-slate-400 mt-1">后端逻辑 & 数据处理 & 前端优化</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    G
                  </div>
                  <span className="font-bold text-slate-700">Gemini</span>
                </div>
                <p className="text-xs text-slate-500">Google Gemini 3 Pro</p>
                <p className="text-xs text-slate-400 mt-1">前端界面设计</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 功能特性 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Sparkles size={20} className="text-amber-500" />
          <h3 className="font-bold text-slate-700">功能特性</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: Star, label: '多卡池管理', desc: '限定/常驻/武器池' },
              { icon: Calculator, label: '保底计算', desc: '实时垫刀追踪' },
              { icon: BarChart3, label: '数据分析', desc: '概率分布图表' },
              { icon: Cloud, label: '云端同步', desc: '多设备数据共享' },
              { icon: Download, label: '导入导出', desc: 'JSON/CSV 格式' },
              { icon: Shield, label: '权限管理', desc: '多角色权限控制' },
            ].map((feature, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                <feature.icon size={20} className="text-indigo-500 mb-2" />
                <h4 className="font-medium text-slate-700 text-sm">{feature.label}</h4>
                <p className="text-xs text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 免责声明 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs text-slate-500 text-center">
          本工具仅供个人抽卡记录使用，与游戏官方无关。
          <br />
          游戏内容版权归 Gryphline / HyperGryph 所有。
        </p>
      </div>
    </div>
  );
});

export default function GachaAnalyzer() {
  // --- State ---
  
  // 0. 用户认证状态
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'user' | 'admin' | 'super_admin'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // 0.1 申请和公告状态
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null); // 'pending' | 'approved' | 'rejected' | null
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  // 权限判断
  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

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

  const [activeTab, setActiveTab] = useState('summary');
  const [showPoolMenu, setShowPoolMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 弹窗状态
  const [modalState, setModalState] = useState({ type: null, data: null });
  const [newPoolNameInput, setNewPoolNameInput] = useState('');
  const [newPoolTypeInput, setNewPoolTypeInput] = useState('limited'); // 'limited' | 'standard'
  const [drawerName, setDrawerName] = useState('');
  const [selectedCharName, setSelectedCharName] = useState('');
  const [editItemState, setEditItemState] = useState(null); // { id, rarity, isStandard } or null

  // 文件上传 Ref
  const fileInputRef = useRef(null);

  // --- Effects ---
  // 监听用户登录状态
  useEffect(() => {
    if (!supabase) return;

    // 获取当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 获取用户角色
  useEffect(() => {
    if (!supabase || !user) {
      setUserRole(null);
      setApplicationStatus(null);
      return;
    }

    const fetchUserRole = async () => {
      try {
        // 获取用户角色
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setUserRole(profile?.role || 'user');

        // 获取申请状态
        const { data: application } = await supabase
          .from('admin_applications')
          .select('status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        setApplicationStatus(application?.status || null);
      } catch (error) {
        console.error('获取用户角色失败:', error);
        setUserRole('user');
      }
    };

    fetchUserRole();
  }, [user]);

  // 加载公告 - 从本地JSON文件加载
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await fetch('/announcements.json');
        if (!response.ok) throw new Error('Failed to fetch announcements');
        const data = await response.json();
        // 过滤激活的公告并按优先级排序
        const activeAnnouncements = data
          .filter(a => a.is_active)
          .sort((a, b) => b.priority - a.priority);
        setAnnouncements(activeAnnouncements);
      } catch (error) {
        console.error('加载公告失败:', error);
        setAnnouncements([]);
      }
    };

    fetchAnnouncements();
  }, []);

  // 登出处理
  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setApplicationStatus(null);
  };

  // 提交管理员申请
  const handleApplyAdmin = async (reason) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('admin_applications')
        .insert({
          user_id: user.id,
          reason: reason
        });

      if (error) throw error;
      setApplicationStatus('pending');
      setShowApplyModal(false);
      return true;
    } catch (error) {
      console.error('提交申请失败:', error);
      return false;
    }
  };

  // --- 云同步函数 ---

  // 迁移弹窗状态
  const [showMigrateModal, setShowMigrateModal] = useState(false);

  // 从云端加载数据
  const loadCloudData = useCallback(async (userId) => {
    if (!supabase || !userId) return null;

    setSyncing(true);
    setSyncError(null);

    try {
      // 加载卡池
      const { data: cloudPools, error: poolsError } = await supabase
        .from('pools')
        .select('*')
        .eq('user_id', userId)
        .order('pool_id', { ascending: true });

      if (poolsError) throw poolsError;

      // 加载历史记录
      const { data: cloudHistory, error: historyError } = await supabase
        .from('history')
        .select('*')
        .eq('user_id', userId)
        .order('record_id', { ascending: true });

      if (historyError) throw historyError;

      // 转换数据格式（云端字段名可能不同）
      const formattedPools = cloudPools.map(p => ({
        id: p.pool_id,
        name: p.name,
        type: p.type
      }));

      const formattedHistory = cloudHistory.map(h => ({
        id: h.record_id,
        rarity: h.rarity,
        isStandard: h.is_standard,
        specialType: h.special_type,
        timestamp: h.timestamp,
        poolId: h.pool_id
      }));

      return { pools: formattedPools, history: formattedHistory };
    } catch (error) {
      console.error('加载云端数据失败:', error);
      setSyncError(error.message);
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  // 保存卡池到云端
  const savePoolToCloud = useCallback(async (pool) => {
    if (!supabase || !user) return;

    try {
      const { error } = await supabase
        .from('pools')
        .upsert({
          user_id: user.id,
          pool_id: pool.id,
          name: pool.name,
          type: pool.type,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,pool_id' });

      if (error) throw error;
    } catch (error) {
      console.error('保存卡池到云端失败:', error);
      setSyncError(error.message);
    }
  }, [user]);

  // 保存历史记录到云端
  const saveHistoryToCloud = useCallback(async (records) => {
    if (!supabase || !user || records.length === 0) return;

    try {
      const cloudRecords = records.map(r => ({
        user_id: user.id,
        record_id: r.id,
        pool_id: r.poolId,
        rarity: r.rarity,
        is_standard: r.isStandard,
        special_type: r.specialType,
        timestamp: r.timestamp,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('history')
        .upsert(cloudRecords, { onConflict: 'user_id,record_id' });

      if (error) throw error;
    } catch (error) {
      console.error('保存历史记录到云端失败:', error);
      setSyncError(error.message);
    }
  }, [user]);

  // 从云端删除历史记录
  const deleteHistoryFromCloud = useCallback(async (recordIds) => {
    if (!supabase || !user) return;

    try {
      const { error } = await supabase
        .from('history')
        .delete()
        .eq('user_id', user.id)
        .in('record_id', recordIds);

      if (error) throw error;
    } catch (error) {
      console.error('从云端删除记录失败:', error);
      setSyncError(error.message);
    }
  }, [user]);

  // 从云端删除指定卡池的所有历史记录
  const deletePoolHistoryFromCloud = useCallback(async (poolId) => {
    if (!supabase || !user) return;

    try {
      const { error } = await supabase
        .from('history')
        .delete()
        .eq('user_id', user.id)
        .eq('pool_id', poolId);

      if (error) throw error;
    } catch (error) {
      console.error('从云端删除卡池记录失败:', error);
      setSyncError(error.message);
    }
  }, [user]);

  // 迁移本地数据到云端
  const migrateLocalToCloud = useCallback(async () => {
    if (!supabase || !user) return false;

    setSyncing(true);
    setSyncError(null);

    try {
      // 保存所有卡池
      for (const pool of pools) {
        await savePoolToCloud(pool);
      }

      // 分批保存历史记录（每次100条）
      const batchSize = 100;
      for (let i = 0; i < history.length; i += batchSize) {
        const batch = history.slice(i, i + batchSize);
        await saveHistoryToCloud(batch);
      }

      return true;
    } catch (error) {
      console.error('迁移数据到云端失败:', error);
      setSyncError(error.message);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [user, pools, history, savePoolToCloud, saveHistoryToCloud]);

  // 登录后处理：检查云端数据并决定是否迁移
  const handlePostLogin = useCallback(async (loggedInUser) => {
    if (!loggedInUser) return;

    const cloudData = await loadCloudData(loggedInUser.id);

    if (cloudData) {
      const hasCloudData = cloudData.pools.length > 0 || cloudData.history.length > 0;
      const hasLocalData = history.length > 0;

      if (hasCloudData) {
        // 云端有数据，直接加载云端数据
        if (cloudData.pools.length > 0) {
          setPools(cloudData.pools);
          setCurrentPoolId(cloudData.pools[0].id);
        }
        if (cloudData.history.length > 0) {
          setHistory(cloudData.history);
        }
      } else if (hasLocalData) {
        // 云端无数据但本地有，询问是否迁移
        setShowMigrateModal(true);
      }
    }
  }, [history, loadCloudData]);

  // 监听用户登录状态变化，登录后加载云端数据
  const prevUserRef = useRef(null);
  useEffect(() => {
    if (user && !prevUserRef.current) {
      // 用户刚登录
      handlePostLogin(user);
    }
    prevUserRef.current = user;
  }, [user, handlePostLogin]);

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
    
    // Auto-detect drawer from last pool
    let detectedDrawer = '';
    if (pools.length > 0) {
      const lastPool = pools[pools.length - 1];
      const parts = lastPool.name.split('-');
      if (parts.length > 1) {
        detectedDrawer = parts[parts.length - 1];
      }
    }
    setDrawerName(detectedDrawer);

    setSelectedCharName('');
    setModalState({ type: 'createPool', data: null });
    setShowPoolMenu(false);
  };

  const confirmCreatePool = async () => {
    if (!newPoolNameInput.trim()) return;
    const newId = 'pool_' + Date.now();
    const newPool = {
      id: newId,
      name: newPoolNameInput.trim(),
      type: newPoolTypeInput
    };
    setPools(prev => [...prev, newPool]);
    setCurrentPoolId(newId);
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      await savePoolToCloud(newPool);
    }
  };

  const openEditPoolModal = (e, pool) => {
    e.stopPropagation();
    setNewPoolNameInput(pool.name);
    setNewPoolTypeInput(pool.type || 'standard');
    setModalState({ type: 'editPool', data: pool });
    setShowPoolMenu(false);
  };

  const confirmEditPool = async () => {
     if (!newPoolNameInput.trim() || !modalState.data) return;

     const updatedPool = {
       id: modalState.data.id,
       name: newPoolNameInput.trim(),
       type: newPoolTypeInput
     };

     setPools(prev => prev.map(p => {
       if (p.id === modalState.data.id) {
         return updatedPool;
       }
       return p;
     }));
     setModalState({ type: null, data: null });

     // 同步到云端
     if (user) {
       await savePoolToCloud(updatedPool);
     }
  };

  const openDeleteConfirmModal = () => {
    const currentPoolName = pools.find(p=>p.id===currentPoolId)?.name;
    setModalState({ type: 'deleteConfirm', data: { poolName: currentPoolName } });
  };

  const confirmDeleteData = async () => {
    setHistory(prev => prev.filter(item => item.poolId !== currentPoolId));
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      await deletePoolHistoryFromCloud(currentPoolId);
    }
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

    // 同步到云端
    if (user) {
      saveHistoryToCloud([newPull]);
    }
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

    // 同步到云端
    if (user) {
      saveHistoryToCloud(newPulls);
    }
  };

  // 编辑记录
  const handleUpdateItem = (id, newConfig) => {
    let updatedItem = null;
    setHistory(prev => prev.map(item => {
      if (item.id === id) {
        updatedItem = { ...item, ...newConfig };
        return updatedItem;
      }
      return item;
    }));
    setEditItemState(null);

    // 同步到云端
    if (user && updatedItem) {
      saveHistoryToCloud([updatedItem]);
    }
  };

  // 删除单条记录 (触发弹窗)
  const handleDeleteItem = (id) => {
    setModalState({ type: 'deleteItem', data: id });
  };

  const confirmRealDeleteItem = async () => {
    const idToDelete = modalState.data;
    setHistory(prev => prev.filter(item => item.id !== idToDelete));
    setEditItemState(null);
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      await deleteHistoryFromCloud([idToDelete]);
    }
  };

  // 删除整组记录 (触发弹窗)
  const handleDeleteGroup = (items) => {
    setModalState({ type: 'deleteGroup', data: items });
  };

  const confirmRealDeleteGroup = async () => {
    const itemsToDelete = modalState.data;
    const idsToDelete = new Set(itemsToDelete.map(i => i.id));
    setHistory(prev => prev.filter(item => !idsToDelete.has(item.id)));
    setModalState({ type: null, data: null });

    // 同步到云端
    if (user) {
      await deleteHistoryFromCloud(Array.from(idsToDelete));
    }
  };


  // 通用导出函数
  const handleExportJSON = (scope) => {
    let exportPools = pools;
    let exportHistory = history;

    if (scope === 'current') {
      exportPools = pools.filter(p => p.id === currentPoolId);
      exportHistory = history.filter(h => h.poolId === currentPoolId);
    }

    // 计算统计摘要
    const calculateStats = (historyData, poolsData) => {
      const stats = {
        totalPulls: 0,
        sixStarTotal: 0,
        sixStarLimited: 0,
        sixStarStandard: 0,
        fiveStar: 0,
        fourStar: 0,
        byPool: {}
      };

      // 按卡池分组计算
      poolsData.forEach(pool => {
        const poolHistory = historyData.filter(h => h.poolId === pool.id && h.specialType !== 'gift');
        stats.byPool[pool.name] = {
          type: pool.type,
          total: poolHistory.length,
          sixStar: poolHistory.filter(h => h.rarity === 6).length,
          sixStarLimited: poolHistory.filter(h => h.rarity === 6 && !h.isStandard).length,
          sixStarStandard: poolHistory.filter(h => h.rarity === 6 && h.isStandard).length
        };
      });

      // 全局统计（排除gift）
      const validHistory = historyData.filter(h => h.specialType !== 'gift');
      stats.totalPulls = validHistory.length;
      stats.sixStarTotal = validHistory.filter(h => h.rarity === 6).length;
      stats.sixStarLimited = validHistory.filter(h => h.rarity === 6 && !h.isStandard).length;
      stats.sixStarStandard = validHistory.filter(h => h.rarity === 6 && h.isStandard).length;
      stats.fiveStar = validHistory.filter(h => h.rarity === 5).length;
      stats.fourStar = validHistory.filter(h => h.rarity <= 4).length;

      return stats;
    };

    const exportObj = {
      version: "2.1",
      scope: scope,
      exportTime: new Date().toISOString(),
      summary: calculateStats(exportHistory, exportPools),
      pools: exportPools,
      history: exportHistory
    };

    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${now.getFullYear().toString().slice(-2)}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    link.download = `endfield-gacha-${timeStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportCSV = (scope) => {
    let dataToExport = [];

    // 辅助函数：为历史记录添加序号和垫刀数
    const processHistoryWithIndex = (historyData, poolId) => {
      const filtered = historyData.filter(h => h.poolId === poolId);
      const sorted = [...filtered].sort((a, b) => a.id - b.id);

      let pityCounter = 0;
      return sorted.map((item, index) => {
        // 计算垫刀（排除gift）
        if (item.specialType !== 'gift') {
          pityCounter++;
        }

        const result = {
          ...item,
          globalIndex: index + 1,
          pityAtPull: item.specialType === 'gift' ? '-' : pityCounter
        };

        // 如果是6星，重置垫刀
        if (item.rarity === 6 && item.specialType !== 'gift') {
          pityCounter = 0;
        }

        return result;
      });
    };

    if (scope === 'current') {
      if (currentPoolHistory.length === 0) return alert("当前卡池无数据");
      // 当前卡池已有globalIndex，需要添加垫刀数
      const sortedHistory = [...history.filter(h => h.poolId === currentPoolId)].sort((a, b) => a.id - b.id);
      let pityCounter = 0;
      dataToExport = sortedHistory.map((item, index) => {
        if (item.specialType !== 'gift') {
          pityCounter++;
        }
        const result = {
          ...item,
          globalIndex: index + 1,
          pityAtPull: item.specialType === 'gift' ? '-' : pityCounter
        };
        if (item.rarity === 6 && item.specialType !== 'gift') {
          pityCounter = 0;
        }
        return result;
      });
    } else {
      if (history.length === 0) return alert("无数据可导出");
      // 全部导出：为每个卡池单独计算序号和垫刀
      pools.forEach(pool => {
        const poolData = processHistoryWithIndex(history, pool.id);
        dataToExport.push(...poolData);
      });
      // 按时间排序
      dataToExport.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // CSV表头（中英文）
    const headers = ["卡池名称(Pool)", "卡池类型(Type)", "序号(No)", "星级(Rarity)", "限定/常驻(Limited/Std)", "特殊标记(Special)", "垫刀数(Pity)", "时间(Time)"];

    const rows = dataToExport.map(item => {
      const pool = pools.find(p => p.id === item.poolId);
      const poolName = pool?.name || 'Unknown';
      const poolType = pool?.type === 'limited' ? '限定池' : pool?.type === 'weapon' ? '武器池' : '常驻池';

      let limitedStr = '-';
      if (item.rarity === 6) {
        limitedStr = item.isStandard ? '常驻(Std)' : '限定(Ltd)';
      }

      let specialStr = '-';
      if (item.specialType === 'guaranteed') specialStr = '保底(Pity)';
      else if (item.specialType === 'gift') specialStr = '赠送(Gift)';

      // 处理可能包含逗号的字段，用引号包裹
      const escapeCsv = (str) => {
        if (typeof str === 'string' && (str.includes(',') || str.includes('"') || str.includes('\n'))) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escapeCsv(poolName),
        poolType,
        item.globalIndex,
        `${item.rarity}星`,
        limitedStr,
        specialStr,
        item.pityAtPull,
        new Date(item.timestamp).toLocaleString()
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${now.getFullYear().toString().slice(-2)}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    link.download = `endfield-gacha-${timeStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // 导入数据处理
  const handleImportFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // 简单验证
        if (!importedData.pools || !importedData.history) {
          alert("文件格式不正确，缺少关键数据字段。");
          return;
        }

        const willSyncToCloud = !!(user && supabase);
        const confirmMsg = `解析成功！\n包含 ${importedData.pools.length} 个卡池和 ${importedData.history.length} 条记录。\n\n是否合并到当前数据中？(相同ID的记录会被跳过)${willSyncToCloud ? '\n\n✓ 数据将自动同步到云端' : '\n\n⚠️ 未登录或未配置云端，仅保存到本地'}`;

        if (!confirm(confirmMsg)) {
          return;
        }

        // 1. 合并 Pools (去重)
        const newPools = [...pools];
        const addedPools = [];
        importedData.pools.forEach(impPool => {
          if (!newPools.some(p => p.id === impPool.id)) {
            newPools.push(impPool);
            addedPools.push(impPool);
          }
        });

        // 2. 合并 History (去重)
        const newHistory = [...history];
        const existingIds = new Set(newHistory.map(h => h.id));
        const addedHistory = [];

        importedData.history.forEach(impItem => {
          if (!existingIds.has(impItem.id)) {
            newHistory.push(impItem);
            addedHistory.push(impItem);
          }
        });

        setPools(newPools);
        setHistory(newHistory);

        // 3. 同步到云端（如果已登录）
        if (willSyncToCloud && (addedPools.length > 0 || addedHistory.length > 0)) {
          setSyncing(true);
          try {
            // 同步新增的卡池
            for (const pool of addedPools) {
              await savePoolToCloud(pool);
            }
            // 分批同步新增的历史记录
            const batchSize = 100;
            for (let i = 0; i < addedHistory.length; i += batchSize) {
              const batch = addedHistory.slice(i, i + batchSize);
              await saveHistoryToCloud(batch);
            }
            alert(`导入完成！新增了 ${addedHistory.length} 条记录，已同步到云端。`);
          } catch (syncError) {
            console.error('同步到云端失败:', syncError);
            alert(`导入完成！新增了 ${addedHistory.length} 条记录。\n\n⚠️ 云端同步失败: ${syncError.message}`);
          } finally {
            setSyncing(false);
          }
        } else {
          alert(`导入完成！新增了 ${addedHistory.length} 条记录。`);
        }

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
                          {/* 编辑卡池按钮 - 仅管理员可见 */}
                          {canEdit && (
                            <button
                              onClick={(e) => openEditPoolModal(e, pool)}
                              className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-200 rounded opacity-0 group-hover/item:opacity-100 transition-all"
                              title="编辑卡池"
                            >
                              <Settings size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* 新建卡池 - 仅管理员可见 */}
                    {canEdit && (
                      <>
                        <div className="border-t border-slate-100 my-1"></div>
                        <button
                          onClick={openCreatePoolModal}
                          className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-medium"
                        >
                          <Plus size={16} />
                          新建卡池...
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 sm:gap-4">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${activeTab === 'summary' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
            >
              汇总
            </button>
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

            {/* 超管管理页面 */}
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${activeTab === 'admin' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-800'}`}
              >
                管理
              </button>
            )}

            {/* 设置和关于按钮 */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`text-sm font-medium px-2 py-1.5 rounded-md transition-colors ${activeTab === 'settings' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              title="设置"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`text-sm font-medium px-2 py-1.5 rounded-md transition-colors ${activeTab === 'about' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}
              title="关于"
            >
              <Info size={18} />
            </button>

            {/* 公告按钮 - 公告关闭时显示 */}
            {!showAnnouncement && announcements.length > 0 && (
              <button
                onClick={() => setShowAnnouncement(true)}
                className="text-sm text-amber-600 hover:text-amber-700 px-2 py-1.5 rounded-md hover:bg-amber-50 transition-colors"
                title="查看公告"
              >
                <Bell size={18} />
              </button>
            )}

            {/* 登录/用户区域 */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
              {isSupabaseConfigured() ? (
                user ? (
                  <div className="flex items-center gap-2">
                    {/* 角色标签 */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold hidden sm:inline ${
                      userRole === 'super_admin' ? 'bg-red-100 text-red-600' :
                      userRole === 'admin' ? 'bg-green-100 text-green-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {userRole === 'super_admin' ? '超管' :
                       userRole === 'admin' ? '管理' : '用户'}
                    </span>
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      {user.email?.split("@")[0]}
                    </span>
                    {/* 申请按钮 - 仅普通用户且未申请时显示 */}
                    {userRole === 'user' && applicationStatus !== 'pending' && (
                      <button
                        onClick={() => setShowApplyModal(true)}
                        className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded transition-colors"
                        title="申请成为管理员"
                      >
                        <UserPlus size={14} />
                        <span className="hidden sm:inline">申请</span>
                      </button>
                    )}
                    {/* 申请待审核状态 */}
                    {applicationStatus === 'pending' && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        审核中
                      </span>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 px-2 py-1 rounded transition-colors"
                      title="退出登录"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <LogIn size={16} />
                    <span className="hidden sm:inline">登录</span>
                  </button>
                )
              ) : (
                <span className="text-xs text-slate-400 flex items-center gap-1" title="未配置 Supabase">
                  <CloudOff size={14} /> 本地模式
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* 公告区域 */}
        {showAnnouncement && announcements.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 relative">
            <button
              onClick={() => setShowAnnouncement(false)}
              className="absolute top-2 right-2 text-amber-400 hover:text-amber-600 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <Bell size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 mb-1">{announcements[0].title}</h3>
                <p className="text-sm text-amber-700 whitespace-pre-wrap">{announcements[0].content}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'summary' ? (
          <SummaryView history={history} pools={pools} />
        ) : activeTab === 'admin' && isSuperAdmin ? (
          <AdminPanel />
        ) : activeTab === 'settings' ? (
          <SettingsPanel user={user} userRole={userRole} />
        ) : activeTab === 'about' ? (
          <AboutPanel />
        ) : (
          <>
            {/* 数据录入区域 - 仅管理员可见 */}
            {canEdit && (
              <InputSection
                currentPool={currentPool}
                poolStatsTotal={stats.total}
                onAddSingle={addSinglePull}
                onSubmitBatch={submitBatch}
                onDeletePool={openDeleteConfirmModal}
              />
            )}

            {/* 非管理员提示 */}
            {!canEdit && (
              <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                <Shield size={40} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-600 mb-2">数据录入仅限管理员</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {user ? (
                    applicationStatus === 'pending'
                      ? '您的管理员申请正在审核中，请耐心等待。'
                      : '如需录入数据，请点击右上角申请成为管理员。'
                  ) : (
                    '请先登录，然后申请成为管理员。'
                  )}
                </p>
                {!user && (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    登录
                  </button>
                )}
              </div>
            )}

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
                       canEdit={canEdit}
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
        </>
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
              {modalState.type === 'createPool' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">快速选择卡池</label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {PRESET_POOLS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const typeStr = preset.type === 'limited' ? '限定' : (preset.type === 'weapon' ? '武器' : '常驻');
                          const name = `${typeStr}${preset.charName ? '-' + preset.charName : ''}${drawerName ? '-' + drawerName : ''}`;
                          setNewPoolTypeInput(preset.type);
                          setSelectedCharName(preset.charName);
                          setNewPoolNameInput(name);
                        }}
                        className="text-left text-xs p-2 rounded border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors truncate"
                        title={preset.label}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">抽卡人</label>
                <input 
                  type="text" 
                  value={drawerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrawerName(val);
                    if (modalState.type === 'createPool') {
                       const typeStr = newPoolTypeInput === 'limited' ? '限定' : (newPoolTypeInput === 'weapon' ? '武器' : '常驻');
                       const name = `${typeStr}${selectedCharName ? '-' + selectedCharName : ''}${val ? '-' + val : ''}`;
                       setNewPoolNameInput(name);
                    }
                  }}
                  placeholder="例如：Me, 朋友A"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">卡池名称</label>
                <input 
                  type="text" 
                  value={newPoolNameInput}
                  onChange={(e) => setNewPoolNameInput(e.target.value)}
                  placeholder="例如：限定池-海滨假日"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && (modalState.type === 'createPool' ? confirmCreatePool() : confirmEditPool())}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">卡池类型</label>
                <div className="flex gap-3">
                  {['limited', 'standard', 'weapon'].map(type => (
                    <label key={type} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${newPoolTypeInput === type ? (type === 'weapon' ? 'bg-slate-800 border-slate-600 text-white' : type === 'limited' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-indigo-50 border-indigo-500 text-indigo-700') + ' font-bold ring-1' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="poolType" 
                        value={type}
                        checked={newPoolTypeInput === type}
                        onChange={() => {
                          setNewPoolTypeInput(type);
                          if (modalState.type === 'createPool') {
                             const typeStr = type === 'limited' ? '限定' : (type === 'weapon' ? '武器' : '常驻');
                             const name = `${typeStr}${selectedCharName ? '-' + selectedCharName : ''}${drawerName ? '-' + drawerName : ''}`;
                             setNewPoolNameInput(name);
                          }
                        }}
                        className="hidden"
                      />
                      {type === 'limited' && <Star size={16} />}
                      {type === 'standard' && <Layers size={16} />}
                      {type === 'weapon' && <Search size={16} />}
                      {type === 'limited' ? '限定池' : (type === 'weapon' ? '武器池' : '常驻池')}
                    </label>
                  ))}
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
      
      {/* 登录弹窗 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(user) => setUser(user)}
      />

      {/* 数据迁移弹窗 */}
      {showMigrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cloud size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">同步本地数据到云端？</h3>
              <p className="text-sm text-slate-500">
                检测到您有 <span className="font-bold text-slate-700">{history.length}</span> 条本地记录。
                <br/>是否将这些数据同步到云端？
              </p>
              {syncing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">正在同步...</span>
                </div>
              )}
              {syncError && (
                <div className="mt-4 text-sm text-red-500 bg-red-50 p-2 rounded">
                  同步失败: {syncError}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-center">
              <button
                onClick={() => setShowMigrateModal(false)}
                disabled={syncing}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                暂不同步
              </button>
              <button
                onClick={async () => {
                  const success = await migrateLocalToCloud();
                  if (success) {
                    setShowMigrateModal(false);
                  }
                }}
                disabled={syncing}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {syncing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    同步中...
                  </>
                ) : (
                  <>
                    <Cloud size={16} />
                    同步到云端
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 申请管理员弹窗 */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">申请成为管理员</h3>
              <p className="text-sm text-slate-500 mb-4">
                成为管理员后，您可以为本站录入抽卡数据。
              </p>
              <textarea
                id="apply-reason"
                placeholder="请简单说明申请理由（如：我想帮忙录入数据）"
                className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                rows={3}
              />
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 justify-center">
              <button
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const reason = document.getElementById('apply-reason').value.trim();
                  if (!reason) {
                    alert('请填写申请理由');
                    return;
                  }
                  const success = await handleApplyAdmin(reason);
                  if (success) {
                    alert('申请已提交，请等待审核');
                  } else {
                    alert('提交失败，请稍后重试');
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-all flex items-center gap-2"
              >
                <UserPlus size={16} />
                提交申请
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
          background-image: linear-gradient(
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