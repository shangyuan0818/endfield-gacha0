import React, { useState, useEffect } from 'react';
import MobileLayout from './layouts/MobileLayout';
import { ErrorBoundary } from '../components';
import MobileLoadingScreen from './components/MobileLoadingScreen';
import { useCloudSync, useAppInitialization, useNotificationBadges } from '../hooks/app';
import { useToast } from '../hooks';

/**
 * 移动端应用入口
 * 与桌面端 App.jsx + GachaAnalyzer.jsx 保持一致的初始化逻辑
 */
function MobileApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('theme') || 'system');

  // 初始化 Toast（用于 useCloudSync）
  const { showToast } = useToast();

  // 云同步 Hook - 提供 loadCloudData 函数
  const { loadCloudData } = useCloudSync({ showToast });

  // 应用初始化 Hook - 处理会话、加载云端数据到 stores
  useAppInitialization({ loadCloudData });

  // 通知徽标 Hook - 加载公告、工单、申请等
  useNotificationBadges();

  // 主题切换逻辑
  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (theme) => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // System
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(themeMode);
    localStorage.setItem('theme', themeMode);

    // Listen for system changes if mode is system
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        if (e.matches) root.classList.add('dark');
        else root.classList.remove('dark');
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  return (
    <ErrorBoundary>
      {isLoading && (
        <MobileLoadingScreen onComplete={() => setIsLoading(false)} />
      )}
      <div className={isLoading ? 'hidden' : 'block'}>
        <MobileLayout themeMode={themeMode} setThemeMode={setThemeMode} />
      </div>
    </ErrorBoundary>
  );
}

export default MobileApp;
