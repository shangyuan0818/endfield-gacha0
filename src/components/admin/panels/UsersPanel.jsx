import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, UserPlus, Edit2, Trash2, Save, X,
  Users, ChevronUp, ChevronDown, ChevronsUpDown, KeyRound
} from 'lucide-react';

// 格式化最后在线时间
const formatLastSeen = (timestamp) => {
  if (!timestamp) return '从未';

  const now = new Date();
  const lastSeen = new Date(timestamp);
  const diffMs = now - lastSeen;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  return `${Math.floor(diffDays / 365)}年前`;
};

const SortIcon = ({ field, userSortField, userSortDirection }) => {
  if (userSortField !== field) {
    return <ChevronsUpDown size={14} className="text-slate-300 dark:text-zinc-600" />;
  }

  return userSortDirection === 'asc'
    ? <ChevronUp size={14} className="text-blue-500" />
    : <ChevronDown size={14} className="text-blue-500" />;
};

const USER_ROW_HEIGHT = 56;
const USER_LIST_OVERSCAN = 8;
const USER_LIST_MIN_HEIGHT = 360;
const USER_LIST_MAX_HEIGHT = 720;

/**
 * 用户管理面板
 */
const UsersPanel = ({
  users,
  actionLoading,
  onSaveUser,
  onDeleteUser,
  onResetUserPassword
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userSortField, setUserSortField] = useState('created_at');
  const [userSortDirection, setUserSortDirection] = useState('desc');
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [userListHeight, setUserListHeight] = useState(480);
  const [userScrollTop, setUserScrollTop] = useState(0);
  const userListRef = useRef(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });

  const resetUserForm = () => {
    setUserForm({ username: '', email: '', password: '', role: 'user' });
    setEditingUser(null);
    setShowUserForm(false);
  };

  const startEditUser = (user) => {
    setUserForm({
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role
    });
    setEditingUser(user);
    setShowUserForm(true);
  };

  const handleSave = () => {
    onSaveUser(userForm, editingUser, resetUserForm);
  };

  const closeResetPasswordDialog = () => {
    setResetPasswordTarget(null);
    setResetPasswordValue('');
  };

  const handleResetPassword = () => {
    if (!resetPasswordTarget) {
      return;
    }

    onResetUserPassword(resetPasswordTarget, resetPasswordValue, closeResetPasswordDialog);
  };

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const result = users.filter(user => {
      const matchesSearch = !normalizedQuery ||
                           user.username?.toLowerCase().includes(normalizedQuery) ||
                           user.email?.toLowerCase().includes(normalizedQuery) ||
                           String(user.id || '').toLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });

    result.sort((a, b) => {
      let aVal, bVal;

      switch (userSortField) {
        case 'username':
          aVal = a.username || '';
          bVal = b.username || '';
          break;
        case 'email':
          aVal = a.email || '';
          bVal = b.email || '';
          break;
        case 'role': {
          const roleOrder = { super_admin: 3, admin: 2, user: 1 };
          aVal = roleOrder[a.role] || 0;
          bVal = roleOrder[b.role] || 0;
          break;
        }
        case 'last_seen_at':
          aVal = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
          bVal = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
          break;
        case 'created_at':
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
        default:
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
      }

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'zh-CN');
        return userSortDirection === 'asc' ? cmp : -cmp;
      } else {
        return userSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    return result;
  }, [users, searchQuery, roleFilter, userSortField, userSortDirection]);

  const handleUserSort = (field) => {
    if (userSortField === field) {
      setUserSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortField(field);
      setUserSortDirection(field === 'username' || field === 'email' ? 'asc' : 'desc');
    }
  };

  useEffect(() => {
    const updateListHeight = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const availableHeight = Math.floor(window.innerHeight * 0.62);
      setUserListHeight(Math.max(USER_LIST_MIN_HEIGHT, Math.min(USER_LIST_MAX_HEIGHT, availableHeight)));
    };

    updateListHeight();
    window.addEventListener('resize', updateListHeight);
    return () => window.removeEventListener('resize', updateListHeight);
  }, []);

  useEffect(() => {
    if (!userListRef.current) {
      return;
    }

    userListRef.current.scrollTop = 0;
    setUserScrollTop(0);
  }, [searchQuery, roleFilter, userSortField, userSortDirection]);

  const visibleUserRange = useMemo(() => {
    const viewportHeight = Math.max(userListHeight, USER_LIST_MIN_HEIGHT);
    const startIndex = Math.max(0, Math.floor(userScrollTop / USER_ROW_HEIGHT) - USER_LIST_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / USER_ROW_HEIGHT) + USER_LIST_OVERSCAN * 2;
    const endIndex = Math.min(filteredUsers.length, startIndex + visibleCount);

    return {
      startIndex,
      endIndex,
      totalHeight: filteredUsers.length * USER_ROW_HEIGHT,
      offsetTop: startIndex * USER_ROW_HEIGHT,
      items: filteredUsers.slice(startIndex, endIndex)
    };
  }, [filteredUsers, userListHeight, userScrollTop]);

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索用户名、邮箱或用户 ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
        >
          <option value="all">全部角色</option>
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
          <option value="super_admin">超级管理员</option>
        </select>
        {!showUserForm && (
          <button
            onClick={() => setShowUserForm(true)}
            className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-none transition-colors"
          >
            <UserPlus size={16} />
            添加用户
          </button>
        )}
      </div>

      {/* 用户编辑表单 */}
      {showUserForm && (
        <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-700 dark:text-zinc-300">
              {editingUser ? '编辑用户' : '添加新用户'}
            </h4>
            <button onClick={resetUserForm} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">用户名</label>
              <input
                type="text"
                value={userForm.username}
                onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                placeholder="用户显示名称"
              />
            </div>
            {!editingUser && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">邮箱 *</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">密码 *</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    placeholder="至少 6 位字符"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">角色</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
              >
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
                {!editingUser && <option value="super_admin">超级管理员</option>}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={actionLoading === 'user'}
              className="flex items-center gap-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {actionLoading === 'user' ? '保存中...' : '保存'}
            </button>
            <button onClick={resetUserForm} className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none">
              取消
            </button>
          </div>
        </div>
      )}

      {resetPasswordTarget && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-slate-700 dark:text-zinc-300">重置用户密码</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                当前用户：{resetPasswordTarget.username || resetPasswordTarget.email || resetPasswordTarget.id}
              </p>
            </div>
            <button onClick={closeResetPasswordDialog} className="text-slate-400 hover:text-slate-600 dark:text-zinc-500">
              <X size={20} />
            </button>
          </div>

          <div className="max-w-md">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
              临时密码
            </label>
            <input
              type="text"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
              placeholder="至少 6 位字符"
            />
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-2">
              该操作会直接覆盖现有密码，请通过可信渠道把临时密码发送给用户，并要求其登录后立即修改。
            </p>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleResetPassword}
              disabled={actionLoading === `reset_password_${resetPasswordTarget.id}`}
              className="flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <KeyRound size={16} />
              {actionLoading === `reset_password_${resetPasswordTarget.id}` ? '设置中...' : '设置临时密码'}
            </button>
            <button
              onClick={closeResetPasswordDialog}
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 用户列表 */}
      <div className="text-xs text-slate-500 dark:text-zinc-500 mb-2">
        显示 {filteredUsers.length} / {users.length} 个用户
      </div>

      {filteredUsers.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p>未找到匹配的用户</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800">
          <div className="min-w-[980px] text-sm">
            <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(240px,1.6fr)_120px_140px_120px_120px] bg-slate-50 dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800">
              <div className="px-4 py-3 text-left">
                <button
                  onClick={() => handleUserSort('username')}
                  className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                >
                  用户名 <SortIcon field="username" userSortField={userSortField} userSortDirection={userSortDirection} />
                </button>
              </div>
              <div className="px-4 py-3 text-left">
                <button
                  onClick={() => handleUserSort('email')}
                  className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                >
                  邮箱 <SortIcon field="email" userSortField={userSortField} userSortDirection={userSortDirection} />
                </button>
              </div>
              <div className="px-4 py-3 text-left">
                <button
                  onClick={() => handleUserSort('role')}
                  className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                >
                  角色 <SortIcon field="role" userSortField={userSortField} userSortDirection={userSortDirection} />
                </button>
              </div>
              <div className="px-4 py-3 text-left">
                <button
                  onClick={() => handleUserSort('last_seen_at')}
                  className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                >
                  最后在线 <SortIcon field="last_seen_at" userSortField={userSortField} userSortDirection={userSortDirection} />
                </button>
              </div>
              <div className="px-4 py-3 text-left">
                <button
                  onClick={() => handleUserSort('created_at')}
                  className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                >
                  注册时间 <SortIcon field="created_at" userSortField={userSortField} userSortDirection={userSortDirection} />
                </button>
              </div>
              <div className="px-4 py-3 text-right">操作</div>
            </div>

            <div
              ref={userListRef}
              onScroll={(event) => setUserScrollTop(event.currentTarget.scrollTop)}
              className="overflow-y-auto"
              style={{ height: `${userListHeight}px` }}
            >
              <div style={{ height: `${visibleUserRange.totalHeight}px`, position: 'relative' }}>
                <div
                  className="absolute inset-x-0"
                  style={{ top: `${visibleUserRange.offsetTop}px` }}
                >
                  {visibleUserRange.items.map((u) => (
                    <div
                      key={u.id}
                      className="grid grid-cols-[minmax(180px,1.2fr)_minmax(240px,1.6fr)_120px_140px_120px_120px] border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950"
                      style={{ minHeight: `${USER_ROW_HEIGHT}px` }}
                    >
                      <div className="px-4 py-3 font-medium text-slate-700 dark:text-zinc-300 truncate" title={u.username || '-'}>
                        {u.username || '-'}
                      </div>
                      <div className="px-4 py-3 text-slate-500 dark:text-zinc-500 truncate" title={u.email || '-'}>
                        {u.email || '-'}
                      </div>
                      <div className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded font-bold ${
                          u.role === 'super_admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          u.role === 'admin' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {u.role === 'super_admin' ? '超管' : u.role === 'admin' ? '管理员' : '用户'}
                        </span>
                      </div>
                      <div className="px-4 py-3 text-slate-500 dark:text-zinc-500">
                        {u.last_seen_at ? (
                          <span title={new Date(u.last_seen_at).toLocaleString()}>
                            {formatLastSeen(u.last_seen_at)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-600">从未</span>
                        )}
                      </div>
                      <div className="px-4 py-3 text-slate-500 dark:text-zinc-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {u.role !== 'super_admin' && (
                            <>
                              <button onClick={() => startEditUser(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="编辑">
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setResetPasswordTarget(u);
                                  setResetPasswordValue('');
                                }}
                                disabled={Boolean(actionLoading) && actionLoading !== `reset_password_${u.id}`}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded disabled:opacity-50"
                                title="重置密码"
                              >
                                <KeyRound size={16} />
                              </button>
                              <button onClick={() => onDeleteUser(u)} disabled={actionLoading === u.id} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50" title="删除">
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPanel;
