import {
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

    this.keyboardStrength = clamp(this.keyboardStrength, MIN_SHOT_STRENGTH, MAX_SHOT_STRENGTH);
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
