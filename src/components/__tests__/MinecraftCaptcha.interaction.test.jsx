import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MinecraftCaptcha from '../MinecraftCaptcha.jsx';

function getInventorySlot(container, index) {
  return container.querySelectorAll('.inventory-grid .crafting-slot')[index];
}

describe('MinecraftCaptcha', () => {
  it('returns a held item when the user interacts outside the captcha', () => {
    const onOutsideClick = vi.fn();
    const { container } = render(
      <>
        <button type="button" onClick={onOutsideClick}>切换验证</button>
        <MinecraftCaptcha onVerified={vi.fn()} />
      </>
    );

    const firstInventorySlot = getInventorySlot(container, 0);
    expect(firstInventorySlot.querySelector('img[alt="烈焰棒"]')).not.toBeNull();

    fireEvent.click(firstInventorySlot, { clientX: 10, clientY: 10 });

    expect(firstInventorySlot.querySelector('img[alt="烈焰棒"]')).toBeNull();
    expect(container.querySelector('.held-item')).not.toBeNull();

    const outsideButton = screen.getByRole('button', { name: '切换验证' });
    fireEvent.pointerDown(outsideButton, { clientX: -10, clientY: -10 });
    fireEvent.click(outsideButton);

    expect(onOutsideClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.held-item')).toBeNull();
    expect(firstInventorySlot.querySelector('img[alt="烈焰棒"]')).not.toBeNull();
  });

  it('tracks touch movement with touch coordinates instead of invalid mouse coordinates', () => {
    const { container } = render(<MinecraftCaptcha onVerified={vi.fn()} />);
    const firstInventorySlot = getInventorySlot(container, 0);

    fireEvent.click(firstInventorySlot, { clientX: 10, clientY: 10 });
    fireEvent.touchMove(document, {
      touches: [{ clientX: 32, clientY: 48 }],
    });

    const heldItem = container.querySelector('.held-item');
    expect(heldItem).not.toBeNull();
    expect(heldItem.style.left).not.toContain('NaN');
    expect(heldItem.style.top).not.toContain('NaN');
  });
});
