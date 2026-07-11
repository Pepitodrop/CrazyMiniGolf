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
    return {
      direction: { x: dx / length, y: dy / length },
      strength: clamp(Math.round(length / 7), 2, 14),
    };
  }

  private currentKeyboardAim(): AimState {
    return {
      direction: { x: Math.cos(this.keyboardAngle), y: Math.sin(this.keyboardAngle) },
      strength: this.keyboardStrength,
    };
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (!this.callbacks.canAim()) return;
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    const aim = this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY));
    this.callbacks.onAim(aim);
  };

  private readonly pointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.callbacks.canAim()) return;
    this.callbacks.onAim(this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY)));
  };

  private readonly pointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.callbacks.canAim()) return;
    const aim = this.aimFromPoint(this.callbacks.toWorld(event.clientX, event.clientY));
    this.pointerId = null;
    this.callbacks.onAim(aim);
    this.callbacks.onStrike(aim);
  };

  private readonly pointerCancel = (): void => {
    this.pointerId = null;
  };

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (isInteractiveTarget(event.target)) return;
    if (event.repeat && event.code === 'Space') return;
    const angleStep = Math.PI / 4;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.keyboardAngle -= angleStep;
    else if (event.code === 'ArrowRight' || event.code === 'KeyD') this.keyboardAngle += angleStep;
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

    this.keyboardStrength = clamp(this.keyboardStrength, 2, 14);
    this.callbacks.onAim(this.currentKeyboardAim());
  };

  setMobileAim(angleDegrees: number, strength: number): AimState {
    this.keyboardAngle = (angleDegrees * Math.PI) / 180;
    this.keyboardStrength = clamp(Math.round(strength), 2, 14);
    const aim = this.currentKeyboardAim();
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
