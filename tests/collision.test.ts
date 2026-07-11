import { describe, expect, it } from 'vitest';
import {
  calculateCollisionSensors,
  collidesWithAnyObstacle,
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

  it('requires a slow ball inside the capture radius', () => {
    expect(isBallInHole(level, { x: 105, y: 40 }, 2)).toBe(true);
    expect(isBallInHole(level, { x: 105, y: 40 }, 3)).toBe(false);
    expect(isBallInHole(level, { x: 90, y: 40 }, 0)).toBe(false);
  });
});
