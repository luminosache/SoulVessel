import assert from "node:assert/strict";
import {
  canSelectOption,
  getFillStageFromSelection,
  resolveEnding,
  toggleOptionSelection,
} from "./npcLogic";
import { npc1, npc2, npcScripts } from "./npcData";

const soil = "anlu-soil";
const unify = "unify-six-states";
const food = "food-secure";
const retire = "disarm-return-field";

assert.equal(npcScripts.length, 3);
assert.equal(npcScripts[0].id, "npc1-jing");
assert.equal(npcScripts[1].id, "npc2-chengtao");
assert.equal(npcScripts[2].id, "npc3-jin");

assert.equal(getFillStageFromSelection(0), 0);
assert.equal(getFillStageFromSelection(1), 1);
assert.equal(getFillStageFromSelection(2), 2);
assert.equal(getFillStageFromSelection(3), 3);

assert.deepEqual(toggleOptionSelection(npc1, [], soil), [soil]);
assert.deepEqual(toggleOptionSelection(npc1, [soil], soil), []);
assert.deepEqual(toggleOptionSelection(npc1, [soil, unify, food], retire), [soil, unify, food]);
assert.equal(canSelectOption(npc1, [soil, unify], food), true);
assert.equal(canSelectOption(npc1, [soil, unify, food], retire), false);

const ending1 = resolveEnding(npc1, [soil, unify, food]);
assert.equal(ending1?.id, "chengdan");
assert.equal(ending1?.isTrueEnding, false);
assert.equal(ending1?.artifacts, undefined);

const ending2 = resolveEnding(npc1, [soil, unify, retire]);
assert.equal(ending2?.id, "qianshou");
assert.equal(ending2?.isTrueEnding, false);

const trueEnding = resolveEnding(npc1, [soil, food, retire]);
assert.equal(trueEnding?.id, "life-before-after");
assert.equal(trueEnding?.isTrueEnding, true);
assert.equal(trueEnding?.artifacts?.[0]?.name, "睡虎地木椟");

assert.equal(resolveEnding(npc1, [unify, food]), null);
assert.equal(resolveEnding(npc1, [soil, unify, food, retire]), null);

const separateTomb = "separate-tomb";
const joinAncestors = "join-ancestors";
const undergroundTax = "underground-tax";
const annualRent = "annual-rent";
const servantFigurine = "servant-figurine";
const leadDouble = "lead-double";

assert.deepEqual(toggleOptionSelection(npc2, [], separateTomb), [separateTomb]);
assert.deepEqual(toggleOptionSelection(npc2, [separateTomb], joinAncestors), [joinAncestors]);
assert.deepEqual(toggleOptionSelection(npc2, [joinAncestors, undergroundTax], annualRent), [joinAncestors, annualRent]);
assert.deepEqual(toggleOptionSelection(npc2, [joinAncestors, annualRent], servantFigurine), [joinAncestors, annualRent, servantFigurine]);
assert.equal(canSelectOption(npc2, [joinAncestors, annualRent, servantFigurine], leadDouble), true);
assert.deepEqual(toggleOptionSelection(npc2, [joinAncestors, annualRent, servantFigurine], leadDouble), [joinAncestors, annualRent, leadDouble]);

const chengTaoCases = [
  [[joinAncestors, undergroundTax, leadDouble], "return-home", true, ["成桃椎地券", "铅人"]],
  [[separateTomb, annualRent, servantFigurine], "yellow-dream", false, ["二千万"]],
  [[separateTomb, undergroundTax, leadDouble], "forget-feeling", false, undefined],
  [[separateTomb, annualRent, leadDouble], "become-dragon", false, ["二千万"]],
  [[joinAncestors, undergroundTax, servantFigurine], "sweet-shackles", false, undefined],
  [[separateTomb, undergroundTax, servantFigurine], "lonely-end", false, undefined],
  [[joinAncestors, annualRent, servantFigurine], "brocade-night", false, ["二千万"]],
  [[joinAncestors, annualRent, leadDouble], "ordinary-rich", false, ["二千万"]],
] as const;

for (const [selectedIds, endingId, isTrueEnding, artifactNames] of chengTaoCases) {
  const ending = resolveEnding(npc2, [...selectedIds]);
  assert.equal(ending?.id, endingId);
  assert.equal(ending?.isTrueEnding, isTrueEnding);
  assert.deepEqual(ending?.artifacts?.map((artifact) => artifact.name), artifactNames);
}

assert.equal(resolveEnding(npc2, [joinAncestors, undergroundTax]), null);
assert.equal(resolveEnding(npc2, [joinAncestors, undergroundTax, leadDouble, servantFigurine]), null);

console.log("npc logic tests passed");
