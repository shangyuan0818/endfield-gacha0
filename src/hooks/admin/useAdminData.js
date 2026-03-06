import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { validateUserData } from '../../utils/validators';

const ADMIN_PROFILE_FIELDS = 'id, username, email, role, created_at, updated_at, last_seen_at';

/**
 * 管理后台数据统一管理 Hook
 * 负责：用户、申请、黑名单、公告、页面内容的数据获取与 CRUD 操作
 */
export function useAdminData(showToast) {
  // 数据状态
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [pageContents, setPageContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // 计算待审批数量
  const pendingCount = useMemo(() =>
    applications.filter(a => a.status === 'pending').length,
    [applications]
  );

  const pendingApps = useMemo(() =>
    applications.filter(a => a.status === 'pending'),
    [applications]
  );

  // 加载所有数据
  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [profilesRes, appsRes, announcementsRes, blacklistRes, pageContentRes] = await Promise.all([
          supabase.from('profiles').select(ADMIN_PROFILE_FIELDS),
          supabase.from('admin_applications').select('*'),
          supabase.from('announcements').select('*').order('priority', { ascending: false }),
          supabase.from('blacklist').select('*').order('created_at', { ascending: false }),
          supabase.from('page_content').select('*').order('id', { ascending: true })
        ]);

        setUsers(profilesRes.data || []);
        setApplications(appsRes.data || []);
        setAnnouncements(announcementsRes.data || []);
        setBlacklist(blacklistRes.data || []);
        setPageContents(pageContentRes.data || []);
      } catch {
        // 静默处理
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ========== 申请审批函数 ==========
  const handleApprove = useCallback(async (appId, userId) => {
    if (!supabase) return;
    setActionLoading(appId);

    try {
      const { error: appError } = await supabase
        .from('admin_applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', appId);

      if (appError) throw appError;

      const { error: profileError, data: updatedProfile } = await supabase
        .rpc('admin_update_profile', {
          p_target_user_id: userId,
          p_role: 'admin',
        });

      if (profileError) throw profileError;

      setApplications(prev => prev.map(a =>
        a.id === appId ? { ...a, status: 'approved' } : a
      ));
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, ...(updatedProfile || {}), role: 'admin' } : u
      ));

      showToast('审批通过！该用户现已成为管理员', 'success');
    } catch (error) {
      showToast('审批失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const handleReject = useCallback(async (appId) => {
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
      showToast('拒绝失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const handleBatchApprove = useCallback(async () => {
    const pending = applications.filter(a => a.status === 'pending');
    if (pending.length === 0) return;

    if (!window.confirm(`确定要批量通过 ${pending.length} 个申请吗？`)) return;

    setActionLoading('batch');
    try {
      for (const app of pending) {
        await handleApprove(app.id, app.user_id);
      }
      showToast(`已批量通过 ${pending.length} 个申请`, 'success');
    } catch {
      showToast('批量操作失败', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [applications, handleApprove, showToast]);

  const handleBatchReject = useCallback(async () => {
    const pending = applications.filter(a => a.status === 'pending');
    if (pending.length === 0) return;

    if (!window.confirm(`确定要批量拒绝 ${pending.length} 个申请吗？`)) return;

    setActionLoading('batch');
    try {
      for (const app of pending) {
        await handleReject(app.id);
      }
      showToast(`已批量拒绝 ${pending.length} 个申请`, 'success');
    } catch {
      showToast('批量操作失败', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [applications, handleReject, showToast]);

  // ========== 用户管理函数 ==========
  const saveUser = useCallback(async (userForm, editingUser, onSuccess) => {
    if (!supabase) return;

    const isCreating = !editingUser;
    const validation = validateUserData(userForm, isCreating);

    if (!validation.isValid) {
      validation.errors.forEach(error => {
        showToast(error, 'error');
      });
      return;
    }

    if (userForm.role === 'super_admin') {
      showToast('禁止通过此接口创建超级管理员', 'error');
      return;
    }

    if (!['user', 'admin'].includes(userForm.role)) {
      showToast('无效的角色类型，只允许 user 或 admin', 'error');
      return;
    }

    setActionLoading('user');

    try {
      if (editingUser) {
        const { error, data: updatedProfile } = await supabase
          .rpc('admin_update_profile', {
            p_target_user_id: editingUser.id,
            p_username: userForm.username,
            p_role: userForm.role,
          });

        if (error) throw error;

        setUsers(prev => prev.map(u =>
          u.id === editingUser.id
            ? { ...u, ...(updatedProfile || {}), username: userForm.username, role: userForm.role }
            : u
        ));
        showToast('用户已更新', 'success');
      } else {
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
              role: userForm.role
            })
          }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '创建用户失败');

        const { data: profilesData } = await supabase.from('profiles').select(ADMIN_PROFILE_FIELDS);
        setUsers(profilesData || []);
        showToast('用户已创建', 'success');
      }

      onSuccess?.();
    } catch (error) {
      showToast('保存用户失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const deleteUser = useCallback(async (user) => {
    if (!supabase) return;

    if (user.role === 'super_admin') {
      showToast('无法删除超级管理员账户', 'error');
      return;
    }

    if (!window.confirm(`确定要删除用户「${user.username}」吗？此操作将删除该用户的所有数据，且无法撤销。`)) {
      return;
    }

    setActionLoading(user.id);

    const backupUsers = [...users];
    const backupApplications = [...applications];

    setUsers(prev => prev.filter(u => u.id !== user.id));
    setApplications(prev => prev.filter(a => a.user_id !== user.id));

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

      showToast('用户已删除', 'success');
    } catch (error) {
      setUsers(backupUsers);
      setApplications(backupApplications);
      showToast('删除用户失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [users, applications, showToast]);

  const addToBlacklist = useCallback(async (user) => {
    if (!supabase) return;

    const reason = window.prompt(`请输入将用户「${user.username}」加入黑名单的原因：`);
    if (!reason) return;

    setActionLoading(user.id);

    try {
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
      showToast('添加黑名单失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  // ========== 黑名单管理函数 ==========
  const saveBlacklistEntry = useCallback(async (blacklistForm, onSuccess) => {
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
      onSuccess?.();
    } catch (error) {
      showToast('添加黑名单失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const removeFromBlacklist = useCallback(async (entry) => {
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
      showToast('移除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  // ========== 公告管理函数 ==========
  const saveAnnouncement = useCallback(async (announcementForm, editingAnnouncement, onSuccess) => {
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

      onSuccess?.();
    } catch (error) {
      showToast('保存公告失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const toggleAnnouncementActive = useCallback(async (announcement) => {
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
      showToast('操作失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const deleteAnnouncement = useCallback(async (announcementId) => {
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
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  // ========== 页面内容管理函数 ==========
  const savePageContent = useCallback(async (pageContentForm, editingPageContent, onSuccess) => {
    if (!supabase) return;
    if (!pageContentForm.id.trim() || !pageContentForm.title.trim() || !pageContentForm.content.trim()) {
      showToast('ID、标题和内容不能为空', 'error');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(pageContentForm.id)) {
      showToast('ID 只能包含小写字母、数字和下划线', 'error');
      return;
    }

    setActionLoading('pageContent');

    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      if (editingPageContent) {
        const { error } = await supabase
          .from('page_content')
          .update({
            title: pageContentForm.title,
            content: pageContentForm.content,
            is_active: pageContentForm.is_active,
            updated_by: currentUser?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPageContent.id);

        if (error) throw error;

        setPageContents(prev => prev.map(p =>
          p.id === editingPageContent.id ? { ...p, ...pageContentForm, updated_at: new Date().toISOString() } : p
        ));
        showToast('页面内容已更新', 'success');
      } else {
        const { data, error } = await supabase
          .from('page_content')
          .insert({
            id: pageContentForm.id,
            title: pageContentForm.title,
            content: pageContentForm.content,
            is_active: pageContentForm.is_active,
            updated_by: currentUser?.id
          })
          .select()
          .single();

        if (error) throw error;

        setPageContents(prev => [...prev, data].sort((a, b) => a.id.localeCompare(b.id)));
        showToast('页面内容已创建', 'success');
      }

      onSuccess?.();
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const togglePageContentActive = useCallback(async (pageContent) => {
    if (!supabase) return;
    setActionLoading(pageContent.id);

    try {
      const { error } = await supabase
        .from('page_content')
        .update({ is_active: !pageContent.is_active })
        .eq('id', pageContent.id);

      if (error) throw error;

      setPageContents(prev => prev.map(p =>
        p.id === pageContent.id ? { ...p, is_active: !p.is_active } : p
      ));
      showToast(pageContent.is_active ? '内容已停用' : '内容已激活', 'success');
    } catch (error) {
      showToast('操作失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  const deletePageContent = useCallback(async (pageContentId) => {
    if (!supabase) return;
    if (!window.confirm('确定要删除这条页面内容吗？此操作无法撤销。')) return;

    setActionLoading(pageContentId);

    try {
      const { error } = await supabase
        .from('page_content')
        .delete()
        .eq('id', pageContentId);

      if (error) throw error;

      setPageContents(prev => prev.filter(p => p.id !== pageContentId));
      showToast('页面内容已删除', 'success');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [showToast]);

  return {
    // 数据状态
    users,
    applications,
    blacklist,
    announcements,
    pageContents,
    loading,
    actionLoading,
    pendingCount,
    pendingApps,

    // 申请审批
    handleApprove,
    handleReject,
    handleBatchApprove,
    handleBatchReject,

    // 用户管理
    saveUser,
    deleteUser,
    addToBlacklist,

    // 黑名单管理
    saveBlacklistEntry,
    removeFromBlacklist,

    // 公告管理
    saveAnnouncement,
    toggleAnnouncementActive,
    deleteAnnouncement,

    // 页面内容管理
    savePageContent,
    togglePageContentActive,
    deletePageContent,
  };
}

export default useAdminData;
