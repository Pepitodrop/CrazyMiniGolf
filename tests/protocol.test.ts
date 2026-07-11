import { describe, expect, it } from 'vitest';
import {
  ENGINE_INPUT_BYTES,
  ENGINE_OUTPUT_BYTES,
  createInitialState,
  decodeEngineOutput,
  encodeEngineCommand,
} from '../src/brainfuck/protocol';

describe('engine protocol', () => {
  it('encodes a fixed 32-byte command packet', () => {
    const state = createInitialState(1, { x: 20, y: 30 });
    const packet = encodeEngineCommand({
      state,
      aim: { xActive: true, xNegative: false, yActive: false, yNegative: false, strength: 12 },
      strike: true,
      maxLevel: 9,
    });
    expect(packet).toHaveLength(ENGINE_INPUT_BYTES);
    expect(packet[0]).toBe(1);
    expect(packet[13]).toBe(1);
    expect(packet[11]).toBe(12);
  });

  it('decodes the fixed output packet', () => {
    const packet = Uint8Array.from([2, 44, 55, 3, 1, 4, 0, 8, 2, 1, 7, 0, 0, 0, 0]);
    const state = decodeEngineOutput(packet);
    expect(state.level).toBe(2);
    expect(state.velocityXNegative).toBe(true);
    expect(state.collision).toBe(true);
    expect(state.movingValue).toBe(7);
  });

  it('rejects malformed output lengths', () => {
    expect(() => decodeEngineOutput(new Uint8Array(ENGINE_OUTPUT_BYTES - 1))).toThrow(
      /expected 15/,
    );
  });
});
