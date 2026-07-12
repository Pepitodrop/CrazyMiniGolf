import { describe, expect, it } from 'vitest';
import {
  calculateCollisionSensors,
  collidesWithAnyObstacle,
  getHoleCaptureStatus,
  isBallInHole,
} from '../src/game/collision';
import type { LevelDefinition } from '../src/game/types';

const level: LevelDefinition = {
  id: 1,
  name: 'Test',
  width: 120,
  height: 80,
  start: { x: 10, y: 40 },
  hole: { x: 105, y: 40 },
  holeRadius: 7,
  ballRadius: 4,
  par: 2,
  obstacles: [{ type: 'rect', x: 50, y: 20, width: 20, height: 40 }],
};

describe('collision adapter', () => {
  it('detects rectangle intersections', () => {
    expect(collidesWithAnyObstacle(level, { x: 47, y: 40 })).toBe(true);
    expect(collidesWithAnyObstacle(level, { x: 20, y: 40 })).toBe(false);
  });
  it('reflects only the blocked axis on the outer course wall', () => {
    const sensors = calculateCollisionSensors(level, { x: 112, y: 40 }, 8, false, 3, false);
    expect(sensors.blockX).toBe(true);
    expect(sensors.blockY).toBe(false);
    expect(sensors.collisionKind).toBe('wall');
  });
  it('reverses every active component on a pink obstacle', () => {
    const sensors = calculateCollisionSensors(level, { x: 42, y: 40 }, 8, false, 3, false);
    expect(sensors.blockX).toBe(true);
    expect(sensors.blockY).toBe(true);
    expect(sensors.collisionKind).toBe('obstacle');
  });
  it('blocks both axes when a diagonal step would clip an obstacle corner', () => {
    const cornerLevel = {
      ...level,
      obstacles: [{ type: 'rect', x: 50, y: 50, width: 20, height: 20 }],
    } satisfies LevelDefinition;
    const sensors = calculateCollisionSensors(cornerLevel, { x: 44, y: 44 }, 4, false, 4, false);
    expect(sensors.blockX).toBe(true);
    expect(sensors.blockY).toBe(true);
    expect(sensors.collisionKind).toBe('obstacle');
  });
  it('distinguishes a capturable ball from a fast pass over the hole', () => {
    expect(getHoleCaptureStatus(level, { x: 105, y: 40 }, 2, 0)).toBe('capturable');
    expect(getHoleCaptureStatus(level, { x: 105, y: 40 }, 3, 0)).toBe('too-fast');
    expect(getHoleCaptureStatus(level, { x: 90, y: 40 }, 0, 0)).toBe('outside');
    expect(isBallInHole(level, { x: 105, y: 40 }, 2, 0)).toBe(true);
  });
});
