import React from 'react';
import { History } from 'lucide-react';

/**
 * 申请历史面板
 */
const HistoryPanel = ({ applications, users }) => {
  return (
    <div className="space-y-4">
      {applications.length === 0 ? (
        <div className="p-12 text-center text-slate-400 dark:text-zinc-500">
          <History size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无申请记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {applications.map(app => {
            const appUser = users.find(u => u.id === app.user_id);
            return (
              <div key={app.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-700 dark:text-zinc-300">{appUser?.username || '未知用户'}</span>
                    <span className="text-xs text-slate-400 dark:text-zinc-500">{appUser?.email}</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-500">{app.reason}</p>
                  <span className="text-xs text-slate-400 dark:text-zinc-600">{new Date(app.created_at).toLocaleString()}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-bold ${
                  app.status === 'approved' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                  app.status === 'rejected' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {app.status === 'approved' ? '已通过' : app.status === 'rejected' ? '已拒绝' : '待审批'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
