import { create } from 'zustand';

/**
 * 应用全局状态管理
 * 管理公告、申请状态、全局统计等应用级数据
 */
const useAppStore = create((set) => ({
  // ========== 全局统计数据 ==========
  globalStats: null,
  globalStatsLoading: false,

  setGlobalStats: (stats) => set({ globalStats: stats }),
  setGlobalStatsLoading: (loading) => set({ globalStatsLoading: loading }),

  fetchGlobalStats: async (supabase) => {
    if (!supabase) return;

    set({ globalStatsLoading: true });
    try {
      const { data, error } = await supabase.rpc('get_global_stats');
      if (!error && data) {
        set({ globalStats: data });
      }
    } finally {
      set({ globalStatsLoading: false });
    }
  },

  // ========== 公告系统 ==========
  announcements: [],
  showAnnouncement: true,

  setAnnouncements: (announcements) => set({ announcements }),
  toggleAnnouncement: () => set((state) => ({ showAnnouncement: !state.showAnnouncement })),
  closeAnnouncement: () => set({ showAnnouncement: false }),
  openAnnouncement: () => set({ showAnnouncement: true }),

  loadAnnouncements: async (supabase) => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        set({ announcements: data });
      }
    } catch (error) {
      // 静默失败
    }
  },

  // ========== 管理员申请状态 ==========
  showApplyModal: false,
  applicationStatus: null, // 'pending' | 'approved' | 'rejected' | null

  setApplicationStatus: (status) => set({ applicationStatus: status }),
  toggleApplyModal: () => set((state) => ({ showApplyModal: !state.showApplyModal })),
  closeApplyModal: () => set({ showApplyModal: false }),
  openApplyModal: () => set({ showApplyModal: true }),

  checkApplicationStatus: async (supabase, userId) => {
    if (!supabase || !userId) return;

    try {
      const { data, error } = await supabase
        .from('admin_applications')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        set({ applicationStatus: data.status });
      }
    } catch (error) {
      // 静默失败
    }
  },
}));

export default useAppStore;
