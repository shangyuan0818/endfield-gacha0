import React from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

/**
 * 申请审批面板
 */
const ApplicationsPanel = ({
  pendingApps,
  users,
  actionLoading,
  onApprove,
  onReject,
  onBatchApprove,
  onBatchReject
}) => {
  return (
    <div className="space-y-4">
      {/* 批量操作栏 */}
      {pendingApps.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <span className="text-sm text-amber-700 dark:text-amber-300">
            共 {pendingApps.length} 个待审批申请
          </span>
          <div className="flex gap-2">
            <button
              onClick={onBatchApprove}
              disabled={actionLoading === 'batch'}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <CheckCircle size={14} />
              全部通过
            </button>
            <button
              onClick={onBatchReject}
              disabled={actionLoading === 'batch'}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-none transition-colors disabled:opacity-50"
            >
              <XCircle size={14} />
              全部拒绝
            </button>
          </div>
        </div>
      )}

      {/* 申请列表 */}
      {pendingApps.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无待审批申请</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingApps.map(app => {
            const appUser = users.find(u => u.id === app.user_id);
            return (
              <div key={app.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-700 dark:text-zinc-300">
                        {appUser?.username || '未知用户'}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">
                        {appUser?.email}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mb-2">
                      {app.reason}
                    </p>
                    <span className="text-xs text-slate-400 dark:text-zinc-600">
                      {new Date(app.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => onApprove(app.id, app.user_id)}
                      disabled={actionLoading === app.id}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-none transition-colors disabled:opacity-50"
                    >
                      通过
                    </button>
                    <button
                      onClick={() => onReject(app.id)}
                      disabled={actionLoading === app.id}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-none transition-colors disabled:opacity-50"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApplicationsPanel;
