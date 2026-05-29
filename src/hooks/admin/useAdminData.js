import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores';
import { validateUserData } from '../../utils/validators';
import {
  getPrimaryAccountPasswordError,
  validateAccountPassword,
} from '../../utils/authSecurity.js';
import * as userService from '../../services/admin/userService';
import * as announcementService from '../../services/admin/announcementService';
import * as accountRecoveryService from '../../services/admin/accountRecoveryService';
import { invalidatePublicCache } from '../../services/admin/publicCacheService';
import { ACCOUNT_RECOVERY_QQ_GROUP } from '../../constants/community';

function getTemporaryPasswordValidationMessage(password) {
  const validation = validateAccountPassword(password);
  if (validation.isValid) {
    return null;
  }

  switch (getPrimaryAccountPasswordError(validation)) {
    case 'required':
    case 'too_short':
      return '临时密码至少需要 8 位字符';
    case 'too_long':
      return '临时密码长度不能超过 100 位';
    case 'too_simple':
      return '临时密码需要至少包含两类字符，例如字母和数字';
    default:
      return '临时密码不符合安全要求';
  }
}

/**
 * 管理后台数据统一管理 Hook
 * 负责：用户与公告的数据获取与 CRUD 操作
 */
export function useAdminData(showToast, activeMenu = 'automation') {
  const user = useAuthStore(state => state.user);
  const userRole = useAuthStore(state => state.userRole);

  // 数据状态
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [accountRecoveryRequests, setAccountRecoveryRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [loadedSections, setLoadedSections] = useState({
    users: false,
    announcements: false,
    accountRecovery: false,
  });

  const ensureSuperAdmin = useCallback(() => {
    if (userRole !== 'super_admin') {
      showToast('需要超级管理员权限', 'error');
      return false;
    }
    return true;
  }, [userRole, showToast]);

  const loadAdminData = useCallback(async (force = false) => {
    if (!user || userRole !== 'super_admin') {
      setUsers([]);
      setAnnouncements([]);
      setAccountRecoveryRequests([]);
      setLoadedSections({
        users: false,
        announcements: false,
        accountRecovery: false,
      });
      setLoading(false);
      return;
    }

    const requiredSections = [];
    if (activeMenu === 'users' || activeMenu === 'userData') {
      requiredSections.push('users');
    }
    if (activeMenu === 'announcements') {
      requiredSections.push('announcements');
    }
    if (activeMenu === 'accountRecovery') {
      requiredSections.push('accountRecovery');
    }

    const sectionsToFetch = requiredSections.filter((section) => force || !loadedSections[section]);
    if (sectionsToFetch.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const results = await Promise.allSettled(sectionsToFetch.map(async (section) => {
      switch (section) {
        case 'users': {
          const result = await userService.loadUsers();
          setUsers(result);
          break;
        }
        case 'announcements': {
          const result = await announcementService.loadAnnouncements();
          setAnnouncements(result);
          break;
        }
        case 'accountRecovery': {
          const result = await accountRecoveryService.loadAccountRecoveryRequests();
          setAccountRecoveryRequests(result);
          break;
        }
        default:
          break;
      }

      return section;
    }));

    const failedSections = [];
    const loadedSectionNames = [];

    results.forEach((result, index) => {
      const section = sectionsToFetch[index];
      const labelMap = {
        users: '用户',
        announcements: '公告',
        accountRecovery: '账号恢复',
      };

      if (result.status === 'fulfilled') {
        loadedSectionNames.push(section);
      } else {
        failedSections.push(labelMap[section] || section);
      }
    });

    if (loadedSectionNames.length > 0) {
      setLoadedSections((prev) => loadedSectionNames.reduce((next, section) => ({
        ...next,
        [section]: true,
      }), prev));
    }

    if (failedSections.length > 0) {
      showToast(`后台数据部分加载失败：${failedSections.join('、')}`, 'warning');
    }

    setLoading(false);
  }, [activeMenu, loadedSections, showToast, user, userRole]);

  // 加载所有数据
  useEffect(() => {
    loadAdminData(false);
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
        await loadAdminData(true);
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

  const resetUserPassword = useCallback(async (user, temporaryPassword, onSuccess) => {
    if (!ensureSuperAdmin()) return;

    const normalizedPassword = String(temporaryPassword || '').trim();
    const passwordError = getTemporaryPasswordValidationMessage(normalizedPassword);
    if (passwordError) {
      showToast(passwordError, 'error');
      return;
    }

    setActionLoading(`reset_password_${user.id}`);

    try {
      await userService.resetUserPassword(user.id, normalizedPassword);
      showToast('临时密码已设置，请通过可信渠道告知用户', 'success');
      onSuccess?.();
    } catch (error) {
      showToast('重置密码失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [ensureSuperAdmin, showToast]);

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
        await invalidatePublicCache('announcements', 'admin:announcement:update');
        showToast('公告已更新', 'success');
      } else {
        const data = await announcementService.createAnnouncement(announcementForm);
        setAnnouncements(prev => [data, ...prev]);
        await invalidatePublicCache('announcements', 'admin:announcement:create');
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
      await invalidatePublicCache('announcements', 'admin:announcement:toggle');
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
      await invalidatePublicCache('announcements', 'admin:announcement:delete');
      showToast('公告已删除', 'success');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [ensureSuperAdmin, showToast]);

  const updateAccountRecoveryRequest = useCallback(async (request, updateData) => {
    if (!ensureSuperAdmin()) return;

    setActionLoading(request.id);

    try {
      const payload = {
        ...updateData,
        handled_by: user?.id || null
      };

      await accountRecoveryService.updateAccountRecoveryRequest(request.id, payload);
      await loadAdminData(true);
      showToast('账号恢复申请已更新', 'success');
    } catch (error) {
      showToast('更新账号恢复申请失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [ensureSuperAdmin, loadAdminData, showToast, user?.id]);

  const resetRecoveryRequestPassword = useCallback(async (request, temporaryPassword, adminNote) => {
    if (!ensureSuperAdmin()) return;

    setActionLoading(`reset_password_${request.id}`);

    try {
      const result = await accountRecoveryService.resetRecoveryRequestPassword(
        request.id,
        request.matched_user_id,
        temporaryPassword,
        adminNote
      );
      await loadAdminData(true);
      const expiresAt = result?.expiresAt
        ? new Date(result.expiresAt).toLocaleString('zh-CN')
        : null;
      const expiryText = expiresAt ? `，有效期至 ${expiresAt}` : '';
      if (result?.partial) {
        showToast(`临时密码已设置，但恢复状态记录部分失败，请检查详情${expiryText}`, 'warning');
      } else {
        showToast(`临时密码已设置${expiryText}，请引导用户加入 QQ 群 ${ACCOUNT_RECOVERY_QQ_GROUP} 获取临时密码`, 'success');
      }
    } catch (error) {
      showToast('设置临时密码失败: ' + error.message, 'error');
    } finally {
      setActionLoading(null);
    }
  }, [ensureSuperAdmin, loadAdminData, showToast]);

  return {
    // 数据状态
    users,
    announcements,
    accountRecoveryRequests,
    loading,
    actionLoading,
    reloadAdminData: loadAdminData,

    // 用户管理
    saveUser,
    deleteUser,
    resetUserPassword,

    // 公告管理
    saveAnnouncement,
    toggleAnnouncementActive,
    deleteAnnouncement,

    // 账号恢复
    updateAccountRecoveryRequest,
    resetRecoveryRequestPassword,
  };
}

export default useAdminData;
