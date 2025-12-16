import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Bell, User, History, RefreshCw, Plus, Edit2, Trash2,
  Eye, EyeOff, Save, X, Search, UserPlus, ChevronRight,
  Users, FileText, Ban, CheckCircle, XCircle, Clock, Database,
  Package, ListOrdered, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import SimpleMarkdown from './SimpleMarkdown';
import { validateUserData } from '../utils/validators';

// 侧边栏菜单项配置
const MENU_ITEMS = [
  { id: 'applications', label: '申请审批', icon: Clock, badge: 'pending' },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'userData', label: '用户数据', icon: Database },
  { id: 'blacklist', label: '黑名单', icon: Ban },
  { id: 'announcements', label: '公告管理', icon: Bell },
  { id: 'history', label: '申请历史', icon: History },
];

const AdminPanel = React.memo(({ showToast }) => {
  // 当前选中的菜单
  const [activeMenu, setActiveMenu] = useState('applications');
  
  // 数据状态
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 用户管理状态
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });

  // 黑名单状态
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [showBlacklistForm, setShowBlacklistForm] = useState(false);
  const [blacklistForm, setBlacklistForm] = useState({
    email: '',
    reason: '',
    type: 'email' // 'email' | 'domain'
  });

  // 公告管理状态
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

  // 用户数据管理状态
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDataSearch, setUserDataSearch] = useState('');
  const [userPools, setUserPools] = useState([]);
  const [userHistory, setUserHistory] = useState([]);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [expandedPools, setExpandedPools] = useState(new Set());

  // 计算待审批数量
  const pendingCount = useMemo(() => 
    applications.filter(a => a.status === 'pending').length, 
    [applications]
  );

  // 加载数据
  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 并行获取所有数据
        const [profilesRes, appsRes, announcementsRes, blacklistRes] = await Promise.all([
          supabase.from('profiles').select('*'),
          supabase.from('admin_applications').select('*'),
          supabase.from('announcements').select('*').order('priority', { ascending: false }),
          supabase.from('blacklist').select('*').order('created_at', { ascending: false })
        ]);

        setUsers(profilesRes.data || []);
        setApplications(appsRes.data || []);
        setAnnouncements(announcementsRes.data || []);
        setBlacklist(blacklistRes.data || []);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ========== 申请审批函数 ==========
  const handleApprove = async (appId, userId) => {
    if (!supabase) return;
    setActionLoading(appId);

    try {
      const { error: appError } = await supabase
        .from('admin_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', appId);

      if (appError) throw appError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userId);

      if (profileError) throw profileError;

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

  // 批量审批
  const handleBatchApprove = async () => {
    const pendingApps = applications.filter(a => a.status === 'pending');
    if (pendingApps.length === 0) return;
    
    if (!window.confirm(`确定要批量通过 ${pendingApps.length} 个申请吗？`)) return;

    setActionLoading('batch');
    try {
      for (const app of pendingApps) {
        await handleApprove(app.id, app.user_id);
      }
      showToast(`已批量通过 ${pendingApps.length} 个申请`, 'success');
    } catch (error) {
      showToast('批量操作失败', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchReject = async () => {
    const pendingApps = applications.filter(a => a.status === 'pending');
    if (pendingApps.length === 0) return;
    
    if (!window.confirm(`确定要批量拒绝 ${pendingApps.length} 个申请吗？`)) return;

    setActionLoading('batch');
    try {
      for (const app of pendingApps) {
        await handleReject(app.id);
      }
      showToast(`已批量拒绝 ${pendingApps.length} 个申请`, 'success');
    } catch (error) {
      showToast('批量操作失败', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ========== 用户管理函数 ==========
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

  const saveUser = async () => {
    if (!supabase) return;

    // ========== 增强的参数验证 ==========
    const isCreating = !editingUser;
    const validation = validateUserData(userForm, isCreating);

    if (!validation.isValid) {
      // 显示所有验证错误
      validation.errors.forEach(error => {
        showToast(error, 'error');
      });
      return;
    }

    // 额外的前端安全检查：明确禁止创建超级管理员
    if (userForm.role === 'super_admin') {
      showToast('禁止通过此接口创建超级管理员', 'error');
      return;
    }

    // 限制角色只能为 user 或 admin
    if (!['user', 'admin'].includes(userForm.role)) {
      showToast('无效的角色类型，只允许 user 或 admin', 'error');
      return;
    }

    setActionLoading('user');

    try {
      if (editingUser) {
        // 编辑现有用户
        const { error } = await supabase
          .from('profiles')
          .update({ username: userForm.username, role: userForm.role })
          .eq('id', editingUser.id);

        if (error) throw error;

        setUsers(prev => prev.map(u =>
          u.id === editingUser.id ? { ...u, username: userForm.username, role: userForm.role } : u
        ));
        showToast('用户已更新', 'success');
      } else {
        // 创建新用户
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
              email: userForm.email.trim(),
              password: userForm.password,
              username: userForm.username?.trim() || userForm.email.split('@')[0],
              role: userForm.role // 已经过验证，只能是 'user' 或 'admin'
            })
          }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '创建用户失败');

        const { data: profilesData } = await supabase.from('profiles').select('*');
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

  const deleteUser = async (user) => {
    if (!supabase) return;

    if (user.role === 'super_admin') {
      showToast('无法删除超级管理员账户', 'error');
      return;
    }

    if (!window.confirm(`确定要删除用户「${user.username}」吗？此操作将删除该用户的所有数据，且无法撤销。`)) {
      return;
    }

    setActionLoading(user.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ userId: user.id })
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '删除用户失败');

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

  // 加入黑名单（从用户管理）
  const addToBlacklist = async (user) => {
    if (!supabase) return;
    
    const reason = window.prompt(`请输入将用户「${user.username}」加入黑名单的原因：`);
    if (!reason) return;

    setActionLoading(user.id);

    try {
      // 添加到黑名单
      const { data, error } = await supabase
        .from('blacklist')
        .insert({
          email: user.email,
          reason: reason,
          type: 'email',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setBlacklist(prev => [data, ...prev]);
      showToast(`已将 ${user.email} 加入黑名单`, 'success');
    } catch (error) {
      console.error('添加黑名单失败:', error);
      showToast('添加黑名单失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // ========== 黑名单管理函数 ==========
  const resetBlacklistForm = () => {
    setBlacklistForm({ email: '', reason: '', type: 'email' });
    setShowBlacklistForm(false);
  };

  const saveBlacklistEntry = async () => {
    if (!supabase) return;

    if (!blacklistForm.email.trim() || !blacklistForm.reason.trim()) {
      showToast('邮箱/域名和原因不能为空', 'error');
      return;
    }

    setActionLoading('blacklist');

    try {
      const { data, error } = await supabase
        .from('blacklist')
        .insert({
          email: blacklistForm.email,
          reason: blacklistForm.reason,
          type: blacklistForm.type,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setBlacklist(prev => [data, ...prev]);
      showToast('已添加到黑名单', 'success');
      resetBlacklistForm();
    } catch (error) {
      console.error('添加黑名单失败:', error);
      showToast('添加黑名单失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const removeFromBlacklist = async (entry) => {
    if (!supabase) return;
    
    if (!window.confirm(`确定要将「${entry.email}」从黑名单中移除吗？`)) return;

    setActionLoading(entry.id);

    try {
      const { error } = await supabase
        .from('blacklist')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      setBlacklist(prev => prev.filter(b => b.id !== entry.id));
      showToast('已从黑名单移除', 'success');
    } catch (error) {
      console.error('移除黑名单失败:', error);
      showToast('移除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredBlacklist = blacklist.filter(entry =>
    entry.email?.toLowerCase().includes(blacklistSearch.toLowerCase()) ||
    entry.reason?.toLowerCase().includes(blacklistSearch.toLowerCase())
  );

  // ========== 用户数据管理函数 ==========
  const loadUserData = async (userId) => {
    if (!supabase || !userId) return;
    
    setUserDataLoading(true);
    setSelectedUserId(userId);
    setExpandedPools(new Set());
    
    try {
      // 并行获取用户的卡池和历史记录
      const [poolsRes, historyRes] = await Promise.all([
        supabase.from('pools').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('history').select('*').eq('user_id', userId).order('timestamp', { ascending: false }).limit(500)
      ]);
      
      setUserPools(poolsRes.data || []);
      setUserHistory(historyRes.data || []);
    } catch (error) {
      console.error('加载用户数据失败:', error);
      showToast('加载用户数据失败: ' + error.message, 'error');
    } finally {
      setUserDataLoading(false);
    }
  };

  const togglePoolExpand = (poolId) => {
    setExpandedPools(prev => {
      const next = new Set(prev);
      if (next.has(poolId)) {
        next.delete(poolId);
      } else {
        next.add(poolId);
      }
      return next;
    });
  };

  const getUserStats = (userId) => {
    const userPoolCount = userPools.length;
    const userRecordCount = userHistory.length;
    const sixStarCount = userHistory.filter(h => h.rarity === 6).length;
    const fiveStarCount = userHistory.filter(h => h.rarity === 5).length;
    return { userPoolCount, userRecordCount, sixStarCount, fiveStarCount };
  };

  const getPoolStats = (poolId) => {
    const records = userHistory.filter(h => h.pool_id === poolId);
    const total = records.length;
    const sixStar = records.filter(r => r.rarity === 6).length;
    const fiveStar = records.filter(r => r.rarity === 5).length;
    const fourStar = records.filter(r => r.rarity === 4).length;
    const threeStar = records.filter(r => r.rarity === 3).length;
    return { total, sixStar, fiveStar, fourStar, threeStar };
  };

  const filteredUsersForData = users.filter(user =>
    user.username?.toLowerCase().includes(userDataSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userDataSearch.toLowerCase())
  );

  // 清理当前选中用户的数据（卡池+记录）
  const handleDeleteUserData = async () => {
    if (!supabase || !selectedUserId) return;
    if (!window.confirm('确定要清空该用户的所有卡池和抽卡记录吗？此操作不可恢复。')) return;

    setActionLoading('purgeUserData');
    try {
      const { error: errHistory } = await supabase.from('history').delete().eq('user_id', selectedUserId);
      if (errHistory) throw errHistory;
      const { error: errPools } = await supabase.from('pools').delete().eq('user_id', selectedUserId);
      if (errPools) throw errPools;
      await loadUserData(selectedUserId);
      showToast('已清空该用户的卡池和抽卡记录', 'success');
    } catch (error) {
      console.error('清理用户数据失败:', error);
      showToast('清理用户数据失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除指定卡池的所有记录
  const handleDeletePoolRecords = async (poolId) => {
    if (!supabase || !selectedUserId) return;
    if (!window.confirm('确定清空该卡池的所有抽卡记录吗？此操作不可恢复。')) return;

    setActionLoading(`purge_records_${poolId}`);
    try {
      const { error } = await supabase.from('history').delete().eq('user_id', selectedUserId).eq('pool_id', poolId);
      if (error) throw error;
      await loadUserData(selectedUserId);
      showToast('已清空该卡池的抽卡记录', 'success');
    } catch (error) {
      console.error('清理卡池记录失败:', error);
      showToast('清理卡池记录失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除卡池及其记录
  const handleDeletePool = async (poolId) => {
    if (!supabase || !selectedUserId) return;
    if (!window.confirm('确定删除该卡池及其所有记录吗？此操作不可恢复。')) return;

    setActionLoading(`delete_pool_${poolId}`);
    try {
      const { error: errHistory } = await supabase.from('history').delete().eq('user_id', selectedUserId).eq('pool_id', poolId);
      if (errHistory) throw errHistory;
      const { error: errPools } = await supabase.from('pools').delete().eq('user_id', selectedUserId).eq('pool_id', poolId);
      if (errPools) throw errPools;
      await loadUserData(selectedUserId);
      showToast('已删除卡池及其记录', 'success');
    } catch (error) {
      console.error('删除卡池失败:', error);
      showToast('删除卡池失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ========== 公告管理函数 ==========
  const resetAnnouncementForm = () => {
    setAnnouncementForm({ title: '', content: '', version: '1.0.0', is_active: true, priority: 0 });
    setEditingAnnouncement(null);
    setShowAnnouncementForm(false);
    setPreviewMode(false);
  };

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

  const saveAnnouncement = async () => {
    if (!supabase) return;
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      showToast('标题和内容不能为空', 'error');
      return;
    }

    setActionLoading('announcement');

    try {
      if (editingAnnouncement) {
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

  // ========== 渲染各面板 ==========
  const renderApplicationsPanel = () => (
    <div className="space-y-4">
      {/* 批量操作栏 */}
      {pendingApps.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <span className="text-sm text-amber-700 dark:text-amber-300">
            共 {pendingApps.length} 个待审批申请
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBatchApprove}
              disabled={actionLoading === 'batch'}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <CheckCircle size={14} />
              全部通过
            </button>
            <button
              onClick={handleBatchReject}
              disabled={actionLoading === 'batch'}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <XCircle size={14} />
              全部拒绝
            </button>
          </div>
        </div>
      )}

      {/* 申请列表 */}
      {pendingApps.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无待审批申请</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingApps.map(app => {
            const appUser = users.find(u => u.id === app.user_id);
            return (
              <div key={app.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-700 dark:text-zinc-300">
                        {appUser?.username || '未知用户'}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">
                        {appUser?.email}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mb-2">
                      {app.reason}
                    </p>
                    <span className="text-xs text-slate-400 dark:text-zinc-600">
                      {new Date(app.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(app.id, app.user_id)}
                      disabled={actionLoading === app.id}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-none transition-colors disabled:opacity-50"
                    >
                      通过
                    </button>
                    <button
                      onClick={() => handleReject(app.id)}
                      disabled={actionLoading === app.id}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors disabled:opacity-50"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderUsersPanel = () => (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索用户名或邮箱..."
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
              onClick={saveUser}
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
          <table className="w-full text-sm">
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
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-zinc-300">{u.username}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-500">{u.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                      u.role === 'super_admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      u.role === 'admin' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      {u.role === 'super_admin' ? '超管' : u.role === 'admin' ? '管理员' : '用户'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {u.role !== 'super_admin' && (
                        <>
                          <button onClick={() => startEditUser(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="编辑">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => addToBlacklist(u)} className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded" title="加入黑名单">
                            <Ban size={16} />
                          </button>
                          <button onClick={() => deleteUser(u)} disabled={actionLoading === u.id} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50" title="删除">
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
  );

  const renderBlacklistPanel = () => (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={blacklistSearch}
            onChange={(e) => setBlacklistSearch(e.target.value)}
            placeholder="搜索邮箱或原因..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
          />
        </div>
        {!showBlacklistForm && (
          <button
            onClick={() => setShowBlacklistForm(true)}
            className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors"
          >
            <Plus size={16} />
            添加黑名单
          </button>
        )}
      </div>

      {/* 添加表单 */}
      {showBlacklistForm && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-red-800 dark:text-red-300">添加黑名单</h4>
            <button onClick={resetBlacklistForm} className="text-red-400 hover:text-red-600">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">类型</label>
              <select
                value={blacklistForm.type}
                onChange={(e) => setBlacklistForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
              >
                <option value="email">邮箱地址</option>
                <option value="domain">邮箱域名</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                {blacklistForm.type === 'email' ? '邮箱地址' : '域名'}
              </label>
              <input
                type="text"
                value={blacklistForm.email}
                onChange={(e) => setBlacklistForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                placeholder={blacklistForm.type === 'email' ? 'spam@example.com' : 'spam-domain.com'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">原因</label>
              <input
                type="text"
                value={blacklistForm.reason}
                onChange={(e) => setBlacklistForm(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                placeholder="刷号、垃圾邮件等"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={saveBlacklistEntry}
              disabled={actionLoading === 'blacklist'}
              className="flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <Ban size={16} />
              {actionLoading === 'blacklist' ? '添加中...' : '添加'}
            </button>
            <button onClick={resetBlacklistForm} className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-none">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 黑名单列表 */}
      <div className="text-xs text-slate-500 dark:text-zinc-500 mb-2">
        共 {filteredBlacklist.length} 条记录
      </div>

      {filteredBlacklist.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Ban size={48} className="mx-auto mb-4 opacity-50" />
          <p>黑名单为空</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBlacklist.map(entry => (
            <div key={entry.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    entry.type === 'domain' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {entry.type === 'domain' ? '域名' : '邮箱'}
                  </span>
                  <span className="font-mono text-slate-700 dark:text-zinc-300">{entry.email}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-zinc-500">{entry.reason}</p>
                <span className="text-xs text-slate-400 dark:text-zinc-600">
                  添加于 {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => removeFromBlacklist(entry)}
                disabled={actionLoading === entry.id}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                title="移除"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAnnouncementsPanel = () => (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-zinc-500">
          共 {announcements.length} 条公告
        </span>
        {!showAnnouncementForm && (
          <button
            onClick={() => setShowAnnouncementForm(true)}
            className="flex items-center gap-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-none transition-colors"
          >
            <Plus size={16} />
            新建公告
          </button>
        )}
      </div>

      {/* 公告编辑表单 */}
      {showAnnouncementForm && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-amber-800 dark:text-amber-300">
              {editingAnnouncement ? '编辑公告' : '新建公告'}
            </h4>
            <button onClick={resetAnnouncementForm} className="text-amber-400 hover:text-amber-600">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">标题</label>
                <input
                  type="text"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  placeholder="公告标题"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">版本号</label>
                  <input
                    type="text"
                    value={announcementForm.version}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, version: e.target.value }))}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                    placeholder="1.0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">优先级</label>
                  <input
                    type="number"
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-amber-700 dark:text-amber-300">
                  内容 <span className="text-xs opacity-75">(支持 Markdown)</span>
                </label>
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                >
                  {previewMode ? <Edit2 size={12} /> : <Eye size={12} />}
                  {previewMode ? '编辑' : '预览'}
                </button>
              </div>

              {previewMode ? (
                <div className="min-h-[200px] p-4 border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900">
                  <SimpleMarkdown content={announcementForm.content} className="text-slate-700 dark:text-zinc-300" />
                </div>
              ) : (
                <textarea
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-none bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-mono text-sm"
                  placeholder="支持 Markdown 语法..."
                />
              )}
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <input
                  type="checkbox"
                  checked={announcementForm.is_active}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-amber-500"
                />
                立即激活
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveAnnouncement}
                disabled={actionLoading === 'announcement'}
                className="flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-none transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {actionLoading === 'announcement' ? '保存中...' : '保存'}
              </button>
              <button onClick={resetAnnouncementForm} className="px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-none">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 公告列表 */}
      {announcements.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无公告</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map(announcement => (
            <div key={announcement.id} className={`p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${!announcement.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-slate-700 dark:text-zinc-300">{announcement.title}</h4>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded">
                      v{announcement.version}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      announcement.is_active ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-500'
                    }`}>
                      {announcement.is_active ? '激活' : '停用'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-500 line-clamp-2">
                    {announcement.content.replace(/[#*>\-`]/g, '').slice(0, 100)}...
                  </p>
                  <span className="text-xs text-slate-400 dark:text-zinc-600">
                    优先级: {announcement.priority} · 更新于 {new Date(announcement.updated_at || announcement.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleAnnouncementActive(announcement)} disabled={actionLoading === announcement.id} className={`p-1.5 rounded ${announcement.is_active ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`} title={announcement.is_active ? '停用' : '激活'}>
                    {announcement.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button onClick={() => startEditAnnouncement(announcement)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="编辑">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteAnnouncement(announcement.id)} disabled={actionLoading === announcement.id} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="删除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderUserDataPanel = () => {
    const selectedUser = users.find(u => u.id === selectedUserId);
    const stats = selectedUserId ? getUserStats(selectedUserId) : null;

    return (
      <div className="space-y-4">
        {/* 用户选择区域 */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* 用户列表 */}
          <div className="lg:w-72 shrink-0">
            <div className="mb-3 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                value={userDataSearch}
                onChange={(e) => setUserDataSearch(e.target.value)}
                placeholder="搜索用户..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-none bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
              />
            </div>
            <div className="border border-zinc-200 dark:border-zinc-700 max-h-[400px] overflow-y-auto">
              {filteredUsersForData.map(user => (
                <button
                  key={user.id}
                  onClick={() => loadUserData(user.id)}
                  className={`w-full text-left px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 transition-colors ${
                    selectedUserId === user.id 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' 
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="font-medium text-sm text-slate-700 dark:text-zinc-300 truncate">
                    {user.username || '未设置用户名'}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-zinc-500 truncate">
                    {user.email}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1 py-0.5 rounded ${
                      user.role === 'super_admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      user.role === 'admin' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400'
                    }`}>
                      {user.role === 'super_admin' ? '超管' : user.role === 'admin' ? '管理员' : '用户'}
                    </span>
                  </div>
                </button>
              ))}
              {filteredUsersForData.length === 0 && (
                <div className="p-4 text-center text-slate-400 dark:text-zinc-500 text-sm">
                  未找到用户
                </div>
              )}
            </div>
          </div>

          {/* 用户数据详情 */}
          <div className="flex-1 min-w-0">
            {!selectedUserId ? (
              <div className="h-full flex items-center justify-center p-12 bg-slate-50 dark:bg-zinc-950 border border-dashed border-zinc-300 dark:border-zinc-700">
                <div className="text-center text-slate-400 dark:text-zinc-500">
                  <Database size={48} className="mx-auto mb-3 opacity-50" />
                  <p>请从左侧选择一个用户查看其数据</p>
                </div>
              </div>
            ) : userDataLoading ? (
              <div className="h-full flex items-center justify-center p-12">
                <RefreshCw size={24} className="animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* 用户信息卡片 */}
                <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <User size={24} />
                    <div>
                      <h4 className="font-bold text-lg">{selectedUser?.username || '未设置用户名'}</h4>
                      <p className="text-blue-100 text-sm">{selectedUser?.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <div className="text-center p-2 bg-white/10 rounded">
                      <div className="text-2xl font-bold">{stats?.userPoolCount || 0}</div>
                      <div className="text-xs text-blue-100">卡池</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded">
                      <div className="text-2xl font-bold">{stats?.userRecordCount || 0}</div>
                      <div className="text-xs text-blue-100">记录</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded">
                      <div className="text-2xl font-bold text-yellow-300">{stats?.sixStarCount || 0}</div>
                      <div className="text-xs text-blue-100">6星</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded">
                      <div className="text-2xl font-bold text-purple-300">{stats?.fiveStarCount || 0}</div>
                      <div className="text-xs text-blue-100">5星</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={handleDeleteUserData}
                      disabled={actionLoading === 'purgeUserData'}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {actionLoading === 'purgeUserData' ? '清理中...' : '清空该用户数据'}
                    </button>
                  </div>
                </div>

                {/* 卡池列表 */}
                <div>
                  <h5 className="font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                    <Package size={16} />
                    用户创建的卡池 ({userPools.length})
                  </h5>
                  {userPools.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700">
                      该用户暂未创建任何卡池
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userPools.map(pool => {
                        const poolStats = getPoolStats(pool.pool_id);
                        const isExpanded = expandedPools.has(pool.pool_id);
                        const poolRecords = userHistory.filter(h => h.pool_id === pool.pool_id);

                        return (
                          <div key={pool.pool_id} className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                            {/* 卡池头部 */}
                            <button
                              onClick={() => togglePoolExpand(pool.pool_id)}
                              className="w-full text-left p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-xs px-2 py-1 rounded font-medium ${
                                  pool.type === 'limited' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                  pool.type === 'weapon' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                  {pool.type === 'limited' ? '限定' : pool.type === 'weapon' ? '武器' : '常驻'}
                                </span>
                                <span className="font-medium text-slate-700 dark:text-zinc-300">{pool.name}</span>
                                {pool.locked && (
                                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded">
                                    已锁定
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                                  <span>{poolStats.total} 抽</span>
                                  <span className="text-yellow-600">★{poolStats.sixStar}</span>
                                  <span className="text-purple-600">★{poolStats.fiveStar}</span>
                                </div>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </button>

                            {/* 卡池详情 */}
                            {isExpanded && (
                              <div className="border-t border-zinc-200 dark:border-zinc-700 p-3 bg-slate-50 dark:bg-zinc-950">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                  <div className="text-center p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                    <div className="text-lg font-bold text-yellow-600">{poolStats.sixStar}</div>
                                    <div className="text-xs text-slate-500">6星</div>
                                  </div>
                                  <div className="text-center p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                    <div className="text-lg font-bold text-purple-600">{poolStats.fiveStar}</div>
                                    <div className="text-xs text-slate-500">5星</div>
                                  </div>
                                  <div className="text-center p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                    <div className="text-lg font-bold text-blue-600">{poolStats.fourStar}</div>
                                    <div className="text-xs text-slate-500">4星</div>
                                  </div>
                                  <div className="text-center p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                                    <div className="text-lg font-bold text-slate-500">{poolStats.threeStar}</div>
                                    <div className="text-xs text-slate-500">3星</div>
                                  </div>
                                </div>

                                {/* 卡池级操作 */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                  <button
                                    onClick={() => handleDeletePoolRecords(pool.pool_id)}
                                    disabled={actionLoading === `purge_records_${pool.pool_id}`}
                                    className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
                                  >
                                    <Trash2 size={14} />
                                    {actionLoading === `purge_records_${pool.pool_id}` ? '清理中...' : '清空该卡池记录'}
                                  </button>
                                  <button
                                    onClick={() => handleDeletePool(pool.pool_id)}
                                    disabled={actionLoading === `delete_pool_${pool.pool_id}`}
                                    className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
                                  >
                                    <Trash2 size={14} />
                                    {actionLoading === `delete_pool_${pool.pool_id}` ? '删除中...' : '删除卡池+记录'}
                                  </button>
                                </div>

                                {/* 最近记录 */}
                                {poolRecords.length > 0 && (
                                  <div>
                                    <div className="text-xs text-slate-500 dark:text-zinc-500 mb-2">
                                      最近 {Math.min(poolRecords.length, 20)} 条记录:
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {poolRecords.slice(0, 20).map((record, idx) => (
                                        <span
                                          key={record.record_id || idx}
                                          className={`text-xs px-1.5 py-0.5 rounded ${
                                            record.rarity === 6 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-bold' :
                                            record.rarity === 5 ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                            record.rarity === 4 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                                          }`}
                                          title={`${record.rarity}星 ${record.is_standard ? '(常驻)' : ''} ${record.special_type || ''}`}
                                        >
                                          {record.rarity}★
                                          {record.is_standard && <span className="opacity-60">歪</span>}
                                          {record.special_type === 'gift' && <span className="opacity-60">礼</span>}
                                        </span>
                                      ))}
                                      {poolRecords.length > 20 && (
                                        <span className="text-xs text-slate-400 dark:text-zinc-500">
                                          +{poolRecords.length - 20} 条
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="mt-2 text-xs text-slate-400 dark:text-zinc-600">
                                  创建于: {new Date(pool.created_at).toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 抽卡统计 */}
                <div>
                  <h5 className="font-bold text-slate-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                    <BarChart3 size={16} />
                    抽卡记录汇总
                  </h5>
                  <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                      <div>
                        <div className="text-2xl font-bold text-slate-700 dark:text-zinc-300">{userHistory.length}</div>
                        <div className="text-xs text-slate-500">总抽数</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-600">{userHistory.filter(h => h.rarity === 6).length}</div>
                        <div className="text-xs text-slate-500">6星</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{userHistory.filter(h => h.rarity === 5).length}</div>
                        <div className="text-xs text-slate-500">5星</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{userHistory.filter(h => h.rarity === 4).length}</div>
                        <div className="text-xs text-slate-500">4星</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-slate-500">{userHistory.filter(h => h.rarity === 3).length}</div>
                        <div className="text-xs text-slate-500">3星</div>
                      </div>
                    </div>
                    {userHistory.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-slate-500 dark:text-zinc-500">
                        6星出率: {((userHistory.filter(h => h.rarity === 6).length / userHistory.length) * 100).toFixed(2)}%
                        {' · '}
                        5星出率: {((userHistory.filter(h => h.rarity === 5).length / userHistory.length) * 100).toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryPanel = () => (
    <div className="space-y-4">
      {applications.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <History size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无申请记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {applications.map(app => {
            const appUser = users.find(u => u.id === app.user_id);
            return (
              <div key={app.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-700 dark:text-zinc-300">{appUser?.username || '未知用户'}</span>
                    <span className="text-xs text-slate-400 dark:text-zinc-500">{appUser?.email}</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-500">{app.reason}</p>
                  <span className="text-xs text-slate-400 dark:text-zinc-600">{new Date(app.created_at).toLocaleString()}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-bold ${
                  app.status === 'approved' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                  app.status === 'rejected' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {app.status === 'approved' ? '已通过' : app.status === 'rejected' ? '已拒绝' : '待审批'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeMenu) {
      case 'applications': return renderApplicationsPanel();
      case 'users': return renderUsersPanel();
      case 'userData': return renderUserDataPanel();
      case 'blacklist': return renderBlacklistPanel();
      case 'announcements': return renderAnnouncementsPanel();
      case 'history': return renderHistoryPanel();
      default: return null;
    }
  };

  return (
    <div className="animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white shadow-lg mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Shield size={28} />
          超级管理员控制台
        </h2>
        <p className="text-red-100 mt-1">管理用户、审批申请、维护黑名单</p>
      </div>

      {/* 侧边栏 + 内容布局 */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* 侧边栏 */}
        <div className="w-full md:w-56 shrink-0">
          <nav className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {MENU_ITEMS.map(item => {
              const Icon = item.icon;
              const badgeCount = item.badge === 'pending' ? pendingCount : 0;
              const isActive = activeMenu === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    isActive 
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-l-4 border-red-500' 
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {badgeCount > 0 && (
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {badgeCount}
                      </span>
                    )}
                    <ChevronRight size={16} className={`transition-transform ${isActive ? 'rotate-90' : ''}`} />
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300 mb-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              {MENU_ITEMS.find(m => m.id === activeMenu)?.label}
            </h3>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
});

export default AdminPanel;
