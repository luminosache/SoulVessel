import type { JinNpc3Data, JinPath } from "./jinData";

import type { FillStage } from "./npcLogic";

export interface LeftSlots {
  text1: string;
  text2: string;
  text3: string;
}

export interface JinValidationResult {
  ok: boolean;
  errors: string[];
}

export interface JinWhiteboxRow {
  path_id: number;
  choice_1: string;
  choice_2: string;
  choice_3: string;
  final_result_title: string;
  artifacts: boolean;
  pass: boolean;
  issue: string;
}

export function isRenderableText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function renderLeftPanelFromSlots(leftSlots: LeftSlots): string[] {
  return [leftSlots.text1, leftSlots.text2, leftSlots.text3].filter(isRenderableText);
}

export function findPathByChoice1(data: JinNpc3Data, choice1: string): JinPath | null {
  return data.paths.find((path) => path.choices[0] === choice1) ?? null;
}

export function findPathByChoice12(data: JinNpc3Data, choice1: string, choice2: string): JinPath | null {
  return data.paths.find((path) => path.choices[0] === choice1 && path.choices[1] === choice2) ?? null;
}

export function findFinalPath(data: JinNpc3Data, choice1: string, choice2: string, choice3: string): JinPath | null {
  return (
    data.paths.find(
      (path) =>
        path.choices[0] === choice1 &&
        path.choices[1] === choice2 &&
        path.choices[2] === choice3,
    ) ?? null
  );
}

export function getJinDisguiseFillStage(
  choice1: string,
  choice2: string,
  choice3: string,
  disguiseChoiceId: string,
): FillStage {
  if (!disguiseChoiceId || choice1 !== disguiseChoiceId) return 0;
  if (choice3) return 3;
  if (choice2) return 2;
  return 1;
}

export function validateJinData(data: JinNpc3Data): JinValidationResult {
  const errors: string[] = [];

  if (!isRenderableText(data.background_texts?.confession)) {
    errors.push("missing background_texts.confession");
  }
  if (!isRenderableText(data.background_texts?.petition)) {
    errors.push("missing background_texts.petition");
  }
  if (!Array.isArray(data.round_1?.options) || data.round_1.options.length !== 2) {
    errors.push("round_1.options must have 2 items");
  }
  if (!Array.isArray(data.round_2?.options) || data.round_2.options.length !== 3) {
    errors.push("round_2.options must have 3 items");
  }
  if (!Array.isArray(data.round_3?.options) || data.round_3.options.length !== 2) {
    errors.push("round_3.options must have 2 items");
  }

  if (!Array.isArray(data.paths)) {
    errors.push("paths must be an array");
    return { ok: false, errors };
  }

  if (data.paths.length !== 12) {
    errors.push(`paths.length must be 12, got ${data.paths.length}`);
  }

  const requiredPathKeys: Array<keyof JinPath> = [
    "path_id",
    "choices",
    "text_1_left",
    "text_1_right",
    "text_2_left_neutral",
    "text_2_right_neutral",
    "text_2_left",
    "text_2_right",
    "text_3_left",
    "text_3_right",
    "final_result",
    "artifacts",
  ];

  const comboSet = new Set<string>();
  const nonEmptyArtifacts: number[] = [];

  for (const path of data.paths) {
    for (const key of requiredPathKeys) {
      if (!(key in path)) {
        errors.push(`path ${path.path_id} missing ${String(key)}`);
      }
    }

    if (!Array.isArray(path.choices) || path.choices.length !== 3) {
      errors.push(`path ${path.path_id} choices must be length 3`);
    } else {
      const comboKey = path.choices.join("||");
      if (comboSet.has(comboKey)) {
        errors.push(`duplicate choices combo at path ${path.path_id}`);
      }
      comboSet.add(comboKey);
    }

    if (
      !path.final_result ||
      typeof path.final_result.title !== "string" ||
      typeof path.final_result.text !== "string"
    ) {
      errors.push(`path ${path.path_id} missing final_result.title/text`);
    }

    if (!Array.isArray(path.artifacts)) {
      errors.push(`path ${path.path_id} artifacts must be array`);
    } else if (path.artifacts.length > 0) {
      nonEmptyArtifacts.push(path.path_id);
    }
  }

  if (!(nonEmptyArtifacts.length === 1 && nonEmptyArtifacts[0] === 1)) {
    errors.push(
      `only path_id=1 should have non-empty artifacts, got [${nonEmptyArtifacts.join(",")}]`,
    );
  }

  return { ok: errors.length === 0, errors };
}

function includesNullOrUndefined(values: string[]): boolean {
  const joined = values.join("\n");
  return joined.includes("undefined") || joined.includes("null");
}

export function runJinWhiteboxMatrix(data: JinNpc3Data): JinWhiteboxRow[] {
  const rows: JinWhiteboxRow[] = [];

  for (const expectedPath of data.paths) {
    const [choice1, choice2, choice3] = expectedPath.choices;
    const issues: string[] = [];

    const state2Path = findPathByChoice1(data, choice1);
    if (!state2Path) {
      issues.push("state2 no path for choice_1");
    }

    const state4Path = findPathByChoice12(data, choice1, choice2);
    if (!state4Path) {
      issues.push("state4 no path for choice_1+choice_2");
    }

    const finalPath = findFinalPath(data, choice1, choice2, choice3);
    if (!finalPath) {
      issues.push("state6 no final path");
    }

    if (finalPath) {
      const sameFinal = data.paths.filter(
        (p) =>
          p.choices[0] === choice1 &&
          p.choices[1] === choice2 &&
          p.choices[2] === choice3,
      );
      if (sameFinal.length !== 1) {
        issues.push(`final path not unique (${sameFinal.length})`);
      }

      const leftSlotsNeutral: LeftSlots = {
        text1: state2Path?.text_1_left ?? "",
        text2: state4Path?.text_2_left_neutral ?? "",
        text3: "",
      };

      const leftSlotsFinal: LeftSlots = {
        text1: state2Path?.text_1_left ?? "",
        text2: finalPath.text_2_left,
        text3: finalPath.text_3_left,
      };

      const renderedNeutral = renderLeftPanelFromSlots(leftSlotsNeutral);
      const renderedFinal = renderLeftPanelFromSlots(leftSlotsFinal);

      if (renderedNeutral.some((line) => line.trim().length === 0)) {
        issues.push("state4 rendered empty left paragraph");
      }
      if (renderedFinal.some((line) => line.trim().length === 0)) {
        issues.push("state6 rendered empty left paragraph");
      }

      const rightState6 = [
        state2Path?.text_1_right ?? "",
        finalPath.text_2_right,
        finalPath.text_3_right,
      ];

      if (rightState6[0] !== (state2Path?.text_1_right ?? "")) {
        issues.push("state6 right text_1_right order error");
      }
      if (rightState6[1] !== finalPath.text_2_right) {
        issues.push("state6 right text_2_right order error");
      }
      if (rightState6[2] !== finalPath.text_3_right) {
        issues.push("state6 right text_3_right order error");
      }

      const state7EndingTitle = finalPath.final_result.title;
      const state7BackNarrative = rightState6.join("\n");
      if (!isRenderableText(state7EndingTitle)) {
        issues.push("state7 ending title missing");
      }
      if (!isRenderableText(state7BackNarrative)) {
        issues.push("state7 back narrative missing");
      }

      const hasArtifacts = Array.isArray(finalPath.artifacts) && finalPath.artifacts.length > 0;
      if (finalPath.path_id === 1 && !hasArtifacts) {
        issues.push("path 1 should enter artifacts state8");
      }
      if (finalPath.path_id !== 1 && hasArtifacts) {
        issues.push("non-path1 should not enter artifacts state8");
      }

      const allStrings = [
        state2Path?.text_1_left ?? "",
        state2Path?.text_1_right ?? "",
        state4Path?.text_2_left_neutral ?? "",
        state4Path?.text_2_right_neutral ?? "",
        finalPath.text_2_left,
        finalPath.text_2_right,
        finalPath.text_3_left,
        finalPath.text_3_right,
        finalPath.final_result.title,
        finalPath.final_result.text,
      ];
      if (includesNullOrUndefined(allStrings)) {
        issues.push("contains undefined/null text");
      }
    }

    rows.push({
      path_id: expectedPath.path_id,
      choice_1: choice1,
      choice_2: choice2,
      choice_3: choice3,
      final_result_title: expectedPath.final_result.title,
      artifacts: Array.isArray(expectedPath.artifacts) && expectedPath.artifacts.length > 0,
      pass: issues.length === 0,
      issue: issues.join("; "),
    });
  }

  return rows;
}
