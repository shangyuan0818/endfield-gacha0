export function handleHorizontalWheelScroll(event) {
  const element = event.currentTarget || event.target;
  if (!element || element.scrollWidth <= element.clientWidth) {
    return;
  }

  const deltaX = Number(event.deltaX) || 0;
  const deltaY = Number(event.deltaY) || 0;
  const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;

  if (!delta) {
    return;
  }

  if (event.cancelable) {
    event.preventDefault();
  }
  event.stopPropagation();

  const maxScrollLeft = element.scrollWidth - element.clientWidth;
  const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, element.scrollLeft + delta));

  element.scrollLeft = nextScrollLeft;
}

export function bindHorizontalWheelScroll(element) {
  if (!element || typeof element.addEventListener !== 'function') {
    return () => {};
  }

  const handleWheel = (event) => {
    handleHorizontalWheelScroll(event);
  };

  element.addEventListener('wheel', handleWheel, { passive: false });
  return () => {
    element.removeEventListener('wheel', handleWheel);
  };
}
