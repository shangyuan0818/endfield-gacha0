import React, { useEffect, useState, useMemo } from 'react';
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
import { updateOwnUsername } from '../../services/accountProfileService.js';
import { finalizeDeletedAccountSession } from '../../utils/finalizeDeletedAccountSession';
import {
  buildUsernameHandle,
  getPreferredUsername,
  getUsernameValidationCode,
  normalizeUsername,
} from '../../utils/usernameValidation.js';
import { MobileSectionTitle, MobileStickyHeader } from '../components/ux/MobilePrimitives.jsx';
import {
  formatFreshnessAbsolute,
  formatFreshnessRelative,
  getFreshnessTone
} from '../../utils/dataFreshness.js';
import { getAccountLastImportTimestamp } from '../../utils/accountFreshness.js';
import { useI18n } from '../../i18n/index.js';
import { localizeGameAccountServerTag } from '../../utils/gameAccountMetadata.js';

function getFreshnessToneClasses(tone) {
  switch (tone) {
    case 'fresh':
      return 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300';
    case 'notice':
      return 'border-amber-500/30 bg-amber-500/12 text-amber-300';
    case 'stale':
      return 'border-red-500/30 bg-red-500/12 text-red-300';
    default:
      return 'border-zinc-200 bg-zinc-50 text-slate-500 dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-400';
  }
}

function MobileSettingsSection({ title, icon, children }) {
  return (
    <div className="mobile-ux-card p-4 space-y-4">
      <MobileSectionTitle title={title} icon={icon} />
      <div className="space-y-4">{children}</div>
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
  const { user, signOut, logout, userRole, syncing, syncError, lastSyncAt, setUser } = useAuthStore();
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
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');
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
  const gameAccounts = useMemo(() => {
    void history;
    return getGameAccountsFromHistory();
  }, [getGameAccountsFromHistory, history]);
  const currentUsername = useMemo(() => getPreferredUsername(user), [user]);
  const currentUsernameHandle = useMemo(() => buildUsernameHandle(user), [user]);

  useEffect(() => {
    setUsernameInput(currentUsername);
    setUsernameError('');
    setUsernameSuccess('');
  }, [currentUsername]);

  const getRoleInfo = (role) => {
    switch (role) {
      case 'super_admin':
        return {
          label: t('settings.role.super_admin.label'),
          badgeClass: 'border-red-400/30 bg-red-500/12',
          textClass: 'text-red-300',
        };
      case 'admin':
        return {
          label: t('settings.role.admin.label'),
          badgeClass: 'border-emerald-400/30 bg-emerald-500/12',
          textClass: 'text-emerald-300',
        };
      default:
        return {
          label: t('settings.role.user.label'),
          badgeClass: 'border-white/10 bg-white/[0.04]',
          textClass: 'text-zinc-300',
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

  const getLocalizedUsernameValidationMessage = (validationCode) => {
    switch (validationCode) {
      case 'required':
        return t('settings.error.usernameRequired');
      case 'too_short':
        return t('settings.error.usernameTooShort');
      case 'too_long':
        return t('settings.error.usernameTooLong');
      case 'invalid_characters':
        return t('settings.error.usernameInvalid');
      default:
        return t('settings.error.usernameUpdateFailed');
    }
  };

  const handleUsernameUpdate = async () => {
    if (!user) {
      setUsernameError(t('settings.error.notLoggedInUsername'));
      return;
    }

    const normalizedUsername = normalizeUsername(usernameInput);
    const validationCode = getUsernameValidationCode(normalizedUsername, { required: true });
    if (validationCode) {
      setUsernameError(getLocalizedUsernameValidationMessage(validationCode));
      setUsernameSuccess('');
      return;
    }

    if (normalizedUsername === currentUsername) {
      setUsernameError(t('settings.error.usernameUnchanged'));
      setUsernameSuccess('');
      return;
    }

    setUsernameLoading(true);
    setUsernameError('');
    setUsernameSuccess('');
    try {
      const updatedUser = await updateOwnUsername(user, normalizedUsername);
      setUser(updatedUser);
      setUsernameInput(normalizedUsername);
      setUsernameSuccess(t('settings.success.usernameUpdated'));
    } catch (error) {
      setUsernameError(error?.message || t('settings.error.usernameUpdateFailed'));
    } finally {
      setUsernameLoading(false);
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
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden slide-right-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark px-4 pb-6 space-y-4">
      <MobileStickyHeader
        eyebrow="SYSTEM"
        icon={Settings}
        title={t('settings.pageTitle')}
        subtitle={t('settings.pageSubtitle')}
      />

      {/* 账户信息 */}
      <MobileSettingsSection title={t('settings.accountSection')} icon={User}>
        {user ? (
          <div className="divide-y divide-zinc-200 overflow-hidden rounded-[1.05rem] border border-zinc-200 bg-zinc-50/75 dark:divide-white/8 dark:border-white/8 dark:bg-white/[0.03]">
            {/* 用户头像和邮箱 */}
            <div className="p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-[1rem] bg-endfield-yellow flex items-center justify-center overflow-hidden border border-endfield-yellow shadow-sm">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={currentUsername || user.email || t('settings.mobile.unnamedUser')}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-black font-mono">
                    {(currentUsername || user.email || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-lg">
                  {currentUsernameHandle || t('settings.mobile.unnamedUser')}
                </p>
                <p className="text-xs text-zinc-500 truncate font-mono uppercase tracking-wide">{user.email}</p>
                <div className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 border ${roleInfo.badgeClass}`}>
                  <span className={`text-[9px] font-bold uppercase ${roleInfo.textClass}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-4 py-4 space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {t('settings.username')}
              </div>
              <input
                type="text"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                placeholder={t('settings.usernamePlaceholder')}
                maxLength={50}
                className="w-full rounded-[0.95rem] border border-zinc-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-endfield-yellow focus:ring-2 focus:ring-endfield-yellow dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              <div className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                {t('settings.usernameFormatHint')}
              </div>
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                {t('settings.usernamePublicHandle', { value: buildUsernameHandle({ ...user, user_metadata: { ...(user?.user_metadata || {}), username: normalizeUsername(usernameInput) || currentUsername } }) })}
              </div>
              {usernameError ? (
                <div className="text-[11px] text-red-500">{usernameError}</div>
              ) : null}
              {usernameSuccess ? (
                <div className="text-[11px] text-emerald-500">{usernameSuccess}</div>
              ) : null}
              <button
                onClick={handleUsernameUpdate}
                disabled={usernameLoading}
                className="w-full rounded-[0.95rem] border border-endfield-yellow bg-endfield-yellow/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-amber-700 transition-all hover:bg-endfield-yellow hover:text-black disabled:opacity-60 dark:text-endfield-yellow"
              >
                {usernameLoading ? `${t('settings.changeUsername')}...` : t('settings.changeUsername')}
              </button>
            </div>

            {/* 修改密码 */}
            <button
              onClick={() => {
                resetPasswordModalState();
                setShowPasswordModal(true);
              }}
              className="w-full px-4 py-3 flex items-center justify-between touch-feedback hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock size={16} className="text-zinc-400" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('settings.changePassword')}</span>
              </div>
              <ChevronRight size={16} className="text-zinc-300" />
            </button>
          </div>
        ) : (
          <div className="rounded-[1.05rem] border border-dashed border-zinc-200 bg-zinc-50/75 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
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
                  className={`flex-1 flex flex-col items-center gap-2 rounded-[1rem] p-3 border transition-all touch-feedback ${
                    isActive
                      ? 'border-endfield-yellow bg-endfield-yellow/10 shadow-[inset_0_0_0_1px_rgba(255,250,0,0.25)]'
                      : 'border-zinc-200 bg-zinc-50/75 hover:border-zinc-300 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-white/15'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-endfield-yellow' : 'text-slate-500 dark:text-zinc-400'} strokeWidth={1.5} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-zinc-900 dark:text-endfield-yellow' : 'text-slate-500 dark:text-zinc-500'}`}>
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
          <PlatformSwitcher className="w-full justify-center py-2.5 rounded-[1rem]" />
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
              <div className="mobile-ux-soft-card p-3">
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">{userPoolCount}</div>
                <div className="text-[9px] text-slate-500 dark:text-zinc-400 uppercase font-bold tracking-wider mt-1">{t('settings.createdPools')}</div>
              </div>
              <div className="mobile-ux-soft-card p-3">
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-zinc-100">{userHistoryCount}</div>
                <div className="text-[9px] text-slate-500 dark:text-zinc-400 uppercase font-bold tracking-wider mt-1">{t('settings.historyRecords')}</div>
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
                  className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 transition-colors disabled:bg-zinc-800 hover:bg-blue-500"
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
                          ? 'mobile-ux-soft-card rounded-[1.05rem] border-endfield-yellow bg-endfield-yellow/5'
                          : 'mobile-ux-soft-card mobile-ux-soft-card--muted'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{account.nickName}</span>
                            {account.serverTag && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-[0.8rem] bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                {localizeGameAccountServerTag(account.serverTag, locale)}
                              </span>
                            )}
                            {currentGameUid === account.gameUid && (
                              <span className="rounded-full bg-endfield-yellow/15 px-1.5 py-0.5 text-[10px] font-bold text-endfield-yellow">
                                {t('settings.currentAccount')}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-500">
                            {t('settings.uidRecordCount', { uid: account.gameUid, count: account.recordCount })}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-[10px] font-bold border whitespace-nowrap ${getFreshnessToneClasses(getFreshnessTone(getAccountLastImportTimestamp(account)))}`}>
                          {formatFreshnessRelative(getAccountLastImportTimestamp(account), t('common.importTimeUnknown'), locale)}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        <div>{t('settings.lastImport', { value: formatFreshnessAbsolute(getAccountLastImportTimestamp(account), t('common.unknown'), locale) })}</div>
                        <div>{t('settings.latestRecord', { value: formatFreshnessAbsolute(account.latestRecordAt, t('common.unknown'), locale) })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-[1.05rem] border border-dashed border-zinc-200 bg-zinc-50/75 px-3 py-3 text-[10px] font-mono text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]">
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
                  className="flex items-center gap-2 rounded-full border border-red-400/30 px-4 py-2 text-red-300 text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 transition-colors hover:bg-red-500/10"
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
                  className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-white text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 transition-colors disabled:bg-zinc-800 hover:bg-red-700"
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
          className="w-full flex items-center justify-center gap-2 rounded-[1.05rem] border border-zinc-200 bg-zinc-50/75 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 hover:border-rose-300 hover:text-rose-500 touch-feedback transition-colors dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-400 dark:hover:border-rose-400/20 dark:hover:text-rose-300"
        >
          <LogOut size={16} />
          {t('nav.logout')}
        </button>
      )}

      {/* 版本信息 */}
      <div className="mobile-ux-card p-4 text-center">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/10" />
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400">{t('app.brand')}</p>
        <p className="mt-1 text-[10px] font-mono text-zinc-500">{APP_VERSION_LABEL}</p>
      </div>

      {/* 底部留白 */}
      <div className="h-4" />

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="mobile-ux-modal">
          <div className="mobile-ux-modal-card animate-scale-up">
            <div className="mobile-ux-modal-header">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-zinc-100">
                <Lock size={16} />
                {t('settings.passwordModalTitle')}
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  resetPasswordModalState();
                }}
                className="rounded-full border border-zinc-200 bg-zinc-50 p-1 touch-feedback transition-colors hover:bg-zinc-100 dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <X size={18} className="text-slate-500 dark:text-zinc-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {passwordError && (
                <div className="mobile-ux-soft-card mobile-ux-soft-card--danger flex items-start gap-2 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="mobile-ux-soft-card mobile-ux-soft-card--success flex items-start gap-2 px-3 py-2 text-xs text-emerald-300">
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
                    className="mobile-ux-input px-4 py-3 text-sm font-mono"
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
                    className="mobile-ux-input px-4 py-3 text-sm font-mono"
                  />
                  {confirmNewPassword && newPassword !== confirmNewPassword && (
                    <p className="mt-2 text-[10px] text-red-500">{t('settings.passwordMismatchInline')}</p>
                  )}
                </div>
              </div>

              <button
                onClick={handlePasswordReset}
                disabled={passwordLoading || !!passwordSuccess}
                className="w-full rounded-full bg-endfield-yellow py-3 text-xs font-bold uppercase tracking-widest text-black touch-feedback disabled:opacity-50 transition-colors hover:bg-yellow-400 disabled:bg-zinc-700"
              >
                {passwordLoading ? t('settings.passwordUpdating') : passwordSuccess ? t('settings.passwordUpdated') : t('settings.passwordUpdateAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除数据确认弹窗 */}
      {showDeleteModal && (
        <div className="mobile-ux-modal">
          <div className="mobile-ux-modal-card animate-scale-up border border-red-400/30">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1rem] border border-red-400/30 bg-red-500/10 text-red-300">
                <AlertTriangle size={32} />
              </div>
              <h3 className="mb-1 text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-zinc-100">{t('settings.deleteDataModalTitle')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mb-4 font-mono">{t('settings.deleteDataIrreversible')}</p>
              {deleteError && (
                <div className="mobile-ux-soft-card mobile-ux-soft-card--danger mb-4 flex items-start gap-2 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}
              
              <div className="mobile-ux-soft-card mobile-ux-soft-card--danger mb-4 p-3 text-left">
                <p className="text-[10px] text-red-400 uppercase font-bold mb-2">{t('settings.deleteDataTargetTitle')}</p>
                <ul className="space-y-1 font-mono text-xs text-red-300">
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
                className="mobile-ux-input mb-4 px-4 py-3 text-sm font-mono"
              />
            </div>
            <div className="mobile-ux-modal-footer">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
                className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 touch-feedback dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-300"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteConfirmText !== deletePhrase || deleteLoading}
                className="flex-1 rounded-full bg-red-600 py-3 text-xs font-bold uppercase tracking-wider text-white touch-feedback disabled:opacity-50 transition-colors hover:bg-red-700 disabled:bg-zinc-800"
              >
                {deleteLoading ? t('settings.deleteDataProgress') : t('settings.deleteDataAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="mobile-ux-modal">
          <div className="mobile-ux-modal-card">
            <div className="mobile-ux-modal-header">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm font-bold text-red-300 uppercase tracking-wide">{t('settings.deleteAccountModalTitle')}</span>
              </div>
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  resetDeleteAccountState();
                }}
                className="text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {deleteAccountError && (
                <div className="mobile-ux-soft-card mobile-ux-soft-card--danger px-3 py-2 text-xs text-red-300">
                  {deleteAccountError}
                </div>
              )}

              <div className="mobile-ux-soft-card mobile-ux-soft-card--danger px-3 py-3 text-xs text-red-300 space-y-1">
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
                  className="mobile-ux-input px-3 py-3 text-sm"
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
                  className="mobile-ux-input px-3 py-3 text-sm"
                />
              </div>
            </div>

            <div className="mobile-ux-modal-footer">
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  resetDeleteAccountState();
                }}
                className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-300"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading || deleteAccountConfirmText !== deleteAccountPhrase}
                className="flex-1 rounded-full bg-red-600 px-4 py-2 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-red-700 disabled:bg-zinc-700"
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
