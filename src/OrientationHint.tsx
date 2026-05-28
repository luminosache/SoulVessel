import { useEffect, useState } from "react";

const DISMISSED_KEY = "hunping-orientation-hint-dismissed";
const PORTRAIT_MOBILE_QUERY = "(max-width: 900px) and (orientation: portrait)";
const TOUCH_DEVICE_QUERY = "(hover: none) and (pointer: coarse)";
const ROTATE_SYMBOL = "\u27f3";
const TITLE_TEXT = "\u8bf7\u6a2a\u5c4f\u89c2\u770b";
const COPY_TEXT =
  "\u300a\u9b42\u74f6\u300b\u4e3a\u6a2a\u5c4f\u9605\u8bfb\u4e0e\u4e92\u52a8\u8bbe\u8ba1\uff0c\u7ffb\u8f6c\u5c4f\u5e55\u53ef\u83b7\u5f97\u6700\u4f73\u4f53\u9a8c\u3002";
const NOTE_TEXT =
  "\u5982\u679c\u4f60\u4ecd\u60f3\u7ee7\u7eed\uff0c\u4e5f\u53ef\u4ee5\u6682\u65f6\u5173\u95ed\u6b64\u63d0\u793a\u3002";
const BUTTON_TEXT = "\u4ecd\u7136\u7ee7\u7eed";

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function isMobilePortrait() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return (
    window.matchMedia(PORTRAIT_MOBILE_QUERY).matches &&
    window.matchMedia(TOUCH_DEVICE_QUERY).matches
  );
}

export default function OrientationHint() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [shouldShow, setShouldShow] = useState(isMobilePortrait);

  useEffect(() => {
    const updateVisibility = () => {
      setShouldShow(isMobilePortrait());
    };

    updateVisibility();
    window.addEventListener("resize", updateVisibility);
    window.addEventListener("orientationchange", updateVisibility);

    return () => {
      window.removeEventListener("resize", updateVisibility);
      window.removeEventListener("orientationchange", updateVisibility);
    };
  }, []);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // This hint is optional and should never block the game.
    }
    setDismissed(true);
  };

  if (dismissed || !shouldShow) {
    return null;
  }

  return (
    <div
      className="orientation-hint-overlay"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-labelledby="orientation-hint-title"
    >
      <div className="orientation-hint-panel">
        <div className="orientation-hint-symbol" aria-hidden="true">
          {ROTATE_SYMBOL}
        </div>
        <h1 id="orientation-hint-title" className="orientation-hint-title">
          {TITLE_TEXT}
        </h1>
        <p className="orientation-hint-copy">{COPY_TEXT}</p>
        <p className="orientation-hint-note">{NOTE_TEXT}</p>
        <button className="orientation-hint-button" onClick={handleDismiss}>
          {BUTTON_TEXT}
        </button>
      </div>
    </div>
  );
}
