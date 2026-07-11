import { describe, expect, it } from 'vitest';
import source from '../src/trumpscript/commentator.tr?raw';
import { createTrumpRuntime } from '../src/trumpscript/runtime';

describe('TrumpScript compatibility runtime', () => {
  it('returns deterministic commentary for a supplied seed', () => {
    const runtime = createTrumpRuntime(source);
    expect(runtime.comment('START', 0)).toBe(runtime.comment('START', 2));
  });

  it('grades results without affecting authoritative scores', () => {
    const runtime = createTrumpRuntime(source);
    expect(runtime.grade(1, 4)).toBe('TREMENDOUS');
    expect(runtime.grade(4, 4)).toBe('VERY SOLID');
  });
});
