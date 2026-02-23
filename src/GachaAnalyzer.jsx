import React, { useState, useMemo, useEffect, useRef } from 'react';
import { History, ChevronDown, LogIn, Lock } from 'lucide-react';
import { supabase } from './supabaseClient';
import { TicketPanel, AboutPanel, SummaryView, AdminPanel, SettingsPanel, RecordsView, DashboardView, EditItemModal, HomePage, Footer, GachaModals } from './components';
import GachaSimulator from './features/simulator/GachaSimulator';
import { LoadingBar } from './components/ui';
import { useToast, useConfirm, useCloudSync, useNotificationBadges, useAppInitialization, usePoolStats, usePoolOperations, useHistoryOperations, useDataExportImport, usePoolRealtimeSubscription, useUserRole } from './hooks';
import { useUIStore, useAuthStore, useAppStore, usePoolStore, useHistoryStore } from './stores';
import { DEFAULT_POOL_ID } from './constants';
import AppHeader from './components/layout/AppHeader';
import { extractDrawerFromPoolName, normalizeIsStandard } from './utils';

export default function GachaAnalyzer({ themeMode, setThemeMode }) {
  // 检测暗色模式
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // --- 从 Zustand Stores 获取状态 ---

  // 认证状态
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const showAuthModal = useAuthStore(state => state.showAuthModal);
  const syncing = useAuthStore(state => state.syncing);
  const syncError = useAuthStore(state => state.syncError);
  const setUser = useAuthStore(state => state.setUser);
  const setUserRole = useAuthStore(state => state.setUserRole);
  const toggleAuthModal = useAuthStore(state => state.toggleAuthModal);
  const openAuthModal = useAuthStore(state => state.openAuthModal);
  const closeAuthModal = useAuthStore(state => state.closeAuthModal);
  const setSyncing = useAuthStore(state => state.setSyncing);
  const setSyncError = useAuthStore(state => state.setSyncError);

  // 应用全局状态
  const globalStats = useAppStore(state => state.globalStats);
  const globalStatsLoading = useAppStore(state => state.globalStatsLoading);
  const announcements = useAppStore(state => state.announcements);
  const showApplyModal = useAppStore(state => state.showApplyModal);
  const applicationStatus = useAppStore(state => state.applicationStatus);
  const setAnnouncements = useAppStore(state => state.setAnnouncements);
  const toggleApplyModal = useAppStore(state => state.toggleApplyModal);
  const setApplicationStatus = useAppStore(state => state.setApplicationStatus);

  // 卡池状态
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);

  // 确保 pools 始终是数组
  const poolsArray = Array.isArray(pools) ? pools : [];
  const poolSearchQuery = usePoolStore(state => state.poolSearchQuery);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const setPoolSearchQuery = usePoolStore(state => state.setPoolSearchQuery);
  const createPool = usePoolStore(state => state.createPool);
  const deletePool = usePoolStore(state => state.deletePool);
  const updatePool = usePoolStore(state => state.updatePool);

  // 历史记录状态
  const history = useHistoryStore(state => state.history);
  const manualPityLimit = useHistoryStore(state => state.manualPityLimit);
  const visibleHistoryCount = useHistoryStore(state => state.visibleHistoryCount);
  const historyFilter = useHistoryStore(state => state.historyFilter);
  const setHistory = useHistoryStore(state => state.setHistory);
  const setManualPityLimit = useHistoryStore(state => state.setManualPityLimit);
  const setVisibleHistoryCount = useHistoryStore(state => state.setVisibleHistoryCount);
  const setHistoryFilter = useHistoryStore(state => state.setHistoryFilter);

  // UI 状态
  const activeTab = useUIStore(state => state.activeTab);
  const modalState = useUIStore(state => state.modalState);
  const setModalState = useUIStore(state => state.setModalState);
  const newPoolNameInput = useUIStore(state => state.newPoolNameInput);
  const newPoolTypeInput = useUIStore(state => state.newPoolTypeInput);
  const isLimitedWeaponPool = useUIStore(state => state.isLimitedWeaponPool);
  const drawerName = useUIStore(state => state.drawerName);
  const selectedCharName = useUIStore(state => state.selectedCharName);
  const editItemState = useUIStore(state => state.editItemState);
  const setActiveTab = useUIStore(state => state.setActiveTab);
  const openModal = useUIStore(state => state.openModal);
  const closeModal = useUIStore(state => state.closeModal);
  const setNewPoolNameInput = useUIStore(state => state.setNewPoolNameInput);
  const setNewPoolTypeInput = useUIStore(state => state.setNewPoolTypeInput);
  const setIsLimitedWeaponPool = useUIStore(state => state.setIsLimitedWeaponPool);
  const setDrawerName = useUIStore(state => state.setDrawerName);
  const setSelectedCharName = useUIStore(state => state.setSelectedCharName);
  const setEditItemState = useUIStore(state => state.setEditItemState);

  // 本地 UI 状态（仍然使用 useState）

  // UX-006: 通知气泡状态 - 使用 Hook
  const {
    pendingApplicationsCount,
    setPendingApplicationsCount,
    hasNewAnnouncement,
    setHasNewAnnouncement,
    unreadTicketsCount,
    setUnreadTicketsCount
  } = useNotificationBadges();

  // 0.2 通用弹窗
  const { toasts, showToast, removeToast } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  // 云同步 Hook - 提供所有云端数据操作函数
  const {
    loadCloudData,
    savePoolToCloud,
    saveHistoryToCloud,
    deleteHistoryFromCloud,
    deletePoolHistoryFromCloud,
    deletePoolFromCloud,
    migrateLocalToCloud,
    handlePostLogin,
    handleManualSync
  } = useCloudSync({ showToast });

  // 应用初始化 Hook - 处理会话、全局统计、last_seen 更新
  const { fetchGlobalStats, updateLastSeen } = useAppInitialization({ loadCloudData });

  // 权限判断
  const canEdit = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  // 当前卡池对象（从 stores 计算）
  const currentPool = useMemo(() => {
    const byId = poolsArray.find(p => p.id === currentPoolId);
    if (byId) return byId;
    const defaultPool = poolsArray.find(p => p.id === DEFAULT_POOL_ID);
    if (defaultPool) return defaultPool;
    if (poolsArray[0]) return poolsArray[0];
    // 如果没有任何卡池，返回一个默认对象
    return { id: DEFAULT_POOL_ID, name: '默认卡池', type: 'limited', locked: false };
  }, [poolsArray, currentPoolId]);

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
    if (exists) {
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

  // 当前选中的游戏账号
  const currentGameUid = usePoolStore(state => state.currentGameUid);

  // 当前卡池的历史记录（只显示当前用户的数据，按游戏账号过滤）
  const currentPoolHistory = useMemo(() => {
    if (!currentPool) return [];
    // 只显示当前用户的数据
    // 游客无法看到任何数据，登录用户只能看到自己的数据
    if (!user) return [];
    let filtered = (history || []).filter(h => h.poolId === currentPoolId && h.user_id === user.id);
    // 按游戏账号过滤（支持多账号：官服/B服）
    if (currentGameUid) {
      filtered = filtered.filter(h => h.game_uid === currentGameUid || h.gameUid === currentGameUid);
    }
    return filtered;
  }, [history, currentPoolId, currentPool, user, currentGameUid]);

  // 归一化当前卡池历史的 isStandard（基于 UP 角色匹配重新计算，不信任数据库原值）
  const normalizedCurrentPoolHistory = useMemo(() => {
    const poolType = currentPool?.type;
    const upCharacter = currentPool?.up_character;

    return currentPoolHistory.map(h => ({
      ...h,
      isStandard: normalizeIsStandard(h, poolType, upCharacter)
    }));
  }, [currentPoolHistory, currentPool?.type, currentPool?.up_character]);

  // 卡池统计 Hook - 统计计算、分组历史、保底计算
  const {
    currentPoolHistoryWithIndex,
    groupedHistory,
    filteredGroupedHistory,
    stats,
    inheritedPityInfo,
    effectivePity
  } = usePoolStats({ normalizedCurrentPoolHistory, currentPool });

  // 组合 cloudSync 函数为对象，供其他 hooks 使用
  const cloudSync = {
    savePoolToCloud, saveHistoryToCloud,
    deletePoolFromCloud, deletePoolHistoryFromCloud, deleteHistoryFromCloud
  };

  // 卡池操作 Hook
  const {
    confirmCreatePool,
    openEditPoolModal,
    confirmEditPool,
    togglePoolLock,
    openDeletePoolModal,
    confirmDeletePool,
    openDeleteConfirmModal,
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
  } = useHistoryOperations({ showToast, cloudSync });

  // 数据导入导出 Hook
  const {
    pendingImport,
    setPendingImport,
    handleExportJSON,
    handleExportCSV,
    handleImportFile,
    confirmImport
  } = useDataExportImport({ showToast, cloudSync, normalizedCurrentPoolHistory });

  // 文件上传 Ref
  const fileInputRef = useRef(null);

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

  // 获取用户角色和申请状态
  useUserRole();

  // 注意：公告加载、待审批申请数量、未读工单数量已移至 useNotificationBadges hook

  // 登出处理
  const signOut = useAuthStore(state => state.signOut);
  const handleLogout = async () => {
    await signOut();
    setApplicationStatus(null);
  };

  // 提交管理员申请
  const handleApplyAdmin = async (reason) => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('admin_applications')
        .insert({
          user_id: user.id,
          reason: reason
        });

      if (error) throw error;
      setApplicationStatus('pending');
      setShowApplyModal(false);
      return true;
    } catch (error) {
      return false;
    }
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
        applicationStatus={applicationStatus}
        activeTab={activeTab}
        hasNewAnnouncement={hasNewAnnouncement}
        setHasNewAnnouncement={setHasNewAnnouncement}
        pendingApplicationsCount={pendingApplicationsCount}
        unreadTicketsCount={unreadTicketsCount}
        setUnreadTicketsCount={setUnreadTicketsCount}
        setActiveTab={setActiveTab}
        openAuthModal={openAuthModal}
        handleLogout={handleLogout}
      />

      <main className="w-full max-w-[1440px] mx-auto px-4 py-8">

        {activeTab === 'home' ? (
          <HomePage user={user} canEdit={canEdit} announcements={announcements} />
        ) : activeTab === 'simulator' ? (
          <GachaSimulator />
        ) : activeTab === 'summary' ? (
          <SummaryView history={history} pools={pools} globalStats={globalStats} globalStatsLoading={globalStatsLoading} user={user} />
        ) : activeTab === 'admin' && isSuperAdmin ? (
          <AdminPanel showToast={showToast} />
        ) : activeTab === 'settings' ? (
          <SettingsPanel
            user={user}
            userRole={userRole}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            pools={pools}
            history={history}
            onDeleteAllData={deleteAllUserData}
            onManualSync={handleManualSync}
            syncing={syncing}
          />
        ) : activeTab === 'about' ? (
          <AboutPanel />
        ) : activeTab === 'tickets' ? (
          <TicketPanel user={user} userRole={userRole} showToast={showToast} />
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
                <DashboardView
                  currentPool={currentPool}
                  stats={stats}
                  effectivePity={effectivePity}
                />

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
                      <RecordsView
                        filteredGroupedHistory={filteredGroupedHistory}
                        currentPool={currentPool}
                        canEditCurrentPool={canEditCurrentPool}
                        onEdit={setEditItemState}
                        onDeleteGroup={handleDeleteGroup}
                        onImportFile={handleImportFile}
                        onExportJSON={handleExportJSON}
                        onExportCSV={handleExportCSV}
                      />
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
        handleApplyAdmin={handleApplyAdmin}
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