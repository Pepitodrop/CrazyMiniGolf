import { describe, expect, it } from 'vitest';
import {
  calculateCollisionSensors,
  collidesWithAnyObstacle,
  isBallInHole,
  isBallWithinHole,
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

  it('reports wall collisions per axis', () => {
    const sensors = calculateCollisionSensors(level, { x: 112, y: 40 }, 8, false, 0, false);
    expect(sensors.blockX).toBe(true);
    expect(sensors.collisionKind).toBe('wall');
  });

  it('reports obstacle collisions per axis', () => {
    const sensors = calculateCollisionSensors(level, { x: 42, y: 40 }, 8, false, 0, false);
    expect(sensors.blockX).toBe(true);
    expect(sensors.collisionKind).toBe('obstacle');
  });

  it('reflects one collision-normal axis instead of sending a corner shot straight back', () => {
    const cornerLevel: LevelDefinition = {
      ...level,
      obstacles: [{ type: 'rect', x: 50, y: 50, width: 20, height: 20 }],
    };
    const sensors = calculateCollisionSensors(cornerLevel, { x: 44, y: 44 }, 5, false, 4, false);
    expect(Number(sensors.blockX) + Number(sensors.blockY)).toBe(1);
    expect(sensors.collisionKind).toBe('obstacle');
  });

  it('distinguishes a fast pass across the hole from a capturable ball', () => {
    expect(isBallWithinHole(level, { x: 105, y: 40 })).toBe(true);
    expect(isBallInHole(level, { x: 105, y: 40 }, 2)).toBe(true);
    expect(isBallInHole(level, { x: 105, y: 40 }, 3)).toBe(false);
    expect(isBallWithinHole(level, { x: 90, y: 40 })).toBe(false);
  });
});
