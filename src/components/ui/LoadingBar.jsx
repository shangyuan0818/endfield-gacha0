import React, { useEffect, useState, useRef } from 'react';

/**
 * 全局顶部加载进度条组件
 * 类似 NProgress / YouTube 风格的加载指示器
 *
 * @param {boolean} isLoading - 是否正在加载
 * @param {number} progress - 可选的确定性进度 (0-100)，不传则使用不确定性动画
 * @param {string} color - 进度条颜色，默认使用 Endfield 黄色
 */
const LoadingBar = React.memo(({ isLoading, progress = null, color = 'bg-endfield-yellow' }) => {
  const [internalProgress, setInternalProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let rafId = null;

    if (isLoading) {
      rafId = requestAnimationFrame(() => {
        setVisible(true);
        setInternalProgress(progress === null ? 30 : 0);
      });

      if (progress === null) {
        intervalRef.current = setInterval(() => {
          setInternalProgress(prev => {
            if (prev >= 90) {
              clearInterval(intervalRef.current);
              return prev;
            }
            const increment = Math.max(0.5, (90 - prev) / 10);
            return Math.min(90, prev + increment);
          });
        }, 200);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (visible) {
        rafId = requestAnimationFrame(() => {
          setInternalProgress(100);
          timeoutRef.current = setTimeout(() => {
            setVisible(false);
            setInternalProgress(0);
          }, 400);
        });
      }
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isLoading, progress, visible]);

  // 如果传入了确定性进度，使用它
  const displayProgress = progress !== null ? progress : internalProgress;

  if (!visible && !isLoading) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent pointer-events-none">
      {/* 进度条主体 */}
      <div
        className={`h-full ${color} transition-all duration-300 ease-out shadow-lg`}
        style={{
          width: `${displayProgress}%`,
          boxShadow: `0 0 10px var(--tw-shadow-color, #FFD700), 0 0 5px var(--tw-shadow-color, #FFD700)`,
          opacity: visible ? 1 : 0,
        }}
      />

      {/* 尾部光晕效果 */}
      {visible && displayProgress < 100 && (
        <div
          className={`absolute top-0 h-full w-24 ${color} opacity-30`}
          style={{
            right: `${100 - displayProgress}%`,
            transform: 'translateX(100%)',
            background: `linear-gradient(to right, transparent, currentColor)`,
            animation: 'pulse 1s ease-in-out infinite',
          }}
        />
      )}

      {/* 动画样式 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
});

LoadingBar.displayName = 'LoadingBar';

export default LoadingBar;
