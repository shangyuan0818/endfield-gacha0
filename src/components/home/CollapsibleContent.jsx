import React from 'react';

const CollapsibleContent = React.memo(function CollapsibleContent({
  isOpen,
  children,
  unmountOnClose = false
}) {
  return (
    <div
      className={`grid transition-all duration-500 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
    >
      <div className="overflow-hidden">
        {isOpen || !unmountOnClose ? children : null}
      </div>
    </div>
  );
});

export default CollapsibleContent;
