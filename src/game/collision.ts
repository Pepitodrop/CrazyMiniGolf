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

function diagonalReflectionAxis(
  level: LevelDefinition,
  next: Vec2,
  velocityX: number,
  velocityY: number,
): 'x' | 'y' | null {
  const obstacle = level.obstacles.find((candidate) =>
    collidesWithObstacle(next, level.ballRadius, candidate),
  );
  if (!obstacle) return null;

  let normalX: number;
  let normalY: number;
  if (obstacle.type === 'circle') {
    normalX = next.x - obstacle.x;
    normalY = next.y - obstacle.y;
  } else {
    const nearestX = Math.max(obstacle.x, Math.min(next.x, obstacle.x + obstacle.width));
    const nearestY = Math.max(obstacle.y, Math.min(next.y, obstacle.y + obstacle.height));
    normalX = next.x - nearestX;
    normalY = next.y - nearestY;

    if (normalX === 0 && normalY === 0) {
      const left = Math.abs(next.x - obstacle.x);
      const right = Math.abs(obstacle.x + obstacle.width - next.x);
      const top = Math.abs(next.y - obstacle.y);
      const bottom = Math.abs(obstacle.y + obstacle.height - next.y);
      const minimum = Math.min(left, right, top, bottom);
      normalX = minimum === left ? -1 : minimum === right ? 1 : 0;
      normalY = minimum === top ? -1 : minimum === bottom ? 1 : 0;
    }
  }

  if (Math.abs(normalX) === Math.abs(normalY)) {
    return velocityX >= velocityY ? 'x' : 'y';
  }
  return Math.abs(normalX) > Math.abs(normalY) ? 'x' : 'y';
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
  const xObstacle = velocityX > 0 && collidesWithAnyObstacle(level, xPoint);
  const yObstacle = velocityY > 0 && collidesWithAnyObstacle(level, yPoint);
  const diagonalObstacle =
    velocityX > 0 &&
    velocityY > 0 &&
    !xObstacle &&
    !yObstacle &&
    collidesWithAnyObstacle(level, { x: nextX, y: nextY });
  const diagonalAxis = diagonalObstacle
    ? diagonalReflectionAxis(level, { x: nextX, y: nextY }, velocityX, velocityY)
    : null;

  const blockX = velocityX > 0 && (xWall || xObstacle || diagonalAxis === 'x');
  const blockY = velocityY > 0 && (yWall || yObstacle || diagonalAxis === 'y');

  return {
    blockX,
    blockY,
    collisionKind:
      xWall || yWall ? 'wall' : xObstacle || yObstacle || diagonalObstacle ? 'obstacle' : 'none',
  };
}

export function isBallWithinHole(level: LevelDefinition, point: Vec2): boolean {
  const dx = point.x - level.hole.x;
  const dy = point.y - level.hole.y;
  const captureRadius = level.holeRadius - Math.max(1, level.ballRadius / 2);
  return dx * dx + dy * dy <= captureRadius * captureRadius;
}

export function isBallInHole(level: LevelDefinition, point: Vec2, movingValue: number): boolean {
  return movingValue <= 2 && isBallWithinHole(level, point);
}
