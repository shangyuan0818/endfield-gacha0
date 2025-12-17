import { create } from 'zustand';

/**
 * UI 状态管理
 * 管理所有与 UI 交互相关的状态（标签页、弹窗、菜单等）
 */
const useUIStore = create((set) => ({
  // ========== 标签页状态 ==========
  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ========== 弹窗状态 ==========
  modalState: { type: null, data: null },
  setModalState: (state) => set({ modalState: state }),
  openModal: (type, data = null) => set({ modalState: { type, data } }),
  closeModal: () => set({ modalState: { type: null, data: null } }),

  // ========== 菜单状态 ==========
  showPoolMenu: false,
  showExportMenu: false,
  togglePoolMenu: () => set((state) => ({ showPoolMenu: !state.showPoolMenu })),
  toggleExportMenu: () => set((state) => ({ showExportMenu: !state.showExportMenu })),
  closeAllMenus: () => set({ showPoolMenu: false, showExportMenu: false }),

  // ========== 卡池创建/编辑表单状态 ==========
  newPoolNameInput: '',
  newPoolTypeInput: 'limited',
  isLimitedWeaponPool: true,
  drawerName: '',
  selectedCharName: '',

  setNewPoolNameInput: (value) => set({ newPoolNameInput: value }),
  setNewPoolTypeInput: (value) => set({ newPoolTypeInput: value }),
  setIsLimitedWeaponPool: (value) => set({ isLimitedWeaponPool: value }),
  setDrawerName: (value) => set({ drawerName: value }),
  setSelectedCharName: (value) => set({ selectedCharName: value }),

  resetPoolForm: () => set({
    newPoolNameInput: '',
    newPoolTypeInput: 'limited',
    isLimitedWeaponPool: true,
    drawerName: '',
    selectedCharName: ''
  }),

  // ========== 记录编辑状态 ==========
  editItemState: null,
  setEditItemState: (state) => set({ editItemState: state }),
  clearEditItemState: () => set({ editItemState: null }),
}));

export default useUIStore;
