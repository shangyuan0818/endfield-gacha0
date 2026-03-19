import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 监听 navigation state 中的 scrollTo 字段，
 * 导航完成后自动滚动到目标元素并播放高亮动画 + 浮动箭头指示。
 *
 * 用法：在顶层容器（如 GachaAnalyzer）中调用一次即可。
 * 导航时传 state：navigate(path, { state: { scrollTo: 'element-id', _ts: Date.now() } })
 */
export function useScrollToHighlight() {
  const location = useLocation();
  const handledRef = useRef(null);

  useEffect(() => {
    const { scrollTo, _ts } = location.state || {};
    if (!scrollTo || handledRef.current === _ts) return;

    handledRef.current = _ts;

    // 清除 state，防止浏览器后退时重复触发
    window.history.replaceState({}, '');

    // 等待目标页面渲染完成
    const timer = setTimeout(() => {
      const el = document.getElementById(scrollTo);
      if (!el) return;

      // 如果元素在关闭的 <details> 中，自动展开
      const details = el.closest('details');
      if (details && !details.open) {
        details.open = true;
      }

      // 滚动到元素
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 播放高亮动画
      el.classList.add('guide-highlight-flash');

      // 创建浮动箭头指示器
      const arrow = document.createElement('div');
      arrow.className = 'guide-arrow-indicator';
      arrow.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;
      document.body.appendChild(arrow);

      // 定位箭头到元素正上方
      const positionArrow = () => {
        const rect = el.getBoundingClientRect();
        arrow.style.left = `${rect.left + rect.width / 2}px`;
        arrow.style.top = `${rect.top - 40}px`;
      };
      // 等滚动完成后定位
      setTimeout(positionArrow, 500);

      // 清理
      const cleanup = setTimeout(() => {
        el.classList.remove('guide-highlight-flash');
        arrow.remove();
      }, 3000);

      return () => clearTimeout(cleanup);
    }, 450);

    return () => clearTimeout(timer);
  }, [location.state]);
}
