import type { AimState } from './types';

export const AIM_ANGLE_STEP_DEGREES = 5;
export const MIN_SHOT_STRENGTH = 2;
export const MAX_SHOT_STRENGTH = 14;

export interface ResolvedAim {
  aim: AimState;
  velocityX: number;
  xNegative: boolean;
  velocityY: number;
  yNegative: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function normalizeAngleDegrees(angleDegrees: number): number {
  const normalized = angleDegrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function snapAngleDegrees(angleDegrees: number): number {
  return normalizeAngleDegrees(
    Math.round(normalizeAngleDegrees(angleDegrees) / AIM_ANGLE_STEP_DEGREES) *
      AIM_ANGLE_STEP_DEGREES,
  );
}

export function angleFromDirection(direction: { x: number; y: number }): number {
  return normalizeAngleDegrees((Math.atan2(direction.y, direction.x) * 180) / Math.PI);
}

export function createAimFromAngle(angleDegrees: number, strength: number): AimState {
  const snappedAngle = snapAngleDegrees(angleDegrees);
  const radians = (snappedAngle * Math.PI) / 180;
  return {
    angleDegrees: snappedAngle,
    direction: { x: Math.cos(radians), y: Math.sin(radians) },
    strength: clamp(Math.round(strength), MIN_SHOT_STRENGTH, MAX_SHOT_STRENGTH),
  };
}

function unsignedAngleDegrees(x: number, y: number): number {
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function resolveUnsignedComponents(
  targetAngle: number,
  strength: number,
): { x: number; y: number } {
  let best = { x: strength, y: 0 };
  let bestScore = Number.POSITIVE_INFINITY;

  for (let x = 0; x <= strength; x += 1) {
    for (let y = 0; y <= strength; y += 1) {
      if (x === 0 && y === 0) continue;
      const angleError = Math.abs(unsignedAngleDegrees(x, y) - targetAngle);
      const magnitudeError = Math.abs(Math.hypot(x, y) - strength);
      const score = angleError * 10 + magnitudeError;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }

  return best;
}

export function resolveAim(input: AimState): ResolvedAim {
  const requestedAngle = input.angleDegrees ?? angleFromDirection(input.direction);
  const angleDegrees = snapAngleDegrees(requestedAngle);
  const strength = clamp(Math.round(input.strength), MIN_SHOT_STRENGTH, MAX_SHOT_STRENGTH);
  const radians = (angleDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const xNegative = cosine < -Number.EPSILON;
  const yNegative = sine < -Number.EPSILON;
  const quadrantAngle = (Math.atan2(Math.abs(sine), Math.abs(cosine)) * 180) / Math.PI;
  const components = resolveUnsignedComponents(quadrantAngle, strength);
  const signedX = xNegative ? -components.x : components.x;
  const signedY = yNegative ? -components.y : components.y;
  const length = Math.hypot(signedX, signedY) || 1;

  return {
    aim: {
      angleDegrees,
      direction: { x: signedX / length, y: signedY / length },
      strength,
    },
    velocityX: components.x,
    xNegative,
    velocityY: components.y,
    yNegative,
  };
}
