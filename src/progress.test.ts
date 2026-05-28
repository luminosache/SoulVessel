import assert from "node:assert/strict";
import {
  PROGRESS_STORAGE_KEY,
  markJinEndingSeen,
  markTutorialSeen,
  readProgress,
  writeProgress,
} from "./progress";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryStorage();

assert.deepEqual(readProgress(storage), {
  hasSeenJinEnding: false,
  hasSeenTutorial: false,
});

assert.deepEqual(markJinEndingSeen(storage), {
  hasSeenJinEnding: true,
  hasSeenTutorial: false,
});

assert.deepEqual(markTutorialSeen(storage), {
  hasSeenJinEnding: true,
  hasSeenTutorial: true,
});

assert.deepEqual(writeProgress({ hasSeenJinEnding: false }, storage), {
  hasSeenJinEnding: false,
  hasSeenTutorial: true,
});

storage.setItem(PROGRESS_STORAGE_KEY, "{bad json");
assert.deepEqual(readProgress(storage), {
  hasSeenJinEnding: false,
  hasSeenTutorial: false,
});

const throwingStorage = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

assert.deepEqual(readProgress(throwingStorage), {
  hasSeenJinEnding: false,
  hasSeenTutorial: false,
});

assert.deepEqual(markJinEndingSeen(throwingStorage), {
  hasSeenJinEnding: true,
  hasSeenTutorial: false,
});

console.log("progress tests passed");
