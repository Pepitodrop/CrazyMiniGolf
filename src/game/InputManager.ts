import { AIM_STEP_DEGREES, aimFromDegrees, angleFromDirection, snapAim } from './aim';
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
  private keyboardAngle = 0;
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
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return aimFromDegrees(angle, Math.round(length / 7));
  }

  private currentKeyboardAim(): AimState {
    return aimFromDegrees(this.keyboardAngle, this.keyboardStrength);
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (!this.callbacks.canAim()) return;
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    const aim = this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY));
    this.keyboardAngle = angleFromDirection(aim.direction);
    this.keyboardStrength = aim.strength;
    this.callbacks.onAim(aim);
  };

  private readonly pointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.callbacks.canAim()) return;
    const aim = this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY));
    this.keyboardAngle = angleFromDirection(aim.direction);
    this.keyboardStrength = aim.strength;
    this.callbacks.onAim(aim);
  };

  private readonly pointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.callbacks.canAim()) return;
    const aim = this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY));
    this.pointerId = null;
    this.keyboardAngle = angleFromDirection(aim.direction);
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
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.keyboardAngle -= AIM_STEP_DEGREES;
    else if (event.code === 'ArrowRight' || event.code === 'KeyD')
      this.keyboardAngle += AIM_STEP_DEGREES;
    else if (event.code === 'ArrowUp' || event.code === 'KeyW') this.keyboardStrength += 1;
    else if (event.code === 'ArrowDown' || event.code === 'KeyS') this.keyboardStrength -= 1;
    else if (event.code === 'Space') {
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

    const aim = snapAim({
      direction: {
        x: Math.cos((this.keyboardAngle * Math.PI) / 180),
        y: Math.sin((this.keyboardAngle * Math.PI) / 180),
      },
      strength: this.keyboardStrength,
    });
    this.keyboardAngle = angleFromDirection(aim.direction);
    this.keyboardStrength = aim.strength;
    this.callbacks.onAim(aim);
  };

  setMobileAim(angleDegrees: number, strength: number): AimState {
    const aim = aimFromDegrees(angleDegrees, strength);
    this.keyboardAngle = angleFromDirection(aim.direction);
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
