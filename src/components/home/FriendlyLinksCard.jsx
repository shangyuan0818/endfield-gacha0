import React from 'react';
import { ArrowUpRight, BarChart3, Globe, Map } from 'lucide-react';
import useSiteConfigStore from '../../stores/useSiteConfigStore';

const ICON_MAP = { BarChart3, Map, Globe };

const DEFAULT_FRIENDLY_LINKS = [
  { title: '一图流攒抽计算器', url: 'https://ef.yituliu.cn/tools/gacha-calculator', icon: 'BarChart3', label: 'RESOURCE PLANNER' },
  { title: '终末地地图（1）', url: 'https://opendfieldmap.cn/', icon: 'Map', label: 'OPEN WORLD MAP' },
  { title: '终末地地图（笋干）', url: 'https://www.zmdmap.com/', icon: 'Map', label: 'GAME MAP WIKI' },
  { title: '同样优秀的抽卡记录分析（还有舟本体的）', url: 'https://endgacha.kwer.top/', icon: 'BarChart3', label: 'GACHA ANALYZER' },
];

const FriendlyLinksCard = React.memo(function FriendlyLinksCard() {
  const FRIENDLY_LINKS = useSiteConfigStore(s => s.getJsonConfig('home_friendly_links', DEFAULT_FRIENDLY_LINKS));

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden group h-full flex flex-col">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-sm animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
          <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-mono tracking-[0.2em] uppercase">Friendly Links // 友情链接</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          {FRIENDLY_LINKS.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/card relative flex flex-col justify-between p-4 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-endfield-yellow hover:bg-white dark:hover:bg-zinc-900 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-0 h-0.5 bg-amber-500 dark:bg-endfield-yellow group-hover/card:w-full transition-all duration-500 ease-out"></div>

              <div className="flex items-start justify-between mb-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-zinc-400 group-hover/card:text-amber-600 dark:group-hover/card:text-endfield-yellow/90 transition-colors uppercase tracking-wider">{link.label}</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 group-hover/card:text-black dark:group-hover/card:text-white transition-colors">{link.title}</span>
                </div>
                <div className="p-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 group-hover/card:border-amber-200 dark:group-hover/card:border-endfield-yellow/50 group-hover/card:bg-amber-50 dark:group-hover/card:bg-endfield-yellow/10 transition-colors rounded-sm text-zinc-400 group-hover/card:text-amber-600 dark:group-hover/card:text-endfield-yellow">
                  {React.createElement(ICON_MAP[link.icon] || Globe, { size: 16 })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 group-hover/card:border-zinc-100 dark:group-hover/card:border-zinc-800/50 transition-colors">
                <div className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-700 group-hover/card:bg-amber-500 dark:group-hover/card:bg-endfield-yellow rounded-full transition-colors"></div>
                <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[120px]">{new URL(link.url).hostname}</span>
                <ArrowUpRight size={12} className="ml-auto text-zinc-300 group-hover/card:text-amber-600 dark:group-hover/card:text-endfield-yellow group-hover/card:-translate-y-0.5 group-hover/card:translate-x-0.5 transition-all" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
});

export default FriendlyLinksCard;
