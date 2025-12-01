import React, { useState, useEffect } from 'react';
import { Shield, Bell, User, History, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';

const AdminPanel = React.memo(({ showToast }) => {
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 加载数据
  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 获取所有用户
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*');

        setUsers(profilesData || []);

        // 获取所有申请
        const { data: appsData } = await supabase
          .from('admin_applications')
          .select('*');

        setApplications(appsData || []);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 审批申请
  const handleApprove = async (appId, userId) => {
    if (!supabase) return;
    setActionLoading(appId);

    try {
      // 更新申请状态
      const { error: appError } = await supabase
        .from('admin_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', appId);

      if (appError) throw appError;

      // 更新用户角色
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userId);

      if (profileError) throw profileError;

      // 更新本地状态
      setApplications(prev => prev.map(a =>
        a.id === appId ? { ...a, status: 'approved' } : a
      ));
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: 'admin' } : u
      ));

      showToast('审批通过！该用户现已成为管理员', 'success');
    } catch (error) {
      console.error('审批失败:', error);
      showToast('审批失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 拒绝申请
  const handleReject = async (appId) => {
    if (!supabase) return;
    setActionLoading(appId);

    try {
      const { error } = await supabase
        .from('admin_applications')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', appId);

      if (error) throw error;

      setApplications(prev => prev.map(a =>
        a.id === appId ? { ...a, status: 'rejected' } : a
      ));

      showToast('已拒绝该申请', 'info');
    } catch (error) {
      console.error('拒绝失败:', error);
      showToast('拒绝失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 更改用户角色
  const handleChangeRole = async (userId, newRole) => {
    if (!supabase) return;
    setActionLoading(userId);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));

      const roleLabel = newRole === 'admin' ? '管理员' : '普通用户';
      showToast(`已将用户角色更改为${roleLabel}`, 'success');
    } catch (error) {
      console.error('更改角色失败:', error);
      showToast('更改角色失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingApps = applications.filter(a => a.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-none p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Shield size={28} />
          超级管理员控制台
        </h2>
        <p className="text-red-100 mt-1">管理用户权限和审批申请</p>
      </div>

      {/* 待审批申请 */}
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-amber-50 flex items-center gap-2">
          <Bell size={20} className="text-amber-600" />
          <h3 className="font-bold text-amber-800">待审批申请</h3>
          {pendingApps.length > 0 && (
            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-sm">
              {pendingApps.length}
            </span>
          )}
        </div>

        {pendingApps.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-zinc-500">
            暂无待审批申请
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingApps.map(app => {
              const appUser = users.find(u => u.id === app.user_id);
              return (
                <div key={app.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:bg-zinc-950">
                  <div>
                    <div className="font-medium text-slate-700 dark:text-zinc-300">
                      {appUser?.username || '未知用户'}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-zinc-500 mt-1">
                      申请理由: {app.reason}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      {new Date(app.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(app.id, app.user_id)}
                      disabled={actionLoading === app.id}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-none transition-colors disabled:opacity-50"
                    >
                      {actionLoading === app.id ? '处理中...' : '通过'}
                    </button>
                    <button
                      onClick={() => handleReject(app.id)}
                      disabled={actionLoading === app.id}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors disabled:opacity-50"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 用户管理 */}
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2">
          <User size={20} className="text-slate-600 dark:text-zinc-400" />
          <h3 className="font-bold text-slate-700 dark:text-zinc-300">用户管理</h3>
          <span className="text-slate-400 dark:text-zinc-500 text-sm">({users.length} 人)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">用户名</th>
                <th className="px-4 py-3 text-left">角色</th>
                <th className="px-4 py-3 text-left">注册时间</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700 dark:text-zinc-300">{u.username}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                      u.role === 'super_admin' ? 'bg-red-100 text-red-600' :
                      u.role === 'admin' ? 'bg-green-100 text-green-600' :
                      'bg-slate-100 text-slate-500 dark:text-zinc-500'
                    }`}>
                      {u.role === 'super_admin' ? '超级管理员' :
                       u.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-zinc-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'super_admin' && (
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        disabled={actionLoading === u.id}
                        className="text-sm border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="user">普通用户</option>
                        <option value="admin">管理员</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 历史申请记录 */}
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2">
          <History size={20} className="text-slate-600 dark:text-zinc-400" />
          <h3 className="font-bold text-slate-700 dark:text-zinc-300">申请历史</h3>
        </div>

        {applications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-zinc-500">
            暂无申请记录
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.map(app => {
              const appUser = users.find(u => u.id === app.user_id);
              return (
                <div key={app.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-700 dark:text-zinc-300">
                      {appUser?.username || '未知用户'}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-zinc-500">{app.reason}</div>
                    <div className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                      {new Date(app.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    app.status === 'approved' ? 'bg-green-100 text-green-600' :
                    app.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    {app.status === 'approved' ? '已通过' :
                     app.status === 'rejected' ? '已拒绝' : '待审批'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default AdminPanel;
