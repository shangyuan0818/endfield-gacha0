import React from 'react';
import { Home, PieChart, LayoutDashboard, Sparkles, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMobilePathForTab, getMobileTabFromPath } from '../../constants/appRoutes';

const tabs = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'summary', label: '统计', icon: PieChart },
  { id: 'dashboard', label: '卡池', icon: LayoutDashboard },
  { id: 'simulator', label: '模拟', icon: Sparkles },
  { id: 'settings', label: '设置', icon: Settings },
];

/**
 * 移动端底部 Tab 栏
 */
function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getMobileTabFromPath(location.pathname);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-50/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 mobile-tab-bar transition-colors duration-300">
      <div className="flex items-center justify-around h-16 px-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => navigate(getMobilePathForTab(tab.id))}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-2 touch-feedback no-tap-zoom transition-all duration-200 ${
                isActive 
                  ? 'text-zinc-900 dark:text-endfield-yellow bg-gradient-to-b from-zinc-100 to-transparent dark:from-zinc-900/50' 
                  : 'text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/30'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-endfield-yellow shadow-[0_0_8px_rgba(255,250,0,0.6)]" />
              )}
              <Icon
                className={`w-5 h-5 mb-1 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`}
              />
              <span className={`text-[10px] font-mono tracking-wide uppercase ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileTabBar;
