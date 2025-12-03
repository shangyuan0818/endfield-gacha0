import React, { useState, useEffect } from 'react';
import { Shield, Bell, User, History, RefreshCw, Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Search, UserPlus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import SimpleMarkdown from './SimpleMarkdown';

const AdminPanel = React.memo(({ showToast }) => {
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 用户管理状态
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'user' | 'admin' | 'super_admin'
  const [editingUser, setEditingUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });

  // 公告管理状态
  const [announcements, setAnnouncements] = useState([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    version: '1.0.0',
    is_active: true,
    priority: 0
  });
  const [previewMode, setPreviewMode] = useState(false);

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

        // 获取所有公告（包括未激活的）
        const { data: announcementsData } = await supabase
          .from('announcements')
          .select('*')
          .order('priority', { ascending: false });

        setAnnouncements(announcementsData || []);
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

  // ========== 用户管理函数 ==========

  // 重置用户表单
  const resetUserForm = () => {
    setUserForm({
      username: '',
      email: '',
      password: '',
      role: 'user'
    });
    setEditingUser(null);
    setShowUserForm(false);
  };

  // 开始编辑用户
  const startEditUser = (user) => {
    setUserForm({
      username: user.username || '',
      email: user.email || '',
      password: '', // 编辑时不显示密码
      role: user.role
    });
    setEditingUser(user);
    setShowUserForm(true);
  };

  // 保存用户（新建或编辑）
  const saveUser = async () => {
    if (!supabase) return;

    // 验证必填字段
    if (!editingUser && (!userForm.email.trim() || !userForm.password.trim())) {
      showToast('邮箱和密码不能为空', 'error');
      return;
    }

    if (editingUser && !userForm.username.trim()) {
      showToast('用户名不能为空', 'error');
      return;
    }

    setActionLoading('user');

    try {
      if (editingUser) {
        // 更新现有用户
        const { error } = await supabase
          .from('profiles')
          .update({
            username: userForm.username,
            role: userForm.role
          })
          .eq('id', editingUser.id);

        if (error) throw error;

        setUsers(prev => prev.map(u =>
          u.id === editingUser.id ? { ...u, username: userForm.username, role: userForm.role } : u
        ));
        showToast('用户已更新', 'success');
      } else {
        // 创建新用户 - 调用 Edge Function
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(
          `${supabase.supabaseUrl}/functions/v1/admin-create-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              email: userForm.email,
              password: userForm.password,
              username: userForm.username || userForm.email.split('@')[0],
              role: userForm.role
            })
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || '创建用户失败');
        }

        // 重新获取用户列表
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*');
        setUsers(profilesData || []);

        showToast('用户已创建', 'success');
      }

      resetUserForm();
    } catch (error) {
      console.error('保存用户失败:', error);
      showToast('保存用户失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除用户
  const deleteUser = async (user) => {
    if (!supabase) return;

    // 防止删除超级管理员
    if (user.role === 'super_admin') {
      showToast('无法删除超级管理员账户', 'error');
      return;
    }

    if (!window.confirm(`确定要删除用户「${user.username}」吗？此操作将删除该用户的所有数据，且无法撤销。`)) {
      return;
    }

    setActionLoading(user.id);

    try {
      // 调用 Edge Function 删除用户
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            userId: user.id
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '删除用户失败');
      }

      // 更新本地状态
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setApplications(prev => prev.filter(a => a.user_id !== user.id));

      showToast('用户已删除', 'success');
    } catch (error) {
      console.error('删除用户失败:', error);
      showToast('删除用户失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 过滤用户列表
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // ========== 公告管理函数 ==========

  // 重置表单
  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      title: '',
      content: '',
      version: '1.0.0',
      is_active: true,
      priority: 0
    });
    setEditingAnnouncement(null);
    setShowAnnouncementForm(false);
    setPreviewMode(false);
  };

  // 开始编辑公告
  const startEditAnnouncement = (announcement) => {
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      version: announcement.version || '1.0.0',
      is_active: announcement.is_active,
      priority: announcement.priority || 0
    });
    setEditingAnnouncement(announcement);
    setShowAnnouncementForm(true);
    setPreviewMode(false);
  };

  // 保存公告
  const saveAnnouncement = async () => {
    if (!supabase) return;
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      showToast('标题和内容不能为空', 'error');
      return;
    }

    setActionLoading('announcement');

    try {
      if (editingAnnouncement) {
        // 更新现有公告
        const { error } = await supabase
          .from('announcements')
          .update({
            title: announcementForm.title,
            content: announcementForm.content,
            version: announcementForm.version,
            is_active: announcementForm.is_active,
            priority: announcementForm.priority,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAnnouncement.id);

        if (error) throw error;

        setAnnouncements(prev => prev.map(a =>
          a.id === editingAnnouncement.id ? { ...a, ...announcementForm, updated_at: new Date().toISOString() } : a
        ));
        showToast('公告已更新', 'success');
      } else {
        // 创建新公告
        const { data, error } = await supabase
          .from('announcements')
          .insert({
            title: announcementForm.title,
            content: announcementForm.content,
            version: announcementForm.version,
            is_active: announcementForm.is_active,
            priority: announcementForm.priority
          })
          .select()
          .single();

        if (error) throw error;

        setAnnouncements(prev => [data, ...prev]);
        showToast('公告已创建', 'success');
      }

      resetAnnouncementForm();
    } catch (error) {
      console.error('保存公告失败:', error);
      showToast('保存公告失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 切换公告激活状态
  const toggleAnnouncementActive = async (announcement) => {
    if (!supabase) return;
    setActionLoading(announcement.id);

    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: !announcement.is_active })
        .eq('id', announcement.id);

      if (error) throw error;

      setAnnouncements(prev => prev.map(a =>
        a.id === announcement.id ? { ...a, is_active: !a.is_active } : a
      ));
      showToast(announcement.is_active ? '公告已停用' : '公告已激活', 'success');
    } catch (error) {
      console.error('切换公告状态失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除公告
  const deleteAnnouncement = async (announcementId) => {
    if (!supabase) return;
    if (!window.confirm('确定要删除这条公告吗？此操作无法撤销。')) return;

    setActionLoading(announcementId);

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) throw error;

      setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
      showToast('公告已删除', 'success');
    } catch (error) {
      console.error('删除公告失败:', error);
      showToast('删除失败: ' + error.message, 'error');
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
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={20} className="text-slate-600 dark:text-zinc-400" />
            <h3 className="font-bold text-slate-700 dark:text-zinc-300">用户管理</h3>
            <span className="text-slate-400 dark:text-zinc-500 text-sm">({filteredUsers.length}/{users.length} 人)</span>
          </div>
          {!showUserForm && (
            <button
              onClick={() => setShowUserForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-none transition-colors"
            >
              <UserPlus size={16} />
              添加用户
            </button>
          )}
        </div>

        {/* 用户编辑表单 */}
        {showUserForm && (
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-700 dark:text-zinc-300">
                {editingUser ? '编辑用户' : '添加新用户'}
              </h4>
              <button
                onClick={resetUserForm}
                className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* 用户名 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  用户名 {!editingUser && <span className="text-xs text-slate-400">(可选，默认为邮箱前缀)</span>}
                </label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="用户显示名称"
                />
              </div>

              {/* 邮箱（仅新建时） */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    邮箱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="user@example.com"
                    required
                  />
                </div>
              )}

              {/* 密码（仅新建时） */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    密码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="至少 6 位字符"
                    required
                    minLength={6}
                  />
                </div>
              )}

              {/* 角色 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  角色
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                  {!editingUser && <option value="super_admin">超级管理员</option>}
                </select>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={saveUser}
                  disabled={actionLoading === 'user'}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {actionLoading === 'user' ? '保存中...' : editingUser ? '更新用户' : '创建用户'}
                </button>
                <button
                  onClick={resetUserForm}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 搜索和筛选 */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex gap-3">
            {/* 搜索框 */}
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索用户名或邮箱..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* 角色筛选 */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">全部角色</option>
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
              <option value="super_admin">超级管理员</option>
            </select>
          </div>
        </div>

        {/* 用户列表 */}
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-zinc-500">
            {searchQuery || roleFilter !== 'all' ? '未找到匹配的用户' : '暂无用户'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">用户名</th>
                  <th className="px-4 py-3 text-left">邮箱</th>
                  <th className="px-4 py-3 text-left">角色</th>
                  <th className="px-4 py-3 text-left">注册时间</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700 dark:text-zinc-300">{u.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-500 dark:text-zinc-500">{u.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded font-bold ${
                        u.role === 'super_admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                        u.role === 'admin' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {u.role === 'super_admin' ? '超级管理员' :
                         u.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-zinc-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.role !== 'super_admin' && (
                          <>
                            <button
                              onClick={() => startEditUser(u)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="编辑用户"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deleteUser(u)}
                              disabled={actionLoading === u.id}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                              title="删除用户"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {/* 公告管理 */}
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-amber-800 dark:text-amber-300">公告管理</h3>
            <span className="text-amber-600 dark:text-amber-500 text-sm">({announcements.length} 条)</span>
          </div>
          {!showAnnouncementForm && (
            <button
              onClick={() => setShowAnnouncementForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-none transition-colors"
            >
              <Plus size={16} />
              新建公告
            </button>
          )}
        </div>

        {/* 公告编辑表单 */}
        {showAnnouncementForm && (
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-700 dark:text-zinc-300">
                {editingAnnouncement ? '编辑公告' : '新建公告'}
              </h4>
              <button
                onClick={resetAnnouncementForm}
                className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* 标题 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  标题
                </label>
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="公告标题"
                />
              </div>

              {/* 版本号和优先级 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    版本号 <span className="text-xs text-slate-400">(用于"下次更新前不显示")</span>
                  </label>
                  <input
                    type="text"
                    value={announcementForm.version}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, version: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="1.0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    优先级 <span className="text-xs text-slate-400">(数字越大越靠前)</span>
                  </label>
                  <input
                    type="number"
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* 内容编辑器/预览切换 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
                    内容 <span className="text-xs text-slate-400">(支持 Markdown)</span>
                  </label>
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
                  >
                    {previewMode ? <Edit2 size={12} /> : <Eye size={12} />}
                    {previewMode ? '编辑' : '预览'}
                  </button>
                </div>

                {previewMode ? (
                  <div className="min-h-[200px] p-4 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900">
                    <SimpleMarkdown content={announcementForm.content} className="text-slate-700 dark:text-zinc-300" />
                  </div>
                ) : (
                  <textarea
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                    rows={8}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-amber-500 outline-none font-mono text-sm"
                    placeholder="支持 Markdown 语法：&#10;## 标题&#10;**粗体** *斜体*&#10;- 列表项&#10;> 引用&#10;`代码`"
                  />
                )}
              </div>

              {/* 激活状态 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={announcementForm.is_active}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-amber-500 border-zinc-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-zinc-300">
                  立即激活显示
                </label>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={saveAnnouncement}
                  disabled={actionLoading === 'announcement'}
                  className="flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {actionLoading === 'announcement' ? '保存中...' : '保存公告'}
                </button>
                <button
                  onClick={resetAnnouncementForm}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 公告列表 */}
        {announcements.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-zinc-500">
            暂无公告
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {announcements.map(announcement => (
              <div key={announcement.id} className={`p-4 ${!announcement.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-700 dark:text-zinc-300 truncate">
                        {announcement.title}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded shrink-0">
                        v{announcement.version}
                      </span>
                      {announcement.is_active ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded shrink-0">
                          激活
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 rounded shrink-0">
                          停用
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-500 line-clamp-2">
                      {announcement.content.replace(/[#*>\-`]/g, '').slice(0, 100)}...
                    </p>
                    <div className="text-xs text-slate-400 dark:text-zinc-600 mt-1">
                      优先级: {announcement.priority} · 更新于 {new Date(announcement.updated_at || announcement.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleAnnouncementActive(announcement)}
                      disabled={actionLoading === announcement.id}
                      className={`p-1.5 rounded transition-colors ${
                        announcement.is_active
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                      title={announcement.is_active ? '停用' : '激活'}
                    >
                      {announcement.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      onClick={() => startEditAnnouncement(announcement)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteAnnouncement(announcement.id)}
                      disabled={actionLoading === announcement.id}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default AdminPanel;
