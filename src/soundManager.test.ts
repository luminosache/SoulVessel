import assert from "node:assert/strict";
import {
  isSoundMuted,
  playSound,
  setSoundMuted,
  stopAllLoopingSounds,
  stopSound,
  unlockAudio,
} from "./soundManager";

assert.equal(isSoundMuted(), false);

unlockAudio();
playSound("enter");
playSound("choice");
playSound("verdict");
playSound("artifact");
playSound("about");
playSound("mad");
playSound("fill");
stopSound("mad");
stopAllLoopingSounds();

setSoundMuted(true);
assert.equal(isSoundMuted(), true);
playSound("enter");

setSoundMuted(false);
assert.equal(isSoundMuted(), false);

console.log("sound manager tests passed");
