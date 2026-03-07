import React, { Suspense, lazy } from 'react';
import { ChevronDown, History, LogIn, Lock } from 'lucide-react';
import EditItemModal from '../modals/EditItemModal';

const DashboardView = lazy(() => import('../dashboard/DashboardView'));
const RecordsView = lazy(() => import('../records/RecordsView'));

function TabPanelFallback({ label = '正在加载模块...' }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none p-10 text-center animate-fade-in">
      <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-zinc-400">
        <div className="w-4 h-4 border-2 border-slate-300 dark:border-zinc-600 border-t-transparent rounded-full animate-spin"></div>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function DesktopDashboardWorkspace({
  user,
  canEdit,
  canEditCurrentPool,
  currentPool,
  editItemState,
  setEditItemState,
  handleUpdateItem,
  handleDeleteItem,
  handleDeleteGroup,
  handleImportFile,
  handleExportJSON,
  handleExportCSV
}) {
  return (
    <>
      {!user && (
        <div className="mb-8 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-zinc-900 dark:to-zinc-950 border border-amber-200 dark:border-amber-900/50 rounded-none p-8 text-center">
          <div className="w-16 h-16 bg-endfield-yellow/20 dark:bg-endfield-yellow/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn size={32} className="text-amber-600 dark:text-endfield-yellow" />
          </div>
          <h3 className="font-bold text-xl text-slate-800 dark:text-zinc-100 mb-3">登录后即可导入抽卡数据</h3>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 max-w-md mx-auto">
            注册并登录后，您可以导入自己的抽卡记录进行分析。
            <br />数据安全存储在云端，可在任意设备访问。
          </p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-4">
            已有账号？点击右上角登录
          </p>
        </div>
      )}

      {user && canEdit && !canEditCurrentPool && (
        <div className="mb-8 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-none p-6 text-center">
          <Lock size={40} className="mx-auto text-amber-400 mb-3" />
          <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-2">此卡池已被锁定</h3>
          <p className="text-sm text-amber-600 dark:text-amber-500">
            卡池「{currentPool?.name}」已被超级管理员锁定，暂时无法编辑。
            <br />如需修改，请联系超级管理员解锁。
          </p>
        </div>
      )}

      {user && (
        <div className="animate-fade-in">
          <Suspense fallback={<TabPanelFallback label="正在加载卡池分析..." />}>
            <DashboardView />
          </Suspense>

          <div className="mt-6">
            <details className="group">
              <summary className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                  <History size={18} /> 详细日志
                </span>
                <ChevronDown size={20} className="text-slate-400 dark:text-zinc-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-2">
                <Suspense fallback={<TabPanelFallback label="正在加载详细日志..." />}>
                  <RecordsView
                    onEdit={setEditItemState}
                    onDeleteGroup={handleDeleteGroup}
                    onImportFile={handleImportFile}
                    onExportJSON={handleExportJSON}
                    onExportCSV={handleExportCSV}
                  />
                </Suspense>
              </div>
            </details>
          </div>

          {editItemState && (
            <EditItemModal
              item={editItemState}
              poolType={currentPool?.type}
              onClose={() => setEditItemState(null)}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          )}
        </div>
      )}
    </>
  );
}
