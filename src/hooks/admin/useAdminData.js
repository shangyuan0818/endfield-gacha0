import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores';
import { validateUserData } from '../../utils/validators';
import * as userService from '../../services/admin/userService';
import * as announcementService from '../../services/admin/announcementService';

/**
 * 管理后台数据统一管理 Hook
 * 负责：用户与公告的数据获取与 CRUD 操作
 */
export function useAdminData(showToast) {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);

  // 数据状态
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const ensureSuperAdmin = useCallback(() => {
    if (userRole !== 'super_admin') {
      showToast('需要超级管理员权限', 'error');
      return false;
    }
    return true;
  }, [userRole, showToast]);

  const loadAdminData = useCallback(async () => {
    if (!user || userRole !== 'super_admin') {
      setUsers([]);
      setAnnouncements([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [
      usersResult,
      announcementsResult
    ] = await Promise.allSettled([
      userService.loadUsers(),
      announcementService.loadAnnouncements()
    ]);

    const failedSections = [];

    if (usersResult.status === 'fulfilled') {
      setUsers(usersResult.value);
    } else {
      failedSections.push('用户');
    }

    if (announcementsResult.status === 'fulfilled') {
      setAnnouncements(announcementsResult.value);
    } else {
      failedSections.push('公告');
    }

    if (failedSections.length > 0) {
      showToast(`后台数据部分加载失败：${failedSections.join('、')}`, 'warning');
    }

    setLoading(false);
  }, [showToast, user, userRole]);

  // 加载所有数据
  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // ========== 用户管理函数 ==========
  const saveUser = useCallback(async (userForm, editingUser, onSuccess) => {
    if (!ensureSuperAdmin()) return;

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
        const updatedProfile = await userService.updateUserProfile(editingUser.id, userForm);

        setUsers(prev => prev.map(u =>
          u.id === editingUser.id
            ? { ...u, ...(updatedProfile || {}), username: userForm.username, role: userForm.role }
            : u
        ));
        showToast('用户已更新', 'success');
      } else {
        await userService.createUser(userForm);
        await loadAdminData();
        showToast('用户已创建', 'success');
      }

      onSuccess?.();
    } catch (error) {
      showToast('保存用户失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [ensureSuperAdmin, loadAdminData, showToast]);

  const deleteUser = useCallback(async (user) => {
    if (!ensureSuperAdmin()) return;

    if (user.role === 'super_admin') {
      showToast('无法删除超级管理员账户', 'error');
      return;
    }

    if (!window.confirm(`确定要删除用户「${user.username}」吗？此操作将删除该用户的所有数据，且无法撤销。`)) {
      return;
    }

    setActionLoading(user.id);

    const backupUsers = [...users];

    setUsers(prev => prev.filter(u => u.id !== user.id));

    try {
      await userService.deleteUser(user.id);
      showToast('用户已删除', 'success');
    } catch (error) {
      setUsers(backupUsers);
      showToast('删除用户失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [users, ensureSuperAdmin, showToast]);

  // ========== 公告管理函数 ==========
  const saveAnnouncement = useCallback(async (announcementForm, editingAnnouncement, onSuccess) => {
    if (!ensureSuperAdmin()) return;
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      showToast('标题和内容不能为空', 'error');
      return;
    }

    setActionLoading('announcement');

    try {
      if (editingAnnouncement) {
        const updatedAt = await announcementService.updateAnnouncement(editingAnnouncement.id, announcementForm);

        setAnnouncements(prev => prev.map(a =>
          a.id === editingAnnouncement.id ? { ...a, ...announcementForm, updated_at: updatedAt } : a
        ));
        showToast('公告已更新', 'success');
      } else {
        const data = await announcementService.createAnnouncement(announcementForm);
        setAnnouncements(prev => [data, ...prev]);
        showToast('公告已创建', 'success');
      }

      onSuccess?.();
    } catch (error) {
      showToast('保存公告失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [ensureSuperAdmin, showToast]);

  const toggleAnnouncementActive = useCallback(async (announcement) => {
    if (!ensureSuperAdmin()) return;
    setActionLoading(announcement.id);

    try {
      await announcementService.setAnnouncementActive(announcement.id, !announcement.is_active);
      setAnnouncements(prev => prev.map(a =>
        a.id === announcement.id ? { ...a, is_active: !a.is_active } : a
      ));
      showToast(announcement.is_active ? '公告已停用' : '公告已激活', 'success');
    } catch (error) {
      showToast('操作失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [ensureSuperAdmin, showToast]);

  const deleteAnnouncement = useCallback(async (announcementId) => {
    if (!ensureSuperAdmin()) return;
    if (!window.confirm('确定要删除这条公告吗？此操作无法撤销。')) return;

    setActionLoading(announcementId);

    try {
      await announcementService.deleteAnnouncement(announcementId);
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
      showToast('公告已删除', 'success');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [ensureSuperAdmin, showToast]);

  return {
    // 数据状态
    users,
    announcements,
    loading,
    actionLoading,
    reloadAdminData: loadAdminData,

    // 用户管理
    saveUser,
    deleteUser,

    // 公告管理
    saveAnnouncement,
    toggleAnnouncementActive,
    deleteAnnouncement,
  };
}

export default useAdminData;
