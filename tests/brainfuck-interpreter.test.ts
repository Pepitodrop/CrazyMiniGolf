import { describe, expect, it } from 'vitest';
import { BrainfuckError, compileBrainfuck, runBrainfuck } from '../src/brainfuck/interpreter';

describe('Brainfuck interpreter', () => {
  it('executes arithmetic and output', () => {
    const result = runBrainfuck('+++.', new Uint8Array());
    expect([...result.output]).toEqual([3]);
  });

  it('supports nested loops', () => {
    const result = runBrainfuck('++[>++[>+<-]<-]>>.');
    expect([...result.output]).toEqual([4]);
  });

  it('supports deterministic byte input and output', () => {
    const result = runBrainfuck(',.,.', Uint8Array.from([65, 66]));
    expect(new TextDecoder().decode(result.output)).toBe('AB');
  });

  it('rejects unmatched brackets', () => {
    expect(() => compileBrainfuck('[++')).toThrowError(BrainfuckError);
  });

  it('enforces step limits', () => {
    try {
      runBrainfuck('+[]', new Uint8Array(), { stepLimit: 100 });
      throw new Error('Expected a step-limit failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(BrainfuckError);
      expect((error as BrainfuckError).code).toBe('STEP_LIMIT');
    }
  });

  it('enforces tape boundaries', () => {
    try {
      runBrainfuck('<', new Uint8Array(), { tapeSize: 2 });
      throw new Error('Expected a memory-limit failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(BrainfuckError);
      expect((error as BrainfuckError).code).toBe('MEMORY_LIMIT');
    }
  });
});
