import assert from "node:assert/strict";

class MockAudio {
  static instances: MockAudio[] = [];

  currentTime = 0;
  loop = false;
  paused = true;
  preload = "";
  src: string;
  volume = 1;
  loadCount = 0;
  pauseCount = 0;
  playCount = 0;
  listeners = new Map<string, () => void>();

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }

  addEventListener(event: string, listener: () => void) {
    this.listeners.set(event, listener);
  }

  load() {
    this.loadCount += 1;
    this.currentTime = 0;
    this.paused = true;
  }

  play() {
    this.playCount += 1;
    return Promise.resolve();
  }

  pause() {
    this.pauseCount += 1;
    this.paused = true;
  }
}

(globalThis as typeof globalThis & { window: object; Audio: typeof MockAudio }).window = {};
(globalThis as typeof globalThis & { window: object; Audio: typeof MockAudio }).Audio = MockAudio;

const {
  isSoundMuted,
  playSound,
  setSoundMuted,
  stopAllLoopingSounds,
  stopSound,
  unlockAudio,
} = await import("./soundManager");

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

playSound("mad");
const madAudio = MockAudio.instances.find((audio) => audio.src === "/audio/mad.mp3");
assert.ok(madAudio);
const madPlayCount = madAudio.playCount;
madAudio.currentTime = 9;
playSound("mad");
assert.equal(madAudio.playCount, madPlayCount);
assert.equal(madAudio.currentTime, 9);

const madLoadCount = madAudio.loadCount;
unlockAudio();
assert.equal(madAudio.loadCount, madLoadCount);
assert.equal(madAudio.currentTime, 9);
stopSound("mad");

const enterAudio = MockAudio.instances.find((audio) => audio.src === "/audio/enter.mp3");
assert.ok(enterAudio);
const enterPauseCount = enterAudio.pauseCount;
setSoundMuted(true);
assert.equal(isSoundMuted(), true);
assert.equal(enterAudio.pauseCount, enterPauseCount + 1);
playSound("enter");

setSoundMuted(false);
assert.equal(isSoundMuted(), false);

console.log("sound manager tests passed");
