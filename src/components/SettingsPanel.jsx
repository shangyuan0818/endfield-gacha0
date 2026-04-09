import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, User, Moon, Sun, Monitor, Trash2, Lock, AlertTriangle, X, Smartphone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuthStore, useHistoryStore, usePoolStore } from '../stores';
import PlatformSwitcher from './common/PlatformSwitcher';
import LocaleSwitcher from './common/LocaleSwitcher.jsx';
import { useTheme } from '../contexts/ThemeContext';
import { useCloudSync } from '../hooks/app';
import { deleteOwnAccount } from '../services/selfAccountService';
import { finalizeDeletedAccountSession } from '../utils/finalizeDeletedAccountSession';
import {
  formatFreshnessAbsolute,
  formatFreshnessRelative,
  getFreshnessTone
} from '../utils/dataFreshness.js';
import { useI18n } from '../i18n/index.js';

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

const SettingsPanel = React.memo(({ onDeleteAllData }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);
  const logout = useAuthStore(state => state.logout);
  const pools = usePoolStore(state => state.pools);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const switchGameAccount = usePoolStore(state => state.switchGameAccount);
  const history = useHistoryStore(state => state.history);
  const getGameAccountsFromHistory = useHistoryStore(state => state.getGameAccountsFromHistory);
  const setHistory = useHistoryStore(state => state.setHistory);
  const { themeMode, setThemeMode } = useTheme();
  const { loadPublicPools } = useCloudSync({ showToast: () => {} });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteAccountSuccess, setDeleteAccountSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const deletePhrase = t('settings.deletePhrase');
  const deleteAccountPhrase = t('settings.deleteAccountPhrase');

  // 统计当前用户创建的数据（过滤掉其他用户的数据）
  const myPools = useMemo(() => {
    if (!pools || !user) return [];
    return pools.filter(pool => pool.user_id === user.id);
  }, [pools, user]);

  const myHistory = useMemo(() => {
    if (!history || !user) return [];
    return history.filter(h => !h.user_id || h.user_id === user.id);
  }, [history, user]);

  const userPoolCount = myPools.length;
  const userHistoryCount = myHistory.length;
  const gameAccounts = useMemo(() => getGameAccountsFromHistory(), [getGameAccountsFromHistory, history]);

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== deletePhrase) return;
    setDeleteLoading(true);
    try {
      await onDeleteAllData();
      setShowDeleteAllModal(false);
      setDeleteConfirmText('');
    } finally {
      setDeleteLoading(false);
    }
  };

  const resetDeleteAccountModalState = () => {
    setDeleteAccountConfirmText('');
    setDeleteAccountPassword('');
    setDeleteAccountError('');
    setDeleteAccountSuccess('');
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

    setDeleteAccountError('');
    setDeleteAccountSuccess('');
    setDeleteAccountLoading(true);

    try {
      await deleteOwnAccount(deleteAccountPassword);
      setDeleteAccountSuccess(t('settings.success.deleteAccount'));

      await finalizeDeletedAccountSession({
        loadPublicPools,
        setPools,
        setHistory,
        switchPool,
        switchGameAccount,
        logout,
      });

      navigate('/', { replace: true });
    } catch (error) {
      setDeleteAccountError(error.message || t('settings.error.deleteAccountFailed'));
    } finally {
      setDeleteAccountLoading(false);
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

  const getRoleInfo = (role) => {
    switch (role) {
      case 'super_admin':
        return { label: t('settings.role.super_admin.label'), color: 'bg-red-100 text-red-600 border-red-200', desc: t('settings.role.super_admin.desc') };
      case 'admin':
        return { label: t('settings.role.admin.label'), color: 'bg-green-100 text-green-600 border-green-200', desc: t('settings.role.admin.desc') };
      default:
        return { label: t('settings.role.user.label'), color: 'bg-slate-100 text-slate-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800', desc: t('settings.role.user.desc') };
    }
  };

  const roleInfo = getRoleInfo(userRole);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 p-6 text-white border-l-4 border-endfield-yellow">
        <h2 className="text-2xl font-bold flex items-center gap-3 font-mono tracking-tighter">
          <Settings size={28} />
          {t('settings.pageTitle')}
        </h2>
        <p className="text-zinc-400 mt-1 text-xs tracking-widest uppercase">{t('settings.pageSubtitle')}</p>
      </div>

      {/* 账户信息 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative group">
        {/* 背景装饰网格 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
        
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center gap-2 relative z-10">
          <User size={20} className="text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">{t('settings.accountSection')}</h3>
        </div>
        <div className="p-6 space-y-4 relative z-10">
          {user ? (
            <>
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-mono">{t('settings.email')}</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono tracking-wide">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-mono">{t('settings.role')}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-bold border rounded-sm font-mono ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
              <div className="py-3 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 italic border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                  {roleInfo.desc}
                </p>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-mono">{t('settings.security')}</span>
                <button
                  onClick={() => {
                    resetPasswordModalState();
                    setShowPasswordModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-endfield-yellow/10 hover:bg-endfield-yellow text-amber-700 dark:text-endfield-yellow hover:text-black border border-endfield-yellow/50 text-xs font-bold tracking-wider transition-all uppercase rounded-sm"
                >
                  <Lock size={14} />
                  {t('settings.changePassword')}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400 dark:text-zinc-500">
              <User size={48} className="mx-auto mb-3 opacity-50" />
              <p className="font-mono text-sm">{t('settings.loginRequired')}</p>
            </div>
          )}
        </div>
      </div>

      {/* 主题设置 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
        {/* 背景装饰网格 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center gap-2 relative z-10">
          <Moon size={20} className="text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">{t('settings.appearanceSection')}</h3>
        </div>
        <div className="p-6 relative z-10">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setThemeMode('light')}
              className={`p-4 border transition-all rounded-sm group ${
                themeMode === 'light'
                  ? 'border-endfield-yellow bg-yellow-50 dark:bg-zinc-800 text-yellow-700'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 bg-white dark:bg-black/20 text-zinc-500'
              }`}
            >
              <Sun size={24} className={`mx-auto mb-2 ${themeMode === 'light' ? 'text-yellow-600' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
              <span className="text-xs font-bold font-mono uppercase">{t('settings.theme.light')}</span>
            </button>
            <button
              onClick={() => setThemeMode('dark')}
              className={`p-4 border transition-all rounded-sm group ${
                themeMode === 'dark'
                  ? 'border-endfield-yellow bg-zinc-800 text-zinc-200'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 bg-white dark:bg-black/20 text-zinc-500'
              }`}
            >
              <Moon size={24} className={`mx-auto mb-2 ${themeMode === 'dark' ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
              <span className="text-xs font-bold font-mono uppercase">{t('settings.theme.dark')}</span>
            </button>
            <button
              onClick={() => setThemeMode('system')}
              className={`p-4 border transition-all rounded-sm group ${
                themeMode === 'system'
                  ? 'border-endfield-yellow bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500 bg-white dark:bg-black/20 text-zinc-500'
              }`}
            >
              <Monitor size={24} className={`mx-auto mb-2 ${themeMode === 'system' ? 'text-black dark:text-white' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
              <span className="text-xs font-bold font-mono uppercase">{t('settings.theme.system')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center gap-2 relative z-10">
          <Monitor size={20} className="text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">{t('settings.languageSection')}</h3>
        </div>
        <div className="p-6 relative z-10 space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-500 font-mono">{t('language.description')}</p>
          <LocaleSwitcher />
        </div>
      </div>

      {/* 平台切换 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
        {/* 背景装饰网格 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center gap-2 relative z-10">
          <Smartphone size={20} className="text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">{t('settings.platformSection')}</h3>
        </div>
        <div className="p-6 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">{t('settings.platformTitle')}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-mono">
                {t('settings.platformDesc')}
              </p>
            </div>
            <PlatformSwitcher className="rounded-sm" />
          </div>
        </div>
      </div>

      {/* 数据管理 */}
      {user && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
          {/* 背景装饰网格 */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center gap-2 relative z-10">
            <Trash2 size={20} className="text-zinc-600 dark:text-zinc-400" />
            <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">{t('settings.dataSection')}</h3>
          </div>
          <div className="p-6 space-y-4 relative z-10">
            {/* 数据统计 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-slate-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-200 dark:bg-zinc-800 transform rotate-45 translate-x-4 -translate-y-4 group-hover:bg-endfield-yellow transition-colors"></div>
                <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{userPoolCount}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500 uppercase tracking-wider font-bold">{t('settings.createdPools')}</div>
              </div>
              <div className="p-4 bg-slate-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-200 dark:bg-zinc-800 transform rotate-45 translate-x-4 -translate-y-4 group-hover:bg-endfield-yellow transition-colors"></div>
                <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{userHistoryCount}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500 uppercase tracking-wider font-bold">{t('settings.historyRecords')}</div>
              </div>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">{t('settings.importFreshnessTitle')}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-mono">
                    {t('settings.importFreshnessDesc')}
                  </p>
                </div>
              </div>

              {gameAccounts.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {gameAccounts.map((account) => (
                    <div
                      key={account.gameUid}
                      className={`border px-4 py-3 ${
                        currentGameUid === account.gameUid
                          ? 'border-endfield-yellow bg-endfield-yellow/5'
                          : 'border-zinc-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{account.nickName}</span>
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
                          <div className="mt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-500">
                            {t('settings.uidRecordCount', { uid: account.gameUid, count: account.recordCount })}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-[10px] font-bold border whitespace-nowrap ${getFreshnessToneClasses(getFreshnessTone(account.lastImportedAt))}`}>
                          {formatFreshnessRelative(account.lastImportedAt, t('common.importTimeUnknown'))}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        <div>{t('settings.lastImport', { value: formatFreshnessAbsolute(account.lastImportedAt, t('common.unknown')) })}</div>
                        <div>{t('settings.latestRecord', { value: formatFreshnessAbsolute(account.latestRecordAt, t('common.unknown')) })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-dashed border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs font-mono text-zinc-500 dark:text-zinc-500">
                  {t('settings.noImportedAccounts')}
                </div>
              )}
            </div>

            {/* 删除我的抽卡数据 */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-red-600 dark:text-red-400">{t('settings.deleteDataTitle')}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-mono">
                    {t('settings.deleteDataDesc')}
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  disabled={userPoolCount === 0 && userHistoryCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 disabled:bg-zinc-100 dark:disabled:bg-zinc-900 disabled:border-zinc-200 dark:disabled:border-zinc-800 disabled:text-zinc-400 text-red-600 dark:text-red-400 text-xs font-bold tracking-wider transition-colors disabled:cursor-not-allowed rounded-sm uppercase"
                >
                  <Trash2 size={14} />
                  {t('settings.deleteMyData')}
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-red-700 dark:text-red-400">{t('settings.deleteAccountTitle')}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-mono">
                    {t('settings.deleteAccountDesc')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetDeleteAccountModalState();
                    setShowDeleteAccountModal(true);
                  }}
                  disabled={userRole === 'admin' || userRole === 'super_admin'}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 border border-red-700 disabled:bg-zinc-100 dark:disabled:bg-zinc-900 disabled:border-zinc-200 dark:disabled:border-zinc-800 disabled:text-zinc-400 text-white text-xs font-bold tracking-wider transition-colors disabled:cursor-not-allowed rounded-sm uppercase"
                >
                  <Trash2 size={14} />
                  {t('settings.confirmDeleteAccountAction')}
                </button>
              </div>
              {(userRole === 'admin' || userRole === 'super_admin') && (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500 font-mono">
                  {t('settings.adminDeleteAccountHint')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <Lock size={18} />
                {t('settings.passwordModalTitle')}
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  resetPasswordModalState();
                }}
                className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {passwordError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-2 rounded-none text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-2 rounded-none text-sm flex items-start gap-2">
                  <Lock size={16} className="shrink-0 mt-0.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder={t('settings.newPasswordPlaceholder')}
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-none focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    {t('settings.confirmNewPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder={t('settings.confirmNewPasswordPlaceholder')}
                    className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-none focus:ring-2 focus:ring-endfield-yellow focus:border-endfield-yellow outline-none"
                  />
                  {confirmNewPassword && newPassword !== confirmNewPassword && (
                    <p className="mt-2 text-xs text-red-500">{t('settings.passwordMismatchInline')}</p>
                  )}
                </div>
              </div>

              <button
                onClick={handlePasswordReset}
                disabled={passwordLoading || !!passwordSuccess}
                className="w-full bg-endfield-yellow hover:bg-yellow-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-black font-bold uppercase tracking-wider py-3 rounded-none transition-colors disabled:cursor-not-allowed"
              >
                {passwordLoading ? t('settings.passwordUpdating') : passwordSuccess ? t('settings.passwordUpdated') : t('settings.passwordUpdateAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-red-50 dark:bg-red-950/30">
              <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={20} />
                {t('settings.deleteAccountModalTitle')}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                {t('settings.deleteAccountModalDesc')}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {deleteAccountError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-2 rounded-none text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{deleteAccountError}</span>
                </div>
              )}
              {deleteAccountSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-2 rounded-none text-sm">
                  {deleteAccountSuccess}
                </div>
              )}

              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 p-4 text-sm text-red-700 dark:text-red-300 space-y-1">
                <p>• {t('settings.deleteAccountWarning1')}</p>
                <p>• {t('settings.deleteAccountWarning2')}</p>
                <p>• {t('settings.deleteAccountWarning3')}</p>
                <p>• {t('settings.deleteAccountWarning4')}</p>
                <p>• {t('settings.deleteAccountWarning5')}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  {t('settings.currentPassword')}
                </label>
                <input
                  type="password"
                  value={deleteAccountPassword}
                  onChange={(event) => setDeleteAccountPassword(event.target.value)}
                  placeholder={t('settings.currentPasswordPlaceholder')}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-none focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  {t('settings.confirmPhrase')}
                </label>
                <input
                  type="text"
                  value={deleteAccountConfirmText}
                  onChange={(event) => setDeleteAccountConfirmText(event.target.value)}
                  placeholder={t('settings.confirmDeleteAccountPlaceholder')}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-none focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  resetDeleteAccountModalState();
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-none transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading || deleteAccountSuccess || deleteAccountConfirmText !== deleteAccountPhrase}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-none shadow-sm transition-all"
              >
                {deleteAccountLoading ? t('settings.deleteAccountProgress') : deleteAccountSuccess ? t('settings.deleteAccountDone') : t('settings.confirmDeleteAccountAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除我的抽卡数据确认弹窗 */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">{t('settings.deleteDataModalTitle')}</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
                {t('settings.deleteDataModalIntro')}
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-none mb-4 text-left">
                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                  <li>• {userPoolCount} {t('settings.createdPools')}</li>
                  <li>• {userHistoryCount} {t('settings.historyRecords')}</li>
                </ul>
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
                {t('settings.deleteDataModalKeepAccount')}
              </p>
              <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
                {t('settings.deleteDataModalFinal')}
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('settings.deleteDataPlaceholder')}
                className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-none focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none mb-4"
              />
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button
                onClick={() => {
                  setShowDeleteAllModal(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-none transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteConfirmText !== deletePhrase || deleteLoading}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-none shadow-sm transition-all"
              >
                {deleteLoading ? t('settings.deleteDataProgress') : t('settings.deleteDataAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SettingsPanel;
