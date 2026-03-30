import React, { useMemo, useState } from 'react';
import {
  Clock3,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  TrendingUp
} from 'lucide-react';

const MOCK_TIMELINE_POOLS = [
  {
    id: 'pool-current-limited',
    title: '河流的女儿',
    type: 'limited',
    featured: '莱万汀',
    period: '03月12日 - 至今',
    totalPulls: 19,
    currentPity: 19,
    outputValue: 740,
    outputLabel: '样本收益',
    bannerTone: 'from-fuchsia-500/20 via-rose-500/10 to-amber-300/10',
    accentClass: 'from-fuchsia-500 to-pink-400',
    entries: [
      {
        id: 'current-push',
        date: '至今',
        stageLabel: '当前推进',
        pulls: 76,
        targetPulls: 90,
        resultSummary: '1 次 6★，当前未歪',
        tags: ['当前阶段'],
        dropBadges: [
          { label: '莱万汀', rarity: 6, count: 1 },
          { label: '赫尔墨斯', rarity: 5, count: 2 },
          { label: '斐迪亚', rarity: 5, count: 1 }
        ]
      }
    ]
  },
  {
    id: 'pool-limited-1',
    title: '热烈色彩',
    type: 'limited',
    featured: '梅露辛',
    period: '02月24日 - 03月12日',
    totalPulls: 60,
    currentPity: 57,
    outputValue: 5000,
    outputLabel: '样本收益',
    bannerTone: 'from-rose-500/20 via-pink-500/10 to-fuchsia-300/10',
    accentClass: 'from-fuchsia-500 to-pink-400',
    entries: [
      {
        id: 'limited-1-main',
        date: '02-24',
        stageLabel: '开池冲刺',
        pulls: 71,
        targetPulls: 90,
        resultSummary: '歪出常驻 1 次',
        tags: ['歪'],
        dropBadges: [
          { label: '菲洛', rarity: 6, count: 1 },
          { label: '赫尔墨斯', rarity: 5, count: 3 },
          { label: '斐迪亚', rarity: 5, count: 2 }
        ]
      },
      {
        id: 'limited-1-free',
        date: '免费十连',
        stageLabel: '活动赠送',
        pulls: 10,
        targetPulls: 30,
        resultSummary: '赠送十连，不计保底',
        tags: ['赠送'],
        dropBadges: [
          { label: '缇娜', rarity: 5, count: 1 }
        ]
      }
    ]
  },
  {
    id: 'pool-limited-2',
    title: '轻飘飘的信使',
    type: 'limited',
    featured: '赛希',
    period: '02月07日 - 02月24日',
    totalPulls: 60,
    currentPity: 60,
    outputValue: 3020,
    outputLabel: '样本收益',
    bannerTone: 'from-slate-500/20 via-zinc-500/10 to-amber-300/10',
    accentClass: 'from-emerald-400 to-teal-400',
    entries: [
      {
        id: 'limited-2-free',
        date: '免费十连',
        stageLabel: '活动赠送',
        pulls: 10,
        targetPulls: 30,
        resultSummary: '赠送十连，不计保底',
        tags: ['赠送'],
        dropBadges: [
          { label: '温妮', rarity: 5, count: 1 }
        ]
      }
    ]
  },
  {
    id: 'pool-weapon-1',
    title: '熔火灼痕',
    type: 'weapon',
    featured: '赤霆模组',
    period: '01月22日 - 02月07日',
    totalPulls: 155,
    currentPity: 8,
    outputValue: 16260,
    outputLabel: '配额折算',
    bannerTone: 'from-amber-500/20 via-orange-500/10 to-red-400/10',
    accentClass: 'from-yellow-400 to-amber-300',
    entries: [
      {
        id: 'weapon-1-hit',
        date: '02-02',
        stageLabel: '第一次命中',
        pulls: 50,
        targetPulls: 80,
        resultSummary: '首轮 UP 武器',
        tags: ['命中'],
        dropBadges: [
          { label: '赤霆模组', rarity: 6, count: 1 },
          { label: '盾卫装置', rarity: 5, count: 1 },
          { label: '侦查模块', rarity: 5, count: 1 }
        ]
      },
      {
        id: 'weapon-1-side',
        date: '01-26',
        stageLabel: '提前出货',
        pulls: 24,
        targetPulls: 80,
        resultSummary: '副产物偏多',
        tags: ['稳定'],
        dropBadges: [
          { label: '盾卫装置', rarity: 5, count: 1 },
          { label: '蜂巢核心', rarity: 5, count: 1 }
        ]
      },
      {
        id: 'weapon-1-miss',
        date: '01-24',
        stageLabel: '开池试探',
        pulls: 68,
        targetPulls: 80,
        resultSummary: '常驻偏移，节奏拖长',
        tags: ['偏移'],
        dropBadges: [
          { label: '菲洛', rarity: 6, count: 1 },
          { label: '侦查模块', rarity: 5, count: 2 },
          { label: '斐迪亚', rarity: 5, count: 1 }
        ]
      }
    ]
  },
  {
    id: 'pool-standard-1',
    title: '常态校准',
    type: 'standard',
    featured: '定向自选',
    period: '长期开放',
    totalPulls: 284,
    currentPity: 42,
    outputValue: 11840,
    outputLabel: '样本收益',
    bannerTone: 'from-blue-500/20 via-sky-500/10 to-cyan-300/10',
    accentClass: 'from-blue-400 to-cyan-300',
    entries: [
      {
        id: 'standard-1-main',
        date: '03-01',
        stageLabel: '稳态补抽',
        pulls: 42,
        targetPulls: 80,
        resultSummary: '常驻主线适合看累计节奏和 300 抽自选进度',
        tags: ['常驻'],
        dropBadges: [
          { label: '菲洛', rarity: 6, count: 1 },
          { label: '蜂巢核心', rarity: 5, count: 1 }
        ]
      },
      {
        id: 'standard-1-side',
        date: '02-18',
        stageLabel: '阶段回收',
        pulls: 61,
        targetPulls: 80,
        resultSummary: '常驻池也可以按阶段回顾，而不只是看累计总数',
        tags: ['累计'],
        dropBadges: [
          { label: '赫尔墨斯', rarity: 5, count: 2 },
          { label: '斐迪亚', rarity: 5, count: 1 }
        ]
      }
    ]
  }
];

const TAB_OPTIONS = [
  { id: 'all', label: '全部阶段' },
  { id: 'limited', label: '限定池' },
  { id: 'weapon', label: '武器池' },
  { id: 'standard', label: '常驻池' }
];

function formatAverage(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${value.toFixed(1)} 抽`;
}

function derivePoolMetrics(pool) {
  const badges = pool.entries.flatMap((entry) => entry.dropBadges);
  const sixStarDrops = badges.filter((badge) => badge.rarity >= 6);
  const fiveStarDrops = badges.filter((badge) => badge.rarity === 5);
  const upHits = sixStarDrops.filter((badge) => badge.label === pool.featured).length;
  const currentPity5 = pool.type === 'weapon' ? 5 : pool.type === 'limited' ? 4 : 3;

  return {
    sixStarCount: sixStarDrops.length,
    fiveStarCount: fiveStarDrops.length,
    upHits,
    avgSixStarPulls: sixStarDrops.length > 0 ? pool.totalPulls / sixStarDrops.length : Number.NaN,
    avgFiveStarPulls: fiveStarDrops.length > 0 ? pool.totalPulls / fiveStarDrops.length : Number.NaN,
    avgUpPulls: upHits > 0 ? pool.totalPulls / upHits : Number.NaN,
    currentPity5,
    winRate: sixStarDrops.length > 0 ? (upHits / sixStarDrops.length) * 100 : 0
  };
}

function getMechanics(pool) {
  if (pool.type === 'weapon') {
    return [
      { id: 'first-80', label: '80 抽首轮必出', value: `${Math.min(pool.totalPulls, 80)} / 80`, detail: '突出第一轮命中或偏移节奏', progress: Math.min((pool.totalPulls / 80) * 100, 100), tone: 'bg-amber-500' },
      { id: 'gift', label: '武器赠送进度', value: `${pool.totalPulls} / 180`, detail: '详情页左栏可继续复用现有赠送逻辑', progress: Math.min((pool.totalPulls / 180) * 100, 100), tone: 'bg-red-500' }
    ];
  }

  if (pool.type === 'standard') {
    return [
      { id: 'select-300', label: '300 抽自选进度', value: `${Math.min(pool.totalPulls, 300)} / 300`, detail: '常驻池只换指标，不用换布局', progress: Math.min((pool.totalPulls / 300) * 100, 100), tone: 'bg-blue-500' }
    ];
  }

  return [
    { id: 'free-ten', label: '免费十连', value: '已领取', detail: '赠送节点继续独立展示，不与正式抽卡混在一起', progress: 100, tone: 'bg-blue-500' },
    { id: 'spark-120', label: '120 抽必出限定', value: `${Math.min(pool.totalPulls, 120)} / 120`, detail: '让详情页左栏和时间线都围绕同一条保底叙事展开', progress: Math.min((pool.totalPulls / 120) * 100, 100), tone: 'rainbow-progress' },
    { id: 'gift-240', label: '240 抽赠送潜能', value: `${pool.totalPulls % 240} / 240`, detail: '下一档赠送适合继续放在详情页分析栏', progress: ((pool.totalPulls % 240) / 240) * 100, tone: 'bg-purple-500' }
  ];
}

function DemoStatBox({ label, value, hint, accentClass = 'text-slate-900 dark:text-zinc-100' }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-black font-mono ${accentClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</div> : null}
    </div>
  );
}

function MechanicRow({ item }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 dark:text-zinc-200">{item.label}</div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{item.detail}</div>
        </div>
        <div className="shrink-0 text-sm font-black font-mono text-slate-900 dark:text-zinc-100">{item.value}</div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full ${item.tone}`} style={{ width: `${Math.min(item.progress, 100)}%` }} />
      </div>
    </div>
  );
}

function MockDetailSidebar({ pool }) {
  const metrics = derivePoolMetrics(pool);
  const tone = getPoolTone(pool.type);
  const mechanics = getMechanics(pool);

  return (
    <aside className="space-y-4 xl:sticky xl:top-6">
      <div className="overflow-hidden border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className={`relative overflow-hidden border-b border-zinc-100 bg-gradient-to-r ${pool.bannerTone} p-5 dark:border-zinc-800`}>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:18px_18px] opacity-80" />
          <div className="relative">
            <span className={`inline-flex border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${tone.chip}`}>
              {tone.label}
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-100">{pool.title}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Sparkles size={14} className="text-endfield-yellow" />
              当前目标：{pool.featured}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <DemoStatBox label="6★ 保底剩余" value={Math.max((pool.type === 'weapon' ? 80 : 80) - pool.currentPity, 0)} hint={`当前垫刀 ${pool.currentPity}`} />
            <DemoStatBox label="5★ 保底剩余" value={Math.max(10 - metrics.currentPity5, 0)} hint={`当前垫刀 ${metrics.currentPity5}`} />
          </div>

          <div className="border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700 dark:text-zinc-200">不歪率</div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-zinc-100">{metrics.sixStarCount > 0 ? `${metrics.winRate.toFixed(1)}%` : '--'}</div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full rainbow-progress" style={{ width: `${Math.min(metrics.winRate, 100)}%` }} />
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              UP 6★ {metrics.upHits} / 全部 6★ {metrics.sixStarCount}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DemoStatBox label="平均 6★ 出货" value={formatAverage(metrics.avgSixStarPulls)} hint={`共 ${metrics.sixStarCount} 次 6★`} accentClass="text-fuchsia-600 dark:text-fuchsia-300" />
            <DemoStatBox label="平均 5★ 出货" value={formatAverage(metrics.avgFiveStarPulls)} hint={`共 ${metrics.fiveStarCount} 次 5★`} accentClass="text-amber-600 dark:text-amber-300" />
          </div>
        </div>
      </div>

      <div className="border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-zinc-400" />
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-800 dark:text-zinc-100">特殊机制进度</h3>
        </div>
        <div className="mt-4 space-y-3">
          {mechanics.map((item) => (
            <MechanicRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function getPoolTone(type) {
  if (type === 'weapon') {
    return {
      chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/60 dark:border-amber-500/30',
      label: '武器池',
      icon: '配额'
    };
  }

  if (type === 'standard') {
    return {
      chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/60 dark:border-blue-500/30',
      label: '常驻池',
      icon: '常驻'
    };
  }

  return {
    chip: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300/60 dark:border-fuchsia-500/30',
    label: '限定池',
    icon: 'UP'
  };
}

function getAccentRailClass(accentClass) {
  if (accentClass.includes('yellow') || accentClass.includes('amber')) {
    return 'bg-amber-400';
  }

  if (accentClass.includes('emerald') || accentClass.includes('teal')) {
    return 'bg-emerald-400';
  }

  if (accentClass.includes('blue') || accentClass.includes('cyan')) {
    return 'bg-blue-400';
  }

  return 'bg-fuchsia-400';
}

function getStageLeadBadge(entry, featured) {
  return entry.dropBadges.find((badge) => badge.rarity >= 6) || entry.dropBadges[0] || {
    label: featured || '?',
    rarity: 5
  };
}

function StagePortrait({ entry, featured }) {
  const leadBadge = getStageLeadBadge(entry, featured);
  const isSixStar = leadBadge.rarity >= 6;
  const portraitTone = isSixStar
    ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400'
    : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400';

  return (
    <div className={`relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 border ${portraitTone} flex flex-col items-center justify-center`}>
      <div className="text-lg sm:text-xl font-black tracking-tight mt-1">
        {leadBadge.label.slice(0, 1) || '?'}
      </div>
      <div className="absolute top-0 right-0 px-1 py-[1px] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[8px] sm:text-[9px] font-bold leading-none">
        {isSixStar ? '6★' : '5★'}
      </div>
    </div>
  );
}

function StageBadge({ badge }) {
  const isSixStar = badge.rarity >= 6;
  return (
    <div className="flex items-center border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5 pr-2 gap-1.5 shadow-sm">
       <div className={`w-6 h-6 flex items-center justify-center text-[10px] font-black ${isSixStar ? 'bg-yellow-400/80 text-yellow-900 dark:bg-yellow-500/80' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'}`}>
         {badge.label.slice(0, 1)}
       </div>
       <div className="flex flex-col justify-center">
         <div className="flex items-baseline gap-1">
           <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 leading-none">{badge.label}</span>
           {badge.count > 1 && <span className="text-[10px] font-black font-mono text-zinc-400 dark:text-zinc-500">x{badge.count}</span>}
         </div>
       </div>
    </div>
  );
}

function TimelineStageCard({ entry, accentClass, featured }) {
  const isFree = entry.tags.includes('赠送');
  const isLose = entry.tags.includes('歪');
  const isWin = entry.tags.includes('命中');
  const stageDropCount = entry.dropBadges.reduce((sum, badge) => sum + badge.count, 0);
  
  let barClass = getAccentRailClass(accentClass);
  if (isFree) {
    barClass = 'bg-emerald-400 dark:bg-emerald-500';
  } else if (entry.tags.includes('常驻')) {
    barClass = 'bg-blue-400 dark:bg-blue-500';
  }

  const widthPercent = Math.max(12, Math.min(100, (entry.pulls / entry.targetPulls) * 100));

  return (
    <div className="relative flex gap-3 sm:gap-5 group">
      {/* Left Axis: Portrait & Date */}
      <div className="flex flex-col items-center w-12 sm:w-16 shrink-0 relative z-10">
        <StagePortrait entry={entry} featured={featured} />
        <span className="mt-2 text-[10px] sm:text-[11px] font-black font-mono text-zinc-500 dark:text-zinc-400">{entry.date}</span>
      </div>

      {/* Right Content */}
      <div className="flex-1 min-w-0 pb-6 sm:pb-8 border-b border-zinc-100 dark:border-zinc-800/60 group-last:border-0 group-last:pb-0">
        
        {/* Info Row */}
         <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <span className="px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 text-[9px] sm:text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
              {entry.stageLabel}
            </span>
            <span className="text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 truncate">
              {entry.resultSummary}
            </span>
         </div>
         <div className="mb-2 sm:mb-3 text-[10px] sm:text-[11px] font-mono uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
           目标 {featured} · 阶段上限 {entry.targetPulls} 抽 · 出货 {stageDropCount} 件
         </div>

         {/* Bar Row */}
         <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative h-8 sm:h-10 flex-1 max-w-[90%] sm:max-w-[85%] bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 overflow-hidden shadow-sm">
            <div 
               className={`absolute inset-y-0 left-0 ${barClass}`} 
               style={{ width: `${widthPercent}%` }}
            >
              {/* Subtle stripe pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent_100%)] bg-[length:12px_12px]" />
            </div>
            <div className="absolute inset-y-0 left-2 sm:left-3 flex items-center">
               <span className="text-lg sm:text-xl font-black font-mono tracking-tight text-zinc-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] dark:text-zinc-100 dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                 {entry.pulls} <span className="text-xs sm:text-sm font-bold ml-0.5">抽</span>
               </span>
            </div>
          </div>
          
          {/* Stamps */}
          <div className="shrink-0 flex gap-1.5 sm:gap-2">
            {isLose && (
               <div className="flex items-center justify-center min-w-8 h-7 sm:min-w-9 sm:h-8 border border-rose-400 bg-rose-50 text-rose-600 dark:border-rose-500/70 dark:bg-rose-500/10 dark:text-rose-400 font-black text-[10px] sm:text-[11px] px-2 shadow-sm">
                 歪
               </div>
            )}
            {isWin && (
               <div className="flex items-center justify-center min-w-8 h-7 sm:min-w-9 sm:h-8 border border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-300 font-black text-[10px] sm:text-[11px] px-2 shadow-sm">
                 UP
               </div>
            )}
            {!isWin && !isLose && isFree && (
               <div className="flex items-center justify-center min-w-8 h-7 sm:min-w-9 sm:h-8 border border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/70 dark:bg-emerald-500/10 dark:text-emerald-300 font-black text-[10px] sm:text-[11px] px-2 shadow-sm">
                 免
               </div>
            )}
          </div>
        </div>

        {/* Badges below bar */}
        <div className="mt-2.5 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
          {entry.dropBadges.map((badge) => (
            <StageBadge key={`${entry.id}-${badge.label}`} badge={badge} />
          ))}
        </div>

      </div>
    </div>
  );
}

function TimelinePoolCard({ pool, showFiveStars, isFocused = false }) {
  const metrics = derivePoolMetrics(pool);
  const visibleEntries = pool.entries.map((entry) => ({
    ...entry,
    dropBadges: showFiveStars
      ? entry.dropBadges
      : entry.dropBadges.filter((badge) => badge.rarity >= 6)
  }));

  return (
    <section className={`border bg-white dark:bg-zinc-950 transition-colors duration-300 ${
      isFocused
        ? 'border-zinc-500 dark:border-zinc-400 shadow-md ring-1 ring-zinc-500/20 dark:ring-zinc-400/20'
        : 'border-zinc-200 dark:border-zinc-800 shadow-sm'
    }`}>
      {/* Header */}
      <div className="relative px-4 py-4 sm:px-6 sm:py-5 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 ${getAccentRailClass(pool.accentClass)}`} />
        
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-100">{pool.title}</h2>
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1 sm:mt-0">{pool.period}</span>
              {isFocused && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-800 font-bold uppercase tracking-wider">
                  当前查看
                </span>
              )}
            </div>
            
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-mono uppercase text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-widest text-zinc-400">合计</span>
                <span className="text-base font-black text-slate-900 dark:text-zinc-100">{pool.totalPulls}</span>
              </div>
              <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-widest text-zinc-400">垫刀</span>
                <span className="text-base font-black text-slate-900 dark:text-zinc-100">{pool.currentPity}</span>
              </div>
              <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-widest text-zinc-400">平均 6★</span>
                <span className="text-base font-black text-slate-900 dark:text-zinc-100">{formatAverage(metrics.avgSixStarPulls)}</span>
              </div>
              <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-widest text-zinc-400">平均 UP</span>
                <span className="text-base font-black text-slate-900 dark:text-zinc-100">{formatAverage(metrics.avgUpPulls)}</span>
              </div>
            </div>
          </div>
          
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 shadow-sm">
             <Sparkles size={14} className="text-endfield-yellow" />
             UP: {pool.featured}
          </div>
        </div>
      </div>

      {/* Entries */}
      <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
        {visibleEntries.map((entry) => (
          <TimelineStageCard
            key={entry.id}
            entry={entry}
            accentClass={pool.accentClass}
            featured={pool.featured}
          />
        ))}
      </div>
    </section>
  );
}

export default function TimelineConceptDemo() {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedPoolId, setSelectedPoolId] = useState(MOCK_TIMELINE_POOLS[0].id);
  const [showFiveStars, setShowFiveStars] = useState(true);

  const visiblePools = useMemo(() => {
    if (activeTab === 'all') {
      return MOCK_TIMELINE_POOLS;
    }

    return MOCK_TIMELINE_POOLS.filter((pool) => pool.type === activeTab);
  }, [activeTab]);

  const selectedPool = useMemo(() => {
    return visiblePools.find((pool) => pool.id === selectedPoolId) || visiblePools[0] || MOCK_TIMELINE_POOLS[0];
  }, [selectedPoolId, visiblePools]);

  const orderedPools = useMemo(() => {
    if (!selectedPool) {
      return visiblePools;
    }

    return [
      selectedPool,
      ...visiblePools.filter((pool) => pool.id !== selectedPool.id)
    ];
  }, [selectedPool, visiblePools]);

  const selectedMetrics = useMemo(() => derivePoolMetrics(selectedPool), [selectedPool]);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-100 p-6 dark:border-zinc-800">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">
                Timeline View
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50">
                卡池时间线视图
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                同类卡池按阶段串联展示，用于回顾命中、偏移、赠送和继承节奏。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <DemoStatBox label="可切池数" value={visiblePools.length} />
              <DemoStatBox label="总节点" value={visiblePools.reduce((sum, pool) => sum + pool.entries.length, 0)} />
              <DemoStatBox label="当前池型" value={getPoolTone(selectedPool.type).label} hint={selectedPool.title} />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {TAB_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveTab(option.id)}
                  className={`border px-4 py-2 text-sm font-bold transition-colors ${
                    activeTab === option.id
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowFiveStars((value) => !value)}
                className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-bold transition-colors ${
                  showFiveStars
                    ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-700 dark:text-yellow-300'
                    : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400'
                }`}
              >
                {showFiveStars ? <Eye size={16} /> : <EyeOff size={16} />}
                展示五星辅助节点
              </button>
              <div className="inline-flex items-center gap-2 border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                <Clock3 size={14} />
                同类池回顾模式
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">卡池选择器</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {visiblePools.map((pool) => (
                  <button
                    key={pool.id}
                    type="button"
                    onClick={() => setSelectedPoolId(pool.id)}
                    className={`border px-4 py-2 text-sm font-bold transition-colors ${
                      selectedPool.id === pool.id
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200'
                    }`}
                  >
                    {pool.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-l-4 border-endfield-yellow bg-zinc-900 px-5 py-4 text-white shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-endfield-yellow">
                <Layers size={14} />
                当前池总投入
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-black font-mono">{selectedPool.totalPulls}</span>
                <span className="pb-1 text-sm font-bold uppercase tracking-[0.18em] text-zinc-500">PULLS</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <MockDetailSidebar pool={selectedPool} />

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DemoStatBox label="当前池 6★ 总数" value={selectedMetrics.sixStarCount} hint={`UP 6★ ${selectedMetrics.upHits}`} accentClass="text-fuchsia-600 dark:text-fuchsia-300" />
            <DemoStatBox label="当前池 5★ 总数" value={selectedMetrics.fiveStarCount} hint={`当前池型 ${getPoolTone(selectedPool.type).label}`} accentClass="text-amber-600 dark:text-amber-300" />
            <DemoStatBox label="平均 6★ 出货" value={formatAverage(selectedMetrics.avgSixStarPulls)} hint="按当前池统计" />
            <DemoStatBox label="平均 UP 出货" value={formatAverage(selectedMetrics.avgUpPulls)} hint="按当前池统计" accentClass="text-emerald-600 dark:text-emerald-300" />
          </div>

          <div className="space-y-6">
            {orderedPools.map((pool) => (
              <TimelinePoolCard key={pool.id} pool={pool} showFiveStars={showFiveStars} isFocused={pool.id === selectedPool.id} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
