import type { LevelDefinition, Obstacle } from '../game/types';

const isFiniteInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);

const isPoint = (value: unknown): value is { x: number; y: number } => {
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
  if (!isPoint(level.start)) errors.push('start must contain integer x and y values.');
  if (!isPoint(level.hole)) errors.push('hole must contain integer x and y values.');
  if (!Array.isArray(level.obstacles) || !level.obstacles.every(isObstacle)) {
    errors.push('obstacles must be an array of valid rectangle or circle obstacles.');
  }

  if (errors.length === 0) {
    const typed = level as unknown as LevelDefinition;
    if (typed.width < 80 || typed.width > 250 || typed.height < 80 || typed.height > 220) {
      errors.push('level dimensions must stay inside the 8-bit engine limits.');
    }
    if (typed.ballRadius < 2 || typed.ballRadius > 8) errors.push('ballRadius must be 2–8.');
    if (typed.holeRadius <= typed.ballRadius) errors.push('holeRadius must exceed ballRadius.');
    for (const [label, point] of [
      ['start', typed.start],
      ['hole', typed.hole],
    ] as const) {
      if (
        point.x < typed.ballRadius ||
        point.x > typed.width - typed.ballRadius ||
        point.y < typed.ballRadius ||
        point.y > typed.height - typed.ballRadius
      ) {
        errors.push(`${label} lies outside the playable area.`);
      }
    }
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
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return value as LevelDefinition[];
}
