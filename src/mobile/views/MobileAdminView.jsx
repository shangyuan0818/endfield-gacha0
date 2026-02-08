import React from 'react';
import { Shield, Users, FileText, Database, AlertTriangle } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';

/**
 * 移动端管理面板（简化版只读）
 * 工业风重构版 (中文)
 */
function MobileAdminView() {
  const { userRole } = useAuthStore();
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-red-500" size={20} />
            <h3 className="text-red-700 dark:text-red-400 font-bold uppercase tracking-wider">拒绝访问</h3>
          </div>
          <p className="text-red-600 dark:text-red-300 text-xs font-mono">
            权限不足。需要管理员权限。
          </p>
        </div>
      </div>
    );
  }

  const adminModules = [
    { id: 'users', label: '用户管理', icon: Users, desc: '查看注册人员' },
    { id: 'pools', label: '卡池数据库', icon: Database, desc: '监控抽卡池' },
    { id: 'announcements', label: '系统广播', icon: FileText, desc: '公告日志' },
  ];

  return (
    <div className="px-4 py-4 space-y-6">
      {/* 标题 */}
      <div className="bg-zinc-900 text-white p-4 border-l-4 border-endfield-yellow shadow-md">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-endfield-yellow" />
          <h1 className="text-lg font-bold uppercase tracking-wide">
            管理控制台
          </h1>
        </div>
        <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest pl-7">
          受限访问区域
        </p>
      </div>

      {/* 提示 */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 p-3 border-l-2 border-l-amber-500">
        <p className="text-xs text-amber-700 dark:text-amber-400 font-mono uppercase">
          [只读] 移动终端访问受限。请使用桌面接口进行完整管理控制。
        </p>
      </div>

      {/* 模块列表 */}
      <div className="space-y-3">
        {adminModules.map((module) => {
          const Icon = module.icon;
          return (
            <div
              key={module.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between group hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 group-hover:bg-endfield-yellow group-hover:border-endfield-yellow group-hover:text-black transition-colors">
                  <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-black" />
                </div>
                <div>
                  <span className="block font-bold text-zinc-900 dark:text-zinc-100 uppercase text-sm tracking-wide">
                    {module.label}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">
                    {module.desc}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-1.5 bg-zinc-300 dark:bg-zinc-700 group-hover:bg-endfield-yellow transition-colors" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MobileAdminView;