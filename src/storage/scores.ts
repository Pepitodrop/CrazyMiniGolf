import type { SavedProgress, ScoreEntry } from '../game/types';

const STORAGE_KEY = 'crazy-mini-golf-progress-v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const emptyProgress = (): SavedProgress => ({
  version: 1,
  unlockedLevel: 1,
  totalBest: null,
  scores: [],
});

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadProgress(storage: StorageLike | null = browserStorage()): SavedProgress {
  try {
    if (!storage) return emptyProgress();
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    if (parsed.version !== 1 || !Array.isArray(parsed.scores)) return emptyProgress();
    return {
      version: 1,
      unlockedLevel: Math.max(1, Math.min(9, Number(parsed.unlockedLevel) || 1)),
      totalBest:
        typeof parsed.totalBest === 'number' && Number.isFinite(parsed.totalBest)
          ? Math.max(0, Math.round(parsed.totalBest))
          : null,
      scores: parsed.scores.filter(
        (entry): entry is ScoreEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          Number.isInteger(entry.levelId) &&
          entry.levelId >= 1 &&
          entry.levelId <= 9 &&
          Number.isInteger(entry.bestStrokes) &&
          entry.bestStrokes >= 0 &&
          Number.isInteger(entry.par) &&
          entry.par > 0,
      ),
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(
  progress: SavedProgress,
  storage: StorageLike | null = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function recordLevelScore(
  progress: SavedProgress,
  levelId: number,
  strokes: number,
  par: number,
): SavedProgress {
  const existing = progress.scores.find((entry) => entry.levelId === levelId);
  const scores = existing
    ? progress.scores.map((entry) =>
        entry.levelId === levelId
          ? { ...entry, bestStrokes: Math.min(entry.bestStrokes, strokes), par }
          : entry,
      )
    : [...progress.scores, { levelId, bestStrokes: strokes, par }];
  const uniqueScores = [...new Map(scores.map((entry) => [entry.levelId, entry])).values()];
  const allNine = uniqueScores.length === 9;
  const total = uniqueScores.reduce((sum, entry) => sum + entry.bestStrokes, 0);
  return {
    version: 1,
    unlockedLevel: Math.min(9, Math.max(progress.unlockedLevel, levelId + 1)),
    scores: uniqueScores.sort((a, b) => a.levelId - b.levelId),
    totalBest: allNine
      ? Math.min(progress.totalBest ?? Number.POSITIVE_INFINITY, total)
      : progress.totalBest,
  };
}

export function resetProgress(storage: StorageLike | null = browserStorage()): SavedProgress {
  const progress = emptyProgress();
  saveProgress(progress, storage);
  return progress;
}
