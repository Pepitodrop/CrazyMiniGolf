import type { CollisionSensors, LevelDefinition, Obstacle, Vec2 } from './types';

export const HOLE_CAPTURE_MAX_SPEED = 2;
export type HoleCaptureStatus = 'outside' | 'too-fast' | 'capturable';

type CollisionAxis = 'x' | 'y';

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

function distanceSquaredToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return dx * dx + dy * dy;
  }

  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared),
  );
  const nearestX = start.x + projection * segmentX;
  const nearestY = start.y + projection * segmentY;
  const dx = point.x - nearestX;
  const dy = point.y - nearestY;
  return dx * dx + dy * dy;
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

function closestObstacle(level: LevelDefinition, point: Vec2): Obstacle | null {
  return (
    level.obstacles.find((obstacle) =>
      collidesWithObstacle(point, level.ballRadius, obstacle),
    ) ?? null
  );
}

function rectangleCollisionNormal(
  point: Vec2,
  obstacle: Extract<Obstacle, { type: 'rect' }>,
): Vec2 {
  const nearestX = Math.max(obstacle.x, Math.min(point.x, obstacle.x + obstacle.width));
  const nearestY = Math.max(obstacle.y, Math.min(point.y, obstacle.y + obstacle.height));
  let normalX = point.x - nearestX;
  let normalY = point.y - nearestY;

  if (normalX === 0 && normalY === 0) {
    const distances = [
      { axis: 'x' as const, value: Math.abs(point.x - obstacle.x), sign: -1 },
      { axis: 'x' as const, value: Math.abs(obstacle.x + obstacle.width - point.x), sign: 1 },
      { axis: 'y' as const, value: Math.abs(point.y - obstacle.y), sign: -1 },
      { axis: 'y' as const, value: Math.abs(obstacle.y + obstacle.height - point.y), sign: 1 },
    ];
    const nearestSide = distances.reduce((best, candidate) =>
      candidate.value < best.value ? candidate : best,
    );
    normalX = nearestSide.axis === 'x' ? nearestSide.sign : 0;
    normalY = nearestSide.axis === 'y' ? nearestSide.sign : 0;
  }

  return { x: normalX, y: normalY };
}

function collisionNormal(point: Vec2, obstacle: Obstacle): Vec2 {
  return obstacle.type === 'rect'
    ? rectangleCollisionNormal(point, obstacle)
    : { x: point.x - obstacle.x, y: point.y - obstacle.y };
}

function dominantReflectionAxis(
  normal: Vec2,
  velocityX: number,
  velocityY: number,
): CollisionAxis {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  if (absX === absY) return velocityX >= velocityY ? 'x' : 'y';
  return absX > absY ? 'x' : 'y';
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
  const xObstacle = velocityX > 0 && collidesWithAnyObstacle(level, xPoint);
  const yObstacle = velocityY > 0 && collidesWithAnyObstacle(level, yPoint);
  const diagonalObstacle =
    velocityX > 0 &&
    velocityY > 0 &&
    !xObstacle &&
    !yObstacle &&
    closestObstacle(level, nextPoint);
  const diagonalAxis = diagonalObstacle
    ? dominantReflectionAxis(collisionNormal(nextPoint, diagonalObstacle), velocityX, velocityY)
    : null;

  const blockX = velocityX > 0 && (xWall || xObstacle || diagonalAxis === 'x');
  const blockY = velocityY > 0 && (yWall || yObstacle || diagonalAxis === 'y');
  const obstacleCollision = xObstacle || yObstacle || diagonalObstacle !== null;

  return {
    blockX,
    blockY,
    collisionKind: xWall || yWall ? 'wall' : obstacleCollision ? 'obstacle' : 'none',
  };
}

export function getHoleCaptureStatus(
  level: LevelDefinition,
  point: Vec2,
  velocityX: number,
  velocityY: number,
  previousPoint: Vec2 = point,
): HoleCaptureStatus {
  const captureRadius = level.holeRadius - Math.max(1, level.ballRadius / 2);
  const distanceSquared = distanceSquaredToSegment(level.hole, previousPoint, point);
  if (distanceSquared > captureRadius * captureRadius) return 'outside';
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
