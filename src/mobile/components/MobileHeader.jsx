import React, { useState } from 'react';
import { Menu, User } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import AuthModal from '../../AuthModal';

/**
 * 移动端顶部导航栏
 */
function MobileHeader({ onMenuClick }) {
  const { user, setUser } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleAvatarClick = () => {
    if (!user) {
      setShowAuthModal(true);
    }
    // 已登录用户点击头像可以后续扩展为打开用户菜单
  };

  const handleAuthSuccess = (newUser) => {
    setUser(newUser);
    setShowAuthModal(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 safe-area-top transition-colors duration-300">
        <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
          {/* 左侧：汉堡菜单 */}
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 touch-feedback hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors rounded-none"
            aria-label="打开菜单"
          >
            <Menu className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
          </button>

          {/* 中间：Logo */}
          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="text-lg font-bold text-endfield-yellow tracking-wider uppercase drop-shadow-sm">终末地抽卡分析器</span>
          </div>

          {/* 右侧：用户头像（点击可登录） */}
          <button
            onClick={handleAvatarClick}
            className="p-1 -mr-1 touch-feedback group"
            aria-label={user ? '用户信息' : '点击登录'}
          >
            {user ? (
              <div className="w-8 h-8 rounded-none bg-endfield-yellow flex items-center justify-center overflow-hidden border border-endfield-yellow group-hover:border-yellow-400 transition-colors shadow-sm">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="头像"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-black font-mono">
                    {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-none bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700 transition-colors">
                <User className="w-4 h-4 text-zinc-500" />
              </div>
            )}
          </button>
        </div>
      </header>

      {/* 登录弹窗 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}

export default MobileHeader;
