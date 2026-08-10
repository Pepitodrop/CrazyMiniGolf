import type { SavedProgress, ScoreEntry } from '../game/types';

const STORAGE_KEY = 'crazy-mini-golf-progress-v1';
const MAX_LEVEL = 9;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface LegacyProgress {
  version: 1;
  unlockedLevel?: unknown;
  totalBest?: unknown;
  scores?: unknown;
}

export const emptyProgress = (): SavedProgress => ({
  version: 2,
  unlockedLevel: 1,
  bestRound: null,
  combinedHoleBests: null,
  scores: [],
});

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function uniqueSortedScores(entries: ScoreEntry[]): ScoreEntry[] {
  return [...new Map(entries.map((entry) => [entry.levelId, entry])).values()].sort(
    (a, b) => a.levelId - b.levelId,
  );
}

function validScoreEntries(value: unknown): ScoreEntry[] {
  if (!Array.isArray(value)) return [];
  return uniqueSortedScores(
    value.filter(
      (entry): entry is ScoreEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        Number.isInteger((entry as ScoreEntry).levelId) &&
        (entry as ScoreEntry).levelId >= 1 &&
        (entry as ScoreEntry).levelId <= MAX_LEVEL &&
        Number.isInteger((entry as ScoreEntry).bestStrokes) &&
        (entry as ScoreEntry).bestStrokes >= 0 &&
        Number.isInteger((entry as ScoreEntry).par) &&
        (entry as ScoreEntry).par > 0,
    ),
  );
}

function validOptionalScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function normalizeUnlockedLevel(value: unknown): number {
  return Math.max(1, Math.min(MAX_LEVEL, Number(value) || 1));
}

export function loadProgress(storage: StorageLike | null = browserStorage()): SavedProgress {
  try {
    if (!storage) return emptyProgress();
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<SavedProgress> | LegacyProgress;
    const scores = validScoreEntries(parsed.scores);
    const unlockedLevel = normalizeUnlockedLevel(parsed.unlockedLevel);

    if (parsed.version === 2) {
      return {
        version: 2,
        unlockedLevel,
        bestRound: validOptionalScore(parsed.bestRound),
        combinedHoleBests: validOptionalScore(parsed.combinedHoleBests),
        scores,
      };
    }

    if (parsed.version === 1) {
      return {
        version: 2,
        unlockedLevel,
        bestRound: null,
        combinedHoleBests: validOptionalScore(parsed.totalBest),
        scores,
      };
    }

    return emptyProgress();
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
  const normalizedScores = uniqueSortedScores(scores);
  const combinedHoleBests =
    normalizedScores.length === MAX_LEVEL
      ? normalizedScores.reduce((sum, entry) => sum + entry.bestStrokes, 0)
      : progress.combinedHoleBests;

  return {
    ...progress,
    version: 2,
    unlockedLevel: Math.min(MAX_LEVEL, Math.max(progress.unlockedLevel, levelId + 1)),
    scores: normalizedScores,
    combinedHoleBests,
  };
}

export function recordRoundScore(progress: SavedProgress, strokes: number): SavedProgress {
  if (!Number.isInteger(strokes) || strokes < 0) return progress;
  return {
    ...progress,
    version: 2,
    bestRound: Math.min(progress.bestRound ?? Number.POSITIVE_INFINITY, strokes),
  };
}

export function resetProgress(storage: StorageLike | null = browserStorage()): SavedProgress {
  const progress = emptyProgress();
  saveProgress(progress, storage);
  return progress;
}
