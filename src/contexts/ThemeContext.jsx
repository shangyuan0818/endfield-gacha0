/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { readStorageValue, STORAGE_KEYS, writeStorageValue } from '../utils/storageUtils.js';

const ThemeContext = createContext(null);

/**
 * 主题管理 Provider
 * 统一管理 themeMode / isDark / applyTheme 逻辑
 * 替代之前 App.jsx 和 MobileApp.jsx 中重复的 useEffect + MutationObserver
 */
export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => readStorageValue(STORAGE_KEYS.THEME_MODE, 'system', { raw: true }));
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (mode) => {
      let dark;
      if (mode === 'dark') {
        dark = true;
      } else if (mode === 'light') {
        dark = false;
      } else {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (dark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      setIsDark(dark);
    };

    applyTheme(themeMode);
    writeStorageValue(STORAGE_KEYS.THEME_MODE, themeMode, { raw: true });

    // system 模式下监听系统偏好变化
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        setIsDark(e.matches);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  const value = useMemo(() => ({
    themeMode,
    setThemeMode,
    isDark,
  }), [themeMode, isDark]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * 获取主题状态的 Hook
 * @returns {{ themeMode: string, setThemeMode: (mode: string) => void, isDark: boolean }}
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
