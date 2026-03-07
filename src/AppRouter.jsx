import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DeviceRedirectGuard from './components/guards/DeviceRedirectGuard';
import App from './App';

// 懒加载移动端入口
const MobileApp = lazy(() => import('./mobile/MobileApp'));
// 懒加载法律页面
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./components/legal/TermsOfService'));

/**
 * 应用路由配置
 * - / : 桌面端入口
 * - /m/* : 移动端入口
 * - /privacy : 隐私政策
 * - /terms : 用户协议
 */
function AppRouter() {
  return (
    <DeviceRedirectGuard>
      <Routes>
        {/* 桌面端路由 */}
        <Route path="/*" element={<App />} />

        {/* 移动端路由 */}
        <Route
          path="/m/*"
          element={
            <Suspense fallback={<MobileLoadingFallback />}>
              <MobileApp />
            </Suspense>
          }
        />

        {/* 法律页面 */}
        <Route
          path="/privacy"
          element={
            <Suspense fallback={<MobileLoadingFallback />}>
              <PrivacyPolicy />
            </Suspense>
          }
        />
        <Route
          path="/terms"
          element={
            <Suspense fallback={<MobileLoadingFallback />}>
              <TermsOfService />
            </Suspense>
          }
        />

        {/* 未匹配路由重定向到首页 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DeviceRedirectGuard>
  );
}

// 移动端加载占位
function MobileLoadingFallback() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-endfield-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-500 dark:text-zinc-400">加载中...</p>
      </div>
    </div>
  );
}

export default AppRouter;
