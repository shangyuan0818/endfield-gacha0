import React from 'react';
import { Accessibility, ArrowLeft, Calculator, Database, Globe, Languages, Map, RefreshCw, Rocket, Share2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMobilePathForTab } from '../../constants/appRoutes.js';
import { DEFAULT_HOME_ROADMAP_ITEMS, normalizeHomeRoadmapItems } from '../../constants/homeRoadmap.js';
import { useI18n } from '../../i18n/index.js';
import { useJsonConfig } from '../../stores/useSiteConfigStore.js';

const ICON_MAP = { Accessibility, Calculator, Database, Globe, Languages, Map, RefreshCw, Rocket, Share2, Shield };

const STATUS_CONFIG = {
  completed: {
    labelKey: 'home.roadmap.status.completed',
    fallback: '已完成',
    dot: 'bg-green-500',
    chip: 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400',
  },
  in_progress: {
    labelKey: 'home.roadmap.status.inProgress',
    fallback: '进行中',
    dot: 'bg-blue-500',
    chip: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  planned: {
    labelKey: 'home.roadmap.status.planned',
    fallback: '计划中',
    dot: 'bg-zinc-300 dark:bg-zinc-600',
    chip: 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
  },
};

function BackButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Back" className="touch-feedback inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors">
      <ArrowLeft size={16} />
    </button>
  );
}

function MobileRoadmapView() {
  const navigate = useNavigate();
  const { isEnglish, t } = useI18n();
  const roadmapConfig = useJsonConfig('home_roadmap_items', DEFAULT_HOME_ROADMAP_ITEMS);
  const roadmapItems = normalizeHomeRoadmapItems(roadmapConfig, DEFAULT_HOME_ROADMAP_ITEMS);

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-4 pb-20 slide-up-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark">
      <div className="py-4 flex items-center gap-3 sticky top-0 bg-white/90 dark:bg-ef-dark/90 backdrop-blur-md z-20 border-b border-zinc-200 dark:border-zinc-800/50 -mx-4 px-4 mb-4">
         <BackButton onClick={() => navigate(getMobilePathForTab('home'))} />
         <h1 className="text-xl font-black tracking-widest text-slate-900 dark:text-white">{isEnglish ? 'Roadmap' : '开发路线图'}</h1>
      </div>

      <div className="mobile-ux-soft-card overflow-hidden">
        <div className="border-b border-zinc-200/90 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <Rocket size={18} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wider text-slate-900 dark:text-zinc-100">
                {t('home.roadmap.title', {}, '功能路线图')}
              </h2>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                {t('home.roadmap.subtitle', {}, 'Development Roadmap')}
              </p>
            </div>
          </div>
        </div>

        <div className="relative p-4">
          <div className="absolute bottom-6 left-8 top-6 w-px bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-3">
            {roadmapItems.map((item) => {
              const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.planned;
              const Icon = ICON_MAP[item.icon] || Database;

              return (
                <div key={item.id} className="relative flex gap-3">
                  <div className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white bg-white dark:border-ef-dark dark:bg-ef-dark">
                    <span className={`block h-3 w-3 rounded-full ${status.dot}`} />
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white/80 p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                          <Icon size={15} />
                        </div>
                        <h3 className="min-w-0 break-words text-sm font-black text-slate-900 dark:text-zinc-100">
                          {t(`home.roadmap.item.${item.id}.title`, {}, item.title)}
                        </h3>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.chip}`}>
                        {t(status.labelKey, {}, status.fallback)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                      {t(`home.roadmap.item.${item.id}.description`, {}, item.description)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobileRoadmapView;
