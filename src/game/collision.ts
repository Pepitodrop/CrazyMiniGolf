import type { CollisionSensors, LevelDefinition, Obstacle, Vec2 } from './types';

export const HOLE_CAPTURE_MAX_SPEED = 2;
export type HoleCaptureStatus = 'outside' | 'too-fast' | 'capturable';

function circleIntersectsRect(
  center: Vec2,
  radius: number,
  obstacle: Extract<Obstacle, { type: 'rect' }>,
): boolean {
  const nearestX = Math.max(obstacle.x, Math.min(center.x, obstacle.x + obstacle.width));
  const nearestY = Math.max(obstacle.y, Math.min(center.y, obstacle.y + obstacle.height));
  const dx = center.x - nearestX;
  const dy = center.y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function circleIntersectsCircle(
  center: Vec2,
  radius: number,
  obstacle: Extract<Obstacle, { type: 'circle' }>,
): boolean {
  const dx = center.x - obstacle.x;
  const dy = center.y - obstacle.y;
  const combined = radius + obstacle.radius;
  return dx * dx + dy * dy <= combined * combined;
}

export function collidesWithObstacle(point: Vec2, radius: number, obstacle: Obstacle): boolean {
  return obstacle.type === 'rect'
    ? circleIntersectsRect(point, radius, obstacle)
    : circleIntersectsCircle(point, radius, obstacle);
}

export function collidesWithAnyObstacle(level: LevelDefinition, point: Vec2): boolean {
  return level.obstacles.some((obstacle) =>
    collidesWithObstacle(point, level.ballRadius, obstacle),
  );
}

export function calculateCollisionSensors(
  level: LevelDefinition,
  position: Vec2,
  velocityX: number,
  velocityXNegative: boolean,
  velocityY: number,
  velocityYNegative: boolean,
): CollisionSensors {
  const nextX = position.x + (velocityXNegative ? -velocityX : velocityX);
  const nextY = position.y + (velocityYNegative ? -velocityY : velocityY);
  const xPoint = { x: nextX, y: position.y };
  const yPoint = { x: position.x, y: nextY };
  const nextPoint = { x: nextX, y: nextY };

  const xWall = nextX - level.ballRadius < 0 || nextX + level.ballRadius > level.width;
  const yWall = nextY - level.ballRadius < 0 || nextY + level.ballRadius > level.height;
  const obstacleCollision =
    collidesWithAnyObstacle(level, xPoint) ||
    collidesWithAnyObstacle(level, yPoint) ||
    collidesWithAnyObstacle(level, nextPoint);

  return {
    blockX: velocityX > 0 && (xWall || obstacleCollision),
    blockY: velocityY > 0 && (yWall || obstacleCollision),
    collisionKind: xWall || yWall ? 'wall' : obstacleCollision ? 'obstacle' : 'none',
  };
}

export function getHoleCaptureStatus(
  level: LevelDefinition,
  point: Vec2,
  velocityX: number,
  velocityY: number,
): HoleCaptureStatus {
  const dx = point.x - level.hole.x;
  const dy = point.y - level.hole.y;
  const captureRadius = level.holeRadius - Math.max(1, level.ballRadius / 2);
  if (dx * dx + dy * dy > captureRadius * captureRadius) return 'outside';
  return Math.hypot(velocityX, velocityY) <= HOLE_CAPTURE_MAX_SPEED ? 'capturable' : 'too-fast';
}

export function isBallInHole(
  level: LevelDefinition,
  point: Vec2,
  velocityX: number,
  velocityY = 0,
): boolean {
  return getHoleCaptureStatus(level, point, velocityX, velocityY) === 'capturable';
}
