import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content, 'utf8');

function replaceExact(path, before, after) {
  const current = read(path);
  if (!current.includes(before)) throw new Error(`Expected text not found in ${path}: ${before.slice(0, 80)}`);
  write(path, current.replace(before, after));
}

function replaceBetween(path, startMarker, endMarker, replacement) {
  const current = read(path);
  const start = current.indexOf(startMarker);
  const end = current.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Markers not found in ${path}: ${startMarker} / ${endMarker}`);
  write(path, `${current.slice(0, start)}${replacement}${current.slice(end)}`);
}

write('src/game/aim.ts', `import type { AimState } from './types';

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

function resolveUnsignedComponents(targetAngle: number, strength: number): { x: number; y: number } {
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
`);

replaceExact(
  'src/game/types.ts',
  `export interface AimState {\n  direction: Vec2;\n  strength: number;\n}`,
  `export interface AimState {\n  direction: Vec2;\n  strength: number;\n  angleDegrees?: number;\n}`,
);

write('src/game/InputManager.ts', `import {
  AIM_ANGLE_STEP_DEGREES,
  createAimFromAngle,
  MAX_SHOT_STRENGTH,
  MIN_SHOT_STRENGTH,
} from './aim';
import type { AimState, Vec2 } from './types';

export interface InputCallbacks {
  canAim(): boolean;
  getBallPosition(): Vec2;
  toWorld(clientX: number, clientY: number): Vec2;
  onAim(aim: AimState): void;
  onStrike(aim: AimState): void;
  onRestart(): void;
  onPause(): void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export class InputManager {
  private pointerId: number | null = null;
  private keyboardAngleDegrees = 0;
  private keyboardStrength = 7;
  private readonly callbacks: InputCallbacks;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, callbacks: InputCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerCancel);
    window.addEventListener('keydown', this.keyDown);
  }

  private aimFromPoint(point: Vec2): AimState {
    const ball = this.callbacks.getBallPosition();
    const dx = point.x - ball.x;
    const dy = point.y - ball.y;
    const length = Math.hypot(dx, dy) || 1;
    const angleDegrees = (Math.atan2(dy, dx) * 180) / Math.PI;
    return createAimFromAngle(
      angleDegrees,
      clamp(Math.round(length / 7), MIN_SHOT_STRENGTH, MAX_SHOT_STRENGTH),
    );
  }

  private currentKeyboardAim(): AimState {
    return createAimFromAngle(this.keyboardAngleDegrees, this.keyboardStrength);
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (!this.callbacks.canAim()) return;
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    const aim = this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY));
    this.keyboardAngleDegrees = aim.angleDegrees ?? this.keyboardAngleDegrees;
    this.keyboardStrength = aim.strength;
    this.callbacks.onAim(aim);
  };

  private readonly pointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.callbacks.canAim()) return;
    const aim = this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY));
    this.keyboardAngleDegrees = aim.angleDegrees ?? this.keyboardAngleDegrees;
    this.keyboardStrength = aim.strength;
    this.callbacks.onAim(aim);
  };

  private readonly pointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.callbacks.canAim()) return;
    const aim = this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY));
    this.pointerId = null;
    this.keyboardAngleDegrees = aim.angleDegrees ?? this.keyboardAngleDegrees;
    this.keyboardStrength = aim.strength;
    this.callbacks.onAim(aim);
    this.callbacks.onStrike(aim);
  };

  private readonly pointerCancel = (): void => {
    this.pointerId = null;
  };

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (isInteractiveTarget(event.target)) return;
    if (event.repeat && event.code === 'Space') return;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      this.keyboardAngleDegrees -= AIM_ANGLE_STEP_DEGREES;
      event.preventDefault();
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      this.keyboardAngleDegrees += AIM_ANGLE_STEP_DEGREES;
      event.preventDefault();
    } else if (event.code === 'ArrowUp' || event.code === 'KeyW') {
      this.keyboardStrength += 1;
      event.preventDefault();
    } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
      this.keyboardStrength -= 1;
      event.preventDefault();
    } else if (event.code === 'Space') {
      event.preventDefault();
      if (this.callbacks.canAim()) this.callbacks.onStrike(this.currentKeyboardAim());
      return;
    } else if (event.code === 'KeyR') {
      this.callbacks.onRestart();
      return;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      this.callbacks.onPause();
      return;
    } else return;

    this.keyboardStrength = clamp(
      this.keyboardStrength,
      MIN_SHOT_STRENGTH,
      MAX_SHOT_STRENGTH,
    );
    const aim = this.currentKeyboardAim();
    this.keyboardAngleDegrees = aim.angleDegrees ?? this.keyboardAngleDegrees;
    this.callbacks.onAim(aim);
  };

  setMobileAim(angleDegrees: number, strength: number): AimState {
    const aim = createAimFromAngle(angleDegrees, strength);
    this.keyboardAngleDegrees = aim.angleDegrees ?? 0;
    this.keyboardStrength = aim.strength;
    this.callbacks.onAim(aim);
    return aim;
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerUp);
    this.canvas.removeEventListener('pointercancel', this.pointerCancel);
    window.removeEventListener('keydown', this.keyDown);
  }
}
`);
write('src/game/collision.ts', `import type { CollisionSensors, LevelDefinition, Obstacle, Vec2 } from './types';

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
  return Math.hypot(velocityX, velocityY) <= HOLE_CAPTURE_MAX_SPEED
    ? 'capturable'
    : 'too-fast';
}

export function isBallInHole(
  level: LevelDefinition,
  point: Vec2,
  velocityX: number,
  velocityY = 0,
): boolean {
  return getHoleCaptureStatus(level, point, velocityX, velocityY) === 'capturable';
}
`);
write('src/brainfuck/protocol.ts', `import type { EngineState, Vec2 } from '../game/types';

export const ENGINE_INPUT_BYTES = 32;
export const ENGINE_OUTPUT_BYTES = 15;

export interface EngineCommand {
  state: EngineState;
  aim?: {
    velocityX: number;
    xNegative: boolean;
    velocityY: number;
    yNegative: boolean;
    strength: number;
  };
  strike?: boolean;
  tick?: boolean;
  blockX?: boolean;
  blockY?: boolean;
  decayX?: boolean;
  decayY?: boolean;
  holeSensor?: boolean;
  advance?: boolean;
  reset?: Vec2;
  maxLevel: number;
  paused?: boolean;
}

const byte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
const flag = (value: boolean | undefined): number => (value ? 1 : 0);

export function encodeEngineCommand(command: EngineCommand): Uint8Array {
  const { state, aim, reset } = command;
  return Uint8Array.from([
    byte(state.level),
    byte(state.x),
    byte(state.y),
    byte(state.velocityX),
    flag(state.velocityXNegative),
    byte(state.velocityY),
    flag(state.velocityYNegative),
    byte(aim?.velocityX ?? 0),
    flag(aim?.xNegative),
    byte(aim?.velocityY ?? 0),
    flag(aim?.yNegative),
    byte(aim?.strength ?? state.strength),
    byte(state.strokes),
    flag(command.strike),
    flag(command.tick && !command.paused),
    flag(command.blockX),
    flag(command.blockY),
    flag(command.decayX),
    flag(command.decayY),
    flag(command.holeSensor),
    flag(command.advance),
    flag(reset !== undefined),
    byte(reset?.x ?? 0),
    byte(reset?.y ?? 0),
    byte(command.maxLevel),
    flag(command.paused),
    0,
    0,
    flag(state.inHole),
    flag(state.levelComplete),
    0,
    0,
  ]);
}

export function decodeEngineOutput(output: Uint8Array): EngineState {
  if (output.length !== ENGINE_OUTPUT_BYTES) {
    throw new Error(
      `Brainfuck engine returned ${output.length} bytes; expected ${ENGINE_OUTPUT_BYTES}.`,
    );
  }
  const value = (index: number): number => output[index] ?? 0;
  return {
    level: value(0),
    x: value(1),
    y: value(2),
    velocityX: value(3),
    velocityXNegative: value(4) !== 0,
    velocityY: value(5),
    velocityYNegative: value(6) !== 0,
    strength: value(7),
    strokes: value(8),
    collision: value(9) !== 0,
    movingValue: value(10),
    inHole: value(11) !== 0,
    levelComplete: value(12) !== 0,
    errorCode: value(13),
  };
}

export function createInitialState(level: number, start: Vec2): EngineState {
  return {
    level,
    x: start.x,
    y: start.y,
    velocityX: 0,
    velocityXNegative: false,
    velocityY: 0,
    velocityYNegative: false,
    strength: 6,
    strokes: 0,
    collision: false,
    movingValue: 0,
    inHole: false,
    levelComplete: false,
    errorCode: 0,
  };
}
`);

replaceExact('scripts/generate-brainfuck-engine.ts', 'aimXActive: 7,', 'aimVelocityX: 7,');
replaceExact('scripts/generate-brainfuck-engine.ts', 'aimYActive: 9,', 'aimVelocityY: 9,');
replaceExact(
  'scripts/generate-brainfuck-engine.ts',
  `  builder.ifConsume(CELL.aimXActive, () => {\n    builder.copyPreserve(CELL.strength, CELL.velocityX, CELL.t2);\n    builder.copyPreserve(CELL.aimXNegative, CELL.xNegative, CELL.t2);\n  });\n  builder.ifConsume(CELL.aimYActive, () => {\n    builder.copyPreserve(CELL.strength, CELL.velocityY, CELL.t2);\n    builder.copyPreserve(CELL.aimYNegative, CELL.yNegative, CELL.t2);\n  });`,
  `  builder.copyPreserve(CELL.aimVelocityX, CELL.velocityX, CELL.t2);\n  builder.copyPreserve(CELL.aimXNegative, CELL.xNegative, CELL.t2);\n  builder.copyPreserve(CELL.aimVelocityY, CELL.velocityY, CELL.t2);\n  builder.copyPreserve(CELL.aimYNegative, CELL.yNegative, CELL.t2);`,
);

replaceExact(
  'src/game/Game.ts',
  `import { calculateCollisionSensors, isBallInHole } from './collision';`,
  `import { createAimFromAngle, resolveAim } from './aim';\nimport {\n  calculateCollisionSensors,\n  getHoleCaptureStatus,\n  HOLE_CAPTURE_MAX_SPEED,\n  type HoleCaptureStatus,\n} from './collision';`,
);
replaceExact(
  'src/game/Game.ts',
  `export interface ShotTelemetry {\n  strength: number;\n  xActive: boolean;\n  yActive: boolean;\n  diagonal: boolean;\n}`,
  `export interface ShotTelemetry {\n  strength: number;\n  angleDegrees: number;\n  velocityX: number;\n  velocityY: number;\n  xActive: boolean;\n  yActive: boolean;\n  diagonal: boolean;\n}`,
);
replaceExact(
  'src/game/Game.ts',
  `  onBounce?(): void;\n  onRoundReset?(): void;`,
  `  onBounce?(): void;\n  onHoleTooFast?(speed: number, maximumSpeed: number): void;\n  onRoundReset?(): void;`,
);
replaceExact(
  'src/game/Game.ts',
  `const DEFAULT_AIM: AimState = { direction: { x: 1, y: 0 }, strength: 7 };`,
  `const DEFAULT_AIM: AimState = resolveAim(createAimFromAngle(0, 7)).aim;`,
);
replaceExact(
  'src/game/Game.ts',
  `  private completionHandled = false;`,
  `  private completionHandled = false;\n  private holeTooFastActive = false;`,
);
replaceBetween(
  'src/game/Game.ts',
  `  async advancePhysics(): Promise<void> {`,
  `  private handleCompletion(): void {`,
  `  async advancePhysics(): Promise<void> {
    if (
      this.engineBusy ||
      this.paused ||
      this.errorMessage ||
      this.state.velocityX + this.state.velocityY === 0
    ) {
      return;
    }
    this.engineBusy = true;
    try {
      const level = this.level;
      const beforeMove = getHoleCaptureStatus(
        level,
        { x: this.state.x, y: this.state.y },
        this.state.velocityX,
        this.state.velocityY,
      );
      this.updateHoleFeedback(beforeMove);

      if (beforeMove === 'capturable') {
        const capturedState = await this.executeEngine({
          state: this.state,
          holeSensor: true,
          maxLevel: this.levels.count,
        });
        if (!capturedState) return;
        this.state = capturedState;
        this.emitState();
        if (this.state.levelComplete && !this.completionHandled) this.handleCompletion();
        return;
      }

      const sensors = calculateCollisionSensors(
        level,
        { x: this.state.x, y: this.state.y },
        this.state.velocityX,
        this.state.velocityXNegative,
        this.state.velocityY,
        this.state.velocityYNegative,
      );
      this.physicsCounter += 1;
      const frictionPulse = this.physicsCounter % 3 === 0;
      const tickState = await this.executeEngine({
        state: this.state,
        tick: true,
        blockX: sensors.blockX,
        blockY: sensors.blockY,
        decayX: frictionPulse && this.state.velocityX > 0,
        decayY: frictionPulse && this.state.velocityY > 0,
        maxLevel: this.levels.count,
      });
      if (!tickState) return;

      this.state = tickState;
      const afterMove = getHoleCaptureStatus(
        level,
        { x: this.state.x, y: this.state.y },
        this.state.velocityX,
        this.state.velocityY,
      );
      this.updateHoleFeedback(afterMove);
      if (!this.state.levelComplete && afterMove === 'capturable') {
        const capturedState = await this.executeEngine({
          state: this.state,
          holeSensor: true,
          maxLevel: this.levels.count,
        });
        if (!capturedState) return;
        this.state = capturedState;
      }

      if (this.state.collision) {
        this.safeAudio('bounce', () => this.audio.bounce());
        this.emit('bounce event', () => this.events.onBounce?.());
        this.emitMessage('BOUNCE');
      }
      this.emitState();
      if (this.state.levelComplete && !this.completionHandled) this.handleCompletion();
    } finally {
      this.engineBusy = false;
    }
  }

`,
);
replaceBetween(
  'src/game/Game.ts',
  `  private quantizeAim(aim: AimState): {`,
  `  private canAim(): boolean {`,
  `  private updateHoleFeedback(status: HoleCaptureStatus): void {
    if (status === 'too-fast') {
      if (!this.holeTooFastActive) {
        const speed = Math.hypot(this.state.velocityX, this.state.velocityY);
        this.emit('hole speed event', () =>
          this.events.onHoleTooFast?.(speed, HOLE_CAPTURE_MAX_SPEED),
        );
      }
      this.holeTooFastActive = true;
      return;
    }
    this.holeTooFastActive = false;
  }

`,
);
replaceExact(
  'src/game/Game.ts',
  `  setAim(aim: AimState): void {\n    this.aim = aim;\n    this.emitState();\n  }`,
  `  setAim(aim: AimState): void {\n    this.aim = resolveAim(aim).aim;\n    this.emitState();\n  }`,
);
replaceExact(
  'src/game/Game.ts',
  `      this.aim = aim;\n      const quantized = this.quantizeAim(aim);`,
  `      const resolved = resolveAim(aim);\n      this.aim = resolved.aim;`,
);
replaceExact(
  'src/game/Game.ts',
  `        aim: quantized,`,
  `        aim: {\n          velocityX: resolved.velocityX,\n          xNegative: resolved.xNegative,\n          velocityY: resolved.velocityY,\n          yNegative: resolved.yNegative,\n          strength: resolved.aim.strength,\n        },`,
);
replaceExact(
  'src/game/Game.ts',
  `        this.safeAudio('hit', () => this.audio.hit(quantized.strength));`,
  `        this.holeTooFastActive = false;\n        this.safeAudio('hit', () => this.audio.hit(resolved.aim.strength));`,
);
replaceExact(
  'src/game/Game.ts',
  `            strength: quantized.strength,\n            xActive: quantized.xActive,\n            yActive: quantized.yActive,\n            diagonal: quantized.xActive && quantized.yActive,`,
  `            strength: resolved.aim.strength,\n            angleDegrees: resolved.aim.angleDegrees ?? 0,\n            velocityX: resolved.velocityX,\n            velocityY: resolved.velocityY,\n            xActive: resolved.velocityX > 0,\n            yActive: resolved.velocityY > 0,\n            diagonal: resolved.velocityX > 0 && resolved.velocityY > 0,`,
);
for (const marker of [
  `        this.physicsCounter = 0;\n        this.emit('level start'`,
  `        this.physicsCounter = 0;\n        this.emit('level start'`,
  `        this.physicsCounter = 0;\n        this.emit('level start'`,
]) {
  const current = read('src/game/Game.ts');
  const index = current.indexOf(marker);
  if (index < 0) throw new Error('Reset marker not found in Game.ts');
  write(
    'src/game/Game.ts',
    `${current.slice(0, index)}        this.physicsCounter = 0;\n        this.holeTooFastActive = false;\n        this.emit('level start'${current.slice(index + marker.length)}`,
  );
}

replaceExact('src/main.ts', '<p class="eyebrow">BRAINFUCK POWERED · v1.0.0</p>', '<p class="eyebrow">BRAINFUCK POWERED · v1.0.1</p>');
replaceExact('src/main.ts', '<div class="commentator" id="commentator">Loading the tremendous commentary engine…</div>', '<div class="commentator" id="commentator">Loading the tremendous commentary engine…</div>\n        <div class="hole-speed-indicator" id="hole-speed-indicator" role="status" hidden></div>');
replaceExact('src/main.ts', '<input id="angle-control" type="range" min="0" max="315" step="45" value="0" />', '<input id="angle-control" type="range" min="0" max="355" step="5" value="0" />');
replaceExact('src/main.ts', '<p class="snap-note">Retro physics snaps shots to eight directions.</p>', '<p class="snap-note">Aim changes in 5° steps. The guide line shows the exact vector sent to the engine.</p>');
replaceExact('src/main.ts', `const commentator = element<HTMLElement>('#commentator');`, `const commentator = element<HTMLElement>('#commentator');\nconst holeSpeedIndicator = element<HTMLElement>('#hole-speed-indicator');`);
replaceExact('src/main.ts', `let pendingFinalMessage: string | null = null;`, `let pendingFinalMessage: string | null = null;\nlet holeSpeedIndicatorTimer: number | null = null;`);
replaceExact('src/main.ts', `    hudPower.textContent = String(game.currentAim.strength);`, `    const currentAim = game.currentAim;\n    const angle = currentAim.angleDegrees ?? 0;\n    hudPower.textContent = String(currentAim.strength);\n    angleControl.value = String(angle);\n    angleOutput.value = \`${'${angle}'}°\`;\n    powerControl.value = String(currentAim.strength);\n    powerOutput.value = String(currentAim.strength);`);
replaceExact('src/main.ts', `  onBounce() {\n    trumpRuntime?.recordBounce();\n  },`, `  onBounce() {\n    trumpRuntime?.recordBounce();\n  },\n  onHoleTooFast(speed, maximumSpeed) {\n    holeSpeedIndicator.hidden = false;\n    holeSpeedIndicator.textContent = \`TOO FAST FOR THE HOLE · SPEED ${'${speed.toFixed(1)}'} · MAX ${'${maximumSpeed}'}\`;\n    if (holeSpeedIndicatorTimer !== null) window.clearTimeout(holeSpeedIndicatorTimer);\n    holeSpeedIndicatorTimer = window.setTimeout(() => {\n      holeSpeedIndicator.hidden = true;\n      holeSpeedIndicatorTimer = null;\n    }, 1800);\n  },`);
replaceExact('src/main.ts', `window.addEventListener('beforeunload', () => game.dispose());`, `window.addEventListener('beforeunload', () => {\n  if (holeSpeedIndicatorTimer !== null) window.clearTimeout(holeSpeedIndicatorTimer);\n  game.dispose();\n});`);

replaceExact('index.html', `    <link\n      rel="icon"\n      href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><text y=%22.9em%22 font-size=%2290%22>⛳</text></svg>"\n    />`, `    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />`);
write('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n  <rect width="64" height="64" rx="14" fill="#09111f"/>\n  <circle cx="20" cy="46" r="8" fill="#f8fafc"/>\n  <path d="M34 9v38" stroke="#ecfdf5" stroke-width="4" stroke-linecap="round"/>\n  <path d="M36 11l19 8-19 8z" fill="#ff4d6d"/>\n  <ellipse cx="37" cy="50" rx="17" ry="6" fill="#183f32" stroke="#56d89b" stroke-width="3"/>\n</svg>\n`);
write('src/ui/release.css', `${read('src/ui/release.css')}\n.hole-speed-indicator {\n  margin-top: 0.6rem;\n  border: 1px solid #ff879d;\n  border-radius: 0.45rem;\n  padding: 0.55rem 0.75rem;\n  color: #fff1f4;\n  background: rgba(190, 24, 93, 0.2);\n  font: 700 0.78rem/1.35 ui-monospace, monospace;\n  letter-spacing: 0.04em;\n  text-align: center;\n}\n`);

replaceExact('src/brainfuck/memory-map.md', '|  7–10 | aim flags            | X/Y active and sign bits for the next strike                  |', '|  7–10 | aim components       | X/Y speed magnitudes and sign bits for the next strike        |');
replaceExact('src/brainfuck/memory-map.md', 'applies strike strength to active axes', 'copies the resolved five-degree X/Y strike components');
replaceExact('src/brainfuck/memory-map.md', 'TypeScript converts browser input to compact direction flags', 'TypeScript snaps browser input to five-degree angles and compact integer components');

write('tests/aim.test.ts', `import { describe, expect, it } from 'vitest';\nimport { createAimFromAngle, resolveAim, snapAngleDegrees } from '../src/game/aim';\n\ndescribe('aim resolution', () => {\n  it('snaps all controls to five-degree increments', () => {\n    expect(snapAngleDegrees(2)).toBe(0);\n    expect(snapAngleDegrees(3)).toBe(5);\n    expect(snapAngleDegrees(358)).toBe(0);\n  });\n\n  it('uses the same normalized vector for the guide and engine components', () => {\n    const resolved = resolveAim(createAimFromAngle(35, 12));\n    const length = Math.hypot(resolved.velocityX, resolved.velocityY);\n    expect(resolved.aim.angleDegrees).toBe(35);\n    expect(resolved.aim.direction.x).toBeCloseTo(resolved.velocityX / length);\n    expect(resolved.aim.direction.y).toBeCloseTo(resolved.velocityY / length);\n  });\n\n  it('preserves signs in every quadrant', () => {\n    const resolved = resolveAim(createAimFromAngle(215, 10));\n    expect(resolved.xNegative).toBe(true);\n    expect(resolved.yNegative).toBe(true);\n    expect(resolved.velocityX).toBeGreaterThan(0);\n    expect(resolved.velocityY).toBeGreaterThan(0);\n  });\n});\n`);
write('tests/collision.test.ts', `import { describe, expect, it } from 'vitest';\nimport { calculateCollisionSensors, collidesWithAnyObstacle, getHoleCaptureStatus, isBallInHole } from '../src/game/collision';\nimport type { LevelDefinition } from '../src/game/types';\n\nconst level: LevelDefinition = { id: 1, name: 'Test', width: 120, height: 80, start: { x: 10, y: 40 }, hole: { x: 105, y: 40 }, holeRadius: 7, ballRadius: 4, par: 2, obstacles: [{ type: 'rect', x: 50, y: 20, width: 20, height: 40 }] };\n\ndescribe('collision adapter', () => {\n  it('detects rectangle intersections', () => { expect(collidesWithAnyObstacle(level, { x: 47, y: 40 })).toBe(true); expect(collidesWithAnyObstacle(level, { x: 20, y: 40 })).toBe(false); });\n  it('reflects only the blocked axis on the outer course wall', () => { const sensors = calculateCollisionSensors(level, { x: 112, y: 40 }, 8, false, 3, false); expect(sensors.blockX).toBe(true); expect(sensors.blockY).toBe(false); expect(sensors.collisionKind).toBe('wall'); });\n  it('reverses every active component on a pink obstacle', () => { const sensors = calculateCollisionSensors(level, { x: 42, y: 40 }, 8, false, 3, false); expect(sensors.blockX).toBe(true); expect(sensors.blockY).toBe(true); expect(sensors.collisionKind).toBe('obstacle'); });\n  it('blocks both axes when a diagonal step would clip an obstacle corner', () => { const cornerLevel = { ...level, obstacles: [{ type: 'rect', x: 50, y: 50, width: 20, height: 20 }] } satisfies LevelDefinition; const sensors = calculateCollisionSensors(cornerLevel, { x: 44, y: 44 }, 4, false, 4, false); expect(sensors.blockX).toBe(true); expect(sensors.blockY).toBe(true); expect(sensors.collisionKind).toBe('obstacle'); });\n  it('distinguishes a capturable ball from a fast pass over the hole', () => { expect(getHoleCaptureStatus(level, { x: 105, y: 40 }, 2, 0)).toBe('capturable'); expect(getHoleCaptureStatus(level, { x: 105, y: 40 }, 3, 0)).toBe('too-fast'); expect(getHoleCaptureStatus(level, { x: 90, y: 40 }, 0, 0)).toBe('outside'); expect(isBallInHole(level, { x: 105, y: 40 }, 2, 0)).toBe(true); });\n});\n`);
write('tests/input-manager.test.ts', `${read('tests/input-manager.test.ts').replace("expect(shot?.direction.x).toBeCloseTo(Math.SQRT1_2);\n    expect(shot?.direction.y).toBeCloseTo(Math.SQRT1_2);", "expect(shot?.angleDegrees).toBe(5);\n    expect(shot?.direction.x).toBeCloseTo(Math.cos((5 * Math.PI) / 180));\n    expect(shot?.direction.y).toBeCloseTo(Math.sin((5 * Math.PI) / 180));").replace("expect(onStrike).toHaveBeenCalledWith({ direction: { x: 1, y: 0 }, strength: 14 });", "expect(onStrike).toHaveBeenCalledWith({\n      angleDegrees: 0,\n      direction: { x: 1, y: 0 },\n      strength: 14,\n    });")}`);
write('tests/brainfuck-engine.test.ts', `${read('tests/brainfuck-engine.test.ts').replace("aim: { xActive: true, xNegative: false, yActive: true, yNegative: true, strength: 9 },", "aim: { velocityX: 8, xNegative: false, velocityY: 5, yNegative: true, strength: 9 },").replace("velocityX: 9,", "velocityX: 8,").replace("velocityY: 9,", "velocityY: 5,").replace("movingValue: 18,", "movingValue: 13,").replace("aim: { xActive: true, xNegative: false, yActive: false, yNegative: false, strength: 5 },", "aim: { velocityX: 5, xNegative: false, velocityY: 0, yNegative: false, strength: 5 },")}`);
write('tests/worker.test.ts', `${read('tests/worker.test.ts').replace('xActive: true,', 'velocityX: 8,').replace('yActive: false,', 'velocityY: 0,')}`);
replaceExact('tests/game.test.ts', `    onBounce: vi.fn(),\n    onRoundReset: vi.fn(),`, `    onBounce: vi.fn(),\n    onHoleTooFast: vi.fn(),\n    onRoundReset: vi.fn(),`);
replaceExact('tests/game.test.ts', `  it('emits typed diagonal shot telemetry', async () => {\n    const { game, spies } = createGame();\n\n    await game.strike({ direction: { x: 1, y: 1 }, strength: 9 });\n\n    expect(spies.onShot).toHaveBeenCalledWith({\n      strength: 9,\n      xActive: true,\n      yActive: true,\n      diagonal: true,\n    });\n  });`, `  it('emits resolved five-degree shot telemetry', async () => {\n    const { game, engine, spies } = createGame();\n    await game.strike({ direction: { x: 1, y: 1 }, strength: 9, angleDegrees: 35 });\n    expect(spies.onShot).toHaveBeenCalledWith(expect.objectContaining({ strength: 9, angleDegrees: 35, xActive: true, yActive: true, diagonal: true }));\n    expect(engine.calls.at(-1)?.aim?.velocityX).toBeGreaterThan(0);\n    expect(engine.calls.at(-1)?.aim?.velocityY).toBeGreaterThan(0);\n  });\n\n  it('reports a fast pass through the hole once per encounter', async () => {\n    const onHoleTooFast = vi.fn();\n    const { game } = createGame({ onHoleTooFast });\n    const state = game.currentState;\n    state.x = game.level.hole.x; state.y = game.level.hole.y; state.velocityX = 4; state.velocityY = 0; state.movingValue = 4;\n    await game.advancePhysics();\n    expect(onHoleTooFast).toHaveBeenCalledTimes(1);\n    expect(onHoleTooFast).toHaveBeenCalledWith(4, 2);\n    expect(game.currentState.levelComplete).toBe(false);\n  });`);
write('tests/e2e/aim-feedback.spec.ts', `import { expect, test } from '@playwright/test';\n\ntest('uses five-degree angle controls and shows hole-speed feedback markup', async ({ page }) => {\n  await page.goto('/');\n  const angle = page.locator('#angle-control');\n  await expect(angle).toHaveAttribute('step', '5');\n  await expect(angle).toHaveAttribute('max', '355');\n  await angle.fill('35');\n  await expect(page.locator('#angle-output')).toHaveText('35°');\n  await expect(page.locator('#hole-speed-indicator')).toBeHidden();\n});\n\ntest('serves the packaged favicon', async ({ page, request }) => {\n  await page.goto('/');\n  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', './favicon.svg');\n  const response = await request.get('/favicon.svg');\n  expect(response.ok()).toBe(true);\n  expect(await response.text()).toContain('<svg');\n});\n`);

replaceExact('README.md', '**Version 1.0.0**', '**Version 1.0.1**');
replaceExact('README.md', '- Eight-direction retro aiming with adjustable power', '- Mouse, touch, slider, and keyboard aiming in five-degree increments');
replaceExact('README.md', '- Physics deliberately uses eight directions and integer magnitudes.', '- Five-degree input angles resolve to the closest safe integer X/Y vector at the selected power.');
replaceExact('README.md', '- **Left/Right or A/D:** rotate aim by 45 degrees', '- **Left/Right or A/D:** rotate aim by 5 degrees');
const changelog = read('CHANGELOG.md');
write('CHANGELOG.md', changelog.replace('## [1.0.0] - 2026-07-11', `## [1.0.1] - 2026-07-12\n\n### Fixed\n\n- Added a packaged SVG favicon that works on the deployed site.\n- Unified mouse, touch, keyboard, slider, guide-line, and engine aim resolution.\n- Added five-degree angle controls with integer engine component resolution.\n- Made pink obstacle collisions reverse the complete incoming vector while outer walls retain normal axis reflection.\n- Added visible feedback when the ball crosses the hole above capture speed.\n\n### Operations\n\n- Added an automated same-repository PR review workflow.\n- Kept full CI, Docker smoke tests, cross-browser E2E, R analysis, deployment, and versioned release automation.\n\n## [1.0.0] - 2026-07-11`));
const packageJson = JSON.parse(read('package.json')); packageJson.version = '1.0.1'; write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
const packageLock = JSON.parse(read('package-lock.json')); packageLock.version = '1.0.1'; packageLock.packages[''].version = '1.0.1'; write('package-lock.json', `${JSON.stringify(packageLock, null, 2)}\n`);

write('.github/workflows/pr-review.yml', `name: Automated PR Review\n\non:\n  pull_request:\n    types: [opened, synchronize, reopened, ready_for_review]\n\npermissions:\n  contents: read\n  pull-requests: write\n\njobs:\n  review:\n    if: github.event.pull_request.draft == false\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n      - run: npm ci\n      - run: npm run audit\n      - run: npm run format:check\n      - run: npm run lint\n      - run: npm run check:engine\n      - run: npm run validate:levels\n      - run: npm run test:coverage\n      - run: npm run build\n      - name: Record automated review\n        if: github.event.pull_request.head.repo.full_name == github.repository\n        uses: actions/github-script@v7\n        with:\n          script: |\n            await github.rest.pulls.createReview({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              pull_number: context.issue.number,\n              event: 'COMMENT',\n              body: [\n                '## Automated production review',\n                '',\n                '✅ Dependency audit',\n                '✅ Formatting and typed lint',\n                '✅ Brainfuck engine consistency',\n                '✅ Level validation',\n                '✅ Unit/integration coverage gates',\n                '✅ Production build',\n                '',\n                'The full CI workflow separately validates Docker, cross-browser E2E, secret history, and R analysis. Merge only after every required check is green.'\n              ].join('\\n')\n            });\n`);
