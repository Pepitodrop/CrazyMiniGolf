import { BrainfuckEngineClient } from '../brainfuck/EngineClient';
import type { EngineCommand } from '../brainfuck/protocol';
import { createInitialState } from '../brainfuck/protocol';
import { AudioManager } from './AudioManager';
import { createAimFromAngle, resolveAim } from './aim';
import {
  calculateCollisionSensors,
  getHoleCaptureStatus,
  HOLE_CAPTURE_MAX_SPEED,
  type HoleCaptureStatus,
} from './collision';
import { InputManager, type InputCallbacks } from './InputManager';
import type { LevelManager } from './LevelManager';
import { Renderer } from './Renderer';
import type { AimState, EngineState, LevelDefinition, Vec2 } from './types';

export interface ShotTelemetry {
  strength: number;
  angleDegrees: number;
  velocityX: number;
  velocityY: number;
  xActive: boolean;
  yActive: boolean;
  diagonal: boolean;
}

export interface GameEvents {
  onState(state: EngineState, level: LevelDefinition, paused: boolean): void;
  onMessage(message: string): void;
  onError(message: string): void;
  onWarning?(message: string): void;
  onLevelStart?(level: LevelDefinition): void;
  onShot?(shot: ShotTelemetry): void;
  onBounce?(): void;
  onHoleTooFast?(speed: number, maximumSpeed: number): void;
  onRoundReset?(): void;
  onLevelComplete(level: LevelDefinition, strokes: number): void;
  onFinalComplete(strokes: number): void;
}

export interface GameEnginePort {
  run(command: EngineCommand): Promise<EngineState>;
  dispose(): void;
}

export interface RendererPort {
  toWorld(level: LevelDefinition, clientX: number, clientY: number): Vec2;
  render(
    level: LevelDefinition,
    state: EngineState,
    aim: AimState,
    paused: boolean,
    errorMessage: string | null,
  ): void;
}

export interface InputPort {
  setMobileAim(angleDegrees: number, strength: number): AimState;
  dispose(): void;
}

export interface AudioPort {
  setEnabled(enabled: boolean): void;
  hit(strength: number): void;
  bounce(): void;
  hole(): void;
  dispose?(): void;
}

export interface GameDependencies {
  engine?: GameEnginePort;
  renderer?: RendererPort;
  inputFactory?: (canvas: HTMLCanvasElement, callbacks: InputCallbacks) => InputPort;
  audio?: AudioPort;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
}

const DEFAULT_AIM: AimState = resolveAim(createAimFromAngle(0, 7)).aim;

export class Game {
  private readonly engine: GameEnginePort;
  private readonly renderer: RendererPort;
  private readonly input: InputPort;
  private readonly audio: AudioPort;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly roundScores = new Map<number, number>();
  private state: EngineState;
  private aim: AimState = DEFAULT_AIM;
  private paused = false;
  private errorMessage: string | null = null;
  private animationFrame = 0;
  private lastPhysicsTick = 0;
  private physicsCounter = 0;
  private engineBusy = false;
  private completionHandled = false;
  private holeTooFastActive = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly levels: LevelManager,
    initialLevelId: number,
    private readonly events: GameEvents,
    dependencies: GameDependencies = {},
  ) {
    const level = levels.getById(initialLevelId);
    this.state = createInitialState(level.id, level.start);
    this.engine = dependencies.engine ?? new BrainfuckEngineClient();
    this.renderer = dependencies.renderer ?? new Renderer(canvas);
    this.audio = dependencies.audio ?? new AudioManager();
    this.requestFrame = dependencies.requestFrame ?? requestAnimationFrame.bind(globalThis);
    this.cancelFrame = dependencies.cancelFrame ?? cancelAnimationFrame.bind(globalThis);
    const inputFactory =
      dependencies.inputFactory ??
      ((target: HTMLCanvasElement, callbacks: InputCallbacks) =>
        new InputManager(target, callbacks));
    this.input = inputFactory(canvas, {
      canAim: () => this.canAim(),
      getBallPosition: () => ({ x: this.state.x, y: this.state.y }),
      toWorld: (clientX, clientY) => this.renderer.toWorld(this.level, clientX, clientY),
      onAim: (aim) => this.setAim(aim),
      onStrike: (aim) => void this.strike(aim),
      onRestart: () => void this.restart(),
      onPause: () => this.togglePause(),
    });
  }

  get level(): LevelDefinition {
    return this.levels.getById(this.state.level);
  }

  get currentState(): EngineState {
    return this.state;
  }

  get currentAim(): AimState {
    return this.aim;
  }

  start(): void {
    this.emit('level start', () => this.events.onLevelStart?.(this.level));
    this.emitState();
    this.animationFrame = this.requestFrame(this.frame);
  }

  private readonly frame = (timestamp: number): void => {
    if (
      !this.paused &&
      !this.errorMessage &&
      !this.engineBusy &&
      this.state.velocityX + this.state.velocityY > 0 &&
      timestamp - this.lastPhysicsTick >= 70
    ) {
      this.lastPhysicsTick = timestamp;
      void this.advancePhysics();
    }
    this.renderer.render(this.level, this.state, this.aim, this.paused, this.errorMessage);
    this.animationFrame = this.requestFrame(this.frame);
  };

  async advancePhysics(): Promise<void> {
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

  private handleCompletion(): void {
    this.completionHandled = true;
    this.roundScores.set(this.state.level, this.state.strokes);
    this.safeAudio('hole', () => this.audio.hole());
    this.emit('level completion', () =>
      this.events.onLevelComplete(this.level, this.state.strokes),
    );
    this.emitMessage(this.state.strokes === 1 ? 'ACE' : 'HOLE');

    if (this.state.level === this.levels.count) {
      if (this.roundScores.size === this.levels.count) {
        const total = [...this.roundScores.values()].reduce((sum, strokes) => sum + strokes, 0);
        this.emit('round completion', () => this.events.onFinalComplete(total));
        this.emitMessage('FINAL');
        this.roundScores.clear();
      } else {
        this.warn('Finish all nine levels in one continuous round to record a round total.');
      }
    }
  }

  private updateHoleFeedback(status: HoleCaptureStatus): void {
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

  private canAim(): boolean {
    return (
      !this.paused &&
      !this.engineBusy &&
      !this.state.levelComplete &&
      this.state.velocityX + this.state.velocityY === 0
    );
  }

  setAim(aim: AimState): void {
    this.aim = resolveAim(aim).aim;
    this.emitState();
  }

  setMobileAim(angleDegrees: number, strength: number): void {
    this.aim = this.input.setMobileAim(angleDegrees, strength);
  }

  async strikeCurrentAim(): Promise<void> {
    await this.strike(this.aim);
  }

  async strike(aim: AimState): Promise<void> {
    if (!this.canAim()) return;
    this.engineBusy = true;
    try {
      const resolved = resolveAim(aim);
      this.aim = resolved.aim;
      const nextState = await this.executeEngine({
        state: this.state,
        aim: {
          velocityX: resolved.velocityX,
          xNegative: resolved.xNegative,
          velocityY: resolved.velocityY,
          yNegative: resolved.yNegative,
          strength: resolved.aim.strength,
        },
        strike: true,
        maxLevel: this.levels.count,
      });
      if (nextState) {
        this.state = nextState;
        this.holeTooFastActive = false;
        this.safeAudio('hit', () => this.audio.hit(resolved.aim.strength));
        this.emit('shot telemetry', () =>
          this.events.onShot?.({
            strength: resolved.aim.strength,
            angleDegrees: resolved.aim.angleDegrees ?? 0,
            velocityX: resolved.velocityX,
            velocityY: resolved.velocityY,
            xActive: resolved.velocityX > 0,
            yActive: resolved.velocityY > 0,
            diagonal: resolved.velocityX > 0 && resolved.velocityY > 0,
          }),
        );
        this.emitMessage('HIT');
        this.emitState();
      }
    } finally {
      this.engineBusy = false;
    }
  }

  async restart(): Promise<void> {
    if (this.engineBusy) return;
    this.engineBusy = true;
    try {
      const nextState = await this.executeEngine({
        state: this.state,
        reset: this.level.start,
        maxLevel: this.levels.count,
      });
      if (nextState) {
        this.state = nextState;
        this.completionHandled = false;
        this.paused = false;
        this.physicsCounter = 0;
        this.holeTooFastActive = false;
        this.emit('level start', () => this.events.onLevelStart?.(this.level));
        this.emitMessage('START');
        this.emitState();
      }
    } finally {
      this.engineBusy = false;
    }
  }

  async selectLevel(levelId: number): Promise<void> {
    if (this.engineBusy) return;
    const nextLevel = this.levels.getById(levelId);
    this.engineBusy = true;
    try {
      const nextState = await this.executeEngine({
        state: { ...this.state, level: nextLevel.id },
        reset: nextLevel.start,
        maxLevel: this.levels.count,
      });
      if (nextState) {
        this.state = nextState;
        this.roundScores.clear();
        this.emit('round reset', () => this.events.onRoundReset?.());
        this.completionHandled = false;
        this.paused = false;
        this.physicsCounter = 0;
        this.holeTooFastActive = false;
        this.emit('level start', () => this.events.onLevelStart?.(this.level));
        this.emitMessage('START');
        this.emitState();
      }
    } finally {
      this.engineBusy = false;
    }
  }

  async nextLevel(): Promise<void> {
    if (!this.state.levelComplete || this.state.level >= this.levels.count || this.engineBusy)
      return;
    const next = this.levels.getById(this.state.level + 1);
    this.engineBusy = true;
    try {
      const nextState = await this.executeEngine({
        state: this.state,
        advance: true,
        reset: next.start,
        maxLevel: this.levels.count,
      });
      if (nextState) {
        this.state = nextState;
        this.completionHandled = false;
        this.physicsCounter = 0;
        this.holeTooFastActive = false;
        this.emit('level start', () => this.events.onLevelStart?.(this.level));
        this.emitMessage('START');
        this.emitState();
      }
    } finally {
      this.engineBusy = false;
    }
  }

  togglePause(): void {
    if (this.errorMessage) return;
    this.paused = !this.paused;
    this.emitState();
  }

  setAudioEnabled(enabled: boolean): void {
    this.safeAudio('audio setting', () => this.audio.setEnabled(enabled));
  }

  private async executeEngine(command: EngineCommand): Promise<EngineState | null> {
    try {
      return await this.engine.run(command);
    } catch (error) {
      this.failEngine(error);
      return null;
    }
  }

  private emitState(): void {
    this.emit('state update', () => this.events.onState(this.state, this.level, this.paused));
  }

  private emitMessage(message: string): void {
    this.emit('message handler', () => this.events.onMessage(message));
  }

  private emit(label: string, callback: () => void): void {
    try {
      callback();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      this.warn(`${label} failed: ${detail}`);
    }
  }

  private safeAudio(label: string, callback: () => void): void {
    try {
      callback();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      this.warn(`${label} audio is unavailable: ${detail}`);
    }
  }

  private warn(message: string): void {
    try {
      this.events.onWarning?.(message);
    } catch {
      console.warn(message);
    }
  }

  private failEngine(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown game engine error.';
    this.errorMessage = `ENGINE ERROR: ${message}`;
    try {
      this.events.onError(this.errorMessage);
    } catch {
      console.error(this.errorMessage);
    }
  }

  dispose(): void {
    this.cancelFrame(this.animationFrame);
    this.input.dispose();
    this.engine.dispose();
    this.audio.dispose?.();
  }
}
