// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { Renderer } from '../src/game/Renderer';
import { createInitialState } from '../src/brainfuck/protocol';
import type { LevelDefinition } from '../src/game/types';

const level: LevelDefinition = {
  id: 1,
  name: 'Render Test',
  width: 200,
  height: 100,
  start: { x: 20, y: 50 },
  hole: { x: 180, y: 50 },
  holeRadius: 7,
  ballRadius: 4,
  par: 2,
  obstacles: [
    { type: 'rect', x: 80, y: 20, width: 20, height: 20 },
    { type: 'circle', x: 120, y: 60, radius: 10 },
  ],
};

function fakeContext(): {
  context: CanvasRenderingContext2D;
  fillRect: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
} {
  const gradient = { addColorStop: vi.fn() };
  const methods = [
    'clearRect',
    'fillRect',
    'strokeRect',
    'save',
    'restore',
    'translate',
    'scale',
    'beginPath',
    'moveTo',
    'lineTo',
    'stroke',
    'arc',
    'fill',
    'closePath',
    'setLineDash',
    'fillText',
  ];
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
  };
  for (const method of methods) target[method] = vi.fn();
  return {
    context: target as unknown as CanvasRenderingContext2D,
    fillRect: target.fillRect as ReturnType<typeof vi.fn>,
    arc: target.arc as ReturnType<typeof vi.fn>,
  };
}

describe('Renderer', () => {
  it('maps client coordinates into world coordinates and renders all shapes', () => {
    const canvas = document.createElement('canvas');
    const { context, fillRect, arc } = fakeContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(context);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 240,
      width: 400,
      height: 240,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    const renderer = new Renderer(canvas);

    const world = renderer.toWorld(level, 200, 120);
    expect(world.x).toBeCloseTo(100);
    expect(world.y).toBeCloseTo(50);

    expect(() =>
      renderer.render(
        level,
        createInitialState(1, level.start),
        { direction: { x: 1, y: 0 }, strength: 7 },
        false,
        null,
      ),
    ).not.toThrow();
    expect(fillRect).toHaveBeenCalled();
    expect(arc).toHaveBeenCalled();
  });
});
