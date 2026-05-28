import { useEffect, useState } from "react";
import {
  isSoundMuted,
  setSoundMuted,
  subscribeSoundMuted,
  unlockAudio,
} from "./soundManager";

export default function SoundToggle() {
  const [muted, setMuted] = useState(isSoundMuted);

  useEffect(() => subscribeSoundMuted(setMuted), []);

  const handleToggle = () => {
    unlockAudio();
    setSoundMuted(!muted);
  };

  return (
    <button
      className="sound-toggle-button"
      onClick={handleToggle}
      title={muted ? "开启声音" : "关闭声音"}
      aria-pressed={!muted}
    >
      {muted ? "声音：关" : "声音：开"}
    </button>
  );
}
