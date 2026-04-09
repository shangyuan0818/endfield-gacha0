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
import LocaleSwitcher from '../../components/common/LocaleSwitcher.jsx';
import { Toast } from '../../components/ui';
import { useTheme } from '../../contexts/ThemeContext';
import { APP_VERSION_LABEL } from '../../constants/appMeta';
import { deleteOwnAccount } from '../../services/selfAccountService';
import { finalizeDeletedAccountSession } from '../../utils/finalizeDeletedAccountSession';
import {
  formatFreshnessAbsolute,
  formatFreshnessRelative,
  getFreshnessTone
} from '../../utils/dataFreshness.js';
import { useI18n } from '../../i18n/index.js';

function getFreshnessToneClasses(tone) {
  switch (tone) {
    case 'fresh':
      return 'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'notice':
      return 'border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
    case 'stale':
      return 'border-red-500/40 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400';
  }
}

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
  const { t, locale, formatDateTime } = useI18n();
  const { themeMode, setThemeMode } = useTheme();
  const { user, signOut, logout, userRole, syncing, syncError, lastSyncAt } = useAuthStore();
  const { pools, setPools, currentPoolId, currentGameUid, switchPool, switchGameAccount } = usePoolStore();
  const { history, setHistory, getGameAccountsFromHistory } = useHistoryStore();
  const { toasts, showToast, removeToast } = useToast();
  const { syncToCloud, loadPublicPools, deleteUserDataFromCloud } = useCloudSync({ showToast });
  const deletePhrase = t('settings.deletePhrase');
  const deleteAccountPhrase = t('settings.deleteAccountPhrase');

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
  const gameAccounts = useMemo(() => getGameAccountsFromHistory(), [getGameAccountsFromHistory, history]);

  const getRoleInfo = (role) => {
    switch (role) {
      case 'super_admin':
        return {
          label: t('settings.role.super_admin.label'),
          badgeClass: 'border-red-200 dark:border-red-900/50 bg-red-100 dark:bg-red-900/30',
          textClass: 'text-red-600 dark:text-red-400',
        };
      case 'admin':
        return {
          label: t('settings.role.admin.label'),
          badgeClass: 'border-green-200 dark:border-green-900/50 bg-green-100 dark:bg-green-900/30',
          textClass: 'text-green-600 dark:text-green-400',
        };
      default:
        return {
          label: t('settings.role.user.label'),
          badgeClass: 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800',
          textClass: 'text-zinc-600 dark:text-zinc-400',
        };
    }
  };

  const roleInfo = getRoleInfo(userRole);
  const lastSyncLabel = useMemo(() => {
    return formatDateTime(lastSyncAt, {}, t('settings.syncNever'));
  }, [formatDateTime, lastSyncAt, t]);

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
      setPasswordError(t('settings.error.notLoggedInPassword'));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(t('settings.error.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('settings.error.passwordMismatch'));
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

      setPasswordSuccess(t('settings.success.passwordUpdated'));
      setTimeout(() => {
        setShowPasswordModal(false);
        resetPasswordModalState();
      }, 2000);
    } catch (error) {
      setPasswordError(error.message || t('settings.error.passwordUpdateFailed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== deletePhrase) return;
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
      setDeleteError(error.message || t('settings.error.deleteDataFailed'));
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
      setDeleteAccountError(t('settings.error.notLoggedInDeleteAccount'));
      return;
    }

    if (deleteAccountConfirmText !== deleteAccountPhrase) {
      setDeleteAccountError(t('settings.error.confirmDeleteAccount'));
      return;
    }

    if (deleteAccountPassword.length < 6) {
      setDeleteAccountError(t('settings.error.currentPasswordRequired'));
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
      showToast(t('settings.success.deleteAccount'), 'success');
      navigate('/m', { replace: true });
    } catch (error) {
      setDeleteAccountError(error.message || t('settings.error.deleteAccountFailed'));
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const themeOptions = [
    { value: 'light', label: t('settings.theme.light'), icon: Sun },
    { value: 'dark', label: t('settings.theme.dark'), icon: Moon },
    { value: 'system', label: t('settings.theme.system'), icon: Monitor },
  ];

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 页面标题 */}
      <div className="bg-zinc-900 text-white p-4 border-l-4 border-endfield-yellow rounded-none shadow-md">
        <h1 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
          <Settings size={20} className="text-endfield-yellow" />
          {t('settings.pageTitle')}
        </h1>
        <p className="text-[10px] text-zinc-400 mt-1 font-mono uppercase tracking-widest">{t('settings.pageSubtitle')}</p>
      </div>

      {/* 账户信息 */}
      <MobileSettingsSection title={t('settings.accountSection')} icon={User}>
        {user ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {/* 用户头像和邮箱 */}
            <div className="p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-none bg-endfield-yellow flex items-center justify-center overflow-hidden border border-endfield-yellow shadow-sm">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata?.full_name || user.email || t('settings.mobile.unnamedUser')}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-black font-mono">
                    {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-lg">
                  {user.user_metadata?.full_name || t('settings.mobile.unnamedUser')}
                </p>
                <p className="text-xs text-zinc-500 truncate font-mono uppercase tracking-wide">{user.email}</p>
                <div className={`mt-2 inline-flex items-center px-2 py-0.5 border ${roleInfo.badgeClass}`}>
                  <span className={`text-[9px] font-bold uppercase ${roleInfo.textClass}`}>
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
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('settings.changePassword')}</span>
              </div>
              <ChevronRight size={16} className="text-zinc-300" />
            </button>
          </div>
        ) : (
          <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/50">
            <User size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <p className="text-xs text-zinc-500 uppercase tracking-widest">{t('settings.mobile.authRequired')}</p>
          </div>
        )}
      </MobileSettingsSection>

      {/* 外观设置 */}
      <MobileSettingsSection title={t('settings.appearanceSection')} icon={Monitor}>
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

      <MobileSettingsSection title={t('settings.languageSection')} icon={Monitor}>
        <div className="p-4 space-y-3">
          <p className="text-[10px] text-zinc-500 text-center font-mono">
            {t('language.description')}
          </p>
          <div className="flex justify-center">
            <LocaleSwitcher />
          </div>
        </div>
      </MobileSettingsSection>

      {/* 平台切换 */}
      <MobileSettingsSection title={t('settings.platformSection')} icon={Monitor}>
        <div className="p-4">
          <PlatformSwitcher className="w-full justify-center py-2.5 rounded-none" />
          <p className="text-[10px] text-zinc-400 text-center mt-2 font-mono uppercase">
            {t('settings.mobile.platformHint')}
          </p>
        </div>
      </MobileSettingsSection>

      {/* 数据管理 */}
      {user && (
        <MobileSettingsSection title={t('settings.dataSection')} icon={Database}>
          <div className="p-4 space-y-4">
            {/* 数据统计 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-none">
                <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{userPoolCount}</div>
                <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mt-1">{t('settings.createdPools')}</div>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-none">
                <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{userHistoryCount}</div>
                <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider mt-1">{t('settings.historyRecords')}</div>
              </div>
            </div>

            {/* 云端同步 */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t('settings.syncSection')}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">{t('settings.lastSync', { value: lastSyncLabel })}</p>
                </div>
                <button
                  onClick={handleManualSync}
                  disabled={syncing || (userPoolCount === 0 && userHistoryCount === 0)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 transition-colors rounded-none"
                >
                  {syncing ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      {t('settings.syncing')}
                    </>
                  ) : (
                    <>
                      <Cloud size={12} />
                      {t('settings.syncAction')}
                    </>
                  )}
                </button>
              </div>
              {syncError && (
                <p className="mt-2 text-[10px] text-red-500 font-mono">
                  {t('settings.lastSyncError', { value: syncError })}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t('settings.importFreshnessTitle')}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                  {t('settings.importFreshnessDesc')}
                </p>
              </div>

              {gameAccounts.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {gameAccounts.map((account) => (
                    <div
                      key={account.gameUid}
                      className={`border px-3 py-3 ${
                        currentGameUid === account.gameUid
                          ? 'border-endfield-yellow bg-endfield-yellow/5'
                          : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{account.nickName}</span>
                            {account.serverTag && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                {account.serverTag}
                              </span>
                            )}
                            {currentGameUid === account.gameUid && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-endfield-yellow/15 text-amber-700 dark:text-endfield-yellow">
                                {t('settings.currentAccount')}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-500">
                            {t('settings.uidRecordCount', { uid: account.gameUid, count: account.recordCount })}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-[10px] font-bold border whitespace-nowrap ${getFreshnessToneClasses(getFreshnessTone(account.lastImportedAt))}`}>
                          {formatFreshnessRelative(account.lastImportedAt, t('common.importTimeUnknown'), locale)}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        <div>{t('settings.lastImport', { value: formatFreshnessAbsolute(account.lastImportedAt, t('common.unknown'), locale) })}</div>
                        <div>{t('settings.latestRecord', { value: formatFreshnessAbsolute(account.latestRecordAt, t('common.unknown'), locale) })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 border border-dashed border-zinc-200 dark:border-zinc-700 px-3 py-3 text-[10px] font-mono text-zinc-500 dark:text-zinc-500">
                  {t('settings.noImportedAccounts')}
                </div>
              )}
            </div>

            {/* 删除数据 */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-500 uppercase">{t('settings.dangerSection')}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{t('settings.deleteDataDesc')}</p>
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
                  {t('settings.deleteMyData')}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-500 uppercase">{t('settings.deleteAccountTitle')}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {t('settings.deleteAccountDesc')}
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
                  {t('settings.confirmDeleteAccountAction')}
                </button>
              </div>
              {(userRole === 'admin' || userRole === 'super_admin') && (
                <p className="mt-2 text-[10px] text-zinc-500 font-mono">
                  {t('settings.adminDeleteAccountHint')}
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
          {t('nav.logout')}
        </button>
      )}

      {/* 版本信息 */}
      <div className="text-center py-6">
        <div className="w-8 h-1 bg-zinc-200 dark:bg-zinc-800 mx-auto mb-3" />
        <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">{t('app.brand')}</p>
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
                {t('settings.passwordModalTitle')}
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
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder={t('settings.newPasswordPlaceholder')}
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:border-endfield-yellow outline-none text-sm font-mono rounded-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    {t('settings.confirmNewPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder={t('settings.confirmNewPasswordPlaceholder')}
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:border-endfield-yellow outline-none text-sm font-mono rounded-none"
                  />
                  {confirmNewPassword && newPassword !== confirmNewPassword && (
                    <p className="mt-2 text-[10px] text-red-500">{t('settings.passwordMismatchInline')}</p>
                  )}
                </div>
              </div>

              <button
                onClick={handlePasswordReset}
                disabled={passwordLoading || !!passwordSuccess}
                className="w-full bg-endfield-yellow hover:bg-yellow-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-black font-bold py-3 text-xs uppercase tracking-widest touch-feedback disabled:opacity-50 rounded-none transition-colors"
              >
                {passwordLoading ? t('settings.passwordUpdating') : passwordSuccess ? t('settings.passwordUpdated') : t('settings.passwordUpdateAction')}
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
              <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-1 uppercase tracking-wide">{t('settings.deleteDataModalTitle')}</h3>
              <p className="text-xs text-zinc-500 mb-4 font-mono">{t('settings.deleteDataIrreversible')}</p>
              {deleteError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 text-xs flex items-start gap-2 rounded-none mb-4">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}
              
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-3 mb-4 text-left rounded-none">
                <p className="text-[10px] text-red-400 uppercase font-bold mb-2">{t('settings.deleteDataTargetTitle')}</p>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 font-mono">
                  <li>[x] {t('settings.deleteDataTargetPools', { count: userPoolCount })}</li>
                  <li>[x] {t('settings.deleteDataTargetHistory', { count: userHistoryCount })}</li>
                </ul>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                {t('settings.deleteDataModalKeepAccount')}
              </p>
              
              <p className="text-xs text-zinc-500 mb-3">
                {t('settings.deleteDataConfirmPrompt', { phrase: deletePhrase })}
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('settings.deleteDataPlaceholder')}
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
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteConfirmText !== deletePhrase || deleteLoading}
                className="flex-1 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 touch-feedback disabled:opacity-50 uppercase tracking-wider transition-colors"
              >
                {deleteLoading ? t('settings.deleteDataProgress') : t('settings.deleteDataAction')}
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
                <span className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">{t('settings.deleteAccountModalTitle')}</span>
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
                <p>• {t('settings.deleteAccountWarning1')}</p>
                <p>• {t('settings.deleteAccountWarning2')}</p>
                <p>• {t('settings.deleteAccountWarning3')}</p>
                <p>• {t('settings.deleteAccountWarning4')}</p>
                <p>• {t('settings.deleteAccountWarning5')}</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  {t('settings.currentPassword')}
                </label>
                <input
                  type="password"
                  value={deleteAccountPassword}
                  onChange={(event) => setDeleteAccountPassword(event.target.value)}
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  className="w-full px-3 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 rounded-none focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  {t('settings.confirmPhrase')}
                </label>
                <input
                  type="text"
                  value={deleteAccountConfirmText}
                  onChange={(event) => setDeleteAccountConfirmText(event.target.value)}
                  placeholder={t('settings.confirmDeleteAccountPlaceholder')}
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
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading || deleteAccountConfirmText !== deleteAccountPhrase}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {deleteAccountLoading ? t('settings.deleteAccountProgress') : t('settings.confirmDeleteAccountAction')}
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
