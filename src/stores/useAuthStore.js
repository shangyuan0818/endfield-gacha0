import { create } from 'zustand';

/**
 * 认证状态管理
 * 管理用户登录、角色权限、同步状态等
 */
const useAuthStore = create((set) => ({
  // ========== 用户认证状态 ==========
  user: null,
  userRole: null, // 'user' | 'admin' | 'super_admin'

  setUser: (user) => set({ user }),
  setUserRole: (role) => set({ userRole: role }),

  login: (user, role) => set({ user, userRole: role }),
  logout: () => set({ user: null, userRole: null }),

  // ========== 权限判断 ==========
  canEdit: () => {
    const { userRole } = useAuthStore.getState();
    return userRole === 'admin' || userRole === 'super_admin';
  },
  isSuperAdmin: () => {
    const { userRole } = useAuthStore.getState();
    return userRole === 'super_admin';
  },

  // ========== 认证弹窗 ==========
  showAuthModal: false,
  toggleAuthModal: () => set((state) => ({ showAuthModal: !state.showAuthModal })),
  closeAuthModal: () => set({ showAuthModal: false }),
  openAuthModal: () => set({ showAuthModal: true }),

  // ========== 云端同步状态 ==========
  syncing: false,
  syncError: null,

  setSyncing: (value) => set({ syncing: value }),
  setSyncError: (error) => set({ syncError: error }),
  clearSyncError: () => set({ syncError: null }),
}));

export default useAuthStore;
