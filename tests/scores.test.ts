import { describe, expect, it } from 'vitest';
import {
  emptyProgress,
  loadProgress,
  recordLevelScore,
  recordRoundScore,
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
  it('stores only the better hole score and unlocks the next level', () => {
    let progress = recordLevelScore(emptyProgress(), 1, 4, 2);
    progress = recordLevelScore(progress, 1, 3, 2);
    progress = recordLevelScore(progress, 1, 5, 2);
    expect(progress.unlockedLevel).toBe(2);
    expect(progress.scores[0]?.bestStrokes).toBe(3);
  });

  it('persists and reloads valid version-two progress', () => {
    const storage = new MemoryStorage();
    const progress = recordRoundScore(recordLevelScore(emptyProgress(), 1, 2, 2), 31);
    saveProgress(progress, storage);
    expect(loadProgress(storage)).toEqual(progress);
  });

  it('migrates the legacy combined-hole total without inventing a round score', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'crazy-mini-golf-progress-v1',
      JSON.stringify({
        version: 1,
        unlockedLevel: 9,
        totalBest: 42,
        scores: [{ levelId: 1, bestStrokes: 2, par: 2 }],
      }),
    );

    expect(loadProgress(storage)).toMatchObject({
      version: 2,
      unlockedLevel: 9,
      bestRound: null,
      combinedHoleBests: 42,
    });
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

  it('keeps combined hole bests separate from the best completed round', () => {
    let progress = emptyProgress();
    for (let id = 1; id <= 9; id += 1) progress = recordLevelScore(progress, id, id + 1, id);
    expect(progress.combinedHoleBests).toBe(54);
    expect(progress.bestRound).toBeNull();

    progress = recordRoundScore(progress, 61);
    progress = recordRoundScore(progress, 58);
    progress = recordRoundScore(progress, 63);
    expect(progress.bestRound).toBe(58);
    expect(progress.combinedHoleBests).toBe(54);
  });
});
