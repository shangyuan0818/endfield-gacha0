import React from 'react';
import { Accessibility, Calculator, ChevronUp, Database, Github, Globe, Languages, Lightbulb, Map, RefreshCw, Share2, Shield } from 'lucide-react';
import CollapsibleContent from './CollapsibleContent';

const ROADMAP_ITEMS = [
  { id: 'sim-inherit', icon: RefreshCw, title: '模拟器状态继承', description: '卡池模拟器支持继承游戏内的真实抽卡与保底状态', status: 'planned', priority: 'high' },
  { id: 'puzzle-captcha', icon: Shield, title: '拼图验证码', description: '主站验证码更换为简单拼图玩法，同时保留现有方式', status: 'planned', priority: 'high' },
  { id: 'global-support', icon: Globe, title: '国际服支持', description: '支持国际服抽卡记录的解析与导入', status: 'planned', priority: 'high' },
  { id: 'currency-calc', icon: Calculator, title: '资源消耗换算', description: '支持换算已消耗合成玉、源石数量及已获得武库配额数量', status: 'planned', priority: 'medium' },
  { id: 'sim-currency', icon: Database, title: '模拟器资源机制', description: '模拟器添加合成玉和源石的使用和获取机制', status: 'planned', priority: 'medium' },
  { id: 'share', icon: Share2, title: '分享功能', description: '模拟器支持脱敏分享卡图片、系统分享与文本复制', status: 'completed', priority: 'medium' },
  { id: 'i18n', icon: Languages, title: '国际化支持', description: '支持英语、日语等多语言界面，服务更多玩家', status: 'planned', priority: 'low' },
  { id: 'a11y', icon: Accessibility, title: '无障碍优化', description: '完善ARIA标签和键盘导航，提升可访问性', status: 'planned', priority: 'low' },
  { id: 'virtual-scroll', icon: Database, title: '虚拟滚动', description: '优化长列表性能，支持更大数据量的流畅浏览', status: 'planned', priority: 'low' },
];

const STATUS_CONFIG = {
  completed: { bg: 'bg-green-500/10 text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800', label: '已完成' },
  in_progress: { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', label: '开发中' },
  planned: { bg: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400', border: 'border-zinc-200 dark:border-zinc-800', label: '计划中' },
};

const PRIORITY_CONFIG = {
  high: { bg: 'bg-amber-500', border: 'border-amber-500', ring: 'ring-amber-500/30' },
  medium: { bg: 'bg-blue-500', border: 'border-blue-500', ring: 'ring-blue-500/30' },
  low: { bg: 'bg-zinc-400', border: 'border-zinc-400', ring: 'ring-zinc-500/30' },
};

const RoadmapCard = React.memo(function RoadmapCard({ isOpen, onToggle }) {
  return (
    <div className="group relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all duration-300 rounded-none sm:rounded-lg">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
        <Map size={240} />
      </div>

      <button
        onClick={onToggle}
        className="w-full relative px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-zinc-800/80 transition-colors text-left"
      >
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 rounded-lg">
              <Lightbulb size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-zinc-100 tracking-tight">
                功能路线图
                <span className="ml-2 text-xs font-normal text-zinc-400 px-2 py-0.5 border border-zinc-200 dark:border-zinc-700 rounded-full font-mono">Roadmap</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">持续进化的功能迭代计划</p>
            </div>
          </div>
          <div className={`sm:hidden transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`}>
            <ChevronUp size={20} className="text-zinc-400" />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-1.5" title="高优先级功能">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-zinc-600 dark:text-zinc-400 font-medium">High Priority</span>
          </div>
          <a
            href="https://github.com/MoguJunn/endfield-gacha/issues"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-md transition-colors"
          >
            <Github size={14} />
            <span>反馈建议</span>
          </a>
          <div className={`hidden sm:block transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`}>
            <ChevronUp size={20} className="text-zinc-400" />
          </div>
        </div>
      </button>

      <CollapsibleContent isOpen={isOpen}>
        <div className="relative px-6 py-6 overflow-x-auto scrollbar-hide">
          <div className="min-w-max">
            <div className="absolute top-[38px] left-6 right-6 h-0.5 bg-zinc-100 dark:bg-zinc-800"></div>
            <div className="flex gap-4">
              {ROADMAP_ITEMS.map((item, index) => {
                const status = STATUS_CONFIG[item.status];
                const priority = PRIORITY_CONFIG[item.priority];
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className="relative w-40 flex-shrink-0 group/item animate-fade-in-up pt-3"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 p-1 rounded-full bg-white dark:bg-zinc-900 border-2 ${priority.border} ring-2 ${priority.ring} z-10 transition-transform duration-300 group-hover/item:scale-125`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${priority.bg}`}></div>
                    </div>

                    <div className="mt-5 relative bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 hover:border-violet-300 dark:hover:border-violet-700/50 hover:shadow-md transition-all duration-300 h-full flex flex-col">
                      <div className={`absolute top-0 left-3 right-3 h-0.5 rounded-b ${priority.bg}`}></div>

                      <div className="flex flex-col gap-2 mb-3 mt-1 text-center">
                        <div className="mx-auto p-2 rounded-md bg-white dark:bg-zinc-800 shadow-sm inline-flex">
                          <Icon size={20} className="text-zinc-500 dark:text-zinc-400 group-hover/item:text-violet-500 transition-colors" />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm leading-snug">{item.title}</h4>
                      </div>

                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3 flex-1 text-center">{item.description}</p>

                      <div className="flex items-center justify-center gap-2 mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase border rounded ${status.bg} ${status.border}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sm:hidden px-6 pb-6 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <a
            href="https://github.com/MoguJunn/endfield-gacha/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium text-sm rounded-lg transition-colors mt-4"
          >
            <Github size={16} />
            <span>在 GitHub 上反馈建议</span>
          </a>
        </div>
      </CollapsibleContent>
    </div>
  );
});

export default RoadmapCard;
