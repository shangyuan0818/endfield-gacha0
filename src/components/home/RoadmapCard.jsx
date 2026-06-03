import React, { useRef, useEffect } from 'react';
import { Accessibility, Calculator, ChevronUp, Database, Github, Globe, Languages, Lightbulb, Map, RefreshCw, Share2, Shield, Rocket } from 'lucide-react';
import CollapsibleContent from './CollapsibleContent';
import { useJsonConfig } from '../../stores/useSiteConfigStore';
import { useI18n } from '../../i18n/index.js';
import { DEFAULT_HOME_ROADMAP_ITEMS, normalizeHomeRoadmapItems } from '../../constants/homeRoadmap.js';
import { bindHorizontalWheelScroll } from '../../utils/horizontalScroll.js';

const ICON_MAP = { RefreshCw, Shield, Globe, Calculator, Database, Share2, Languages, Accessibility, Map, Rocket };

const STATUS_CONFIG = {
  completed: { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500/30', cardBg: 'bg-green-500/5 dark:bg-green-500/10' },
  in_progress: { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500/30', cardBg: 'bg-blue-500/5 dark:bg-blue-500/10' },
  planned: { bg: 'bg-zinc-300 dark:bg-zinc-600', text: 'text-zinc-400 dark:text-zinc-500', border: 'border-zinc-200 dark:border-zinc-700', cardBg: 'bg-zinc-50 dark:bg-zinc-800/50' },
};

const RoadmapCard = React.memo(function RoadmapCard({ isOpen, onToggle, interactive = true }) {
  const { t } = useI18n();
  const roadmapItems = useJsonConfig('home_roadmap_items', DEFAULT_HOME_ROADMAP_ITEMS);
  const ROADMAP_ITEMS = normalizeHomeRoadmapItems(roadmapItems, DEFAULT_HOME_ROADMAP_ITEMS);
  const tt = (key, fallback, params = {}) => t(key, params, fallback);
  const scrollRef = useRef(null);
  const focusItemRef = useRef(null);

  const statusConfig = {
    completed: { ...STATUS_CONFIG.completed, label: tt('home.roadmap.status.completed', '已完成') },
    in_progress: { ...STATUS_CONFIG.in_progress, label: tt('home.roadmap.status.inProgress', '进行中') },
    planned: { ...STATUS_CONFIG.planned, label: tt('home.roadmap.status.planned', '计划中') },
  };

  const translatedRoadmapItems = ROADMAP_ITEMS.map((item) => ({
    ...item,
    title: tt(`home.roadmap.item.${item.id}.title`, item.title),
    description: tt(`home.roadmap.item.${item.id}.description`, item.description),
  }));
  const HeaderTag = interactive ? 'button' : 'div';

  const focusIndex = (() => {
    const firstUnfinishedIndex = translatedRoadmapItems.findIndex((item) => item.status !== 'completed');
    if (firstUnfinishedIndex !== -1) {
      return firstUnfinishedIndex;
    }
    return Math.max(translatedRoadmapItems.length - 1, 0);
  })();

  useEffect(() => {
    if ((interactive ? isOpen : true) && scrollRef.current && focusItemRef.current) {
      const container = scrollRef.current;
      const targetItem = focusItemRef.current;
      const scrollLeft = targetItem.offsetLeft - container.offsetWidth / 2 + targetItem.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [focusIndex, interactive, isOpen, translatedRoadmapItems.length]);

  useEffect(() => bindHorizontalWheelScroll(scrollRef.current), []);

  return (
    <div className="group relative overflow-hidden bg-white dark:bg-[#111] border border-zinc-200 dark:border-zinc-800 transition-all duration-300 rounded-none sm:rounded-xl">
      {/* Background Texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>

      {/* Header Button */}
      <HeaderTag
        type={interactive ? 'button' : undefined}
        onClick={interactive ? onToggle : undefined}
        className={`w-full relative px-5 py-4 flex items-center justify-between gap-4 bg-white/80 dark:bg-[#111]/80 backdrop-blur-md text-left border-b border-zinc-100 dark:border-zinc-800/50 ${interactive ? 'cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg shadow-lg shadow-indigo-500/20">
            <Rocket size={18} />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100 tracking-wider">
              {tt('home.roadmap.title', '功能路线图')}
            </h3>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{tt('home.roadmap.subtitle', 'Development Roadmap')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/MoguJunn/endfield-gacha/issues"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded text-xs font-bold transition-colors"
          >
            <Github size={14} />
            <span>{tt('home.roadmap.feedback', 'Feedback')}</span>
          </a>
          {interactive ? (
            <div className={`p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`}>
              <ChevronUp size={16} />
            </div>
          ) : null}
        </div>
      </HeaderTag>

      {/* Content Area */}
      <CollapsibleContent isOpen={interactive ? isOpen : true}>
        <div className="relative pt-8 pb-10">
          {/* Continuous Horizontal Line */}
          <div className="absolute top-[52px] left-0 right-0 h-1 bg-zinc-100 dark:bg-zinc-800/50 z-0"></div>

          {/* Scrollable Container */}
          <div 
            ref={scrollRef}
            className="pool-card-rail-scrollbar flex flex-nowrap items-start gap-4 overflow-x-scroll overflow-y-hidden px-6 relative z-10"
          >
            {translatedRoadmapItems.map((item, index) => {
              const status = statusConfig[item.status] || statusConfig.planned;
              const Icon = ICON_MAP[item.icon] || Database;
              const isPast = item.status === 'completed';
              const isCurrent = item.status === 'in_progress';

              return (
                <div
                  key={item.id}
                  ref={index === focusIndex ? focusItemRef : null}
                  className="relative shrink-0 w-[240px] flex flex-col group"
                >
                  
                  {/* Timeline Node Point */}
                  <div className="relative h-10 flex items-center justify-center mb-4">
                    <div className={`w-4 h-4 rounded-full border-4 border-white dark:border-[#111] z-10 transition-transform duration-300 group-hover:scale-125 ${status.bg} shadow-sm`}>
                        {isCurrent && <div className="absolute inset-[-6px] rounded-full border border-blue-500/50 animate-ping"></div>}
                    </div>
                    {/* Highlighted active line segment behind the dot for completed items */}
                    {isPast && (
                        <div className="absolute top-1/2 left-0 right-1/2 h-1 bg-green-500 -translate-y-1/2 -z-10"></div>
                    )}
                    {isPast && index < translatedRoadmapItems.length - 1 && translatedRoadmapItems[index+1].status === 'completed' && (
                        <div className="absolute top-1/2 left-1/2 right-0 h-1 bg-green-500 -translate-y-1/2 -z-10"></div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className={`border ${status.border} ${status.cardBg} rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isCurrent ? 'shadow-blue-500/10' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-1.5 rounded-lg bg-white dark:bg-zinc-800/80 shadow-sm ${status.text}`}>
                        <Icon size={16} />
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tracking-wider ${status.text} ${status.border} ${isCurrent ? 'bg-blue-500/10' : 'bg-white dark:bg-zinc-900/50'}`}>
                        {status.label}
                      </span>
                    </div>
                    
                    <h4 className={`font-bold text-sm mb-1.5 ${isPast ? 'text-zinc-600 dark:text-zinc-300' : 'text-slate-900 dark:text-white'}`}>
                      {item.title}
                    </h4>
                    <p className={`text-xs leading-relaxed ${isPast ? 'text-zinc-500 dark:text-zinc-500' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* End Node */}
            <div className="relative shrink-0 w-20 flex flex-col items-center justify-start opacity-50">
                <div className="relative h-10 flex items-center justify-center mb-4 w-full">
                    <div className="absolute top-1/2 left-0 right-1/2 h-1 bg-zinc-100 dark:bg-zinc-800/50 -translate-y-1/2 -z-10"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700 z-10"></div>
                </div>
                <div className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">TBA</div>
            </div>

          </div>
        </div>
      </CollapsibleContent>
    </div>
  );
});

export default RoadmapCard;
