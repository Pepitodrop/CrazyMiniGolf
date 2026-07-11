import { BrainfuckEngineClient } from '../brainfuck/EngineClient';
import { createInitialState } from '../brainfuck/protocol';
import { AudioManager } from './AudioManager';
import { calculateCollisionSensors, isBallInHole } from './collision';
import { InputManager } from './InputManager';
import type { LevelManager } from './LevelManager';
import { Renderer } from './Renderer';
import type { AimState, EngineState, LevelDefinition } from './types';

export interface GameEvents {
  onState(state: EngineState, level: LevelDefinition, paused: boolean): void;
  onMessage(message: string): void;
  onError(message: string): void;
  onLevelComplete(level: LevelDefinition, strokes: number): void;
  onFinalComplete(strokes: number): void;
}

const DEFAULT_AIM: AimState = { direction: { x: 1, y: 0 }, strength: 7 };

export class Game {
  private readonly engine = new BrainfuckEngineClient();
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly audio = new AudioManager();
  private state: EngineState;
  private aim: AimState = DEFAULT_AIM;
  private paused = false;
  private errorMessage: string | null = null;
  private animationFrame = 0;
  private lastPhysicsTick = 0;
  private physicsCounter = 0;
  private engineBusy = false;
  private completionHandled = false;
  private finalTotal = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly levels: LevelManager,
    initialLevelId: number,
    private readonly events: GameEvents,
  ) {
    const level = levels.getById(initialLevelId);
    this.state = createInitialState(level.id, level.start);
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas, {
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
    this.events.onState(this.state, this.level, this.paused);
    this.animationFrame = requestAnimationFrame(this.frame);
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
      void this.physicsTick();
    }
    this.renderer.render(this.level, this.state, this.aim, this.paused, this.errorMessage);
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private async physicsTick(): Promise<void> {
    this.engineBusy = true;
    try {
      const level = this.level;
      const sensors = calculateCollisionSensors(
        level,
        { x: this.state.x, y: this.state.y },
        this.state.velocityX,
        this.state.velocityXNegative,
        this.state.velocityY,
        this.state.velocityYNegative,
      );
      const holeSensor = isBallInHole(
        level,
        { x: this.state.x, y: this.state.y },
        this.state.movingValue,
      );
      this.physicsCounter += 1;
      const frictionPulse = this.physicsCounter % 3 === 0;
      const next = await this.engine.run({
        state: this.state,
        tick: true,
        blockX: sensors.blockX,
        blockY: sensors.blockY,
        decayX: frictionPulse && this.state.velocityX > 0,
        decayY: frictionPulse && this.state.velocityY > 0,
        holeSensor,
        maxLevel: this.levels.count,
      });
      this.state = next;
      if (next.collision) {
        this.audio.bounce();
        this.events.onMessage('BOUNCE');
      }
      this.events.onState(this.state, this.level, this.paused);
      if (next.levelComplete && !this.completionHandled) this.handleCompletion();
    } catch (error) {
      this.fail(error);
    } finally {
      this.engineBusy = false;
    }
  }

  private handleCompletion(): void {
    this.completionHandled = true;
    this.finalTotal += this.state.strokes;
    this.audio.hole();
    this.events.onLevelComplete(this.level, this.state.strokes);
    this.events.onMessage(this.state.strokes === 1 ? 'ACE' : 'HOLE');
    if (this.state.level === this.levels.count) {
      this.events.onFinalComplete(this.finalTotal);
      this.events.onMessage('FINAL');
    }
  }

  private quantizeAim(aim: AimState): {
    xActive: boolean;
    xNegative: boolean;
    yActive: boolean;
    yNegative: boolean;
    strength: number;
  } {
    const absX = Math.abs(aim.direction.x);
    const absY = Math.abs(aim.direction.y);
    let xActive = absX >= 0.38;
    let yActive = absY >= 0.38;
    if (!xActive && !yActive) {
      xActive = absX >= absY;
      yActive = !xActive;
    }
    return {
      xActive,
      xNegative: aim.direction.x < 0,
      yActive,
      yNegative: aim.direction.y < 0,
      strength: Math.max(2, Math.min(14, Math.round(aim.strength))),
    };
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
    this.aim = aim;
    this.events.onState(this.state, this.level, this.paused);
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
      this.aim = aim;
      const quantized = this.quantizeAim(aim);
      this.state = await this.engine.run({
        state: this.state,
        aim: quantized,
        strike: true,
        maxLevel: this.levels.count,
      });
      this.audio.hit(quantized.strength);
      this.events.onMessage('HIT');
      this.events.onState(this.state, this.level, this.paused);
    } catch (error) {
      this.fail(error);
    } finally {
      this.engineBusy = false;
    }
  }

  async restart(): Promise<void> {
    if (this.engineBusy) return;
    this.engineBusy = true;
    try {
      this.state = await this.engine.run({
        state: this.state,
        reset: this.level.start,
        maxLevel: this.levels.count,
      });
      this.completionHandled = false;
      this.paused = false;
      this.physicsCounter = 0;
      this.events.onMessage('START');
      this.events.onState(this.state, this.level, this.paused);
    } catch (error) {
      this.fail(error);
    } finally {
      this.engineBusy = false;
    }
  }

  async selectLevel(levelId: number): Promise<void> {
    if (this.engineBusy) return;
    const nextLevel = this.levels.getById(levelId);
    this.engineBusy = true;
    try {
      this.state = await this.engine.run({
        state: { ...this.state, level: nextLevel.id },
        reset: nextLevel.start,
        maxLevel: this.levels.count,
      });
      this.completionHandled = false;
      this.paused = false;
      this.physicsCounter = 0;
      this.events.onMessage('START');
      this.events.onState(this.state, this.level, this.paused);
    } catch (error) {
      this.fail(error);
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
      this.state = await this.engine.run({
        state: this.state,
        advance: true,
        reset: next.start,
        maxLevel: this.levels.count,
      });
      this.completionHandled = false;
      this.physicsCounter = 0;
      this.events.onMessage('START');
      this.events.onState(this.state, this.level, this.paused);
    } catch (error) {
      this.fail(error);
    } finally {
      this.engineBusy = false;
    }
  }

  togglePause(): void {
    if (this.errorMessage) return;
    this.paused = !this.paused;
    this.events.onState(this.state, this.level, this.paused);
  }

  setAudioEnabled(enabled: boolean): void {
    this.audio.setEnabled(enabled);
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown game error.';
    this.errorMessage = `ENGINE ERROR: ${message}`;
    this.events.onError(this.errorMessage);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.input.dispose();
    this.engine.dispose();
  }
}
