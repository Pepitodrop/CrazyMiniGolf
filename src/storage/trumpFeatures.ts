import type { TrumpFeature } from '../trumpscript/runtime';

const STORAGE_KEY = 'crazy-mini-golf-trump-features-v1';

export interface TrumpFeatureStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface TrumpFeatureProgress {
  version: 1;
  stylePoints: number;
  unlockedFeatureIds: string[];
}

export interface TrumpAwardResult {
  progress: TrumpFeatureProgress;
  newlyUnlocked: TrumpFeature[];
}

export const emptyTrumpFeatureProgress = (): TrumpFeatureProgress => ({
  version: 1,
  stylePoints: 0,
  unlockedFeatureIds: [],
});

function browserStorage(): TrumpFeatureStorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadTrumpFeatureProgress(
  storage: TrumpFeatureStorageLike | null = browserStorage(),
): TrumpFeatureProgress {
  try {
    if (!storage) return emptyTrumpFeatureProgress();
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyTrumpFeatureProgress();
    const parsed = JSON.parse(raw) as Partial<TrumpFeatureProgress>;
    if (parsed.version !== 1 || !Array.isArray(parsed.unlockedFeatureIds)) {
      return emptyTrumpFeatureProgress();
    }
    return {
      version: 1,
      stylePoints:
        typeof parsed.stylePoints === 'number' && Number.isFinite(parsed.stylePoints)
          ? Math.max(0, Math.round(parsed.stylePoints))
          : 0,
      unlockedFeatureIds: [
        ...new Set(parsed.unlockedFeatureIds.filter((id): id is string => typeof id === 'string')),
      ],
    };
  } catch {
    return emptyTrumpFeatureProgress();
  }
}

export function saveTrumpFeatureProgress(
  progress: TrumpFeatureProgress,
  storage: TrumpFeatureStorageLike | null = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function recordTrumpAwards(
  progress: TrumpFeatureProgress,
  awards: TrumpFeature[],
): TrumpAwardResult {
  const unlocked = new Set(progress.unlockedFeatureIds);
  const newlyUnlocked = awards.filter((award) => !unlocked.has(award.id));
  for (const award of newlyUnlocked) unlocked.add(award.id);
  return {
    newlyUnlocked,
    progress: {
      version: 1,
      stylePoints:
        progress.stylePoints + newlyUnlocked.reduce((sum, award) => sum + award.points, 0),
      unlockedFeatureIds: [...unlocked].sort(),
    },
  };
}

export function resetTrumpFeatureProgress(
  storage: TrumpFeatureStorageLike | null = browserStorage(),
): TrumpFeatureProgress {
  const progress = emptyTrumpFeatureProgress();
  saveTrumpFeatureProgress(progress, storage);
  return progress;
}
