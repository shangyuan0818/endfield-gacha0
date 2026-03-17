import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, User, Moon, Sun, Monitor, Trash2, Lock, Cloud, RefreshCw,
  AlertTriangle, X, Database, LogOut, ChevronRight
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import usePoolStore from '../../stores/usePoolStore';
import useHistoryStore from '../../stores/useHistoryStore';
import { useCloudSync } from '../../hooks/app';
import { useToast } from '../../hooks';
import { supabase } from '../../supabaseClient';
import PlatformSwitcher from '../../components/common/PlatformSwitcher';
import { Toast } from '../../components/ui';
import { useTheme } from '../../contexts/ThemeContext';
import { APP_VERSION_LABEL } from '../../constants/appMeta';
import { deleteOwnAccount } from '../../services/selfAccountService';
import { finalizeDeletedAccountSession } from '../../utils/finalizeDeletedAccountSession';

function MobileSettingsSection({ title, icon, children }) {
  const IconComponent = icon;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center gap-2">
        <IconComponent size={14} className="text-zinc-400" />
        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">{title}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * 移动端设置视图 - 工业风重构版 (中文)
 */
function MobileSettingsView() {
  const navigate = useNavigate();
  const { themeMode, setThemeMode } = useTheme();
  const { user, signOut, logout, userRole, syncing, syncError, lastSyncAt } = useAuthStore();
  const { pools, setPools, currentPoolId, switchPool, switchGameAccount } = usePoolStore();
  const { history, setHistory } = useHistoryStore();
  const { toasts, showToast, removeToast } = useToast();
  const { syncToCloud, loadPublicPools, deleteUserDataFromCloud } = useCloudSync({ showToast });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const myPools = useMemo(() => {
    if (!pools || !user) return [];
    const poolsArray = Array.isArray(pools) ? pools : [];
    return poolsArray.filter(pool => pool.user_id === user.id);
  }, [pools, user]);

  const myHistory = useMemo(() => {
    if (!history || !user) return [];
    const historyArray = Array.isArray(history) ? history : [];
    return historyArray.filter(h => !h.user_id || h.user_id === user.id);
  }, [history, user]);

  const userPoolCount = myPools.length;
  const userHistoryCount = myHistory.length;

  const getRoleInfo = (role) => {
    switch (role) {
      case 'super_admin':
        return { label: '超级管理员', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400', desc: '系统级访问权限' };
      case 'admin':
        return { label: '管理员', color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400', desc: '数据维护权限' };
      default:
        return { label: '干员', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400', desc: '标准访问权限' };
    }
  };

  const roleInfo = getRoleInfo(userRole);
  const lastSyncLabel = useMemo(() => {
    if (!lastSyncAt) {
      return '尚未同步';
    }

    const parsed = new Date(lastSyncAt);
    if (Number.isNaN(parsed.getTime())) {
      return '尚未同步';
    }

    return parsed.toLocaleString('zh-CN');
  }, [lastSyncAt]);

  const handleManualSync = async () => {
    if (syncToCloud) {
      await syncToCloud();
    }
  };

  const resetPasswordModalState = () => {
    setPasswordError('');
    setPasswordSuccess('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handlePasswordReset = async () => {
    if (!user) {
      setPasswordError('当前未登录，无法修改密码');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('密码至少需要 6 位字符');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordSuccess('密码已更新。');
      setTimeout(() => {
        setShowPasswordModal(false);
        resetPasswordModalState();
      }, 2000);
    } catch (error) {
      setPasswordError(error.message || '修改失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== '确认删除') return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const historyArray = Array.isArray(history) ? history : [];
      const poolsArray = Array.isArray(pools) ? pools : [];
      const nextHistory = historyArray.filter((item) => item?.user_id && item.user_id !== user.id);
      const refreshedPublicPools = await deleteUserDataFromCloud()
        .then(() => loadPublicPools?.());
      const fallbackPools = poolsArray.filter((pool) => pool?.user_id !== user.id);
      const nextPools = Array.isArray(refreshedPublicPools) ? refreshedPublicPools : fallbackPools;

      setHistory(nextHistory);
      setPools(nextPools);

      if (!nextPools.some((pool) => pool?.id === currentPoolId)) {
        switchPool(nextPools[0]?.id || null);
      }

      setShowDeleteModal(false);
      setDeleteConfirmText('');
    } catch (error) {
      setDeleteError(error.message || '删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const resetDeleteAccountState = () => {
    setDeleteAccountLoading(false);
    setDeleteAccountError('');
    setDeleteAccountConfirmText('');
    setDeleteAccountPassword('');
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      setDeleteAccountError('当前未登录，无法注销账号');
      return;
    }

    if (deleteAccountConfirmText !== '确认注销账号') {
      setDeleteAccountError('请输入“确认注销账号”后再继续');
      return;
    }

    if (deleteAccountPassword.length < 6) {
      setDeleteAccountError('请输入当前密码以确认身份');
      return;
    }

    setDeleteAccountLoading(true);
    setDeleteAccountError('');

    try {
      await deleteOwnAccount(deleteAccountPassword);
      await finalizeDeletedAccountSession({
        loadPublicPools,
        setPools,
        setHistory,
        switchPool,
        switchGameAccount,
        logout,
      });
      showToast('账号已注销，当前会话已退出', 'success');
      navigate('/m', { replace: true });
    } catch (error) {
      setDeleteAccountError(error.message || '注销账号失败');
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const themeOptions = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 页面标题 */}
      <div className="bg-zinc-900 text-white p-4 border-l-4 border-endfield-yellow rounded-none shadow-md">
        <h1 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
          <Settings size={20} className="text-endfield-yellow" />
          系统设置
        </h1>
        <p className="text-[10px] text-zinc-400 mt-1 font-mono uppercase tracking-widest">配置与偏好</p>
      </div>

      {/* 账户信息 */}
      <MobileSettingsSection title="账户状态" icon={User}>
        {user ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {/* 用户头像和邮箱 */}
            <div className="p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-none bg-endfield-yellow flex items-center justify-center overflow-hidden border border-endfield-yellow shadow-sm">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="头像" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-black font-mono">
                    {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-lg">
                  {user.user_metadata?.full_name || '未命名用户'}
                </p>
                <p className="text-xs text-zinc-500 truncate font-mono uppercase tracking-wide">{user.email}</p>
                <div className="mt-2 inline-flex items-center px-2 py-0.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                  <span className={`text-[9px] font-bold uppercase ${roleInfo.color.split(' ')[0] === 'bg-red-100' ? 'text-red-500' : 'text-zinc-500'}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
            </div>

            {/* 修改密码 */}
            <button
              onClick={() => {
                resetPasswordModalState();
                setShowPasswordModal(true);
              }}
              className="w-full px-4 py-3 flex items-center justify-between touch-feedback hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock size={16} className="text-zinc-400" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">修改密码</span>
              </div>
              <ChevronRight size={16} className="text-zinc-300" />
            </button>
          </div>
        ) : (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/50">
            <User size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-xs text-zinc-500 uppercase tracking-widest">需要身份验证</p>
          </div>
        )}
      </MobileSettingsSection>

      {/* 外观设置 */}
      <MobileSettingsSection title="显示界面" icon={Monitor}>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = themeMode === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setThemeMode(option.value)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 border transition-all touch-feedback rounded-none ${
                    isActive
                      ? 'border-endfield-yellow bg-endfield-yellow/10 shadow-[inset_0_0_0_1px_rgba(255,250,0,0.5)]'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-endfield-yellow' : 'text-zinc-400'} strokeWidth={1.5} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-zinc-900 dark:text-endfield-yellow' : 'text-zinc-500'}`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </MobileSettingsSection>

      {/* 平台切换 */}
      <MobileSettingsSection title="系统平台" icon={Monitor}>
        <div className="p-4">
          <PlatformSwitcher className="w-full justify-center py-2.5 rounded-none" />
          <p className="text-[10px] text-zinc-400 text-center mt-2 font-mono uppercase">
            切换到桌面端以获得完整功能
          </p>
        </div>
      </MobileSettingsSection>

      {/* 数据管理 */}
      {user && (
        <MobileSettingsSection title="数据管理" icon={Database}>
          <div className="p-4 space-y-4">
            {/* 数据统计 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-none">
                <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{userPoolCount}</div>
                <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mt-1">创建卡池</div>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-none">
                <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{userHistoryCount}</div>
                <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mt-1">总记录数</div>
              </div>
            </div>

            {/* 云端同步 */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">云端同步</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">上次同步: {lastSyncLabel}</p>
                </div>
                <button
                  onClick={handleManualSync}
                  disabled={syncing || (userPoolCount === 0 && userHistoryCount === 0)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 transition-colors rounded-none"
                >
                  {syncing ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      同步中...
                    </>
                  ) : (
                    <>
                      <Cloud size={12} />
                      立即同步
                    </>
                  )}
                </button>
              </div>
              {syncError && (
                <p className="mt-2 text-[10px] text-red-500 font-mono">
                  最近一次同步错误: {syncError}
                </p>
              )}
            </div>

            {/* 删除数据 */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-500 uppercase">危险区域</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">仅删除当前账号的抽卡数据，不删除账号本身</p>
                </div>
                <button
                  onClick={() => {
                    setDeleteError('');
                    setShowDeleteModal(true);
                  }}
                  disabled={userPoolCount === 0 && userHistoryCount === 0}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 transition-colors rounded-none"
                >
                  <Trash2 size={12} />
                  删除我的数据
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-500 uppercase">注销账号</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    永久删除当前账号、抽卡记录与自建卡池。管理员账号不支持自助注销。
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetDeleteAccountState();
                    setShowDeleteAccountModal(true);
                  }}
                  disabled={userRole === 'admin' || userRole === 'super_admin'}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 transition-colors rounded-none"
                >
                  <Trash2 size={12} />
                  注销账号
                </button>
              </div>
              {(userRole === 'admin' || userRole === 'super_admin') && (
                <p className="mt-2 text-[10px] text-zinc-500 font-mono">
                  管理员账号请使用超管流程删除，不提供自助注销。
                </p>
              )}
            </div>
          </div>
        </MobileSettingsSection>
      )}

      {/* 退出登录 */}
      {user && (
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 font-bold uppercase tracking-widest touch-feedback transition-colors rounded-none text-xs"
        >
          <LogOut size={16} />
          退出登录
        </button>
      )}

      {/* 版本信息 */}
      <div className="text-center py-6">
        <div className="w-8 h-1 bg-zinc-200 dark:bg-zinc-800 mx-auto mb-3" />
        <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">终末地抽卡分析器</p>
        <p className="text-[10px] text-zinc-500 mt-1 font-mono">{APP_VERSION_LABEL}</p>
      </div>

      {/* 底部留白 */}
      <div className="h-4" />

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm overflow-hidden animate-scale-up rounded-none shadow-2xl border border-zinc-700">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 uppercase tracking-wide text-sm">
                <Lock size={16} />
                修改密码
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  resetPasswordModalState();
                }}
                className="p-1 touch-feedback hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={18} className="text-zinc-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {passwordError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 text-xs flex items-start gap-2 rounded-none">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-3 py-2 text-xs flex items-start gap-2 rounded-none">
                  <Lock size={14} className="shrink-0 mt-0.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    新密码
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="至少 6 位字符"
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:border-endfield-yellow outline-none text-sm font-mono rounded-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="再次输入新密码"
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:border-endfield-yellow outline-none text-sm font-mono rounded-none"
                  />
                  {confirmNewPassword && newPassword !== confirmNewPassword && (
                    <p className="mt-2 text-[10px] text-red-500">两次输入的密码不一致。</p>
                  )}
                </div>
              </div>

              <button
                onClick={handlePasswordReset}
                disabled={passwordLoading || !!passwordSuccess}
                className="w-full bg-endfield-yellow hover:bg-yellow-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-black font-bold py-3 text-xs uppercase tracking-widest touch-feedback disabled:opacity-50 rounded-none transition-colors"
              >
                {passwordLoading ? '修改中...' : passwordSuccess ? '已更新' : '更新密码'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除数据确认弹窗 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm overflow-hidden animate-scale-up rounded-none shadow-2xl border-2 border-red-500">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-4 rounded-none border border-red-200 dark:border-red-800">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-1 uppercase tracking-wide">确认删除</h3>
              <p className="text-xs text-zinc-500 mb-4 font-mono">此操作无法撤销</p>
              {deleteError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 text-xs flex items-start gap-2 rounded-none mb-4">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}
              
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-3 mb-4 text-left rounded-none">
                <p className="text-[10px] text-red-400 uppercase font-bold mb-2">目标数据:</p>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 font-mono">
                  <li>[x] {userPoolCount} 个我创建的卡池</li>
                  <li>[x] {userHistoryCount} 条我的记录</li>
                </ul>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                公开共享卡池会保留，您的账号不会被删除。
              </p>
              
              <p className="text-xs text-zinc-500 mb-3">
                输入 "<span className="text-red-500 font-bold">确认删除</span>" 以确认:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder='确认删除'
                className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:border-red-500 outline-none mb-4 text-sm font-mono rounded-none"
              />
            </div>
            <div className="flex border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                className="flex-1 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 touch-feedback uppercase tracking-wider"
              >
                取消
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteConfirmText !== '确认删除' || deleteLoading}
                className="flex-1 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 touch-feedback disabled:opacity-50 uppercase tracking-wider transition-colors"
              >
                {deleteLoading ? '删除中...' : '删除我的数据'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-none shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-red-50 dark:bg-red-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">注销当前账号</span>
              </div>
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  resetDeleteAccountState();
                }}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {deleteAccountError && (
                <div className="px-3 py-2 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/10 text-red-600 dark:text-red-400 text-xs">
                  {deleteAccountError}
                </div>
              )}

              <div className="px-3 py-3 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/10 text-xs text-red-700 dark:text-red-300 space-y-1">
                <p>• 当前账号将被永久删除</p>
                <p>• 当前账号名下的抽卡记录与自建卡池会一起删除</p>
                <p>• 删除后无法恢复，请先导出需要保留的数据</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  当前密码
                </label>
                <input
                  type="password"
                  value={deleteAccountPassword}
                  onChange={(event) => setDeleteAccountPassword(event.target.value)}
                  placeholder="输入当前密码"
                  className="w-full px-3 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 rounded-none focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  确认短语
                </label>
                <input
                  type="text"
                  value={deleteAccountConfirmText}
                  onChange={(event) => setDeleteAccountConfirmText(event.target.value)}
                  placeholder='请输入“确认注销账号”'
                  className="w-full px-3 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 rounded-none focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  resetDeleteAccountState();
                }}
                className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
              >
                取消
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading || deleteAccountConfirmText !== '确认注销账号'}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {deleteAccountLoading ? '注销中...' : '确认注销'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default MobileSettingsView;
