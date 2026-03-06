import React, { lazy, Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { History, ChevronDown, LogIn, Lock } from 'lucide-react';
import Footer from './components/layout/Footer';
import EditItemModal from './components/modals/EditItemModal';
import GachaModals from './components/modals/GachaModals';
import { LoadingBar } from './components/ui';
import { useToast, useConfirm, useCloudSync, useCurrentPoolData, useNotificationBadges, useAppInitialization, usePoolOperations, useHistoryOperations, useDataExportImport, usePoolRealtimeSubscription, useUserRole } from './hooks';
import { useUIStore, useAuthStore, useAppStore, usePoolStore, useHistoryStore } from './stores';
import { DEFAULT_POOL_ID } from './constants';
import AppHeader from './components/layout/AppHeader';
import { extractDrawerFromPoolName } from './utils';
import { isPoolGroupId } from './stores/usePoolStore';

const HomePage = lazy(() => import('./components/home/HomePage'));
const GachaSimulator = lazy(() => import('./features/simulator/GachaSimulator'));
const SummaryView = lazy(() => import('./components/SummaryView'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const AboutPanel = lazy(() => import('./components/AboutPanel'));
const TicketPanel = lazy(() => import('./components/TicketPanel'));
const DashboardView = lazy(() => import('./components/dashboard/DashboardView'));
const RecordsView = lazy(() => import('./components/records/RecordsView'));

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

export default function GachaAnalyzer() {
  // --- 从 Zustand Stores 获取状态 ---

  // 认证状态
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const syncing = useAuthStore(state => state.syncing);
  const openAuthModal = useAuthStore(state => state.openAuthModal);

  // 应用全局状态
  const globalStatsLoading = useAppStore(state => state.globalStatsLoading);
  const announcements = useAppStore(state => state.announcements);

  // 卡池状态
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const switchPool = usePoolStore(state => state.switchPool);

  // 历史记录状态
  const history = useHistoryStore(state => state.history);

  const {
    poolsArray,
    currentPool,
    normalizedCurrentPoolHistory
  } = useCurrentPoolData();

  // UI 状态
  const activeTab = useUIStore(state => state.activeTab);
  const editItemState = useUIStore(state => state.editItemState);
  const setActiveTab = useUIStore(state => state.setActiveTab);
  const setEditItemState = useUIStore(state => state.setEditItemState);

  // 本地 UI 状态（仍然使用 useState）

  // UX-006: 通知气泡状态 - 使用 Hook
  const {
    hasNewAnnouncement,
    setHasNewAnnouncement,
    unreadTicketsCount,
    setUnreadTicketsCount
  } = useNotificationBadges();

  // 0.2 通用弹窗
  const { toasts, showToast, removeToast } = useToast();
  const { confirmState, handleConfirm, handleCancel } = useConfirm();

  // 云同步 Hook - 提供所有云端数据操作函数
  const {
    loadCloudData,
    loadPublicPools,
    savePoolToCloud,
    saveHistoryToCloud,
    deleteHistoryFromCloud,
    deletePoolHistoryFromCloud,
    deletePoolFromCloud,
    migrateLocalToCloud
  } = useCloudSync({ showToast });

  // 应用初始化 Hook - 处理会话、全局统计、last_seen 更新
  useAppInitialization({ loadCloudData, loadPublicPools });

  // 权限判断
  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  // 如果当前选中卡池ID无效，则回退到默认池
  // 使用 ref 和防抖防止快速切换时的竞态条件
  const pendingSwitchRef = useRef(null);
  const lastSwitchTimeRef = useRef(0);

  useEffect(() => {
    // 卡池列表为空时不做任何操作
    if (poolsArray.length === 0) {
      return;
    }

    // 当前选中的卡池存在，无需回退
    const exists = poolsArray.some(p => p.id === currentPoolId);
    // FEAT-018: 池组虚拟ID也视为有效，不回退
    if (exists || isPoolGroupId(currentPoolId)) {
      // 清除任何待处理的切换
      if (pendingSwitchRef.current) {
        clearTimeout(pendingSwitchRef.current);
        pendingSwitchRef.current = null;
      }
      return;
    }

    // currentPoolId 为空或无效，需要回退
    // 但要防止快速连续切换导致的循环
    const now = Date.now();
    const timeSinceLastSwitch = now - lastSwitchTimeRef.current;

    // 如果距离上次自动切换不到 500ms，跳过（防止循环）
    if (timeSinceLastSwitch < 500) {
      return;
    }

    // 清除之前的待处理切换
    if (pendingSwitchRef.current) {
      clearTimeout(pendingSwitchRef.current);
    }

    // 延迟执行回退，给用户操作留出时间
    pendingSwitchRef.current = setTimeout(() => {
      // 再次检查是否仍需要回退
      const stillMissing = !poolsArray.some(p => p.id === currentPoolId);
      if (stillMissing && currentPoolId) {
        const fallback = poolsArray.find(p => p.id === DEFAULT_POOL_ID) || poolsArray[0];
        if (fallback) {
          lastSwitchTimeRef.current = Date.now();
          switchPool(fallback.id);
        }
      }
      pendingSwitchRef.current = null;
    }, 100);

    return () => {
      if (pendingSwitchRef.current) {
        clearTimeout(pendingSwitchRef.current);
        pendingSwitchRef.current = null;
      }
    };
  }, [poolsArray, currentPoolId, switchPool]);

  // 当前卡池是否可编辑（锁定的卡池只有超管能改）
  const canEditCurrentPool = useMemo(() => {
    if (!canEdit) return false;
    if (currentPool?.locked && !isSuperAdmin) return false;
    return true;
  }, [canEdit, currentPool?.locked, isSuperAdmin]);

  // 获取所有已知的抽卡人列表
  const knownDrawers = useMemo(() => {
    const drawers = new Set();
    poolsArray.forEach(pool => {
      const drawer = extractDrawerFromPoolName(pool.name);
      if (drawer) {
        drawers.add(drawer);
      }
    });
    return Array.from(drawers).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [poolsArray]);

  // 组合 cloudSync 函数为对象，供其他 hooks 使用
  const cloudSync = {
    savePoolToCloud, saveHistoryToCloud,
    deletePoolFromCloud, deletePoolHistoryFromCloud, deleteHistoryFromCloud
  };

  // 卡池操作 Hook
  const {
    confirmCreatePool,
    confirmEditPool,
    confirmDeletePool,
    confirmDeleteData,
    deleteAllUserData
  } = usePoolOperations({ showToast, cloudSync });

  // 历史记录操作 Hook
  const {
    closeModalAndClear,
    handleUpdateItem,
    handleDeleteItem,
    confirmRealDeleteItem,
    handleDeleteGroup,
    confirmRealDeleteGroup
  } = useHistoryOperations({ showToast, cloudSync, currentPool });

  // 数据导入导出 Hook
  const {
    pendingImport,
    setPendingImport,
    handleExportJSON,
    handleExportCSV,
    handleImportFile,
    confirmImport
  } = useDataExportImport({ showToast, cloudSync, normalizedCurrentPoolHistory });

  // --- Effects ---

  // 检查导入后重定向
  useEffect(() => {
    const redirectTarget = sessionStorage.getItem('redirect_after_import');
    if (redirectTarget) {
      sessionStorage.removeItem('redirect_after_import');
      // 延迟一点确保页面渲染完成
      setTimeout(() => {
        setActiveTab(redirectTarget);
      }, 100);
    }
  }, [setActiveTab]);

  // 实时监听卡池变化
  usePoolRealtimeSubscription({ showToast });

  // 获取用户角色
  useUserRole();

  // 注意：公告加载和未读工单数量已移至 useNotificationBadges hook

  // 登出处理
  const signOut = useAuthStore(state => state.signOut);
  const handleLogout = async () => {
    await signOut();
  };

  // 迁移弹窗状态
  const [showMigrateModal, setShowMigrateModal] = useState(false);

  // 注意：历史记录和卡池列表不再保存到 localStorage，只存储在服务器端
  // 仅保留 UI 状态（当前选中卡池ID）在 localStorage

  useEffect(() => {
    localStorage.setItem('gacha_current_pool_id', currentPoolId);
  }, [currentPoolId]);

  // --- 组件 ---

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 font-sans pb-20 md:pb-10 relative">
      {/* 全局加载进度条 */}
      <LoadingBar isLoading={syncing || globalStatsLoading} />

      {/* 顶部导航 */}
      <AppHeader
        user={user}
        userRole={userRole}
        activeTab={activeTab}
        hasNewAnnouncement={hasNewAnnouncement}
        setHasNewAnnouncement={setHasNewAnnouncement}
        unreadTicketsCount={unreadTicketsCount}
        setUnreadTicketsCount={setUnreadTicketsCount}
        setActiveTab={setActiveTab}
        openAuthModal={openAuthModal}
        handleLogout={handleLogout}
      />

      <main className="w-full max-w-[1440px] mx-auto px-4 py-8">

        {activeTab === 'home' ? (
          <Suspense fallback={<TabPanelFallback label="正在加载首页..." />}>
            <HomePage user={user} canEdit={canEdit} announcements={announcements} />
          </Suspense>
        ) : activeTab === 'simulator' ? (
          <Suspense fallback={<TabPanelFallback label="正在加载模拟器..." />}>
            <GachaSimulator />
          </Suspense>
        ) : activeTab === 'summary' ? (
          <Suspense fallback={<TabPanelFallback label="正在加载统计..." />}>
            <SummaryView />
          </Suspense>
        ) : activeTab === 'admin' && isSuperAdmin ? (
          <Suspense fallback={<TabPanelFallback label="正在加载管理后台..." />}>
            <AdminPanel showToast={showToast} />
          </Suspense>
        ) : activeTab === 'settings' ? (
          <Suspense fallback={<TabPanelFallback label="正在加载设置..." />}>
            <SettingsPanel
              user={user}
            userRole={userRole}
            pools={pools}
            history={history}
            onDeleteAllData={deleteAllUserData}
          />
          </Suspense>
        ) : activeTab === 'about' ? (
          <Suspense fallback={<TabPanelFallback label="正在加载关于页..." />}>
            <AboutPanel />
          </Suspense>
        ) : activeTab === 'tickets' ? (
          <Suspense fallback={<TabPanelFallback label="正在加载工单..." />}>
            <TicketPanel user={user} userRole={userRole} showToast={showToast} />
          </Suspense>
        ) : (
          <>
            {/* 游客提示 - 未登录时显示 */}
            {!user && (
              <div className="mb-8 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-zinc-900 dark:to-zinc-950 border border-amber-200 dark:border-amber-900/50 rounded-none p-8 text-center">
                <div className="w-16 h-16 bg-endfield-yellow/20 dark:bg-endfield-yellow/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogIn size={32} className="text-amber-600 dark:text-endfield-yellow" />
                </div>
                <h3 className="font-bold text-xl text-slate-800 dark:text-zinc-100 mb-3">登录后即可导入抽卡数据</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">
                  注册并登录后，您可以导入自己的抽卡记录进行分析。
                  <br/>数据安全存储在云端，可在任意设备访问。
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={openAuthModal}
                    className="bg-endfield-yellow text-black hover:bg-yellow-400 font-bold uppercase tracking-wider px-6 py-3 rounded-none text-sm transition-colors shadow-lg shadow-yellow-500/20"
                  >
                    立即登录 / 注册
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-4">
                  已有账号？点击上方按钮登录
                </p>
              </div>
            )}

            {/* 卡池锁定提示 - 管理员但卡池被锁定 */}
            {user && canEdit && !canEditCurrentPool && (
              <div className="mb-8 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-none p-6 text-center">
                <Lock size={40} className="mx-auto text-amber-400 mb-3" />
                <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-2">此卡池已被锁定</h3>
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  卡池「{currentPool?.name}」已被超级管理员锁定，暂时无法编辑。
                  <br/>如需修改，请联系超级管理员解锁。
                </p>
              </div>
            )}

            {activeTab === 'dashboard' && user && (
              <div className="animate-fade-in">
                <Suspense fallback={<TabPanelFallback label="正在加载卡池分析..." />}>
                  <DashboardView />
                </Suspense>

                {/* 详细日志 - 默认折叠 */}
                <div className="mt-6">
                  <details className="group">
                    <summary className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                      <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                        <History size={18} /> 详细日志
                      </span>
                      <ChevronDown size={20} className="text-slate-400 dark:text-zinc-500 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-2">
                      <Suspense fallback={<TabPanelFallback label="正在加载详细日志..." />}>
                        <RecordsView
                          onEdit={setEditItemState}
                          onDeleteGroup={handleDeleteGroup}
                          onImportFile={handleImportFile}
                          onExportJSON={handleExportJSON}
                          onExportCSV={handleExportCSV}
                        />
                      </Suspense>
                    </div>
                  </details>
                </div>

                {/* 编辑弹窗 */}
                {editItemState && (
                  <EditItemModal
                    item={editItemState}
                    poolType={currentPool.type}
                    onClose={() => setEditItemState(null)}
                    onUpdate={handleUpdateItem}
                    onDelete={handleDeleteItem}
                  />
                )}
              </div>
            )}
        </>
      )}
      </main>

      {/* 全局页脚 */}
      <Footer />

      {/* --- 全局弹窗 --- */}
      <GachaModals
        knownDrawers={knownDrawers}
        showToast={showToast}
        toasts={toasts}
        removeToast={removeToast}
        confirmState={confirmState}
        handleConfirm={handleConfirm}
        handleCancel={handleCancel}
        closeModalAndClear={closeModalAndClear}
        confirmCreatePool={confirmCreatePool}
        confirmEditPool={confirmEditPool}
        confirmDeletePool={confirmDeletePool}
        confirmDeleteData={confirmDeleteData}
        confirmRealDeleteItem={confirmRealDeleteItem}
        confirmRealDeleteGroup={confirmRealDeleteGroup}
        pendingImport={pendingImport}
        setPendingImport={setPendingImport}
        confirmImport={confirmImport}
        showMigrateModal={showMigrateModal}
        setShowMigrateModal={setShowMigrateModal}
        migrateLocalToCloud={migrateLocalToCloud}
        canEdit={canEdit}
      />

      <style>{`
        /* 组件特有样式 - 通用动画已移至 index.css */
        .shine-effect-rainbow {
          background-image: linear-gradient(
            120deg,
            rgba(255,255,255,0) 30%,
            rgba(255, 215, 0, 0.5) 40%,
            rgba(255, 0, 128, 0.5) 50%,
            rgba(0, 255, 255, 0.5) 60%,
            rgba(255,255,255,0) 70%
          );
          background-size: 200% 100%;
          animation: shine 3s infinite linear;
        }

        .glow-border {
           box-shadow: 0 0 8px rgba(255, 165, 0, 0.6);
        }
      `}</style>
    </div>
  );
}
