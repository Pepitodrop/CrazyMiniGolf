import type { AimState } from './types';

export const AIM_STEP_DEGREES = 5;
export const MIN_STRENGTH = 2;
export const MAX_STRENGTH = 14;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function snapAngleDegrees(value: number): number {
  return normalizeDegrees(Math.round(normalizeDegrees(value) / AIM_STEP_DEGREES) * AIM_STEP_DEGREES);
}

export function angleFromDirection(direction: AimState['direction']): number {
  return normalizeDegrees((Math.atan2(direction.y, direction.x) * 180) / Math.PI);
}

export function aimFromDegrees(angleDegrees: number, strength: number): AimState {
  const snappedDegrees = snapAngleDegrees(angleDegrees);
  const radians = (snappedDegrees * Math.PI) / 180;
  return {
    direction: { x: Math.cos(radians), y: Math.sin(radians) },
    strength: clamp(Math.round(strength), MIN_STRENGTH, MAX_STRENGTH),
  };
}

export function snapAim(aim: AimState): AimState {
  return aimFromDegrees(angleFromDirection(aim.direction), aim.strength);
}

export interface EngineAimVector {
  velocityX: number;
  xNegative: boolean;
  velocityY: number;
  yNegative: boolean;
  strength: number;
}

export function toEngineAimVector(aim: AimState): EngineAimVector {
  const snapped = snapAim(aim);
  const velocityX = Math.round(Math.abs(snapped.direction.x) * snapped.strength);
  const velocityY = Math.round(Math.abs(snapped.direction.y) * snapped.strength);

  return {
    velocityX,
    xNegative: snapped.direction.x < 0,
    velocityY,
    yNegative: snapped.direction.y < 0,
    strength: snapped.strength,
  };
}
