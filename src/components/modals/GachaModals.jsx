import React, { useEffect, useState } from 'react';
import { X, Trash2, AlertCircle, Upload, CheckCircle2, User, Cloud, CloudOff, RefreshCw, Star, Layers, Search } from 'lucide-react';
import AuthModal from '../../AuthModal';
import { Toast, ConfirmDialog } from '../ui';
import { useUIStore, useAuthStore, useHistoryStore } from '../../stores';
import { PRESET_POOLS } from '../../constants';
import { buildUsernameHandle } from '../../utils/usernameValidation.js';

const DEFAULT_POOL_FORM = {
  name: '',
  type: 'limited',
  isLimitedWeapon: true,
  drawerName: '',
  selectedCharName: ''
};

function normalizeEditablePoolType(type) {
  if (type === 'limited_character') return 'limited';
  if (type === 'limited_weapon') return 'weapon';
  return type || 'standard';
}

function buildPoolName(type, selectedCharName, drawerName) {
  const typeLabel = type === 'limited' ? '限定' : (type === 'weapon' ? '武器' : '常驻');
  return `${typeLabel}${selectedCharName ? '-' + selectedCharName : ''}${drawerName ? '-' + drawerName : ''}`;
}

function getInitialPoolForm(modalState) {
  if (modalState.type === 'editPool' && modalState.data) {
    return {
      name: modalState.data.name || '',
      type: normalizeEditablePoolType(modalState.data.type),
      isLimitedWeapon: modalState.data.isLimitedWeapon !== false,
      drawerName: '',
      selectedCharName: ''
    };
  }

  return DEFAULT_POOL_FORM;
}

/**
 * 全局弹窗管理组件
 */
export default function GachaModals({
  // 已知抽卡人列表
  knownDrawers,
  // Toast
  toasts,
  removeToast,
  // Confirm
  confirmState,
  handleConfirm,
  handleCancel,
  // 卡池操作回调
  closeModalAndClear,
  confirmCreatePool,
  confirmEditPool,
  confirmDeletePool,
  confirmDeleteData,
  confirmRealDeleteItem,
  confirmRealDeleteGroup,
  // 数据导入
  pendingImport,
  setPendingImport,
  confirmImport,
  // 迁移
  showMigrateModal,
  setShowMigrateModal,
  migrateLocalToCloud,
  canEdit
}) {
  // 从 stores 获取状态
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const showAuthModal = useAuthStore(state => state.showAuthModal);
  const closeAuthModal = useAuthStore(state => state.closeAuthModal);
  const syncing = useAuthStore(state => state.syncing);
  const syncError = useAuthStore(state => state.syncError);

  const modalState = useUIStore(state => state.modalState);
  const setModalState = useUIStore(state => state.setModalState);

  const history = useHistoryStore(state => state.history);
  const [poolForm, setPoolForm] = useState(DEFAULT_POOL_FORM);

  useEffect(() => {
    queueMicrotask(() => {
      setPoolForm(getInitialPoolForm(modalState));
    });
  }, [modalState]);

  const closePoolFormModal = () => {
    setPoolForm(DEFAULT_POOL_FORM);
    closeModalAndClear();
  };

  const applyAutoPoolName = (updates) => {
    setPoolForm(prev => {
      const next = { ...prev, ...updates };
      return { ...next, name: buildPoolName(next.type, next.selectedCharName, next.drawerName) };
    });
  };

  const submitPoolForm = async () => {
    if (modalState.type === 'createPool') {
      await confirmCreatePool(poolForm);
      return;
    }

    await confirmEditPool(poolForm);
  };

  return (
    <>
      {/* 创建/编辑卡池弹窗 */}
      {(modalState.type === 'createPool' || modalState.type === 'editPool') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 dark:text-zinc-300">{modalState.type === 'createPool' ? '创建新卡池' : '编辑卡池'}</h3>
              <button onClick={closePoolFormModal} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:text-zinc-400 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {modalState.type === 'createPool' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase mb-2">快速选择卡池</label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {PRESET_POOLS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyAutoPoolName({ type: preset.type, selectedCharName: preset.charName })}
                        className="text-left text-xs p-2 rounded-none border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:border-yellow-300 dark:hover:border-yellow-700 text-slate-600 dark:text-zinc-300 hover:text-yellow-700 dark:hover:text-yellow-300 transition-colors truncate"
                        title={preset.label}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modalState.type === 'editPool' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">卡池添加人</label>
                  <div className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-none">
                    <User size={16} />
                    <span>{modalState.data?.creator_username || (user ? buildUsernameHandle(user) : '未知用户')}</span>
                    {modalState.data?.created_at && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">
                        创建于 {new Date(modalState.data.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">抽卡人</label>
                {knownDrawers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {knownDrawers.map(drawer => (
                      <button
                        key={drawer}
                        onClick={() => {
                          if (modalState.type === 'createPool') {
                            applyAutoPoolName({ drawerName: drawer });
                          } else {
                            setPoolForm(prev => ({ ...prev, drawerName: drawer }));
                          }
                        }}
                        className={`text-xs px-2 py-1 rounded-none border transition-colors ${
                          poolForm.drawerName === drawer
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 font-bold'
                            : 'bg-slate-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:border-yellow-300 dark:hover:border-yellow-700'
                        }`}
                      >
                        <User size={10} className="inline mr-1" />{drawer}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={poolForm.drawerName}
                  onChange={(e) => {
                    if (modalState.type === 'createPool') {
                      applyAutoPoolName({ drawerName: e.target.value });
                    } else {
                      setPoolForm(prev => ({ ...prev, drawerName: e.target.value }));
                    }
                  }}
                  placeholder={knownDrawers.length > 0 ? "选择上方已有或输入新抽卡人" : "例如：Me, 朋友A"}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">卡池名称</label>
                <input
                  type="text"
                  value={poolForm.name}
                  onChange={(e) => setPoolForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：限定-莱万汀-Me"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && submitPoolForm()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-2">卡池类型</label>
                <div className="flex gap-3">
                  {['limited', 'standard', 'weapon'].map(type => (
                    <label key={type} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-none border cursor-pointer transition-all ${poolForm.type === type ? (type === 'weapon' ? 'bg-slate-800 border-slate-600 text-white' : type === 'limited' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-yellow-50 dark:bg-yellow-900/20 border-indigo-500 text-yellow-700 dark:text-yellow-300') + ' font-bold ring-1' : 'border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:bg-zinc-950'}`}>
                      <input
                        type="radio"
                        name="poolType"
                        value={type}
                        checked={poolForm.type === type}
                        onChange={() => {
                          if (modalState.type === 'createPool') {
                            applyAutoPoolName({ type });
                          } else {
                            setPoolForm(prev => ({ ...prev, type }));
                          }
                        }}
                        className="hidden"
                      />
                      {type === 'limited' && <Star size={16} />}
                      {type === 'standard' && <Layers size={16} />}
                      {type === 'weapon' && <Search size={16} />}
                      {type === 'limited' ? '限定池' : (type === 'weapon' ? '武器池' : '常驻池')}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
                  {poolForm.type === 'limited' && '包含限定与歪，统计大小保底、硬保底(120)及赠送(240)。'}
                  {poolForm.type === 'standard' && '仅统计常驻6星，不区分限定/歪，无大小保底统计。'}
                  {poolForm.type === 'weapon' && (poolForm.isLimitedWeapon
                    ? '6星40抽保底，首轮80抽必出限定。赠送：100(常)->180(限)->+80交替。'
                    : '6星40抽保底，无额外赠送内容。'
                  )}
                </p>

                {poolForm.type === 'weapon' && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-none border border-zinc-200 dark:border-zinc-700">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">限定武器池</span>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">限定武器池有额外获取内容（武库箱、限定武器赠送）</p>
                      </div>
                      <div className="relative">
                        <input type="checkbox" checked={poolForm.isLimitedWeapon} onChange={(e) => setPoolForm(prev => ({ ...prev, isLimitedWeapon: e.target.checked }))} className="sr-only" />
                        <div className={`w-11 h-6 rounded-full transition-colors ${poolForm.isLimitedWeapon ? 'bg-orange-500' : 'bg-slate-300 dark:bg-zinc-600'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${poolForm.isLimitedWeapon ? 'translate-x-5' : ''}`}></div>
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-end">
              <button onClick={closePoolFormModal} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors">取消</button>
              <button onClick={submitPoolForm} disabled={!poolForm.name.trim()} className="px-4 py-2 text-sm font-bold text-white bg-endfield-yellow text-black hover:bg-yellow-400 font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed rounded-none shadow-sm transition-all">
                {modalState.type === 'createPool' ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除卡池确认弹窗 */}
      {modalState.type === 'deletePool' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4"><Trash2 size={24} /></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">确定删除卡池？</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                您正在删除卡池 <span className="font-bold text-slate-700 dark:text-zinc-300">「{modalState.data?.name}」</span>
                <br/>及其所有 <span className="text-red-500 font-bold">{(history || []).filter(h => h.poolId === modalState.data?.id).length}</span> 条抽卡记录。
                <br/>此操作<span className="text-red-500 font-bold">无法撤销</span>。
              </p>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button onClick={closeModalAndClear} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-none transition-colors">取消</button>
              <button onClick={confirmDeletePool} className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-none shadow-sm transition-all">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 清空卡池数据确认弹窗 */}
      {modalState.type === 'deleteConfirm' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4"><AlertCircle size={24} /></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">确定清空数据？</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                您正在清空 <span className="font-bold text-slate-700 dark:text-zinc-300">{modalState.data?.poolName}</span> 的所有记录。
                <br/>此操作<span className="text-red-500 font-bold">无法撤销</span>。
              </p>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button onClick={closeModalAndClear} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-none transition-colors">再想想</button>
              <button onClick={confirmDeleteData} className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-none shadow-sm transition-all">确认清空</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除单条记录确认 */}
      {modalState.type === 'deleteItem' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" style={{zIndex: 60}}>
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4"><Trash2 size={24} /></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">删除这条记录？</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500">此操作将从历史记录中移除该条目。</p>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button onClick={() => setModalState({ type: null, data: null })} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors">取消</button>
              <button onClick={confirmRealDeleteItem} className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-none shadow-sm transition-all">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除整组确认 */}
      {modalState.type === 'deleteGroup' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-sm flex items-center justify-center mx-auto mb-4"><Trash2 size={24} /></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">删除这 {modalState.data?.length} 条记录？</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500">您正在删除一组记录（例如一次十连）。</p>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button onClick={closeModalAndClear} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors">取消</button>
              <button onClick={confirmRealDeleteGroup} className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-none shadow-sm transition-all">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* 登录弹窗 */}
      <AuthModal isOpen={showAuthModal} onClose={closeAuthModal} onAuthSuccess={(user) => setUser(user)} />

      {/* 数据迁移弹窗 */}
      {showMigrateModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-sm flex items-center justify-center mx-auto mb-4"><Cloud size={24} /></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">同步本地数据到云端？</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                检测到您有 <span className="font-bold text-slate-700 dark:text-zinc-300">{(history || []).length}</span> 条本地记录。
                <br/>是否将这些数据同步到云端？
              </p>
              {syncing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-yellow-600 dark:text-endfield-yellow">
                  <RefreshCw size={16} className="animate-spin" /><span className="text-sm">正在同步...</span>
                </div>
              )}
              {syncError && <div className="mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-none">同步失败: {syncError}</div>}
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button onClick={() => setShowMigrateModal(false)} disabled={syncing} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-none transition-colors disabled:opacity-50">暂不同步</button>
              <button onClick={async () => { const success = await migrateLocalToCloud(); if (success) setShowMigrateModal(false); }} disabled={syncing} className="px-4 py-2 text-sm font-bold bg-endfield-yellow text-black hover:bg-yellow-400 uppercase tracking-wider rounded-none shadow-sm transition-all disabled:opacity-50 flex items-center gap-2">
                {syncing ? (<><RefreshCw size={16} className="animate-spin" />同步中...</>) : (<><Cloud size={16} />同步到云端</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入确认弹窗 */}
      {pendingImport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-none shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-blue-100 text-blue-500 rounded-sm flex items-center justify-center mx-auto mb-4"><Upload size={28} /></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">确认导入数据</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                包含 <span className="font-bold text-slate-700 dark:text-zinc-300">{pendingImport.data.pools.length}</span> 个卡池和 <span className="font-bold text-slate-700 dark:text-zinc-300">{pendingImport.data.history.length}</span> 条记录
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">相同ID的记录会被跳过</p>
              {pendingImport.willSyncToCloud ? (
                <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1"><Cloud size={14} /> 数据将自动同步到云端</p>
              ) : (
                <p className="text-xs text-amber-600 mt-2 flex items-center justify-center gap-1"><CloudOff size={14} /> 未登录，仅保存到本地</p>
              )}
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex gap-3 justify-center">
              <button onClick={() => setPendingImport(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:text-zinc-100 hover:bg-slate-200 rounded-none transition-colors">取消</button>
              <button onClick={confirmImport} disabled={syncing} className="px-4 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 rounded-none shadow-sm transition-all flex items-center gap-2">
                {syncing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {syncing ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 通用确认弹窗 */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Toast 通知 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  );
}
