import { describe, expect, it } from 'vitest';
import rawLevels from '../src/levels/levels.json';
import { LevelManager } from '../src/game/LevelManager';
import { parseLevels, validateLevel } from '../src/levels/schema';

describe('level data', () => {
  it('contains nine valid, increasingly difficult levels', () => {
    const levels = parseLevels(rawLevels);
    expect(levels).toHaveLength(9);
    expect(levels.map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(levels.every((level) => validateLevel(level).length === 0)).toBe(true);
    expect(levels.at(-1)?.par).toBeGreaterThan(levels[0]?.par ?? 0);
  });

  it('rejects malformed and out-of-bounds level geometry', () => {
    const invalid = {
      ...rawLevels[0],
      id: 20,
      par: -5,
      obstacles: [{ type: 'rect', x: -999, y: 10, width: 20, height: 20 }],
    };
    const errors = validateLevel(invalid);
    expect(errors).toContain('id must be between 1 and 9.');
    expect(errors).toContain('par must be between 1 and 20.');
    expect(errors.some((error) => error.includes('lies outside'))).toBe(true);
  });

  it('requires ids to be exactly one through nine', () => {
    const shifted = rawLevels.map((level, index) => ({ ...level, id: index + 20 }));
    expect(() => parseLevels(shifted)).toThrow(/exactly 1 through 9/);
  });

  it('provides deterministic level lookup with useful errors', () => {
    const manager = new LevelManager();
    expect(manager.count).toBe(9);
    expect(manager.getByIndex(0).id).toBe(1);
    expect(manager.getById(9).name).toBe('Segfault Summit');
    expect(() => manager.getByIndex(99)).toThrow(/Unknown level index/);
    expect(() => manager.getById(99)).toThrow(/Unknown level id/);
  });
});
