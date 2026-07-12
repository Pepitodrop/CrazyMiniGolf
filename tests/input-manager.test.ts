// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { InputManager } from '../src/game/InputManager';
import type { AimState } from '../src/game/types';

describe('InputManager', () => {
  it('handles keyboard aiming, striking, restart and pause', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() });
    const onAim = vi.fn();
    const onStrike = vi.fn();
    const onRestart = vi.fn();
    const onPause = vi.fn();
    const manager = new InputManager(canvas, {
      canAim: () => true,
      getBallPosition: () => ({ x: 0, y: 0 }),
      toWorld: (x, y) => ({ x, y }),
      onAim,
      onStrike,
      onRestart,
      onPause,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

    expect(onAim).toHaveBeenCalled();
    const shot = onStrike.mock.calls[0]?.[0] as AimState | undefined;
    expect(shot?.strength).toBe(8);
    expect(shot?.angleDegrees).toBe(5);
    expect(shot?.direction.x).toBeCloseTo(Math.cos((5 * Math.PI) / 180));
    expect(shot?.direction.y).toBeCloseTo(Math.sin((5 * Math.PI) / 180));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
    manager.dispose();
  });

  it('does not hijack keys while an interactive control is focused', () => {
    const canvas = document.createElement('canvas');
    const input = document.createElement('input');
    document.body.append(input);
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() });
    const onAim = vi.fn();
    const onStrike = vi.fn();
    const manager = new InputManager(canvas, {
      canAim: () => true,
      getBallPosition: () => ({ x: 0, y: 0 }),
      toWorld: (x, y) => ({ x, y }),
      onAim,
      onStrike,
      onRestart: vi.fn(),
      onPause: vi.fn(),
    });

    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));

    expect(onAim).not.toHaveBeenCalled();
    expect(onStrike).not.toHaveBeenCalled();
    manager.dispose();
    input.remove();
  });

  it('converts pointer distance to a clamped strike strength', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() });
    const onStrike = vi.fn();
    const manager = new InputManager(canvas, {
      canAim: () => true,
      getBallPosition: () => ({ x: 10, y: 10 }),
      toWorld: (x, y) => ({ x, y }),
      onAim: vi.fn(),
      onStrike,
      onRestart: vi.fn(),
      onPause: vi.fn(),
    });

    const down = new Event('pointerdown') as PointerEvent;
    Object.defineProperties(down, {
      pointerId: { value: 1 },
      clientX: { value: 108 },
      clientY: { value: 10 },
    });
    const up = new Event('pointerup') as PointerEvent;
    Object.defineProperties(up, {
      pointerId: { value: 1 },
      clientX: { value: 108 },
      clientY: { value: 10 },
    });
    canvas.dispatchEvent(down);
    canvas.dispatchEvent(up);

    expect(onStrike).toHaveBeenCalledWith({
      angleDegrees: 0,
      direction: { x: 1, y: 0 },
      strength: 14,
    });
    manager.dispose();
  });
});
