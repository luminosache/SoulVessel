export const PROGRESS_STORAGE_KEY = "hunping-game-progress-v1";

export interface GameProgress {
  hasSeenJinEnding: boolean;
  hasSeenTutorial: boolean;
}

interface ProgressStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const DEFAULT_PROGRESS: GameProgress = {
  hasSeenJinEnding: false,
  hasSeenTutorial: false,
};

function getBrowserStorage(): ProgressStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeProgress(value: unknown): GameProgress {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PROGRESS };
  }

  const progress = value as Partial<GameProgress>;
  return {
    hasSeenJinEnding: progress.hasSeenJinEnding === true,
    hasSeenTutorial: progress.hasSeenTutorial === true,
  };
}

function normalizeProgressPatch(value: Partial<GameProgress>): Partial<GameProgress> {
  return {
    ...(typeof value.hasSeenJinEnding === "boolean"
      ? { hasSeenJinEnding: value.hasSeenJinEnding }
      : {}),
    ...(typeof value.hasSeenTutorial === "boolean"
      ? { hasSeenTutorial: value.hasSeenTutorial }
      : {}),
  };
}

export function readProgress(storage: ProgressStorage | null = getBrowserStorage()): GameProgress {
  try {
    const rawValue = storage?.getItem(PROGRESS_STORAGE_KEY);
    if (!rawValue) {
      return { ...DEFAULT_PROGRESS };
    }
    return normalizeProgress(JSON.parse(rawValue));
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function writeProgress(
  nextProgress: Partial<GameProgress>,
  storage: ProgressStorage | null = getBrowserStorage(),
): GameProgress {
  const progress = {
    ...readProgress(storage),
    ...normalizeProgressPatch(nextProgress),
  };

  try {
    storage?.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Progress unlocks are nice-to-have and must never break gameplay.
  }

  return progress;
}

export function markJinEndingSeen(storage?: ProgressStorage | null): GameProgress {
  return writeProgress({ hasSeenJinEnding: true }, storage ?? getBrowserStorage());
}

export function markTutorialSeen(storage?: ProgressStorage | null): GameProgress {
  return writeProgress({ hasSeenTutorial: true }, storage ?? getBrowserStorage());
}
