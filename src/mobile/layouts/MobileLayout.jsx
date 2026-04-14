import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MobileHeader from '../components/MobileHeader';
import MobileTabBar from '../components/MobileTabBar';
import MobileDrawer from '../components/MobileDrawer';
import { getMobilePathForTab, getMobileTabFromPath } from '../../constants/appRoutes';

// 移动端视图
import MobileHomePageView from '../views/MobileHomePageView';
import MobileSummaryView from '../views/MobileSummaryView';
import MobileDashboardView from '../views/MobileDashboardView';
import MobileSimulatorView from '../views/MobileSimulatorView';
import MobileSettingsView from '../views/MobileSettingsView';
import MobileAboutView from '../views/MobileAboutView';
import MobileAdminView from '../views/MobileAdminView';
import MobileTicketView from '../views/MobileTicketView';
import useAuthStore from '../../stores/useAuthStore';
import { useScrollToHighlight } from '../../hooks/app/useScrollToHighlight';
import { useI18n } from '../../i18n/index.js';

/**
 * 移动端主布局
 */
function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userRole, authResolved } = useAuthStore();
  const { isEnglish } = useI18n();
  const activeTab = getMobileTabFromPath(location.pathname);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isSuperAdmin = userRole === 'super_admin';
  const isResolvingRole = !authResolved || (Boolean(user) && userRole === null);
  const tt = (zh, en) => (isEnglish ? en : zh);

  useScrollToHighlight();

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
          <Route index element={<MobileHomePageView />} />
          <Route path="summary" element={<MobileSummaryView />} />
          <Route path="dashboard" element={<MobileDashboardView />} />
          <Route path="simulator" element={<MobileSimulatorView />} />
          <Route path="settings" element={<MobileSettingsView />} />
          <Route path="about" element={<MobileAboutView />} />
          <Route
            path="admin"
            element={
              isResolvingRole ? (
                <div className="px-4 py-8">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 text-sm text-slate-500 dark:text-zinc-400">
                    {tt('正在校验管理权限...', 'Checking admin access...')}
                  </div>
                </div>
              ) : isSuperAdmin ? (
                <MobileAdminView />
              ) : (
                <Navigate to={getMobilePathForTab('home')} replace />
              )
            }
          />
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
