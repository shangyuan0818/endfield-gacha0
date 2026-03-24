import { create } from 'zustand';
import { supabase } from '../supabaseClient';

/**
 * 认证状态管理
 * 管理用户登录、角色权限、同步状态等
 */
const useAuthStore = create((set) => ({
  // ========== 用户认证状态 ==========
  user: null,
  userRole: null, // 'user' | 'admin' | 'super_admin'
  authResolved: false,

  setUser: (user) => set((state) => ({
    user,
    lastSyncAt: user ? state.lastSyncAt : null
  })),
  setUserRole: (role) => set({ userRole: role }),
  setAuthResolved: (value) => set({ authResolved: Boolean(value) }),

  login: (user, role) => set({ user, userRole: role, authResolved: true }),
  logout: () => set({ user: null, userRole: null, authResolved: true, syncing: false, syncError: null, lastSyncAt: null }),

  /** 完整登出：清除 Supabase 会话 + Zustand 状态 */
  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null, userRole: null, authResolved: true, syncing: false, syncError: null, lastSyncAt: null });
  },

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
  lastSyncAt: null,

  setSyncing: (value) => set({ syncing: value }),
  setSyncError: (error) => set({ syncError: error }),
  setLastSyncAt: (value) => set({ lastSyncAt: value }),
  clearSyncError: () => set({ syncError: null }),
}));

export default useAuthStore;
