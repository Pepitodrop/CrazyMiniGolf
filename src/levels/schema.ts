import { collidesWithObstacle } from '../game/collision';
import type { LevelDefinition, Obstacle, Vec2 } from '../game/types';

const isFiniteInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);

const isPoint = (value: unknown): value is Vec2 => {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Record<string, unknown>;
  return isFiniteInteger(point.x) && isFiniteInteger(point.y);
};

const isObstacle = (value: unknown): value is Obstacle => {
  if (typeof value !== 'object' || value === null) return false;
  const obstacle = value as Record<string, unknown>;
  if (obstacle.type === 'rect') {
    return (
      isFiniteInteger(obstacle.x) &&
      isFiniteInteger(obstacle.y) &&
      isFiniteInteger(obstacle.width) &&
      isFiniteInteger(obstacle.height) &&
      obstacle.width > 0 &&
      obstacle.height > 0
    );
  }
  if (obstacle.type === 'circle') {
    return (
      isFiniteInteger(obstacle.x) &&
      isFiniteInteger(obstacle.y) &&
      isFiniteInteger(obstacle.radius) &&
      obstacle.radius > 0
    );
  }
  return false;
};

function pointInsideCourse(point: Vec2, radius: number, width: number, height: number): boolean {
  return (
    point.x - radius >= 0 &&
    point.x + radius <= width &&
    point.y - radius >= 0 &&
    point.y + radius <= height
  );
}

function obstacleInsideCourse(obstacle: Obstacle, width: number, height: number): boolean {
  if (obstacle.type === 'rect') {
    return (
      obstacle.x >= 0 &&
      obstacle.y >= 0 &&
      obstacle.x + obstacle.width <= width &&
      obstacle.y + obstacle.height <= height
    );
  }
  return pointInsideCourse(obstacle, obstacle.radius, width, height);
}

export function validateLevel(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null) return ['Level must be an object.'];
  const level = value as Record<string, unknown>;
  const requiredIntegers = ['id', 'width', 'height', 'holeRadius', 'ballRadius', 'par'] as const;
  for (const key of requiredIntegers) {
    if (!isFiniteInteger(level[key])) errors.push(`${key} must be a finite integer.`);
  }
  if (typeof level.name !== 'string' || level.name.trim().length === 0) {
    errors.push('name must be a non-empty string.');
  }
  if (
    level.specialRule !== undefined &&
    (typeof level.specialRule !== 'string' || level.specialRule.trim().length === 0)
  ) {
    errors.push('specialRule must be a non-empty string when provided.');
  }
  if (!isPoint(level.start)) errors.push('start must contain integer x and y values.');
  if (!isPoint(level.hole)) errors.push('hole must contain integer x and y values.');
  if (!Array.isArray(level.obstacles) || !level.obstacles.every(isObstacle)) {
    errors.push('obstacles must be an array of valid rectangle or circle obstacles.');
  }

  if (errors.length === 0) {
    const typed = level as unknown as LevelDefinition;
    if (typed.id < 1 || typed.id > 9) errors.push('id must be between 1 and 9.');
    if (typed.width < 80 || typed.width > 250 || typed.height < 80 || typed.height > 220) {
      errors.push('level dimensions must stay inside the 8-bit engine limits.');
    }
    if (typed.par < 1 || typed.par > 20) errors.push('par must be between 1 and 20.');
    if (typed.ballRadius < 2 || typed.ballRadius > 8) errors.push('ballRadius must be 2–8.');
    if (typed.holeRadius <= typed.ballRadius || typed.holeRadius > 20) {
      errors.push('holeRadius must exceed ballRadius and be at most 20.');
    }
    if (!pointInsideCourse(typed.start, typed.ballRadius, typed.width, typed.height)) {
      errors.push('start lies outside the playable area.');
    }
    if (!pointInsideCourse(typed.hole, typed.holeRadius, typed.width, typed.height)) {
      errors.push('hole lies outside the playable area.');
    }

    const startHoleDistance = Math.hypot(
      typed.start.x - typed.hole.x,
      typed.start.y - typed.hole.y,
    );
    if (startHoleDistance <= typed.holeRadius + typed.ballRadius) {
      errors.push('start and hole must not overlap.');
    }

    typed.obstacles.forEach((obstacle, index) => {
      if (!obstacleInsideCourse(obstacle, typed.width, typed.height)) {
        errors.push(`obstacle ${index + 1} lies outside the playable area.`);
      }
      if (collidesWithObstacle(typed.start, typed.ballRadius, obstacle)) {
        errors.push(`start overlaps obstacle ${index + 1}.`);
      }
      if (collidesWithObstacle(typed.hole, typed.holeRadius, obstacle)) {
        errors.push(`hole overlaps obstacle ${index + 1}.`);
      }
    });
  }
  return errors;
}

export function parseLevels(value: unknown): LevelDefinition[] {
  if (!Array.isArray(value)) throw new Error('Level file must contain an array.');
  const errors = value.flatMap((level, index) =>
    validateLevel(level).map((message) => `Level ${index + 1}: ${message}`),
  );
  if (value.length !== 9) errors.push(`Expected 9 levels, found ${value.length}.`);
  const ids = value
    .filter(
      (level): level is Record<string, unknown> => typeof level === 'object' && level !== null,
    )
    .map((level) => level.id);
  if (new Set(ids).size !== ids.length) errors.push('Level ids must be unique.');
  const numericIds = ids.filter((id): id is number => typeof id === 'number').sort((a, b) => a - b);
  if (numericIds.length === 9 && numericIds.some((id, index) => id !== index + 1)) {
    errors.push('Level ids must be exactly 1 through 9.');
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return [...(value as LevelDefinition[])].sort((a, b) => a.id - b.id);
}
