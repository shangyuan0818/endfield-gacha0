import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DesktopDashboardWorkspace from './DesktopDashboardWorkspace';
import { useI18n } from '../../i18n/index.js';

const HomePage = lazy(() => import('../home/HomePage'));
const GachaSimulator = lazy(() => import('../../features/simulator/GachaSimulator'));
const SummaryView = lazy(() => import('../SummaryView'));
const AdminPanel = lazy(() => import('../AdminPanel'));
const SettingsPanel = lazy(() => import('../SettingsPanel'));
const AboutPanel = lazy(() => import('../AboutPanel'));
const TicketPanel = lazy(() => import('../TicketPanel'));
const TimelineConceptDemo = lazy(() => import('../demo/TimelineConceptDemo'));

function TabPanelFallback({ label = '正在加载模块...' }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none p-10 text-center animate-fade-in">
      <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-zinc-400">
        <div className="w-4 h-4 border-2 border-slate-300 dark:border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function DesktopAppRoutes({
  user,
  userRole,
  authResolved,
  showToast,
  isSuperAdmin,
  currentPool,
  canEdit,
  canEditCurrentPool,
  deleteAllUserData,
  editItemState,
  setEditItemState,
  handleUpdateItem,
  handleDeleteItem,
  handleDeleteGroup,
  handleImportFile,
  handleExportJSON,
  handleExportCSV
}) {
  const { isEnglish } = useI18n();
  const tt = (zh, en) => (isEnglish ? en : zh);
  const isResolvingRole = !authResolved || (Boolean(user) && userRole === null);

  return (
    <Routes>
      <Route
        index
        element={
          <Suspense fallback={<TabPanelFallback label={tt('正在加载首页...', 'Loading home...')} />}>
            <HomePage />
          </Suspense>
        }
      />
      <Route
        path="summary"
        element={
          <Suspense fallback={<TabPanelFallback label={tt('正在加载统计...', 'Loading summary...')} />}>
            <SummaryView />
          </Suspense>
        }
      />
      <Route
        path="dashboard"
        element={
          <DesktopDashboardWorkspace
            user={user}
            showToast={showToast}
            canEdit={canEdit}
            canEditCurrentPool={canEditCurrentPool}
            currentPool={currentPool}
            editItemState={editItemState}
            setEditItemState={setEditItemState}
            handleUpdateItem={handleUpdateItem}
            handleDeleteItem={handleDeleteItem}
            handleDeleteGroup={handleDeleteGroup}
            handleImportFile={handleImportFile}
            handleExportJSON={handleExportJSON}
            handleExportCSV={handleExportCSV}
          />
        }
      />
      <Route
        path="simulator"
        element={
          <Suspense fallback={<TabPanelFallback label={tt('正在加载模拟器...', 'Loading simulator...')} />}>
            <GachaSimulator />
          </Suspense>
        }
      />
      <Route
        path="timeline-demo"
        element={
          <Suspense fallback={<TabPanelFallback label={tt('正在加载时间线 Demo...', 'Loading timeline demo...')} />}>
            <TimelineConceptDemo />
          </Suspense>
        }
      />
      <Route
        path="settings"
        element={
          <Suspense fallback={<TabPanelFallback label={tt('正在加载设置...', 'Loading settings...')} />}>
            <SettingsPanel onDeleteAllData={deleteAllUserData} />
          </Suspense>
        }
      />
      <Route
        path="about"
        element={
          <Suspense fallback={<TabPanelFallback label={tt('正在加载关于页...', 'Loading about...')} />}>
            <AboutPanel />
          </Suspense>
        }
      />
      <Route
        path="tickets"
        element={
          <Suspense fallback={<TabPanelFallback label={tt('正在加载工单...', 'Loading tickets...')} />}>
            <TicketPanel user={user} userRole={userRole} showToast={showToast} />
          </Suspense>
        }
      />
      <Route
        path="admin"
        element={
          isResolvingRole ? (
            <TabPanelFallback label={tt('正在校验管理权限...', 'Checking admin access...')} />
          ) : isSuperAdmin ? (
            <Suspense fallback={<TabPanelFallback label={tt('正在加载管理后台...', 'Loading admin panel...')} />}>
              <AdminPanel showToast={showToast} />
            </Suspense>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
