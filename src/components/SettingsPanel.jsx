import React, { useState, useMemo } from 'react';
import { Settings, User, Moon, Sun, Monitor, Trash2, Lock, Cloud, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

const SettingsPanel = React.memo(({ user, userRole, themeMode, setThemeMode, pools, history, onDeleteAllData, onManualSync, syncing }) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
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

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    if (passwordForm.new.length < 6) {
      setPasswordError('新密码至少需要6位字符');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new
      });

      if (error) throw error;

      setPasswordSuccess('密码修改成功！');
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      setPasswordError(error.message || '修改失败，请重试');
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
          SETTINGS // 系统设置
        </h2>
        <p className="text-zinc-400 mt-1 text-xs tracking-widest uppercase">Manage account and system preferences</p>
      </div>

      {/* 账户信息 */}
      <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
          <User size={20} className="text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200">账户信息</h3>
        </div>
        <div className="p-6 space-y-4">
          {user ? (
            <>
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-600 dark:text-zinc-400">邮箱地址</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-600 dark:text-zinc-400">当前权限</span>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm font-bold border ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
              <div className="py-3 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-500">{roleInfo.desc}</p>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-zinc-600 dark:text-zinc-400">账户密码</span>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-endfield-yellow hover:bg-yellow-400 text-black text-sm font-bold tracking-wider transition-colors"
                >
                  <Lock size={16} />
                  修改密码
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400 dark:text-zinc-500">
              <User size={48} className="mx-auto mb-3 opacity-50" />
              <p>请先登录以查看账户信息</p>
            </div>
          )}
        </div>
      </div>

      {/* 主题设置 */}
      <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
          <Moon size={20} className="text-zinc-600 dark:text-zinc-400" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200">主题设置</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setThemeMode('light')}
              className={`p-4 border-2 transition-all ${
                themeMode === 'light'
                  ? 'border-endfield-yellow bg-yellow-50 dark:bg-zinc-800'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500'
              }`}
            >
              <Sun size={24} className={`mx-auto mb-2 ${themeMode === 'light' ? 'text-yellow-600' : 'text-zinc-400'}`} />
              <span className={`text-sm font-medium ${themeMode === 'light' ? 'text-yellow-700' : 'text-zinc-500'}`}>浅色模式</span>
            </button>
            <button
              onClick={() => setThemeMode('dark')}
              className={`p-4 border-2 transition-all ${
                themeMode === 'dark'
                  ? 'border-endfield-yellow bg-zinc-800'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500'
              }`}
            >
              <Moon size={24} className={`mx-auto mb-2 ${themeMode === 'dark' ? 'text-white' : 'text-zinc-400'}`} />
              <span className={`text-sm font-medium ${themeMode === 'dark' ? 'text-zinc-200' : 'text-zinc-500'}`}>深色模式</span>
            </button>
            <button
              onClick={() => setThemeMode('system')}
              className={`p-4 border-2 transition-all ${
                themeMode === 'system'
                  ? 'border-endfield-yellow bg-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500'
              }`}
            >
              <Monitor size={24} className={`mx-auto mb-2 ${themeMode === 'system' ? 'text-black dark:text-white' : 'text-zinc-400'}`} />
              <span className={`text-sm font-medium ${themeMode === 'system' ? 'text-zinc-900 dark:text-zinc-200' : 'text-zinc-500'}`}>跟随系统</span>
            </button>
          </div>
        </div>
      </div>

      {/* 数据管理 */}
      {user && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
            <Trash2 size={20} className="text-zinc-600 dark:text-zinc-400" />
            <h3 className="font-bold text-zinc-700 dark:text-zinc-200">数据管理</h3>
          </div>
          <div className="p-6 space-y-4">
            {/* 数据统计 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <div className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{userPoolCount}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-500">卡池数量</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <div className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{userHistoryCount}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-500">抽卡记录</div>
              </div>
            </div>

            {/* 手动同步到云端 */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-700 dark:text-zinc-300">同步数据到云端</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                    将你创建的卡池和抽卡记录上传到云端（不会上传其他用户的数据）
                  </p>
                </div>
                <button
                  onClick={handleManualSync}
                  disabled={syncing || (userPoolCount === 0 && userHistoryCount === 0)}
                  className="flex items-center gap-2 px-4 py-2 bg-endfield-yellow hover:bg-yellow-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-black text-sm font-bold tracking-wider transition-colors disabled:cursor-not-allowed"
                >
                  {syncing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      同步中...
                    </>
                  ) : (
                    <>
                      <Cloud size={16} />
                      立即同步
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 删除所有数据 */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-700 dark:text-zinc-300">删除所有数据</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                    删除当前账号添加的所有卡池和抽卡记录
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  disabled={userPoolCount === 0 && userHistoryCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-sm font-bold tracking-wider transition-colors disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                  删除全部
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
                修改密码
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-none text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-2 rounded-none text-sm">
                  {passwordSuccess}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">新密码</label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                  placeholder="至少6位字符"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">确认新密码</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  placeholder="再次输入新密码"
                  required
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-none focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-endfield-yellow text-black hover:bg-yellow-400 font-bold uppercase tracking-wider hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 rounded-none transition-colors"
              >
                {passwordLoading ? '修改中...' : '确认修改'}
              </button>
            </form>
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
