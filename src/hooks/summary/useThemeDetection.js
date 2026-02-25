import { useTheme } from '../../contexts/ThemeContext';

/**
 * 主题检测 Hook（兼容层）
 * 内部使用 ThemeContext，不再使用 MutationObserver
 *
 * @returns {boolean} isDark - 是否为暗色模式
 */
export function useThemeDetection() {
  const { isDark } = useTheme();
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
