import { describe, expect, it } from 'vitest';
import rawLevels from '../src/levels/levels.json';
import { parseLevels, validateLevel } from '../src/levels/schema';

describe('level data', () => {
  it('contains nine valid, increasingly difficult levels', () => {
    const levels = parseLevels(rawLevels);
    expect(levels).toHaveLength(9);
    expect(levels.map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(levels.every((level) => validateLevel(level).length === 0)).toBe(true);
    expect(levels.at(-1)?.par).toBeGreaterThan(levels[0]?.par ?? 0);
  });

  it('rejects malformed levels', () => {
    expect(() => parseLevels([{ id: 1 }])).toThrow(/Expected 9 levels/);
  });
});
