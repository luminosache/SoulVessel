export type SoundName = "enter" | "choice" | "verdict" | "artifact" | "about" | "mad" | "fill";

const MUTED_STORAGE_KEY = "hunping-sound-muted";

const SOUND_CONFIG: Record<SoundName, { src: string; volume: number; loop?: boolean }> = {
  enter: { src: "/audio/enter.mp3", volume: 0.24 },
  choice: { src: "/audio/choice.mp3", volume: 0.2 },
  verdict: { src: "/audio/verdict.mp3", volume: 0.28 },
  artifact: { src: "/audio/artifact.mp3", volume: 0.24 },
  about: { src: "/audio/about.mp3", volume: 0.2 },
  mad: { src: "/audio/mad.mp3", volume: 0.09, loop: true },
  fill: { src: "/audio/fill.mp3", volume: 0.22 },
};

const audioElements = new Map<SoundName, HTMLAudioElement>();
const mutedListeners = new Set<(muted: boolean) => void>();
let audioUnlocked = false;
let warnedMissing = new Set<SoundName>();

function canUseBrowserAudio() {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function readStoredMuted() {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

let muted = readStoredMuted();

function getAudio(name: SoundName) {
  if (!canUseBrowserAudio()) return null;

  const existing = audioElements.get(name);
  if (existing) return existing;

  const config = SOUND_CONFIG[name];
  const audio = new Audio(config.src);
  audio.preload = "auto";
  audio.volume = config.volume;
  audio.loop = config.loop === true;
  audio.addEventListener("error", () => {
    if (warnedMissing.has(name)) return;
    warnedMissing.add(name);
    console.warn(`[sound] unable to load ${config.src}`);
  });
  audioElements.set(name, audio);
  return audio;
}

export function unlockAudio() {
  audioUnlocked = true;
  for (const name of Object.keys(SOUND_CONFIG) as SoundName[]) {
    getAudio(name)?.load();
  }
}

export function isSoundMuted() {
  return muted;
}

export function setSoundMuted(nextMuted: boolean) {
  muted = nextMuted;
  try {
    localStorage.setItem(MUTED_STORAGE_KEY, String(nextMuted));
  } catch {
    // Sound preferences are optional and must never affect gameplay.
  }

  if (nextMuted) {
    stopAllLoopingSounds();
  }

  mutedListeners.forEach((listener) => listener(muted));
}

export function subscribeSoundMuted(listener: (muted: boolean) => void) {
  mutedListeners.add(listener);
  return () => {
    mutedListeners.delete(listener);
  };
}

export function playSound(name: SoundName) {
  if (muted) return;

  const audio = getAudio(name);
  if (!audio) return;

  const config = SOUND_CONFIG[name];
  if (config.loop && !audio.paused) return;

  try {
    audio.currentTime = 0;
    audio.volume = config.volume;
    audio.loop = config.loop === true;
    void audio.play().catch(() => {
      if (!audioUnlocked) return;
    });
  } catch {
    // Missing files, unsupported codecs, or autoplay policy failures should stay silent.
  }
}

export function stopSound(name: SoundName) {
  const audio = audioElements.get(name);
  if (!audio) return;
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers may reject currentTime changes before metadata is loaded.
  }
}

export function stopAllLoopingSounds() {
  for (const name of Object.keys(SOUND_CONFIG) as SoundName[]) {
    if (SOUND_CONFIG[name].loop) {
      stopSound(name);
    }
  }
}
