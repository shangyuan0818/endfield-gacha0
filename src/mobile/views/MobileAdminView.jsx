import React from 'react';
import { Shield, Users, FileText, Database, AlertTriangle, Bot } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import {
  MobileGlassPanel,
  MobilePage,
  MobileSectionTitle,
  MobileStatusBadge,
  MobileStickyHeader
} from '../components/ux/MobilePrimitives.jsx';

/**
 * 移动端管理面板（简化版只读）
 * 工业风重构版 (中文)
 */
function MobileAdminView() {
  const { userRole } = useAuthStore();
  const isSuperAdmin = userRole === 'super_admin';

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 h-full overflow-y-auto overflow-x-hidden slide-right-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark px-4 pb-6 space-y-4">
        <div className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm rounded-xl p-5 border-rose-500/30 bg-rose-500/10 p-6">
          <div className="mb-2 flex items-center gap-3">
            <AlertTriangle className="text-rose-400" size={20} />
            <h3 className="font-bold uppercase tracking-wider text-rose-300">拒绝访问</h3>
          </div>
          <p className="font-mono text-xs text-rose-200/80">
            权限不足。需要超级管理员权限。
          </p>
        </div>
      </div>
    );
  }

  const adminModules = [
    { id: 'users', label: '用户管理', icon: Users, desc: '查看注册人员' },
    { id: 'pools', label: '卡池数据库', icon: Database, desc: '监控抽卡池' },
    { id: 'announcements', label: '系统广播', icon: FileText, desc: '公告日志' },
    { id: 'automation', label: '自动化审计', icon: Bot, desc: '审核运营任务' },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden slide-right-enter scroll-smooth w-full bg-ef-light dark:bg-ef-dark px-4 pb-6 space-y-4">
      <MobileStickyHeader
        eyebrow="SYSTEM"
        icon={Shield}
        title="管理控制台"
        subtitle="受限访问区域"
        actions={<MobileStatusBadge tone="danger">SUPER ADMIN</MobileStatusBadge>}
      />

      <div className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm rounded-xl p-5 border-amber-400/20 bg-amber-500/10">
        <p className="text-xs font-mono uppercase text-amber-300">
          [只读] 移动终端访问受限。请使用桌面接口进行完整管理控制。
        </p>
      </div>

      <div className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200 dark:border-white/5 shadow-sm rounded-xl p-4 space-y-4">
        <MobileSectionTitle
          title="模块总览"
          subtitle="当前只提供只读入口与状态确认。"
          icon={Shield}
        />

        <div className="space-y-3">
        {adminModules.map((module) => {
          const Icon = module.icon;
          return (
            <div
              key={module.id}
              className="group flex items-center justify-between rounded-[1rem] border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-white/15"
            >
              <div className="flex items-center gap-4">
                <div className="border border-white/10 bg-white/[0.05] p-2 transition-colors group-hover:border-endfield-yellow/40 group-hover:bg-endfield-yellow/10">
                  <Icon className="h-5 w-5 text-zinc-400 group-hover:text-endfield-yellow" />
                </div>
                <div>
                  <span className="block text-sm font-bold uppercase tracking-wide text-zinc-100">
                    {module.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase text-zinc-500">
                    {module.desc}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-700 transition-colors group-hover:bg-endfield-yellow" />
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

export default MobileAdminView;
