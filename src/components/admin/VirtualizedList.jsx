import React, { useCallback, useMemo, useState } from 'react';

const DEFAULT_ITEM_HEIGHT = 112;
const DEFAULT_MAX_HEIGHT = 560;
const DEFAULT_OVERSCAN = 5;

const VirtualizedList = ({
  items,
  renderItem,
  getKey,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  maxHeight = DEFAULT_MAX_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  className = '',
  spacerClassName = '',
}) => {
  const safeItems = Array.isArray(items) ? items : [];
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(maxHeight / itemHeight) + overscan * 2;
    const endIndex = Math.min(safeItems.length, startIndex + visibleCount);
    return { startIndex, endIndex };
  }, [itemHeight, maxHeight, overscan, safeItems.length, scrollTop]);

  const handleScroll = useCallback((event) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const visibleItems = safeItems.slice(visibleRange.startIndex, visibleRange.endIndex);
  const topPadding = visibleRange.startIndex * itemHeight;
  const bottomPadding = Math.max(0, (safeItems.length - visibleRange.endIndex) * itemHeight);

  return (
    <div
      onScroll={handleScroll}
      className={`overflow-y-auto ${className}`}
      style={{ maxHeight, scrollbarWidth: 'thin' }}
    >
      <div className={spacerClassName} style={{ height: topPadding }} />
      {visibleItems.map((item, index) => {
        const absoluteIndex = visibleRange.startIndex + index;
        const key = getKey ? getKey(item, absoluteIndex) : absoluteIndex;
        return (
          <React.Fragment key={key}>
            {renderItem(item, absoluteIndex)}
          </React.Fragment>
        );
      })}
      <div className={spacerClassName} style={{ height: bottomPadding }} />
    </div>
  );
};

export default VirtualizedList;
