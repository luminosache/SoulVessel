import type { NpcEnding, NpcScript, OptionKind } from "./npcData";

export type FillStage = 0 | 1 | 2 | 3;

export function getOptionKind(npc: NpcScript, optionId: string): OptionKind | null {
  return npc.options.find((option) => option.id === optionId)?.kind ?? null;
}

export function getSelectionCountByKind(npc: NpcScript, selectedIds: string[], kind: OptionKind): number {
  return selectedIds.filter((id) => getOptionKind(npc, id) === kind).length;
}

export function canSelectOption(npc: NpcScript, selectedIds: string[], optionId: string): boolean {
  if (selectedIds.includes(optionId)) return true;

  const option = npc.options.find((item) => item.id === optionId);
  if (option?.selectionGroup) return true;

  const kind = option?.kind ?? null;
  if (kind === "text") {
    return getSelectionCountByKind(npc, selectedIds, "text") < npc.requiredTextSelections;
  }

  if (kind === "item") {
    return getSelectionCountByKind(npc, selectedIds, "item") < npc.requiredItemSelections;
  }

  return false;
}

export function toggleOptionSelection(npc: NpcScript, selectedIds: string[], optionId: string): string[] {
  if (selectedIds.includes(optionId)) {
    return selectedIds.filter((id) => id !== optionId);
  }

  const option = npc.options.find((item) => item.id === optionId);
  if (option?.selectionGroup) {
    return [
      ...selectedIds.filter((id) => {
        const selectedOption = npc.options.find((item) => item.id === id);
        return selectedOption?.selectionGroup !== option.selectionGroup;
      }),
      optionId,
    ];
  }

  if (!canSelectOption(npc, selectedIds, optionId)) {
    return selectedIds;
  }

  return [...selectedIds, optionId];
}

export function getFillStageFromSelection(selectedCount: number): FillStage {
  if (selectedCount <= 0) return 0;
  if (selectedCount === 1) return 1;
  if (selectedCount === 2) return 2;
  return 3;
}

function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function toDecisionKey(selectedIds: string[]): string {
  return [...selectedIds].sort().join("|");
}

export function resolveEnding(npc: NpcScript, selectedIds: string[]): NpcEnding | null {
  if (selectedIds.length !== npc.requiredTextSelections + npc.requiredItemSelections) {
    return null;
  }

  if (npc.decisionMatrix) {
    const mapping = npc.decisionMatrix[toDecisionKey(selectedIds)];
    if (mapping) {
      const mappedEnding = npc.endings.find((ending) => ending.id === mapping.endingId);
      if (mappedEnding) {
        return {
          ...mappedEnding,
          isTrueEnding: mapping.isTrueEnding,
        };
      }
    }
  }

  return npc.endings.find((ending) => sameSet(ending.requiredOptionIds, selectedIds)) ?? null;
}
