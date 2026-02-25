import React, { useState, useMemo, useCallback } from 'react';
import {
  Settings, User, Moon, Sun, Monitor, Trash2, Lock, Cloud, RefreshCw,
  AlertTriangle, X, Mail, Database, LogOut, ChevronRight
} from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import usePoolStore from '../../stores/usePoolStore';
import useHistoryStore from '../../stores/useHistoryStore';
import { useCloudSync } from '../../hooks/app';
import { supabase } from '../../supabaseClient';
import PlatformSwitcher from '../../components/common/PlatformSwitcher';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * 移动端设置视图 - 工业风重构版 (中文)
 */
function MobileSettingsView() {
  const { themeMode, setThemeMode } = useTheme();
  const { user, signOut, userRole } = useAuthStore();
  const { pools } = usePoolStore();
  const { history } = useHistoryStore();

  const showToast = useCallback((message, type = 'info') => {
    console.log(`[${type}] ${message}`);
  }, []);

  const { syncToCloud, syncing } = useCloudSync({ showToast });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const myPools = useMemo(() => {
    if (!pools || !user) return [];
    const poolsArray = Array.isArray(pools) ? pools : [];
    return poolsArray.filter(pool => !pool.user_id || pool.user_id === user.id);
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
        return { label: '超级管理员', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400', desc: 'System Access Level 5' };
      case 'admin':
        return { label: '管理员', color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400', desc: 'Data Entry Authorized' };
      default:
        return { label: '干员', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400', desc: 'Standard Access' };
    }
  };

  const roleInfo = getRoleInfo(userRole);

  const handleManualSync = async () => {
    if (syncToCloud) {
      await syncToCloud();
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setPasswordError('Email not found');
      return;
    }

    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);

    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${appUrl}/reset-password`
      });

      if (error) throw error;

      setPasswordSuccess('重置邮件已发送！');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 3000);
    } catch (error) {
      setPasswordError(error.message || '发送失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== '确认删除') return;
    setDeleteLoading(true);
    try {
      // Logic for deleting data would go here
      setShowDeleteModal(false);
      setDeleteConfirmText('');
    } finally {
      setDeleteLoading(false);
    }
  };

  const themeOptions = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ];

  const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center gap-2">
        <Icon size={14} className="text-zinc-400" />
        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">{title}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 页面标题 */}
      <div className="bg-zinc-900 text-white p-4 border-l-4 border-endfield-yellow rounded-none shadow-md">
        <h1 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide">
          <Settings size={20} className="text-endfield-yellow" />
          系统设置
        </h1>
        <p className="text-[10px] text-zinc-400 mt-1 font-mono uppercase tracking-widest">Configuration & Preferences</p>
      </div>

      {/* 账户信息 */}
      <Section title="账户状态" icon={User}>
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
                  {user.user_metadata?.full_name || 'Operator'}
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
              onClick={() => setShowPasswordModal(true)}
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
      </Section>

      {/* 外观设置 */}
      <Section title="显示界面" icon={Monitor}>
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
      </Section>

      {/* 平台切换 */}
      <Section title="系统平台" icon={Monitor}>
        <div className="p-4">
          <PlatformSwitcher className="w-full justify-center py-2.5 rounded-none" />
          <p className="text-[10px] text-zinc-400 text-center mt-2 font-mono uppercase">
            切换到桌面端以获得完整功能
          </p>
        </div>
      </Section>

      {/* 数据管理 */}
      {user && (
        <Section title="数据管理" icon={Database}>
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
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">上次同步: 未知</p>
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
            </div>

            {/* 删除数据 */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-500 uppercase">危险区域</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">永久删除所有数据</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={userPoolCount === 0 && userHistoryCount === 0}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-bold uppercase tracking-wider touch-feedback disabled:opacity-50 transition-colors rounded-none"
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </div>
            </div>
          </div>
        </Section>
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
        <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Endfield Gacha Analyzer</p>
        <p className="text-[10px] text-zinc-500 mt-1 font-mono">v3.3.1</p>
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
                重置密码
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="p-1 touch-feedback hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
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
                  <Mail size={14} className="shrink-0 mt-0.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-3 rounded-none">
                <div className="flex items-start gap-3">
                  <Mail size={20} className="text-endfield-yellow shrink-0 mt-0.5" />
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <p className="font-bold text-zinc-800 dark:text-zinc-200 mb-1 uppercase text-xs">邮件确认</p>
                    <p className="text-xs">
                      发送重置链接至 <span className="font-mono text-endfield-yellow">{user?.email}</span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePasswordReset}
                disabled={passwordLoading || !!passwordSuccess}
                className="w-full bg-endfield-yellow hover:bg-yellow-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-black font-bold py-3 text-xs uppercase tracking-widest touch-feedback disabled:opacity-50 rounded-none transition-colors"
              >
                {passwordLoading ? '发送中...' : passwordSuccess ? '已发送' : '发送重置链接'}
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
              
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-3 mb-4 text-left rounded-none">
                <p className="text-[10px] text-red-400 uppercase font-bold mb-2">目标数据:</p>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 font-mono">
                  <li>[x] {userPoolCount} 个卡池</li>
                  <li>[x] {userHistoryCount} 条记录</li>
                </ul>
              </div>
              
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
                {deleteLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileSettingsView;