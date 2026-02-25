import React, { useState } from 'react';
import MobileLayout from './layouts/MobileLayout';
import { ErrorBoundary } from '../components';
import MobileLoadingScreen from './components/MobileLoadingScreen';
import { useCloudSync, useAppInitialization, useNotificationBadges } from '../hooks/app';
import { useToast } from '../hooks';
import { ThemeProvider } from '../contexts/ThemeContext';

/**
 * 移动端应用入口
 * 与桌面端 App.jsx + GachaAnalyzer.jsx 保持一致的初始化逻辑
 */
function MobileApp() {
  const [isLoading, setIsLoading] = useState(true);

  // 初始化 Toast（用于 useCloudSync）
  const { showToast } = useToast();

  // 云同步 Hook - 提供 loadCloudData 函数
  const { loadCloudData } = useCloudSync({ showToast });

  // 应用初始化 Hook - 处理会话、加载云端数据到 stores
  useAppInitialization({ loadCloudData });

  // 通知徽标 Hook - 加载公告、工单、申请等
  useNotificationBadges();

  return (
    <ThemeProvider>
      <ErrorBoundary>
        {isLoading && (
          <MobileLoadingScreen onComplete={() => setIsLoading(false)} />
        )}
        <div className={isLoading ? 'hidden' : 'block'}>
          <MobileLayout />
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default MobileApp;
