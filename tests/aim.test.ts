import { describe, expect, it } from 'vitest';
import { createAimFromAngle, resolveAim, snapAngleDegrees } from '../src/game/aim';

describe('aim resolution', () => {
  it('snaps all controls to five-degree increments', () => {
    expect(snapAngleDegrees(2)).toBe(0);
    expect(snapAngleDegrees(3)).toBe(5);
    expect(snapAngleDegrees(358)).toBe(0);
  });

  it('uses the same normalized vector for the guide and engine components', () => {
    const resolved = resolveAim(createAimFromAngle(35, 12));
    const length = Math.hypot(resolved.velocityX, resolved.velocityY);
    expect(resolved.aim.angleDegrees).toBe(35);
    expect(resolved.aim.direction.x).toBeCloseTo(resolved.velocityX / length);
    expect(resolved.aim.direction.y).toBeCloseTo(resolved.velocityY / length);
  });

  it('preserves signs in every quadrant', () => {
    const resolved = resolveAim(createAimFromAngle(215, 10));
    expect(resolved.xNegative).toBe(true);
    expect(resolved.yNegative).toBe(true);
    expect(resolved.velocityX).toBeGreaterThan(0);
    expect(resolved.velocityY).toBeGreaterThan(0);
  });
});
