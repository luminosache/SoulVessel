import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  clearTypewriterSnapshots,
  getTypewriterSnapshot,
  getTypewriterReplayKey,
  recordTypewriterSnapshot,
  TYPEWRITER_CONTENT_INTERVAL_MS,
  TYPEWRITER_TITLE_INTERVAL_MS,
} from "./typewriterLogic";

clearTypewriterSnapshots();

const firstRunKey = getTypewriterReplayKey({
  title: "真结局·生前身后",
  content: "同一段结算文字",
  triggerKey: "first-trigger",
});
const secondRunKey = getTypewriterReplayKey({
  title: "真结局·生前身后",
  content: "同一段结算文字",
  triggerKey: "second-trigger",
});

assert.equal(firstRunKey, secondRunKey);
assert.equal(TYPEWRITER_TITLE_INTERVAL_MS, 22);
assert.equal(TYPEWRITER_CONTENT_INTERVAL_MS, 12);

recordTypewriterSnapshot(firstRunKey, {
  typedTitle: "真结局",
  typedContent: "同一段",
  completed: false,
});

assert.deepEqual(getTypewriterSnapshot(secondRunKey), {
  typedTitle: "真结局",
  typedContent: "同一段",
  completed: false,
});

recordTypewriterSnapshot(secondRunKey, {
  typedTitle: "真",
  typedContent: "同",
  completed: false,
});

assert.deepEqual(getTypewriterSnapshot(firstRunKey), {
  typedTitle: "真结局",
  typedContent: "同一段",
  completed: false,
});

const cssPath = fileURLToPath(new URL("./index.css", import.meta.url));
const css = readFileSync(cssPath, "utf8");

assert.match(css, /#right-content-panel p:not\(\.typewriter-content\)/);
assert.match(css, /#left-content-panel p:not\(\.typewriter-content\)/);

const dizzinessKeyframes = css.match(/@keyframes bowingDizziness \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.ok(dizzinessKeyframes.length > 0);
assert.doesNotMatch(dizzinessKeyframes, /\bfilter:/);
assert.doesNotMatch(dizzinessKeyframes, /\btransform:/);
assert.doesNotMatch(css, /will-change:\s*text-shadow,\s*filter,\s*transform/);

console.log("typewriter logic tests passed");
