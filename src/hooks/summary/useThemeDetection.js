import { useState, useEffect } from 'react';

/**
 * 主题检测 Hook
 * 响应式监听 document.documentElement 的 class 变化来检测暗色模式
 *
 * @returns {boolean} isDark - 是否为暗色模式
 */
export function useThemeDetection() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

/**
 * 获取图表 Tooltip 样式
 * @param {boolean} isDark - 是否为暗色模式
 * @returns {Object} Tooltip 样式对象
 */
export function getTooltipStyle(isDark) {
  return {
    borderRadius: '0px',
    border: isDark ? '1px solid #3f3f46' : '1px solid #e4e4e7',
    boxShadow: isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    fontSize: '12px',
    backgroundColor: isDark ? '#18181b' : '#ffffff',
    color: isDark ? '#e4e4e7' : '#27272a'
  };
}

export default useThemeDetection;
