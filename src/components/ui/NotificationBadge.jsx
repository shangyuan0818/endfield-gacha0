import React from 'react';

/**
 * 通知气泡组件
 * 显示红点或数字徽章
 */
const NotificationBadge = React.memo(({
  count = 0,
  showDot = false,
  maxCount = 99,
  className = '',
  dotClassName = '',
  children
}) => {
  // 不显示任何内容
  if (!showDot && count <= 0) {
    return children || null;
  }

  // 格式化数字显示
  const displayCount = count > maxCount ? `${maxCount}+` : count;

  return (
    <div className={`relative inline-flex ${className}`}>
      {children}
      {showDot && count <= 0 ? (
        // 仅显示红点
        <span
          className={`absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ${dotClassName}`}
        />
      ) : count > 0 ? (
        // 显示数字徽章
        <span
          className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full ${dotClassName}`}
        >
          {displayCount}
        </span>
      ) : null}
    </div>
  );
});

NotificationBadge.displayName = 'NotificationBadge';

export default NotificationBadge;
