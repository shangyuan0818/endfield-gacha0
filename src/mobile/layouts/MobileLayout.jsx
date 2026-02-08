import React, { useState } from 'react';
import useUIStore from '../../stores/useUIStore';
import useAuthStore from '../../stores/useAuthStore';
import MobileHeader from '../components/MobileHeader';
import MobileTabBar from '../components/MobileTabBar';
import MobileDrawer from '../components/MobileDrawer';

// 移动端视图
import MobileHomeView from '../views/MobileHomeView';
import MobileSummaryView from '../views/MobileSummaryView';
import MobileDashboardView from '../views/MobileDashboardView';
import MobileSimulatorView from '../views/MobileSimulatorView';
import MobileSettingsView from '../views/MobileSettingsView';
import MobileAboutView from '../views/MobileAboutView';

/**
 * 移动端主布局
 */
function MobileLayout({ themeMode, setThemeMode }) {
  const { activeTab } = useUIStore();
  const { user } = useAuthStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 根据 activeTab 渲染对应视图
  const renderView = () => {
    switch (activeTab) {
      case 'home':
        return <MobileHomeView />;
      case 'summary':
        return <MobileSummaryView />;
      case 'dashboard':
        return <MobileDashboardView />;
      case 'simulator':
        return <MobileSimulatorView />;
      case 'settings':
        return <MobileSettingsView themeMode={themeMode} setThemeMode={setThemeMode} />;
      case 'about':
        return <MobileAboutView />;
      default:
        return <MobileHomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 mobile-page-container">
      {/* 顶部导航 */}
      <MobileHeader onMenuClick={() => setIsDrawerOpen(true)} />

      {/* 主内容区域 */}
      <main className="pt-14 pb-20">
        {renderView()}
      </main>

      {/* 底部 Tab 栏 */}
      <MobileTabBar />

      {/* 侧边抽屉菜单 */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
      />
    </div>
  );
}

export default MobileLayout;
