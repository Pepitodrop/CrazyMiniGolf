import { describe, expect, it } from 'vitest';
import { aimFromDegrees, snapAngleDegrees, toEngineAimVector } from '../src/game/aim';

describe('five-degree aim model', () => {
  it('snaps arbitrary angles to five-degree increments', () => {
    expect(snapAngleDegrees(12)).toBe(10);
    expect(snapAngleDegrees(13)).toBe(15);
    expect(snapAngleDegrees(-2)).toBe(0);
    expect(snapAngleDegrees(358)).toBe(0);
  });

  it('uses the same snapped direction for preview and engine velocity', () => {
    const aim = aimFromDegrees(33, 14);
    const engine = toEngineAimVector(aim);
    expect(engine.velocityX).toBe(12);
    expect(engine.velocityY).toBe(8);
    expect(engine.xNegative).toBe(false);
    expect(engine.yNegative).toBe(false);
  });

  it('preserves quadrant signs', () => {
    const engine = toEngineAimVector(aimFromDegrees(215, 10));
    expect(engine.xNegative).toBe(true);
    expect(engine.yNegative).toBe(true);
    expect(engine.velocityX).toBeGreaterThan(0);
    expect(engine.velocityY).toBeGreaterThan(0);
  });
});
