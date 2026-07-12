import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  decodeEngineOutput,
  encodeEngineCommand,
} from '../src/brainfuck/protocol';
import { executeEngineRequest } from '../src/brainfuck/worker';

describe('Brainfuck worker execution', () => {
  it('executes the precompiled engine with the configured safety limits', () => {
    const output = executeEngineRequest(
      encodeEngineCommand({
        state: createInitialState(1, { x: 24, y: 75 }),
        aim: {
          velocityX: 8,
          xNegative: false,
          velocityY: 0,
          yNegative: false,
          strength: 8,
        },
        strike: true,
        maxLevel: 9,
      }),
    ).output;

    expect(decodeEngineOutput(output)).toMatchObject({
      level: 1,
      velocityX: 8,
      strokes: 1,
    });
  });
});
