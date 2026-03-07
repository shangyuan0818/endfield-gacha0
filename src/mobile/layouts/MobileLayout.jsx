import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MobileHeader from '../components/MobileHeader';
import MobileTabBar from '../components/MobileTabBar';
import MobileDrawer from '../components/MobileDrawer';
import { getMobilePathForTab, getMobileTabFromPath } from '../../constants/appRoutes';

// 移动端视图
import MobileHomeView from '../views/MobileHomeView';
import MobileSummaryView from '../views/MobileSummaryView';
import MobileDashboardView from '../views/MobileDashboardView';
import MobileSimulatorView from '../views/MobileSimulatorView';
import MobileSettingsView from '../views/MobileSettingsView';
import MobileAboutView from '../views/MobileAboutView';
import MobileAdminView from '../views/MobileAdminView';
import MobileTicketView from '../views/MobileTicketView';

/**
 * 移动端主布局
 */
function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getMobileTabFromPath(location.pathname);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (activeTab === 'home' && location.pathname !== getMobilePathForTab('home')) {
      navigate(getMobilePathForTab('home'), { replace: true });
    }
  }, [activeTab, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 mobile-page-container">
      {/* 顶部导航 */}
      <MobileHeader onMenuClick={() => setIsDrawerOpen(true)} />

      {/* 主内容区域 - pt-14 (56px) + safe-area-inset-top */}
      <main className="pb-20" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}>
        <Routes>
          <Route index element={<MobileHomeView />} />
          <Route path="summary" element={<MobileSummaryView />} />
          <Route path="dashboard" element={<MobileDashboardView />} />
          <Route path="simulator" element={<MobileSimulatorView />} />
          <Route path="settings" element={<MobileSettingsView />} />
          <Route path="about" element={<MobileAboutView />} />
          <Route path="admin" element={<MobileAdminView />} />
          <Route path="tickets" element={<MobileTicketView />} />
          <Route path="*" element={<Navigate to={getMobilePathForTab('home')} replace />} />
        </Routes>
      </main>

      {/* 底部 Tab 栏 */}
      <MobileTabBar />

      {/* 侧边抽屉菜单 */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}

export default MobileLayout;
