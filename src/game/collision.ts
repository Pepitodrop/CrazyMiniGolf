import type { CollisionSensors, LevelDefinition, Obstacle, Vec2 } from './types';

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

  const xWall = nextX - level.ballRadius < 0 || nextX + level.ballRadius > level.width;
  const yWall = nextY - level.ballRadius < 0 || nextY + level.ballRadius > level.height;
  const xObstacle = collidesWithAnyObstacle(level, xPoint);
  const yObstacle = collidesWithAnyObstacle(level, yPoint);
  const blockX = velocityX > 0 && (xWall || xObstacle);
  const blockY = velocityY > 0 && (yWall || yObstacle);

  return {
    blockX,
    blockY,
    collisionKind: xWall || yWall ? 'wall' : xObstacle || yObstacle ? 'obstacle' : 'none',
  };
}

export function isBallInHole(level: LevelDefinition, point: Vec2, movingValue: number): boolean {
  const dx = point.x - level.hole.x;
  const dy = point.y - level.hole.y;
  const captureRadius = level.holeRadius - Math.max(1, level.ballRadius / 2);
  return movingValue <= 2 && dx * dx + dy * dy <= captureRadius * captureRadius;
}
