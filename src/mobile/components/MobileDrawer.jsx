import React, { useEffect, useRef, useState } from 'react';
import { X, Sun, Moon, Monitor, MessageSquare, Shield, Info, LogOut, User, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import PlatformSwitcher from '../../components/common/PlatformSwitcher';
import AuthModal from '../../AuthModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getMobilePathForTab } from '../../constants/appRoutes';

/**
 * 移动端侧边抽屉菜单
 */
function MobileDrawer({ isOpen, onClose }) {
  const { themeMode, setThemeMode } = useTheme();
  const { user, signOut, userRole, setUser } = useAuthStore();
  const navigate = useNavigate();
  const isSuperAdmin = userRole === 'super_admin';
  const drawerRef = useRef(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && drawerRef.current && !drawerRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // 禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const handleAdminClick = () => {
    navigate(getMobilePathForTab('admin'));
    onClose();
  };

  const handleAboutClick = () => {
    navigate(getMobilePathForTab('about'));
    onClose();
  };

  const handleFeedbackClick = () => {
    navigate(getMobilePathForTab('tickets'));
    onClose();
  };

  const handleLoginClick = () => {
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (newUser) => {
    setUser(newUser);
    setShowAuthModal(false);
  };

  if (!isOpen) return null;

  const themeOptions = [
    { value: 'system', label: '跟随系统', icon: Monitor },
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
  ];

  return (
    <div className="fixed inset-0 z-50">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50 animate-overlay-fade-in" />

      {/* 抽屉内容 */}
      <div
        ref={drawerRef}
        className="absolute left-0 top-0 bottom-0 w-72 bg-slate-50 dark:bg-zinc-950 animate-slide-in-left safe-area-top safe-area-bottom shadow-2xl border-r border-zinc-200 dark:border-zinc-800"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50">
          <span className="text-lg font-bold text-endfield-yellow tracking-wider uppercase">终末地抽卡分析</span>
          <button onClick={onClose} className="p-2 touch-feedback hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors rounded-none">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* 用户信息 */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-none bg-endfield-yellow flex items-center justify-center overflow-hidden border border-endfield-yellow shadow-sm">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="头像"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-black font-mono">
                    {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate font-mono">
                  {user.user_metadata?.full_name || '用户'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-none bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                  <User className="w-6 h-6 text-zinc-500" />
                </div>
                <p className="text-zinc-500 font-bold text-sm">未登录</p>
              </div>
              <button
                onClick={handleLoginClick}
                className="flex items-center gap-2 px-4 py-2 bg-endfield-yellow text-black text-xs font-bold uppercase tracking-wider touch-feedback hover:bg-yellow-400 transition-colors rounded-none"
              >
                <LogIn size={14} />
                登录
              </button>
            </div>
          )}
        </div>

        {/* 主题切换 */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 mb-3 uppercase tracking-wider">显示设置</p>
          <div className="flex gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = themeMode === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setThemeMode(option.value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-2 touch-feedback border transition-all rounded-none ${
                    isActive
                      ? 'bg-endfield-yellow text-black border-endfield-yellow shadow-sm'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 菜单项 */}
        <div className="py-2">
          {/* 工单反馈 */}
          <button
            onClick={handleFeedbackClick}
            className="group flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all border-l-2 border-transparent hover:border-endfield-yellow"
          >
            <MessageSquare className="w-5 h-5 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            <span className="text-zinc-600 dark:text-zinc-400 font-medium group-hover:text-zinc-900 dark:group-hover:text-zinc-100">工单反馈</span>
          </button>

          {/* 管理面板（仅超管可见） */}
          {isSuperAdmin && (
            <button
              onClick={handleAdminClick}
              className="group flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all border-l-2 border-transparent hover:border-endfield-yellow"
            >
              <Shield className="w-5 h-5 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
              <span className="text-zinc-600 dark:text-zinc-400 font-medium group-hover:text-zinc-900 dark:group-hover:text-zinc-100">管理面板</span>
            </button>
          )}

          {/* 关于 */}
          <button
            onClick={handleAboutClick}
            className="group flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all border-l-2 border-transparent hover:border-endfield-yellow"
          >
            <Info className="w-5 h-5 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            <span className="text-zinc-600 dark:text-zinc-400 font-medium group-hover:text-zinc-900 dark:group-hover:text-zinc-100">关于</span>
          </button>

          {/* 平台切换 */}
          <div className="px-4 py-2">
             <PlatformSwitcher variant="menu-item" />
          </div>
        </div>

        {/* 底部：退出登录 */}
        {user && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-200 dark:border-zinc-800 safe-area-bottom">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>退出登录</span>
            </button>
          </div>
        )}
      </div>

      {/* 登录弹窗 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default MobileDrawer;
