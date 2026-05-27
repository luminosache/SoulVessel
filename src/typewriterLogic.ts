export const TYPEWRITER_TITLE_INTERVAL_MS = 22;
export const TYPEWRITER_CONTENT_INTERVAL_MS = 12;

export interface TypewriterSnapshot {
  typedTitle: string;
  typedContent: string;
  completed: boolean;
}

interface TypewriterReplayKeyInput {
  title: string;
  content: string;
  triggerKey: string;
}

const typewriterSnapshots = new Map<string, TypewriterSnapshot>();

export function getTypewriterReplayKey({
  title,
  content,
}: TypewriterReplayKeyInput): string {
  return `${title}::${content}`;
}

export function getTypewriterSnapshot(cacheKey: string): TypewriterSnapshot | null {
  return typewriterSnapshots.get(cacheKey) ?? null;
}

export function recordTypewriterSnapshot(
  cacheKey: string,
  snapshot: TypewriterSnapshot,
): void {
  const current = typewriterSnapshots.get(cacheKey);
  if (!current) {
    typewriterSnapshots.set(cacheKey, snapshot);
    return;
  }

  typewriterSnapshots.set(cacheKey, {
    typedTitle:
      snapshot.typedTitle.length > current.typedTitle.length
        ? snapshot.typedTitle
        : current.typedTitle,
    typedContent:
      snapshot.typedContent.length > current.typedContent.length
        ? snapshot.typedContent
        : current.typedContent,
    completed: current.completed || snapshot.completed,
  });
}

export function clearTypewriterSnapshots(): void {
  typewriterSnapshots.clear();
}
