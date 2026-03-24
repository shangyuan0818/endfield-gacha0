import React from 'react';
import { BarChart3, LogIn, LogOut, Settings, Info, CloudOff, MessageSquare } from 'lucide-react';
import { NotificationBadge } from '../ui';
import HeaderPoolTimeInfo from './HeaderPoolTimeInfo';
import { isSupabaseConfigured } from '../../supabaseClient';
import { STORAGE_KEYS, markAsViewed } from '../../utils';

/**
 * 应用顶部导航栏组件
 */
export default function AppHeader({
  // 状态
  user,
  userRole,
  activeTab,
  // 通知
  hasNewAnnouncement,
  setHasNewAnnouncement,
  unreadTicketsCount,
  setUnreadTicketsCount,
  newGameAnnouncementCount,
  // 操作
  setActiveTab,
  openAuthModal,
  handleLogout
}) {
  const isSuperAdmin = userRole === 'super_admin';

  return (
    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40 shadow-sm dark:shadow-md">
      {/* 背景装饰网格 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

      <div className="w-full max-w-[1440px] mx-auto px-4 h-16 flex items-center justify-between relative z-10">

        {/* 左侧：Logo + 标题 */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-endfield-yellow flex items-center justify-center rounded-sm shadow-sm dark:shadow-[0_0_10px_rgba(255,204,0,0.3)]">
              <BarChart3 className="text-black w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                ENDFIELD <span className="text-amber-500 dark:text-endfield-yellow">GACHA</span>
              </h1>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono tracking-[0.2em] uppercase block">Analyzer System</span>
            </div>
          </div>

          {/* UP池时间信息 - 实时更新 */}
          <HeaderPoolTimeInfo />
        </div>

        <div className="flex gap-2 sm:gap-4">
          <NotificationBadge showDot={hasNewAnnouncement}>
            <button
              onClick={() => {
                setActiveTab('home');
                if (hasNewAnnouncement) {
                  markAsViewed(STORAGE_KEYS.ANNOUNCEMENT_LAST_VIEWED);
                  setHasNewAnnouncement(false);
                }
              }}
              className={`text-sm font-bold px-3 py-1.5 rounded-sm transition-all duration-200 ${
                activeTab === 'home'
                  ? 'bg-endfield-yellow text-black shadow-sm dark:shadow-[0_0_10px_rgba(255,204,0,0.2)]'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              首页
            </button>
          </NotificationBadge>
          <button
            onClick={() => setActiveTab('summary')}
            className={`text-sm font-bold px-3 py-1.5 rounded-sm transition-all duration-200 ${
              activeTab === 'summary'
                ? 'bg-endfield-yellow text-black shadow-sm dark:shadow-[0_0_10px_rgba(255,204,0,0.2)]'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            统计
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`text-sm font-bold px-3 py-1.5 rounded-sm transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'bg-endfield-yellow text-black shadow-sm dark:shadow-[0_0_10px_rgba(255,204,0,0.2)]'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            卡池分析
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`text-sm font-bold px-3 py-1.5 rounded-sm transition-all duration-200 ${
              activeTab === 'simulator'
                ? 'bg-endfield-yellow text-black shadow-sm dark:shadow-[0_0_10px_rgba(255,204,0,0.2)]'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            模拟器
          </button>

          {/* 超管管理页面 */}
          {isSuperAdmin && (
            <NotificationBadge showDot={newGameAnnouncementCount > 0}>
              <button
                onClick={() => {
                  setActiveTab('admin');
                  markAsViewed(STORAGE_KEYS.ADMIN_LAST_VIEWED);
                }}
                className={`text-sm font-bold px-3 py-1.5 rounded-sm transition-all duration-200 ${
                  activeTab === 'admin'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-white/5'
                }`}
                title={newGameAnnouncementCount > 0 ? `${newGameAnnouncementCount} 条新公告可同步` : '管理'}
              >
                管理
              </button>
            </NotificationBadge>
          )}

          {/* 工单、设置和关于按钮 */}
          {user && (
            <NotificationBadge count={unreadTicketsCount}>
              <button
                onClick={() => {
                  setActiveTab('tickets');
                  markAsViewed(STORAGE_KEYS.TICKETS_LAST_VIEWED);
                  setUnreadTicketsCount(0);
                }}
                className={`text-sm font-medium px-2 py-1.5 rounded-sm transition-all duration-200 ${
                  activeTab === 'tickets'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5'
                }`}
                title="工单"
              >
                <MessageSquare size={18} />
              </button>
            </NotificationBadge>
          )}
          <button
            onClick={() => setActiveTab('settings')}
            className={`text-sm font-medium px-2 py-1.5 rounded-sm transition-all duration-200 ${
              activeTab === 'settings'
                ? 'bg-slate-100 dark:bg-zinc-800 text-amber-600 dark:text-endfield-yellow border border-amber-500 dark:border-endfield-yellow'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
            title="设置"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`text-sm font-medium px-2 py-1.5 rounded-sm transition-all duration-200 ${
              activeTab === 'about'
                ? 'bg-yellow-50 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400'
                : 'text-slate-500 dark:text-zinc-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-white/5'
            }`}
            title="关于"
          >
            <Info size={18} />
          </button>

          {/* 登录/用户区域 */}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-zinc-200 dark:border-zinc-800">
            {isSupabaseConfigured() ? (
              user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">{user.user_metadata?.username || user.email?.split('@')[0]}</span>
                    <span className="text-[10px] text-amber-600 dark:text-endfield-yellow uppercase tracking-wider font-mono">
                      {(userRole === 'super_admin' || userRole === 'admin') ? 'Super-Endmin' : 'Endmin'}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-red-500 transition-colors"
                    title="退出登录"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">游客</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-mono">
                      GUEST
                    </span>
                  </div>
                  <button
                    onClick={openAuthModal}
                    className="flex items-center gap-2 px-4 py-2 bg-endfield-yellow hover:bg-yellow-400 text-black text-sm font-bold uppercase tracking-wider rounded-sm transition-colors shadow-sm dark:shadow-lg dark:shadow-yellow-500/20"
                  >
                    <LogIn size={16} />
                    <span className="hidden sm:inline">登录</span>
                  </button>
                </div>
              )
            ) : (
              <span className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-1 font-mono" title="未配置 Supabase">
                <CloudOff size={14} /> LOCAL MODE
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
