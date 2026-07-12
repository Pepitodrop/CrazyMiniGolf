import { describe, expect, it, vi } from 'vitest';
import engineSource from '../src/brainfuck/engine.bf?raw';
import { compileBrainfuck, runCompiledBrainfuck } from '../src/brainfuck/interpreter';
import {
  decodeEngineOutput,
  encodeEngineCommand,
  type EngineCommand,
} from '../src/brainfuck/protocol';
import {
  Game,
  type AudioPort,
  type GameDependencies,
  type GameEnginePort,
  type GameEvents,
  type InputPort,
  type RendererPort,
} from '../src/game/Game';
import { LevelManager } from '../src/game/LevelManager';
import type { AimState, EngineState, LevelDefinition, Vec2 } from '../src/game/types';

class InlineEngine implements GameEnginePort {
  private readonly compiled = compileBrainfuck(engineSource);
  calls: EngineCommand[] = [];

  run(command: EngineCommand): Promise<EngineState> {
    this.calls.push(command);
    const result = runCompiledBrainfuck(this.compiled, encodeEngineCommand(command), {
      tapeSize: 96,
      stepLimit: 350_000,
      outputLimit: 32,
    });
    return Promise.resolve(decodeEngineOutput(result.output));
  }

  dispose(): void {}
}

const renderer: RendererPort = {
  toWorld: (_level: LevelDefinition, clientX: number, clientY: number): Vec2 => ({
    x: clientX,
    y: clientY,
  }),
  render: () => undefined,
};

const input: InputPort = {
  setMobileAim(angleDegrees: number, strength: number): AimState {
    const radians = (angleDegrees * Math.PI) / 180;
    return { direction: { x: Math.cos(radians), y: Math.sin(radians) }, strength };
  },
  dispose: () => undefined,
};

const audio: AudioPort = {
  setEnabled: () => undefined,
  hit: () => undefined,
  bounce: () => undefined,
  hole: () => undefined,
  dispose: () => undefined,
};

function createGame(overrides: Partial<GameEvents> = {}): {
  game: Game;
  engine: InlineEngine;
  spies: {
    onError: ReturnType<typeof vi.fn>;
    onWarning: ReturnType<typeof vi.fn>;
    onShot: ReturnType<typeof vi.fn>;
    onFinalComplete: ReturnType<typeof vi.fn>;
  };
} {
  const engine = new InlineEngine();
  const spies = {
    onError: vi.fn(),
    onWarning: vi.fn(),
    onShot: vi.fn(),
    onFinalComplete: vi.fn(),
  };
  const events: GameEvents = {
    onState: vi.fn(),
    onMessage: vi.fn(),
    onError: spies.onError,
    onWarning: spies.onWarning,
    onLevelStart: vi.fn(),
    onShot: spies.onShot,
    onBounce: vi.fn(),
    onHoleTooFast: vi.fn(),
    onRoundReset: vi.fn(),
    onLevelComplete: vi.fn(),
    onFinalComplete: spies.onFinalComplete,
    ...overrides,
  };
  const dependencies: GameDependencies = {
    engine,
    renderer,
    inputFactory: () => input,
    audio,
    requestFrame: () => 1,
    cancelFrame: () => undefined,
  };
  const game = new Game({} as HTMLCanvasElement, new LevelManager(), 1, events, dependencies);
  return { game, engine, spies };
}

function placeOneStepOutsideHole(game: Game, strokes = 1): void {
  const state = game.currentState;
  const level = game.level;
  state.x = level.hole.x - (level.holeRadius - Math.max(1, level.ballRadius / 2)) - 1;
  state.y = level.hole.y;
  state.velocityX = 1;
  state.velocityXNegative = false;
  state.velocityY = 0;
  state.velocityYNegative = false;
  state.movingValue = 1;
  state.strokes = strokes;
  state.inHole = false;
  state.levelComplete = false;
}

describe('Game orchestration', () => {
  it('captures a ball that enters the hole on its final movement tick', async () => {
    const { game, engine } = createGame();
    placeOneStepOutsideHole(game, 2);

    await game.advancePhysics();

    expect(game.currentState.inHole).toBe(true);
    expect(game.currentState.levelComplete).toBe(true);
    expect(game.currentState.velocityX).toBe(0);
    expect(engine.calls).toHaveLength(2);
    expect(engine.calls[0]?.holeSensor).toBeUndefined();
    expect(engine.calls[1]?.holeSensor).toBe(true);
  });

  it('calculates a continuous nine-level round from per-level results', async () => {
    const { game, spies } = createGame();

    for (let levelId = 1; levelId <= 9; levelId += 1) {
      placeOneStepOutsideHole(game, levelId);
      await game.advancePhysics();
      if (levelId < 9) await game.nextLevel();
    }

    expect(spies.onFinalComplete).toHaveBeenCalledTimes(1);
    expect(spies.onFinalComplete).toHaveBeenCalledWith(45);
  });

  it('does not reuse a completed round total when level nine is replayed', async () => {
    const { game, spies } = createGame();

    for (let levelId = 1; levelId <= 9; levelId += 1) {
      placeOneStepOutsideHole(game, levelId);
      await game.advancePhysics();
      if (levelId < 9) await game.nextLevel();
    }

    await game.restart();
    placeOneStepOutsideHole(game, 3);
    await game.advancePhysics();

    expect(spies.onFinalComplete).toHaveBeenCalledTimes(1);
    expect(spies.onWarning).toHaveBeenCalledWith(
      'Finish all nine levels in one continuous round to record a round total.',
    );
  });

  it('does not report an incomplete practice selection as a full round', async () => {
    const { game, spies } = createGame();
    await game.selectLevel(9);
    placeOneStepOutsideHole(game, 7);

    await game.advancePhysics();

    expect(spies.onFinalComplete).not.toHaveBeenCalled();
    expect(spies.onWarning).toHaveBeenCalledWith(
      'Finish all nine levels in one continuous round to record a round total.',
    );
  });

  it('emits resolved five-degree shot telemetry', async () => {
    const { game, engine, spies } = createGame();
    await game.strike({ direction: { x: 1, y: 1 }, strength: 9, angleDegrees: 35 });
    expect(spies.onShot).toHaveBeenCalledWith(
      expect.objectContaining({
        strength: 9,
        angleDegrees: 35,
        xActive: true,
        yActive: true,
        diagonal: true,
      }),
    );
    expect(engine.calls.at(-1)?.aim?.velocityX).toBeGreaterThan(0);
    expect(engine.calls.at(-1)?.aim?.velocityY).toBeGreaterThan(0);
  });

  it('reports a fast pass through the hole once per encounter', async () => {
    const onHoleTooFast = vi.fn();
    const { game } = createGame({ onHoleTooFast });
    const state = game.currentState;
    state.x = game.level.hole.x - 8;
    state.y = game.level.hole.y;
    state.velocityX = 14;
    state.velocityY = 0;
    state.movingValue = 14;
    await game.advancePhysics();
    expect(onHoleTooFast).toHaveBeenCalledTimes(1);
    expect(onHoleTooFast).toHaveBeenCalledWith(14, 2);
    expect(game.currentState.levelComplete).toBe(false);
  });

  it('isolates optional callback failures from engine failures', async () => {
    const { game, spies } = createGame({
      onLevelComplete: () => {
        throw new Error('storage unavailable');
      },
    });
    placeOneStepOutsideHole(game, 2);

    await game.advancePhysics();

    expect(spies.onError).not.toHaveBeenCalled();
    expect(spies.onWarning).toHaveBeenCalledWith('level completion failed: storage unavailable');
    expect(game.currentState.levelComplete).toBe(true);
  });
});
