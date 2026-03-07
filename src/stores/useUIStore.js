import { create } from 'zustand';

/**
 * UI 状态管理
 * 仅保留真正跨页面共享的 UI 状态
 */
const useUIStore = create((set) => ({
  // ========== 弹窗状态 ==========
  modalState: { type: null, data: null },
  setModalState: (state) => set({ modalState: state }),
  openModal: (type, data = null) => set({ modalState: { type, data } }),
  closeModal: () => set({ modalState: { type: null, data: null } }),
}));

export default useUIStore;
