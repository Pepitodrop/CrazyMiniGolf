import { describe, expect, it } from 'vitest';
import {
  emptyTrumpFeatureProgress,
  loadTrumpFeatureProgress,
  recordTrumpAwards,
  saveTrumpFeatureProgress,
  type TrumpFeatureStorageLike,
} from '../src/storage/trumpFeatures';
import type { TrumpFeature } from '../src/trumpscript/runtime';

class MemoryStorage implements TrumpFeatureStorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const award = (id: string, points: number): TrumpFeature => ({
  id,
  kind: 'CHALLENGE',
  levelId: 1,
  title: id,
  conditions: [{ type: 'ACE' }],
  points,
  message: id,
});

describe('TrumpScript feature persistence', () => {
  it('awards each feature only once', () => {
    const first = recordTrumpAwards(emptyTrumpFeatureProgress(), [award('ace', 100)]);
    const second = recordTrumpAwards(first.progress, [award('ace', 100)]);
    expect(first.progress.stylePoints).toBe(100);
    expect(first.newlyUnlocked).toHaveLength(1);
    expect(second.progress.stylePoints).toBe(100);
    expect(second.newlyUnlocked).toHaveLength(0);
  });

  it('returns false instead of throwing when medal storage is unavailable', () => {
    const storage: TrumpFeatureStorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(saveTrumpFeatureProgress(emptyTrumpFeatureProgress(), storage)).toBe(false);
  });

  it('persists style points and unique medals', () => {
    const storage = new MemoryStorage();
    const result = recordTrumpAwards(emptyTrumpFeatureProgress(), [award('a', 40), award('b', 60)]);
    saveTrumpFeatureProgress(result.progress, storage);
    expect(loadTrumpFeatureProgress(storage)).toEqual({
      version: 1,
      stylePoints: 100,
      unlockedFeatureIds: ['a', 'b'],
    });
  });
});
