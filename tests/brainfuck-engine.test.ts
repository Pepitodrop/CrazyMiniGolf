import { describe, expect, it } from 'vitest';
import engineSource from '../src/brainfuck/engine.bf?raw';
import { runBrainfuck } from '../src/brainfuck/interpreter';
import {
  createInitialState,
  decodeEngineOutput,
  encodeEngineCommand,
  type EngineCommand,
} from '../src/brainfuck/protocol';
import type { EngineState } from '../src/game/types';

function execute(command: EngineCommand): EngineState {
  return decodeEngineOutput(
    runBrainfuck(engineSource, encodeEngineCommand(command), {
      tapeSize: 96,
      stepLimit: 350_000,
      outputLimit: 32,
    }).output,
  );
}

describe('Brainfuck game engine', () => {
  it('resets ball and per-level state', () => {
    const dirty: EngineState = {
      ...createInitialState(3, { x: 99, y: 99 }),
      velocityX: 8,
      velocityY: 5,
      strokes: 7,
      inHole: true,
      levelComplete: true,
    };
    const result = execute({ state: dirty, reset: { x: 25, y: 80 }, maxLevel: 9 });
    expect(result).toMatchObject({
      level: 3,
      x: 25,
      y: 80,
      velocityX: 0,
      velocityY: 0,
      strokes: 0,
      inHole: false,
      levelComplete: false,
    });
  });

  it('applies a strike and increments the stroke count', () => {
    const state = createInitialState(1, { x: 24, y: 75 });
    const result = execute({
      state,
      aim: { velocityX: 8, xNegative: false, velocityY: 5, yNegative: true, strength: 9 },
      strike: true,
      maxLevel: 9,
    });
    expect(result).toMatchObject({
      velocityX: 8,
      velocityXNegative: false,
      velocityY: 5,
      velocityYNegative: true,
      strokes: 1,
      movingValue: 13,
    });
  });

  it('moves the ball and applies friction pulses', () => {
    const state: EngineState = {
      ...createInitialState(1, { x: 20, y: 30 }),
      velocityX: 5,
      velocityY: 3,
      movingValue: 8,
    };
    const result = execute({ state, tick: true, decayX: true, decayY: true, maxLevel: 9 });
    expect(result).toMatchObject({ x: 25, y: 33, velocityX: 4, velocityY: 2, movingValue: 6 });
  });

  it('bounces on an obstacle sensor and skips penetration movement', () => {
    const state: EngineState = {
      ...createInitialState(2, { x: 100, y: 60 }),
      velocityX: 6,
      movingValue: 6,
    };
    const result = execute({ state, tick: true, blockX: true, maxLevel: 9 });
    expect(result.x).toBe(100);
    expect(result.velocityXNegative).toBe(true);
    expect(result.collision).toBe(true);
  });

  it('marks the hole and level completion', () => {
    const state = createInitialState(4, { x: 210, y: 30 });
    const result = execute({ state, holeSensor: true, maxLevel: 9 });
    expect(result.inHole).toBe(true);
    expect(result.levelComplete).toBe(true);
  });

  it('does not advance beyond maxLevel', () => {
    const state = { ...createInitialState(9, { x: 20, y: 20 }), levelComplete: true, inHole: true };
    const result = execute({ state, advance: true, maxLevel: 9 });
    expect(result.level).toBe(9);
  });

  it('saturates the stroke counter instead of wrapping after 255', () => {
    const state = { ...createInitialState(1, { x: 20, y: 20 }), strokes: 255 };
    const result = execute({
      state,
      aim: { velocityX: 5, xNegative: false, velocityY: 0, yNegative: false, strength: 5 },
      strike: true,
      maxLevel: 9,
    });
    expect(result.strokes).toBe(255);
  });

  it('advances through all nine level ids deterministically', () => {
    let state = createInitialState(1, { x: 24, y: 75 });
    for (let level = 2; level <= 9; level += 1) {
      state = execute({
        state: { ...state, levelComplete: true, inHole: true },
        advance: true,
        reset: { x: 20 + level, y: 40 + level },
        maxLevel: 9,
      });
      expect(state.level).toBe(level);
      expect(state.x).toBe(20 + level);
      expect(state.y).toBe(40 + level);
      expect(state.strokes).toBe(0);
    }
  });
});
