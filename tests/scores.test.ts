import { describe, expect, it } from 'vitest';
import {
  emptyProgress,
  loadProgress,
  recordLevelScore,
  saveProgress,
  type StorageLike,
} from '../src/storage/scores';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('local score storage', () => {
  it('stores only the better score and unlocks the next level', () => {
    let progress = recordLevelScore(emptyProgress(), 1, 4, 2);
    progress = recordLevelScore(progress, 1, 3, 2);
    progress = recordLevelScore(progress, 1, 5, 2);
    expect(progress.unlockedLevel).toBe(2);
    expect(progress.scores[0]?.bestStrokes).toBe(3);
  });

  it('persists and reloads valid progress', () => {
    const storage = new MemoryStorage();
    const progress = recordLevelScore(emptyProgress(), 1, 2, 2);
    saveProgress(progress, storage);
    expect(loadProgress(storage)).toEqual(progress);
  });

  it('returns false instead of throwing when storage writes are blocked', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(saveProgress(emptyProgress(), storage)).toBe(false);
  });

  it('computes a total highscore after all nine levels', () => {
    let progress = emptyProgress();
    for (let id = 1; id <= 9; id += 1) progress = recordLevelScore(progress, id, id + 1, id);
    expect(progress.totalBest).toBe(54);
  });
});
