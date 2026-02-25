import React, { useState, useMemo } from 'react';
import { Settings, User, Moon, Sun, Monitor, Trash2, Lock, Cloud, RefreshCw, AlertTriangle, X, Mail, Smartphone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import PlatformSwitcher from './common/PlatformSwitcher';
import { useTheme } from '../contexts/ThemeContext';

const SettingsPanel = React.memo(({ user, userRole, pools, history, onDeleteAllData, onManualSync, syncing }) => {
  const { themeMode, setThemeMode } = useTheme();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // 统计当前用户创建的数据（过滤掉其他用户的数据）
  const myPools = useMemo(() => {
    if (!pools || !user) return [];
    return pools.filter(pool => !pool.user_id || pool.user_id === user.id);
  }, [pools, user]);

  const myHistory = useMemo(() => {
    if (!history || !user) return [];
    return history.filter(h => !h.user_id || h.user_id === user.id);
  }, [history, user]);

  const userPoolCount = myPools.length;
  const userHistoryCount = myHistory.length;

  const handleManualSync = async () => {
    if (onManualSync) {
      await onManualSync();
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== '确认删除') return;
    setDeleteLoading(true);
    try {
      await onDeleteAllData();
      setShowDeleteAllModal(false);
      setDeleteConfirmText('');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setPasswordError('无法获取邮箱地址');
      return;
    }

    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);

    try {
      // 使用环境变量配置的域名，避免 window.location.origin 被篡改
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${appUrl}/reset-password`
      });

      if (error) throw error;

      setPasswordSuccess('密码重置邮件已发送！请查收邮箱并点击链接重置密码。');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 3000);
    } catch (error) {
      setPasswordError(error.message || '发送失败，请重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleInfo = (role) => {
    switch (role) {
      case 'super_admin':
        return { label: '超级管理员', color: 'bg-red-100 text-red-600 border-red-200', desc: '拥有所有权限，可管理用户和审批申请' };
      case 'admin':
        return { label: '管理员', color: 'bg-green-100 text-green-600 border-green-200', desc: '可录入和编辑抽卡数据' };
      default:
        return { label: '普通用户', color: 'bg-slate-100 text-slate-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800', desc: '可查看数据，需申请成为管理员才能录入' };
    }
  };

  const roleInfo = getRoleInfo(userRole);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 p-6 text-white border-l-4 border-endfield-yellow">
        <h2 className="text-2xl font-bold flex items-center gap-3 font-mono tracking-tighter">
          <Settings size={28} />
          系统设置
        </h2>
        <p className="text-zinc-400 mt-1 text-xs tracking-widest uppercase">管理账户与系统偏好</p>
      </div>

      {/* 账户信息 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative group">
        {/* 背景装饰网格 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
        
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center gap-2 relative z-10">
          <User size={20} className="text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">账户信息</h3>
        </div>
        <div className="p-6 space-y-4 relative z-10">
          {user ? (
            <>
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-mono">邮箱</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 font-mono tracking-wide">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-mono">权限</span>
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
                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-mono">安全</span>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-endfield-yellow/10 hover:bg-endfield-yellow text-amber-700 dark:text-endfield-yellow hover:text-black border border-endfield-yellow/50 text-xs font-bold tracking-wider transition-all uppercase rounded-sm"
                >
                  <Lock size={14} />
                  修改密码
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400 dark:text-zinc-500">
              <User size={48} className="mx-auto mb-3 opacity-50" />
              <p className="font-mono text-sm">请登录以查看账户信息</p>
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
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">外观设置</h3>
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
              <span className="text-xs font-bold font-mono uppercase">浅色</span>
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
              <span className="text-xs font-bold font-mono uppercase">深色</span>
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
              <span className="text-xs font-bold font-mono uppercase">跟随系统</span>
            </button>
          </div>
        </div>
      </div>

      {/* 平台切换 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
        {/* 背景装饰网格 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center gap-2 relative z-10">
          <Smartphone size={20} className="text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">平台切换</h3>
        </div>
        <div className="p-6 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">移动端视图</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-mono">
                切换到移动端界面，适合手机和平板使用。
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
            <h3 className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide text-sm">数据管理</h3>
          </div>
          <div className="p-6 space-y-4 relative z-10">
            {/* 数据统计 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-slate-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-200 dark:bg-zinc-800 transform rotate-45 translate-x-4 -translate-y-4 group-hover:bg-endfield-yellow transition-colors"></div>
                <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{userPoolCount}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500 uppercase tracking-wider font-bold">创建的卡池</div>
              </div>
              <div className="p-4 bg-slate-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-200 dark:bg-zinc-800 transform rotate-45 translate-x-4 -translate-y-4 group-hover:bg-endfield-yellow transition-colors"></div>
                <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{userHistoryCount}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-500 uppercase tracking-wider font-bold">抽卡记录</div>
              </div>
            </div>

            {/* 删除所有数据 */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-red-600 dark:text-red-400">危险区域 // 删除数据</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-mono">
                    永久删除您的所有数据。
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  disabled={userPoolCount === 0 && userHistoryCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 disabled:bg-zinc-100 dark:disabled:bg-zinc-900 disabled:border-zinc-200 dark:disabled:border-zinc-800 disabled:text-zinc-400 text-red-600 dark:text-red-400 text-xs font-bold tracking-wider transition-colors disabled:cursor-not-allowed rounded-sm uppercase"
                >
                  <Trash2 size={14} />
                  全部删除
                </button>
              </div>
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
                重置密码
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300">
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
                  <Mail size={16} className="shrink-0 mt-0.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 p-4 rounded-none">
                <div className="flex items-start gap-3">
                  <Mail size={20} className="text-endfield-yellow shrink-0 mt-1" />
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <p className="font-medium text-zinc-800 dark:text-zinc-200 mb-2">邮件重置密码</p>
                    <p className="mb-2">
                      我们将向您的注册邮箱 <span className="font-mono text-endfield-yellow">{user?.email}</span> 发送一封密码重置邮件。
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">
                      点击邮件中的链接即可设置新密码。链接将在 1 小时后失效。
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePasswordReset}
                disabled={passwordLoading || !!passwordSuccess}
                className="w-full bg-endfield-yellow hover:bg-yellow-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-black font-bold uppercase tracking-wider py-3 rounded-none transition-colors disabled:cursor-not-allowed"
              >
                {passwordLoading ? '发送中...' : passwordSuccess ? '已发送' : '发送重置邮件'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除所有数据确认弹窗 */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">危险操作确认</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
                您即将删除当前账号的<span className="text-red-500 font-bold">所有数据</span>，包括：
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-none mb-4 text-left">
                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                  <li>• {userPoolCount} 个卡池</li>
                  <li>• {userHistoryCount} 条抽卡记录</li>
                </ul>
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-500 mb-4">
                此操作<span className="text-red-500 font-bold">无法撤销</span>！请输入"确认删除"以继续：
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder='输入"确认删除"'
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
                取消
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteConfirmText !== '确认删除' || deleteLoading}
                className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-none shadow-sm transition-all"
              >
                {deleteLoading ? '删除中...' : '永久删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SettingsPanel;
