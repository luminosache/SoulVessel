/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { npcScripts } from "./npcData";
import {
  getFillStageFromSelection as getNpcFillStageFromSelection,
  resolveEnding,
  toggleOptionSelection,
} from "./npcLogic";
import type { FillStage } from "./npcLogic";
import { jinNpcData, type JinPath } from "./jinData";
import {
  findFinalPath,
  findPathByChoice1,
  findPathByChoice12,
  getJinDisguiseFillStage,
  isRenderableText,
  renderLeftPanelFromSlots,
  runJinWhiteboxMatrix,
  validateJinData,
} from "./jinLogic";
import {
  getTypewriterSnapshot,
  getTypewriterReplayKey,
  recordTypewriterSnapshot,
  TYPEWRITER_CONTENT_INTERVAL_MS,
  TYPEWRITER_TITLE_INTERVAL_MS,
} from "./typewriterLogic";
import {
  markJinEndingSeen,
  markTutorialSeen,
  readProgress,
} from "./progress";

type ActiveTab = string;
type JinState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const introText = "生人死去，化作幽魂。\n前往泰山府的路上\n能携带的文书\n只有魂瓶上的寥寥数语……";
const completedTypewriterCache = new Set<string>();
const introInscriptions = [
  {
    id: "5805",
    src: "/inscription-5805.png",
    alt: "碑文右上",
    className: "inscription-5805",
  },
  {
    id: "5806",
    src: "/inscription-5806.png",
    alt: "碑文左下",
    className: "inscription-5806",
  },
];

const tutorialSteps = [
  "请先阅读幽魂的自述和携带到你面前的物品。",
  "在此处做出选择，为幽魂制作魂瓶，你所写下的词语将直接被泰山府君阅读。",
  "看到『查看文物』时，可以点击接引下一位。",
];

function renderTextWithBold(text: string) {
  return text.split(/(\*\*.*?\*\*)/g).map((segment, index) => {
    const isBoldToken = segment.startsWith("**") && segment.endsWith("**") && segment.length > 4;
    if (!isBoldToken) {
      return <React.Fragment key={index}>{segment}</React.Fragment>;
    }
    return (
      <strong key={index} className="font-bold text-[#dfcdad]">
        {segment.slice(2, -2)}
      </strong>
    );
  });
}

interface TypewriterParagraphProps {
  title: string;
  content: string;
  delay?: number;
  titleColorClass?: string;
  triggerKey: string;
  onComplete?: () => void;
}

function TypewriterParagraph({
  title,
  content,
  delay = 0,
  titleColorClass = "text-[#a4baba]",
  triggerKey,
  onComplete,
}: TypewriterParagraphProps) {
  const [typedTitle, setTypedTitle] = useState("");
  const [typedContent, setTypedContent] = useState("");
  const [textBoxHeight, setTextBoxHeight] = useState<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const measureRef = useRef<HTMLParagraphElement | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    const measure = () => {
      const nextHeight = measureRef.current?.scrollHeight ?? 0;
      if (nextHeight > 0) {
        setTextBoxHeight(Math.ceil(nextHeight));
      }
    };

    measure();
    window.addEventListener("resize", measure);

    let resizeObserver: ResizeObserver | null = null;
    if (measureRef.current?.parentElement && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(measureRef.current.parentElement);
    }

    return () => {
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
    };
  }, [title, content, titleColorClass]);

  useEffect(() => {
    const cacheKey = getTypewriterReplayKey({ title, content, triggerKey });
    const cachedSnapshot = getTypewriterSnapshot(cacheKey);
    if (completedTypewriterCache.has(cacheKey) || cachedSnapshot?.completed) {
      setTypedTitle(title);
      setTypedContent(content);
      window.setTimeout(() => onCompleteRef.current?.(), 0);
      return;
    }

    const initialTitle = cachedSnapshot?.typedTitle ?? "";
    const initialContent = cachedSnapshot?.typedContent ?? "";

    setTypedTitle(initialTitle);
    setTypedContent(initialContent);

    let cancelled = false;
    const titleLength = title.length;
    const contentLength = content.length;
    const contentStep = Math.max(1, Math.ceil(contentLength / 420));
    const hasCachedProgress = initialTitle.length > 0 || initialContent.length > 0;

    const clearPending = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const typeContent = (contentIdx: number) => {
      if (cancelled) return;
      const nextContentIdx = Math.min(contentLength, contentIdx + contentStep);
      const nextContent = content.slice(0, nextContentIdx);
      setTypedTitle(title);
      setTypedContent(nextContent);
      if (nextContentIdx >= contentLength) {
        recordTypewriterSnapshot(cacheKey, {
          typedTitle: title,
          typedContent: content,
          completed: true,
        });
        completedTypewriterCache.add(cacheKey);
        onCompleteRef.current?.();
        return;
      }
      recordTypewriterSnapshot(cacheKey, {
        typedTitle: title,
        typedContent: nextContent,
        completed: false,
      });
      timeoutRef.current = window.setTimeout(
        () => typeContent(nextContentIdx),
        TYPEWRITER_CONTENT_INTERVAL_MS,
      );
    };

    const typeTitle = (titleIdx: number) => {
      if (cancelled) return;
      const nextTitleIdx = titleIdx + 1;
      const nextTitle = title.slice(0, nextTitleIdx);
      setTypedTitle(nextTitle);
      if (nextTitleIdx >= titleLength) {
        recordTypewriterSnapshot(cacheKey, {
          typedTitle: title,
          typedContent: initialContent,
          completed: false,
        });
        typeContent(initialContent.length);
        return;
      }
      recordTypewriterSnapshot(cacheKey, {
        typedTitle: nextTitle,
        typedContent: initialContent,
        completed: false,
      });
      timeoutRef.current = window.setTimeout(
        () => typeTitle(nextTitleIdx),
        TYPEWRITER_TITLE_INTERVAL_MS,
      );
    };

    timeoutRef.current = window.setTimeout(() => {
      if (initialTitle.length >= titleLength) {
        typeContent(initialContent.length);
        return;
      }
      if (titleLength === 0) {
        typeContent(initialContent.length);
        return;
      }
      typeTitle(initialTitle.length);
    }, hasCachedProgress ? 0 : delay);

    return () => {
      cancelled = true;
      clearPending();
    };
  }, [title, content, delay, triggerKey]);

  return (
    <div
      className="text-box relative w-full overflow-hidden"
      style={textBoxHeight ? { height: `${textBoxHeight}px` } : undefined}
    >
      <p className="typewriter-content leading-relaxed text-justify">
        <strong className={`${titleColorClass} font-bold tracking-widest text-[300%] leading-tight`}>
          {typedTitle}
        </strong>
        {typedTitle && <br />}
        <span className="whitespace-pre-line text-lg font-serif tracking-[0.15em] text-[#8ba2a2] transition-colors duration-300 leading-relaxed block mt-1">
          {typedContent}
        </span>
      </p>

      <p
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 leading-relaxed text-justify"
      >
        <strong className={`${titleColorClass} font-bold tracking-widest text-[300%] leading-tight`}>
          {title}
        </strong>
        <br />
        <span className="whitespace-pre-line text-lg font-serif tracking-[0.15em] text-[#8ba2a2] transition-colors duration-300 leading-relaxed block mt-1">
          {content}
        </span>
      </p>
    </div>
  );
}

interface TypewriterArtifactButtonProps {
  onClick: () => void;
}

function TypewriterArtifactButton({ onClick }: TypewriterArtifactButtonProps) {
  return (
    <button
      onClick={onClick}
      className="font-serif text-xs md:text-sm tracking-[0.4em] text-[#dfcdad] hover:text-[#ffd179] transition-all duration-300 underline underline-offset-8 decoration-[#dfcdad]/40 hover:decoration-[#dfcdad]/80 cursor-pointer animate-fadeIn font-semibold relative flex items-center h-full py-1.5"
      title="查看文物"
    >
      查看文物
    </button>
  );
}

interface TagPageData {
  content: string;
  interpretation: string;
}

interface HangingTagItem {
  name: string;
  pages: TagPageData[];
}

const MINI_PARTICLE_SHAPES = [
  "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)", // trapezoid
  "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)", // irregular pentagon
  "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)", // hexagon-esque
  "polygon(0% 15%, 100% 0%, 85% 100%, 15% 85%)", // skewed quadrilateral
  "polygon(50% 0%, 100% 100%, 0% 100%)", // small sliver triangle
  "polygon(0% 0%, 100% 30%, 70% 100%, 10% 90%)"
];

export default function App() {
  // Intro screen states: "show" | "transitioning" | "done"
  const [introStep, setIntroStep] = useState<"show" | "transitioning" | "done">("show");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isShaking, setIsShaking] = useState(false);
  const [isTombRumbling, setIsTombRumbling] = useState(false);
  const [soilActive, setSoilActive] = useState(false);
  const [soilBlocks, setSoilBlocks] = useState<any[]>([]);
  const [eyeOpening, setEyeOpening] = useState(false);
  const [darkOcclusion, setDarkOcclusion] = useState(0);
  const [progress, setProgress] = useState(() => readProgress());
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (introStep !== "show") return;
    const { clientX, clientY } = e;
    const x = (clientX / window.innerWidth - 0.5) * 2; // scale normalized -1 to 1
    const y = (clientY / window.innerHeight - 0.5) * 2; // scale normalized -1 to 1
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${clientY - rect.top}px`);
    setMousePos({ x, y });
  };

  const handleIntroMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty("--mouse-x", "-999px");
    e.currentTarget.style.setProperty("--mouse-y", "-999px");
  };

  const handleIntroClick = () => {
    if (introStep !== "show") return;
    setIsShaking(true);

    const blocks: any[] = [];
    const waveCount = 4;
    
    // For each of the 4 shovel waves, spawn a beautiful set of flat, fine dark dust specks and flat blocks
    for (let wave = 0; wave < waveCount; wave++) {
      const particlesInWave = 35; // 35 particles per shovel wave
      for (let i = 0; i < particlesInWave; i++) {
        // Position them in clusters or throughout the screen
        const left = Math.random() * 98 + 1;
        const top = Math.random() * 98 + 1;
        // Vary the sizes from tiny specks (2px) to slightly wider clean flat shards (24px)
        const size = Math.random() > 0.4 ? (2 + Math.random() * 7) : (10 + Math.random() * 14); 
        const shape = MINI_PARTICLE_SHAPES[Math.floor(Math.random() * MINI_PARTICLE_SHAPES.length)];

        // Random trajectories (they fly snappily from outside, or fly fast on the screen)
        const angle = Math.random() * 2 * Math.PI;
        const speed = 60 + Math.random() * 120;
        const startX = Math.cos(angle) * speed;
        const startY = Math.sin(angle) * speed;

        // Base wave timing
        const baseDelay = wave * 1000; // wave 0: 0ms, wave 1: 1000ms, wave 2: 2000ms, wave 3: 3000ms
        const randomOffset = Math.random() * 450;
        const duration = 240 + Math.random() * 320; // fast snappy impact

        blocks.push({
          id: `p-${wave}-${i}`,
          wave,
          shape,
          left,
          top,
          width: size,
          height: size,
          startX,
          startY,
          delay: baseDelay + randomOffset,
          duration,
          rotate: Math.random() * 360,
          scale: 0.85 + Math.random() * 0.5,
          opacity: 0.65 + Math.random() * 0.3, // semi-transparent and variable!
          blurAmount: 1.2 + Math.random() * 1.8, // soft lens edge blur
          gradAngle: Math.floor(Math.random() * 360) // unique gradient alignment per speck
        });
      }
    }

    setSoilBlocks(blocks);
    setIntroStep("transitioning");

    // Instantly activate first shovel wave
    setTimeout(() => {
      setSoilActive(true);
      setDarkOcclusion(0.28);
    }, 20);

    // Stop shaking after wave 0
    setTimeout(() => {
      setIsShaking(false);
    }, 550);

    // --- SECOND SHOVEL WAVE (1000ms) ---
    setTimeout(() => {
      setIsShaking(true);
      setDarkOcclusion(0.58);
    }, 1000);
    setTimeout(() => {
      setIsShaking(false);
    }, 1550);

    // --- THIRD SHOVEL WAVE (2000ms) ---
    setTimeout(() => {
      setIsShaking(true);
      setDarkOcclusion(0.84);
    }, 2000);
    setTimeout(() => {
      setIsShaking(false);
    }, 2550);

    // --- FOURTH SHOVEL WAVE (3000ms) ---
    setTimeout(() => {
      setIsShaking(true);
      setDarkOcclusion(1.0); // Completely shut, total occlusion into darkness
    }, 3000);
    setTimeout(() => {
      setIsShaking(false);
    }, 3550);

    // --- SEALEAD VAULT TOMB RUMBLE (3500ms to 5500ms) ---
    // A continuous, deep mechanical rumble right after the final throw covers everything
    setTimeout(() => {
      setIsTombRumbling(true);
    }, 3500);

    // Staggered eye opening start once particles, darkness and tomb rubmle settled completely (5500ms)
    // Satisfies: "鐪肩獥鍔ㄧ敾鎷夐暱鍒?s", beginning at 5500ms and concluding at 10500ms
    setTimeout(() => {
      setIsTombRumbling(false);
      setEyeOpening(true);
    }, 5500);

    // Conclude full sequence exactly at 12.0 seconds (12000ms total)
    setTimeout(() => {
      setIntroStep("done");
      setSoilActive(false);
      setSoilBlocks([]);
      setEyeOpening(false);
      setDarkOcclusion(0);
    }, 12000);
  };

  const [currentNpcIndex, setCurrentNpcIndex] = useState(0);
  const [isLeftTextFading, setIsLeftTextFading] = useState(false);
  const currentNpc = npcScripts[currentNpcIndex];
  const isJinNpc = currentNpc.id === "npc3-jin";

  const [jinState, setJinState] = useState<JinState>(0);
  const [jinChoice1, setJinChoice1] = useState("");
  const [jinChoice2, setJinChoice2] = useState("");
  const [jinChoice3, setJinChoice3] = useState("");
  const [jinLeftSlots, setJinLeftSlots] = useState({
    text1: "",
    text2: "",
    text3: "",
  });
  const [jinRightText1, setJinRightText1] = useState("");
  const [jinRightText2, setJinRightText2] = useState("");
  const [jinRightText3, setJinRightText3] = useState("");
  const [jinShowingEnding, setJinShowingEnding] = useState(false);
  const [jinMatchedPath1, setJinMatchedPath1] = useState<JinPath | null>(null);
  const [jinMatchedPath12, setJinMatchedPath12] = useState<JinPath | null>(null);
  const [jinFinalPath, setJinFinalPath] = useState<JinPath | null>(null);
  const [showJinArtifactOverlay, setShowJinArtifactOverlay] = useState(false);
  const [isJinIntroPlaying, setIsJinIntroPlaying] = useState(false);
  const [jinVesselFillStage, setJinVesselFillStage] = useState<FillStage>(0);
  const [isJinVesselDissipating, setIsJinVesselDissipating] = useState(false);
  const hasPlayedJinIntroRef = useRef(false);
  const skipJinIntroDelayRef = useRef(false);

  const jinTaintedChoiceId = jinNpcData.round_1.options[0]?.option_id ?? "";
  const jinDisguiseChoiceId =
    jinNpcData.round_1.options.find((option) => option.text === "潜伏伪装")?.option_id ??
    jinNpcData.round_1.options[1]?.option_id ??
    "";
  const jinLeftRenderedLines = renderLeftPanelFromSlots(jinLeftSlots);
  const jinRightNarrativeLines = [jinRightText1, jinRightText2, jinRightText3].filter(
    isRenderableText,
  );
  const jinArtifacts = jinFinalPath?.artifacts ?? [];
  const jinPrimaryArtifact = jinArtifacts[0] ?? null;
  const canShowJinArtifact = jinState === 7 && jinArtifacts.length > 0;
  const jinLeftPanelTitle = isJinNpc && jinState >= 2 ? "后世评价" : currentNpc.subtitle;
  const jinWhiteboxRows = useMemo(() => runJinWhiteboxMatrix(jinNpcData), []);
  const [showAboutAuthorPlaceholder, setShowAboutAuthorPlaceholder] = useState(false);

  // Hanging interactive items panel states
  const [selectedTagIdx, setSelectedTagIdx] = useState<number>(0);
  const [tagPage, setTagPage] = useState<number>(0);

  // Currently displayed text on the left panel (editorial view)
  const [activeDisplayTab, setActiveDisplayTab] = useState<ActiveTab>("");

  // Relic touch vibration tactile trigger
  const [vibrateTrigger, setVibrateTrigger] = useState(false);

  // Relic water ripple waves trigger
  const [rippleTrigger, setRippleTrigger] = useState(false);

  // Floating artifact museum viewer overlay state
  const [showArtifactOverlay, setShowArtifactOverlay] = useState(false);
  const [artifactPageIndex, setArtifactPageIndex] = useState(0);

  // Multi-selectable toggle buttons for the bottom options
  const [selectedTabs, setSelectedTabs] = useState<ActiveTab[]>([]);
  const [settlementRunId, setSettlementRunId] = useState(0);
  const [endingActionsVisible, setEndingActionsVisible] = useState(false);
  const previousSelectedCountRef = useRef(0);

  // Dissipation states for the slow energy fade-out animation
  const [isDissipating, setIsDissipating] = useState(false);
  const [visualFillStage, setVisualFillStage] = useState<FillStage>(0);

  // Core locked parameters confirmed by user:
  // - Preset: 瀹垮￥ (B)
  // - Breathing: 6s
  // - Gold Thickness (density): 80% (0.80)
  // - White border widened by 50% -> glowIntensity factor is 1.5 (yielding outline stroke of 1.8)
  const pulseSpeed = 6; 
  const glowIntensity = 1.5; 
  const goldDensity = 0.8; 
  const goldEdition = "B"; // Scheme B (瀹垮￥鏈辩爞)

  const optionSlots = currentNpc.options.map((option) => ({ tag: option.id }));
  const isTwoRowOptions = currentNpc.options.length > 4;
  const isChengtaoNpc = currentNpc.id === "npc2-chengtao";
  const chengtaoTextOptionIds = isChengtaoNpc
    ? currentNpc.options.filter((option) => option.kind === "text").map((option) => option.id)
    : [];
  const chengtaoItemOptionIds = isChengtaoNpc
    ? currentNpc.options.filter((option) => option.kind === "item").map((option) => option.id)
    : [];
  const optionByTab = Object.fromEntries(
    currentNpc.options.map((option) => [option.id, option])
  ) as Record<ActiveTab, (typeof currentNpc.options)[number]>;
  const requiredSelectionCount =
    currentNpc.requiredTextSelections + currentNpc.requiredItemSelections;
  const leftPanelLines = isJinNpc ? jinLeftRenderedLines : currentNpc.biography.split("\n\n");
  const hangingTagsData: HangingTagItem[] = currentNpc.carryItems.map((item) => ({
    name: item.name,
    pages: [
      {
        content: item.content,
        interpretation: item.translation ?? "",
      },
    ],
  }));

  useEffect(() => {
    setSelectedTagIdx(0);
    setTagPage(0);
    setArtifactPageIndex(0);
    setActiveDisplayTab(currentNpc.options[0]?.id ?? "");
  }, [currentNpcIndex, currentNpc.options]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const validation = validateJinData(jinNpcData);
    if (!validation.ok) {
      console.error("[jin] data validation failed", validation.errors);
    } else {
      console.log("[jin] data validation passed");
    }

    const tableRows = jinWhiteboxRows.map((row) => ({
      path_id: row.path_id,
      choice_1: row.choice_1,
      choice_2: row.choice_2,
      choice_3: row.choice_3,
      final_result_title: row.final_result_title,
      artifacts: row.artifacts ? "yes" : "no",
      pass_fail: row.pass ? "pass" : "fail",
      issue: row.issue,
    }));
    console.table(tableRows);
  }, [jinWhiteboxRows]);

  useEffect(() => {
    const leftPanel = document.getElementById("left-content-panel");

    if (isJinNpc) {
      document.body.classList.add("jin-active");
      document.body.classList.add("jin-warning-mode");
      initializeJinFlow();
      leftPanel?.classList.remove("tainted-state");
      return;
    }

    document.body.classList.remove("jin-active");
    document.body.classList.remove("jin-warning-mode");
    leftPanel?.classList.remove("tainted-state");
  }, [isJinNpc, currentNpcIndex]);

  useEffect(() => {
    if (!isJinNpc) return;
    if (jinState !== 0) return;

    setJinLeftSlots({
      text1: jinNpcData.background_texts.confession,
      text2: "",
      text3: "",
    });
    setJinRightText1(jinNpcData.background_texts.petition);
    setJinRightText2("");
    setJinRightText3("");
    setJinShowingEnding(false);

    if (skipJinIntroDelayRef.current) {
      skipJinIntroDelayRef.current = false;
      setJinState(1);
      return;
    }

    const timer = window.setTimeout(() => {
      setJinState(1);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [isJinNpc, jinState]);

  // Toggle selection for bottom options
  const handleTabToggle = (tag: ActiveTab) => {
    const optionId = optionByTab[tag]?.id;
    if (!optionId) return;
    const selectedOptionIds = selectedTabs;
    const nextSelectedOptionIds = toggleOptionSelection(currentNpc, selectedOptionIds, optionId);

    if (nextSelectedOptionIds === selectedOptionIds) return;

    setVibrateTrigger(false);
    setRippleTrigger(false);
    setTimeout(() => {
      setVibrateTrigger(true);
      setRippleTrigger(true);
    }, 12);

    setActiveDisplayTab(tag);
    setSelectedTabs(nextSelectedOptionIds);
  };

  const setJinTaintedState = (enabled: boolean) => {
    const leftPanel = document.getElementById("left-content-panel");
    if (!leftPanel) return;
    if (enabled) {
      leftPanel.classList.add("tainted-state");
    } else {
      leftPanel.classList.remove("tainted-state");
    }
  };


  useEffect(() => {
    if (isJinNpc && jinState === 0 && !hasPlayedJinIntroRef.current && !skipJinIntroDelayRef.current) {
      setIsJinIntroPlaying(true);
      hasPlayedJinIntroRef.current = true;
      setTimeout(() => {
        setIsJinIntroPlaying(false);
      }, 7000);
    }
    if (!isJinNpc) {
      hasPlayedJinIntroRef.current = false;
      setIsJinIntroPlaying(false);
    }
  }, [isJinNpc, jinState]);

  const initializeJinFlow = (options?: { skipIntroDelay?: boolean }) => {
    skipJinIntroDelayRef.current = options?.skipIntroDelay ?? false;
    setShowAboutAuthorPlaceholder(false);
    setShowJinArtifactOverlay(false);
    setJinState(0);
    setJinChoice1("");
    setJinChoice2("");
    setJinChoice3("");
    setJinLeftSlots({ text1: "", text2: "", text3: "" });
    setJinRightText1("");
    setJinRightText2("");
    setJinRightText3("");
    setJinShowingEnding(false);
    setJinMatchedPath1(null);
    setJinMatchedPath12(null);
    setJinFinalPath(null);
    setJinVesselFillStage(0);
    setIsJinVesselDissipating(false);
    setJinTaintedState(false);
  };

  const handleJinRound1Select = (optionId: string) => {
    const matched = findPathByChoice1(jinNpcData, optionId);
    if (!matched) return;

    setJinChoice1(optionId);
    setJinMatchedPath1(matched);
    setJinLeftSlots({
      text1: matched.text_1_left,
      text2: "",
      text3: "",
    });
    setJinRightText1(matched.text_1_right);
    setJinRightText2("");
    setJinRightText3("");
    setJinShowingEnding(false);
    setJinState(3);
    setJinVesselFillStage(getJinDisguiseFillStage(optionId, "", "", jinDisguiseChoiceId));
    setIsJinVesselDissipating(false);

    const isTainted = optionId === jinTaintedChoiceId;
    setJinTaintedState(isTainted);
  };

  const handleJinRound2Select = (optionId: string) => {
    if (!jinChoice1) return;
    const matched = findPathByChoice12(jinNpcData, jinChoice1, optionId);
    if (!matched) return;

    setJinChoice2(optionId);
    setJinMatchedPath12(matched);
    setJinRightText2(matched.text_2_right_neutral);
    setJinLeftSlots((prev) => ({
      ...prev,
      text2: matched.text_2_left_neutral,
    }));
    setJinState(5);
    setJinVesselFillStage(getJinDisguiseFillStage(jinChoice1, optionId, "", jinDisguiseChoiceId));
  };

  const handleJinRound3Select = (optionId: string) => {
    if (!jinChoice1 || !jinChoice2) return;
    const finalPath = findFinalPath(jinNpcData, jinChoice1, jinChoice2, optionId);
    if (!finalPath) return;

    setJinChoice3(optionId);
    setJinFinalPath(finalPath);

    // state 6: replace first, then append
    setJinRightText2(finalPath.text_2_right);
    setJinLeftSlots((prev) => ({
      ...prev,
      text2: finalPath.text_2_left,
    }));

    setJinRightText3(finalPath.text_3_right);
    setJinLeftSlots((prev) => ({
      ...prev,
      text3: finalPath.text_3_left,
    }));
    setJinShowingEnding(false);
    setJinState(6);
    setJinVesselFillStage(
      getJinDisguiseFillStage(jinChoice1, jinChoice2, optionId, jinDisguiseChoiceId),
    );
  };

  const handleJinViewEnding = () => {
    if (jinState !== 6 || !jinFinalPath) return;
    setJinShowingEnding(true);
    setJinState(7);
    setProgress(markJinEndingSeen());
  };

  const handleJinBackToNarrative = () => {
    if (jinState !== 7) return;
    if (jinVesselFillStage > 0) {
      setIsJinVesselDissipating(true);
      window.setTimeout(() => {
        initializeJinFlow({ skipIntroDelay: true });
      }, 650);
      return;
    }
    initializeJinFlow({ skipIntroDelay: true });
  };

  const handleJinOpenArtifactOverlay = () => {
    if (!canShowJinArtifact) return;
    setShowJinArtifactOverlay(true);
  };

  const handleJinCloseArtifactOverlay = () => {
    setShowJinArtifactOverlay(false);
  };

  const fillStage = getNpcFillStageFromSelection(selectedTabs.length);

  // Synchronize visual stage except when in active dissipation
  useEffect(() => {
    if (!isDissipating) {
      setVisualFillStage(fillStage);
    }
  }, [fillStage, isDissipating]);

  // Map fill stage to SVG Y coordinate and height inside our 300x450 viewBox
  const getFillMetrics = (stage: FillStage) => {
    switch (stage) {
      case 0: // Empty / Not Glowing / 0%
        return { y: 420, height: 0, particleOpacity: 0, percentLabel: "0%" };
      case 1: // Low Fill / 30%
        return { y: 324, height: 100, particleOpacity: 0.45, percentLabel: "30%" };
      case 2: // Mid Fill / 60%
        return { y: 232, height: 192, particleOpacity: 0.8, percentLabel: "60%" };
      case 3: // Full Fill / 100%
        return { y: 112, height: 310, particleOpacity: 1.0, percentLabel: "100%" };
      default:
        return { y: 420, height: 0, particleOpacity: 0, percentLabel: "0%" };
    }
  };

  const selectedCount = selectedTabs.length;
  const isJinDisguiseVesselActive =
    isJinNpc && (jinVesselFillStage > 0 || isJinVesselDissipating);
  const vesselFillStage = isJinDisguiseVesselActive ? jinVesselFillStage : visualFillStage;
  const vesselFillCount = vesselFillStage;
  const isVesselDissipating = isJinDisguiseVesselActive
    ? isJinVesselDissipating
    : isDissipating;
  const vesselRequiredSelectionCount = isJinDisguiseVesselActive ? 3 : requiredSelectionCount;
  const { y: yPosition, height: heightValue, particleOpacity, percentLabel } = getFillMetrics(vesselFillStage);

  useEffect(() => {
    if (
      previousSelectedCountRef.current < requiredSelectionCount &&
      selectedCount >= requiredSelectionCount
    ) {
      setSettlementRunId((current) => current + 1);
    }
    previousSelectedCountRef.current = selectedCount;
  }, [selectedCount, requiredSelectionCount]);

  const soulVaseOpacity = vesselFillCount === 0 ? 0.35
                        : vesselFillCount === 1 ? 0.60
                        : vesselFillCount === 2 ? 0.85
                        : 1.0;

  const soulVaseFilter = vesselFillCount >= vesselRequiredSelectionCount
    ? "drop-shadow(0 0 40px rgba(180, 190, 200, 0.4))"
    : "drop-shadow(0 0 20px rgba(180, 190, 200, 0.15))";

  const triggerKey = `${activeDisplayTab}-${selectedCount}-${settlementRunId}`;
  const selectedOptionIds = selectedTabs;
  const currentEnding = resolveEnding(currentNpc, selectedOptionIds);
  const currentArtifacts = currentEnding?.artifacts ?? [];
  const currentArtifact = currentArtifacts[artifactPageIndex] ?? null;
  const isTrueEnding = currentEnding?.isTrueEnding === true;
  const hasNextNpc = currentNpcIndex < npcScripts.length - 1;
  const canGuideNext = isTrueEnding && hasNextNpc;
  const showExplanationHeading = currentNpc.id !== "npc2-chengtao";
  const canShowStandardEndingActions =
    Boolean(currentEnding) && endingActionsVisible && !isDissipating;
  const canShowUnlockedFeatures = progress.hasSeenJinEnding;
  const shouldShowTutorialOverlay =
    introStep === "done" &&
    currentNpc.id === "npc1-jing" &&
    !progress.hasSeenTutorial &&
    !showArtifactOverlay &&
    !showAboutAuthorPlaceholder;

  const resetStandardNpcView = () => {
    setShowArtifactOverlay(false);
    setSelectedTabs([]);
    setActiveDisplayTab("");
    setVisualFillStage(0);
    setIsDissipating(false);
    setSettlementRunId(0);
    setEndingActionsVisible(false);
    previousSelectedCountRef.current = 0;
  };

  const enterNpcFromCover = (npcIndex: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIntroStep("done");
    setSoilActive(false);
    setSoilBlocks([]);
    setEyeOpening(false);
    setDarkOcclusion(0);
    setIsShaking(false);
    setIsTombRumbling(false);
    setShowAboutAuthorPlaceholder(false);
    resetStandardNpcView();
    setCurrentNpcIndex(npcIndex);

    if (npcScripts[npcIndex]?.id === "npc3-jin") {
      initializeJinFlow({ skipIntroDelay: true });
    }
  };

  const handleOpenAboutGame = () => {
    setShowAboutAuthorPlaceholder(true);
  };

  const handleReturnToCover = () => {
    setShowAboutAuthorPlaceholder(false);
    setIntroStep("show");
  };

  const completeTutorial = () => {
    setProgress(markTutorialSeen());
  };

  const handleTutorialNext = () => {
    if (tutorialStepIndex >= tutorialSteps.length - 1) {
      completeTutorial();
      return;
    }
    setTutorialStepIndex((index) => index + 1);
  };

  useEffect(() => {
    setArtifactPageIndex(0);
  }, [currentEnding?.id]);

  useEffect(() => {
    setEndingActionsVisible(false);
  }, [currentEnding?.id, triggerKey]);

  const handleGuideNextNpc = () => {
    if (!canGuideNext) return;

    setShowArtifactOverlay(false);
    setSelectedTabs([]);
    setActiveDisplayTab("");
    setVisualFillStage(0);
    setIsDissipating(false);
    previousSelectedCountRef.current = 0;
    setIsLeftTextFading(true);

    window.setTimeout(() => {
      setCurrentNpcIndex((index) => Math.min(index + 1, npcScripts.length - 1));
      setIsLeftTextFading(false);
    }, 420);
  };

  const pagePeelVariants = {
    initial: {
      clipPath: "polygon(-10% -10%, 150% -10%, 150% 150%, -10% 150%)",
      opacity: 1,
      scale: 1,
      rotate: 0,
      x: 0,
      y: 0,
      transformOrigin: "top left",
    },
    animate: {
      clipPath: "polygon(-10% -10%, 150% -10%, 150% 150%, -10% 150%)",
      opacity: 1,
      scale: 1,
      rotate: 0,
      x: 0,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    },
    exit: {
      clipPath: "polygon(-10% -10%, 150% -10%, -10% -10%, -10% 150%)",
      opacity: 0,
      rotate: -3.5,
      scale: 0.96,
      x: -120,
      y: -120,
      transition: { duration: 1.4, ease: [0.25, 1, 0.35, 1] }
    }
  };

  const renderOptionCard = (tag: ActiveTab, extraClass = "") => {
    const option = optionByTab[tag];
    if (!option) return null;
    const isSelected = selectedTabs.includes(tag);

    return (
      <div
        key={tag}
        onClick={() => handleTabToggle(tag)}
        className={`cursor-pointer flex flex-col items-center group relative py-3 select-none ${isTwoRowOptions ? "option-slot" : ""} ${extraClass}`}
        id={`tab-visual-${tag}`}
      >
        {option.description && (
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-[10px] tracking-[0.18em] text-[#819595]/0 group-hover:text-[#9bb1b1]/80 transition-colors duration-300 pointer-events-none">
            {option.description}
          </span>
        )}

        <span
          className={`font-serif text-sm tracking-[0.25em] transition-all duration-300 ${
            isSelected ? "text-[#dfcdad] scale-[1.03] font-medium" : "text-[#6c7f7f] hover:text-[#b2caca]"
          }`}
        >
          {option.label}
        </span>

        <div className="relative mt-3 h-[2px] w-24">
          <div
            className={`absolute left-1/2 -translate-x-1/2 h-full transition-all duration-300 ${
              isSelected ? "w-0 opacity-0 bg-transparent" : "w-0 group-hover:w-20 bg-[#6d7e7e]/70 opacity-100"
            }`}
          />
          <div
            className={`absolute left-1/2 -translate-x-1/2 h-[2px] transition-all duration-300 ${
              isSelected
                ? "w-20 bg-[#dfcdad] opacity-100 shadow-[0_1px_6px_rgba(223,205,173,0.7)]"
                : "w-0 opacity-0 bg-transparent"
            }`}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ================= 2.1 INTRO SCREEN ELEMENT AT THE VERY TOP OF BODY-LAND ================= */}
      {introStep !== "done" && (
        <div
          id="intro-screen"
          onClick={handleIntroClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleIntroMouseLeave}
          className={`fixed inset-0 z-[99999] overflow-hidden bg-[#1a1a1a] flex flex-col items-center justify-center cursor-pointer select-none ${
            isShaking ? "animate-earth-shake" : isTombRumbling ? "animate-tomb-rumble" : ""
          }`}
          style={{
            "--mouse-x": "-999px",
            "--mouse-y": "-999px",
            opacity: eyeOpening ? 0 : 1,
            pointerEvents: eyeOpening ? "none" : "auto",
            transition: eyeOpening ? "opacity 5000ms cubic-bezier(0.16, 1, 0.3, 1)" : "none"
          } as React.CSSProperties}
        >
          <style>{`
            .inscription-container {
              position: absolute;
              inset: 0;
              z-index: 5;
              pointer-events: none;
            }

            .inscription-image {
              position: absolute;
              height: min(58vh, 760px);
              width: auto;
              max-width: 46vw;
              object-fit: contain;
              user-select: none;
            }

            .inscription-5805 .inscription-image {
              left: 50%;
              top: 50%;
              transform: translate(calc(-50% + 30vw), calc(-50% - 20vh));
            }

            .inscription-5806 .inscription-image {
              left: 50%;
              top: 50%;
              transform: translate(calc(-50% - 30vw), calc(-50% + 20vh));
            }

            .inscription-base {
              opacity: 0.06;
            }

            .inscription-light-mask {
              position: absolute;
              inset: 0;
              -webkit-mask-image: radial-gradient(circle 120px at var(--mouse-x, -999px) var(--mouse-y, -999px), black 0%, rgba(0,0,0,0.5) 40%, transparent 100%);
              mask-image: radial-gradient(circle 120px at var(--mouse-x, -999px) var(--mouse-y, -999px), black 0%, rgba(0,0,0,0.5) 40%, transparent 100%);
              -webkit-mask-repeat: no-repeat;
              mask-repeat: no-repeat;
              transition: -webkit-mask-position 0.1s ease, mask-position 0.1s ease;
            }

            .inscription-lit {
              opacity: 0.96;
              filter: drop-shadow(0 0 8px rgba(255, 200, 0, 0.6)) sepia(1) saturate(5) hue-rotate(15deg);
            }
          `}</style>

          {/* Base charcoal black backdrop with parallax shift */}
          <div
            id="intro-bg"
            className="absolute inset-[-40px] z-0 bg-gradient-to-b from-[#1c1d1d] via-[#121414] to-[#0a0c0c]"
            style={{
              transform: introStep === "transitioning" 
                ? "scale(1.75)" 
                : `scale(1.05) translate(${mousePos.x * -12}px, ${mousePos.y * -12}px)`,
              filter: introStep === "transitioning" ? "brightness(0.04) contrast(1.2)" : "brightness(1) contrast(1)",
              opacity: introStep === "transitioning" ? 0 : 1,
              transition: introStep === "transitioning" 
                ? "transform 12000ms cubic-bezier(0.16, 1, 0.3, 1), filter 12000ms cubic-bezier(0.16, 1, 0.3, 1), opacity 12000ms cubic-bezier(0.16, 1, 0.3, 1)" 
                : "transform 350ms cubic-bezier(0.25, 1, 0.5, 1)"
            }}
          />

          {/* Secondary depth layer: Fine organic charcoal fiber texture with differential parallax ratio */}
          <div 
            className="absolute inset-[-60px] pointer-events-none opacity-[0.035] mix-blend-color-dodge z-[1]"
            style={{
              transform: introStep === "transitioning"
                ? "scale(1.95)"
                : `scale(1.08) translate(${mousePos.x * -6}px, ${mousePos.y * -6}px)`,
              transition: introStep === "transitioning"
                ? "transform 12000ms cubic-bezier(0.16, 1, 0.3, 1)"
                : "transform 400ms cubic-bezier(0.25, 1, 0.5, 1)"
            }}
          >
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <filter id="charcoal-depth-noise">
                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
                <feColorMatrix type="matrix" values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  1 0 0 0 0" />
              </filter>
              <rect width="100%" height="100%" filter="url(#charcoal-depth-noise)" />
            </svg>
          </div>

          {/* Tertiary layer: Warm faint lantern glow following the cursor */}
          <div
            className="absolute inset-0 pointer-events-none mix-blend-color-dodge z-[2]"
            style={{
              background: `radial-gradient(circle 420px at ${50 + mousePos.x * 22.5}% ${50 + mousePos.y * 22.5}%, rgba(223, 205, 173, 0.22) 0%, rgba(223, 205, 173, 0.08) 50%, transparent 100%)`,
              opacity: introStep === "transitioning" ? Math.max(0, 1 - darkOcclusion) : 1,
              transition: introStep === "transitioning" ? "opacity 1200ms cubic-bezier(0.25, 1, 0.5, 1)" : "none"
            }}
          />

          {/* Progressive dirt occlusion layer representing the accumulated coverage sealing everything in total darkness */}
          <div
            className="absolute inset-0 bg-black z-[3] pointer-events-none"
            style={{
              opacity: darkOcclusion,
              transition: "opacity 1200ms cubic-bezier(0.25, 1, 0.5, 1)"
            }}
          />

          {/* ================= FLAT CRUMB PARTICLES LAYER ================= */}
          {soilBlocks.map((block) => (
            <div
              key={block.id}
              className="absolute pointer-events-none"
              style={{
                left: `${block.left}%`,
                top: `${block.top}%`,
                width: `${block.width}px`,
                height: `${block.height}px`,
                clipPath: block.shape,
                background: `linear-gradient(${block.gradAngle}deg, #070707 0%, #1e1208 60%, #301b0f 100%)`,
                transform: soilActive
                  ? `translate(0px, 0px) rotate(${block.rotate}deg) scale(${block.scale})`
                  : `translate(${block.startX}px, ${block.startY}px) rotate(0deg) scale(0.1)`,
                opacity: soilActive ? block.opacity : 0,
                filter: `blur(${block.blurAmount}px)`,
                transition: `transform ${block.duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${block.delay}ms, opacity ${block.duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${block.delay}ms`,
                transformOrigin: "center center",
                zIndex: 4,
              }}
            />
          ))}

          {introInscriptions.map((inscription) => (
            <div
              key={inscription.id}
              className={`inscription-container ${inscription.className}`}
              aria-hidden="true"
              style={{
                opacity: introStep === "transitioning" ? Math.max(0, 1 - darkOcclusion * 1.25) : 1,
                transition: introStep === "transitioning" ? "opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1)" : "none"
              }}
            >
              <img className="inscription-base inscription-image" src={inscription.src} alt={`${inscription.alt}底层`} />
              <div className="inscription-light-mask">
                <img className="inscription-lit inscription-image" src={inscription.src} alt={`${inscription.alt}亮层`} />
              </div>
            </div>
          ))}

          <div
            className="absolute inset-0 z-[6] pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 260px 430px at 50% 48%, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.2) 45%, transparent 72%)",
              opacity: introStep === "transitioning" ? Math.max(0, 1 - darkOcclusion * 1.25) : 1,
              transition: introStep === "transitioning" ? "opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1)" : "none"
            }}
          />

          {/* Text/prose elements wrapper */}
          <div 
            className="relative z-10 flex flex-col items-center justify-center space-y-12 px-6 h-full max-h-[640px] w-full"
            style={{
              opacity: introStep === "transitioning" ? Math.max(0, 1 - darkOcclusion * 1.25) : 1,
              transition: introStep === "transitioning" ? "opacity 1000ms cubic-bezier(0.16, 1, 0.3, 1)" : "none"
            }}
          >
            {/* Elegant vertical Songti/Serif prose text */}
            <div
              className="font-serif text-[#b6c2c2]/85 text-sm md:text-base tracking-[0.45em] select-none text-center"
              style={{
                writingMode: "vertical-rl",
                whiteSpace: "pre-line",
                fontSize: "clamp(20px, 2.1vw, 28px)",
                lineHeight: "3.15",
                letterSpacing: "0.18em",
                maxHeight: "min(58vh, 560px)",
                maxWidth: "min(28vw, 360px)",
                textShadow: "0 0 10px rgba(180, 200, 200, 0.26), 0 0 28px rgba(0, 0, 0, 0.85)",
              }}
            >
              {introText}
            </div>

            {/* Blinking start indicator positioned absolutely lower on the page */}
            <div
              className="fixed bottom-[8vh] left-1/2 -translate-x-1/2 font-serif tracking-[0.3em] text-[#637575] animate-pulse select-none whitespace-nowrap"
              style={{
                fontSize: "clamp(12px, 1.05vw, 16px)",
                lineHeight: "1.8",
                textShadow: "0 0 8px rgba(120, 145, 145, 0.22), 0 0 18px rgba(0, 0, 0, 0.75)",
              }}
            >
              —点击任意处开始游戏—
            </div>

            {canShowUnlockedFeatures && introStep === "show" && (
              <div className="fixed bottom-[15vh] left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 cursor-default">
                {npcScripts.map((npc, index) => (
                  <button
                    key={`cover-shortcut-${npc.id}`}
                    onClick={(event) => enterNpcFromCover(index, event)}
                    className="font-serif text-xs tracking-[0.3em] text-[#9bb1b1] hover:text-[#dfcdad] border border-[#637575]/25 hover:border-[#dfcdad]/45 bg-[#0d0f0f]/45 hover:bg-[#131616]/80 px-4 py-2 transition-all duration-300 cursor-pointer"
                    title={`进入${npc.name}`}
                  >
                    {npc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main UI display */}
      <div
        className={`w-full min-w-[1440px] min-h-screen bg-[#3b4343] flex flex-col relative overflow-hidden text-[#e2e6e6] select-none ${
          introStep === "done" ? "animate-fadeIn" : ""
        }`}
        id="soul-bottle-root"
        style={{
          display: (introStep === "done" || introStep === "transitioning") ? "flex" : "none",
          clipPath: introStep === "transitioning"
            ? (eyeOpening ? "ellipse(135% 135% at 50% 45%)" : "ellipse(100% 0% at 50% 45%)")
            : "none",
          transition: introStep === "transitioning" ? "clip-path 5000ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
        }}
      >

      {canShowUnlockedFeatures && !showAboutAuthorPlaceholder && (
        <button
          onClick={handleOpenAboutGame}
          className="fixed right-16 bottom-32 z-[80] font-serif text-xs tracking-[0.28em] text-[#f2d08a] hover:text-[#ffe1a3] border border-[#8a6a32]/55 hover:border-[#c89b4a]/80 bg-[#0d0f0f]/50 hover:bg-[#131616]/90 px-4 py-2 transition-all duration-300 cursor-pointer shadow-[0_0_18px_rgba(138,106,50,0.12)]"
          title="关于本游戏"
        >
          关于本游戏
        </button>
      )}

      {/* Cinematic Intro Overlay for Jin Chengze */}
      {isJinNpc && isJinIntroPlaying && (
        <div className="fixed inset-0 z-[100] bg-[#0d0f0f] flex items-center justify-center animate-fadeIn">
          <div className="cinematic-title font-serif text-[#9bb1b1] text-6xl tracking-[1.2em] opacity-0 animate-cinematicIntro">
            泰山府悬案
          </div>
        </div>
      )}

      {/* Subtle paper rubbing noise background layer across the entire screen */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none z-0 mix-blend-overlay">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="coarse-rubbing">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.9   0 0 0 0 0.9   0 0 0 0 0.9  1 0 0 0 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#coarse-rubbing)" />
        </svg>
      </div>

      {/* ================= DUAL-COLUMN VIEWPORT LAYOUT with FLOATING CENTERPIECE ================= */}
      <div className={`flex-1 w-full min-w-[1440px] flex flex-row relative z-10 min-h-[calc(100vh-100px)] ${isChengtaoNpc ? "chengtao-main-stage" : ""}`}>
        
        {/* ================= EXTRA: SHADOW DIVISION INTERSECT BETWEEN COLUMNS ================= */}
        {/* Adds back the gorgeous vertical ambient dark shadow fading to both sides */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0 z-15 pointer-events-none block">
          {/* Left-directed soft shadow */}
          <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-[#0e1111]/85 to-transparent" />
          {/* Right-directed soft shadow */}
          <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-[#0e1111]/95 to-transparent" />
          {/* Center sharp partition line */}
          <div className="absolute -left-[1px] top-0 bottom-0 w-[2px] bg-[#1a2020]/30" />
        </div>

        {/* ================= 1. LEFT COLUMN: CLASSICAL PROSE TEXT (50% WIDTH) ================= */}
        {/* Widen standard right padding to guarantee no textual content is ever blocked by the central scaled bottle */}
        <section
          id="left-content-panel" className={`w-1/2 flex flex-col justify-between py-20 pl-16 pr-36 z-10 box-border bg-[#3b4343] relative animate-fadeIn animate-duration-500 ${isJinNpc && isJinIntroPlaying ? "opacity-0" : "opacity-100"}`}
        >
          <div className="h-4" />

          {/* Horizontal Left-Aligned Classical Prose Text */}
          <div
            className={`flex-1 flex flex-col justify-center py-6 space-y-10 animate-fadeIn w-full max-w-[760px] transition-opacity duration-500 ${
              isLeftTextFading ? "opacity-0" : "opacity-100"
            }`}
            id="left-text-panel"
          >
            
            <div className="space-y-3">
              <span className="font-serif tracking-[0.4em] text-[#9bb1b1] block text-[300%] leading-none">
                {isJinNpc ? jinLeftPanelTitle : currentNpc.subtitle}
              </span>
              <div className="h-[1px] w-14 bg-[#8da4a4]/40" />
            </div>

            {/* Dynamic scripture prose block */}
            <div className="space-y-8" id="classical-prose-verses">
              {leftPanelLines.map((line, idx) => (
                <p
                  key={isJinNpc ? `jin-left-${idx}-${line}` : idx}
                  className={`font-serif text-xl tracking-[0.25em] text-[#e2e6e6] leading-relaxed text-left transition-all duration-300 whitespace-pre-line ${isJinNpc ? "fade-in-slow text-fade-in" : ""}`}
                >
                  {renderTextWithBold(line)}
                </p>
              ))}
            </div>


          </div>

          {/* ================= NEW INTERACTIVE TAGS & OPTIONS SECTION ================= */}
          {/* Elegant layout, stays perfectly inside the left panel color and border bounds */}
          {!isJinNpc && (
            <div className="mt-8 pt-8 border-t border-[#525e5e]/25 space-y-4" id="interactive-relic-tags-section">
            
            {/* Interactive Dual Hanging Cards display and descriptions */}
            <div className="grid grid-cols-2 gap-4">
              {hangingTagsData.map((tag, idx) => {
                const isActive = selectedTagIdx === idx;
                
                return (
                  <div
                    key={idx}
                    onClick={() => { setSelectedTagIdx(idx); setTagPage(0); }}
                    className={`group relative cursor-pointer py-4 px-4 rounded transition-all duration-300 text-center select-none border box-border ${
                      isActive
                        ? "bg-gradient-to-br from-[#2f3939] to-[#202727] border-[#dfcdad]/60 shadow-[inset_0_0_12px_rgba(3,4,4,0.35)] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)]"
                        : "bg-gradient-to-br from-[#293232]/40 to-[#1e2424]/40 border-[#525e5e]/25 hover:border-[#dfcdad]/30 shadow-sm"
                    }`}
                    id={`tag-a-${idx}`}
                  >
                    <h4 className={`font-serif text-sm tracking-widest leading-none transition-colors ${
                      isActive ? "text-[#dfcdad] font-semibold" : "text-[#718585] group-hover:text-[#a4baba]"
                    }`}>
                      {tag.name}
                    </h4>
                  </div>
                );
              })}
            </div>

            {/* Description Details Card for the active tag with multi-page flipping controls */}
            {/* relative z-30 ensures click events bypass any absolute layered visual effects */}
            <div 
              className="p-5 rounded transition-all duration-500 ease-in-out border box-border bg-gradient-to-r from-[#2c3535]/80 to-[#222a2a]/85 border-[#dfcdad]/20 shadow-[0_4px_16px_rgba(0,0,0,0.2)] relative z-30"
              id="tag-desc-box"
            >
              {/* Text content */}
              <div className="space-y-4 animate-fadeIn animate-duration-300" key={`${selectedTagIdx}-${tagPage}`}>
                <div className="space-y-1.5 animate-fadeIn">
                  <span className="text-[11px] tracking-[0.2em] block font-serif text-[#dfcdad]/65 font-semibold uppercase">
                    {hangingTagsData[selectedTagIdx].name}
                  </span>
                  <p className="text-justify leading-relaxed tracking-widest text-[#e4e8e8] text-sm whitespace-pre-line font-serif">
                    {hangingTagsData[selectedTagIdx].pages[tagPage].content}
                  </p>
                </div>
                
                {hangingTagsData[selectedTagIdx].pages[tagPage].interpretation?.trim() && (
                  <div className="pt-3.5 border-t border-[#dfcdad]/10 space-y-1.5 animate-fadeIn">
                    <span className="text-[11px] tracking-[0.2em] block font-serif text-[#dfcdad]/65 font-semibold uppercase">
                      译文：
                    </span>
                  <p className="text-justify leading-relaxed text-xs font-serif text-[#819a9a] whitespace-pre-line">
                    {hangingTagsData[selectedTagIdx].pages[tagPage].interpretation}
                  </p>
                </div>
                )}
              </div>
            </div>

            </div>
          )}

          <div className="h-6" />
        </section>

        {/* ================= 2. RIGHT COLUMN: ARCHAEOLOGICAL REPORT GRID (50% WIDTH) ================= */}
        {/* Widen standard left padding on large screens, preventing central scaled bottle overlapping */}
        <section
          id="right-content-panel" className={`w-1/2 flex flex-col justify-between py-20 pr-16 pl-36 z-10 box-border bg-[#131616] relative border-l border-[#2d3838]/15 ${isJinNpc && isJinIntroPlaying ? "opacity-0" : "opacity-100"}`}
        >
          {isJinNpc ? (
            <>
              <div className="absolute inset-0 bg-[#131616] py-20 pr-16 pl-36 flex flex-col items-start justify-center z-10">
                <div className="max-h-full overflow-y-auto pr-2 space-y-6 w-full max-w-[760px]">
                  {jinShowingEnding && jinFinalPath ? (
                    <TypewriterParagraph
                      title={jinFinalPath.final_result.title}
                      content={jinFinalPath.final_result.text}
                      delay={0}
                      titleColorClass="text-[#dfcdad]"
                      triggerKey={`jin-ending-${jinFinalPath.path_id}`}
                    />
                  ) : (
                    <>
                      {(jinState === 0 || jinState === 1) && (
                        <div className="space-y-3">
                          <span className="font-serif tracking-[0.4em] text-[#9bb1b1] block text-[300%] leading-none">
                            戒子陈情书
                          </span>
                          <div className="h-[1px] w-14 bg-[#8da4a4]/40" />
                        </div>
                      )}
                      {jinRightNarrativeLines.map((line, index) => (
                        <p
                          key={`jin-right-${index}-${line}`}
                          className={`font-serif text-lg tracking-[0.15em] text-[#8ba2a2] whitespace-pre-line leading-relaxed ${isJinNpc ? "fade-in-slow text-fade-in" : ""}`}
                        >
                          {line}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="absolute bottom-10 left-36 z-30 flex items-center space-x-6">
                {jinState === 6 && (
                  <button
                    onClick={handleJinViewEnding}
                    className="font-serif text-sm tracking-[0.35em] text-[#dfcdad] hover:text-[#ffd179] transition-all duration-300 cursor-pointer"
                  >
                    查看结局
                  </button>
                )}
                {jinState === 7 && (
                  <>
                    <button
                      onClick={handleJinBackToNarrative}
                      className="font-serif text-sm tracking-[0.35em] text-[#dfcdad] hover:text-[#ffd179] transition-all duration-300 cursor-pointer"
                    >
                      重选
                    </button>
                    {canShowJinArtifact && (
                      <TypewriterArtifactButton onClick={handleJinOpenArtifactOverlay} />
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                {selectedTabs.length < requiredSelectionCount ? (
                  <motion.div
                    key="astrological-seal-block"
                    variants={pagePeelVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="absolute inset-0 bg-[#131616] flex flex-col items-center justify-center select-none origin-top-left z-10 py-20 pr-16 pl-36"
                    id="ritual-seal-diagram"
                  >
                    {/* Ultra-minimalist selection progress text */}
                    <div className="text-center space-y-4">
                      <div className="font-serif text-[80px] tracking-[0.2em] font-light text-[#dfcdad] leading-none animate-pulse">
                        {selectedTabs.length} <span className="text-[#526565]/40 text-4xl font-light">/</span> <span className="text-[#819595]/60 text-4xl font-light">{requiredSelectionCount}</span>
                      </div>
                      <div className="font-serif text-sm tracking-[0.4em] text-[#718585]/70 uppercase">
                        激活进度
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="archeological-scroll-block"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ 
                      opacity: isDissipating ? 0 : 1, 
                      x: 0,
                      transition: { duration: isDissipating ? 1.5 : 0.8 } 
                    }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.5 } }}
                    className={`absolute inset-0 bg-[#131616] py-20 pr-16 pl-36 flex flex-col items-start justify-center z-10 ${isChengtaoNpc ? "chengtao-ending-panel" : ""}`}
                    style={{
                      transition: "opacity 1500ms ease-in-out"
                    }}
                  >
                    <div className={`max-h-full overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-[#2d3838] scrollbar-track-transparent w-full max-w-[760px] ${isChengtaoNpc ? "chengtao-ending-text-scroll" : ""}`}>
                      {currentEnding && (
                        <TypewriterParagraph
                          title={currentEnding.title}
                          content={currentEnding.text}
                          delay={0}
                          titleColorClass={isTrueEnding ? "text-[#dfcdad]" : "text-[#a4baba]"}
                          triggerKey={`${triggerKey}-${currentEnding.id}`}
                          onComplete={() => setEndingActionsVisible(true)}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Button Area aligned with the left-edge of the right column text */}
              <div className="absolute bottom-10 left-36 z-30 flex items-center space-x-6">
                {canShowStandardEndingActions && (
                  <>
                    <button
                      onClick={() => {
                        if (isDissipating) return;
                        setEndingActionsVisible(false);
                        // Trigger tactile feedback vibration of the vessel ONLY (NO water ripples on reset as requested)
                        setVibrateTrigger(false);
                        setRippleTrigger(false);
                        setIsDissipating(true);
                        setTimeout(() => {
                          setVibrateTrigger(true);
                        }, 12);
                        // Gradually reset visual state after fading out completely first
                        setTimeout(() => {
                          setSelectedTabs([]);
                          setActiveDisplayTab(currentNpc.options[0]?.id ?? "");
                          setIsDissipating(false);
                          previousSelectedCountRef.current = 0;
                        }, 1500);
                      }}
                      className="font-serif text-sm tracking-[0.4em] text-[#819595]/50 hover:text-[#dfcdad] transition-all duration-300 py-1.5 bg-transparent border-none rounded-none cursor-pointer relative z-40 animate-fadeIn"
                      title="重设所有选项"
                    >
                      重选
                    </button>

                    {currentArtifacts.length > 0 && (
                      <TypewriterArtifactButton
                        onClick={() => {
                          setArtifactPageIndex(0);
                          setShowArtifactOverlay(true);
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </section>


        {/* ================= 3. FLOATING VESSEL ELEMENT (ABSOLUTELY POSITIONED INTERSECTING DIVIDER) ================= */}
        {/*
          Sits beautifully on top of the 1/2 vertical boundary, overlapping Left Column and Right Column perfectly.
          NO card wrapping, NO border, absolute transparency. Upscaled to maximize aesthetic visual depth.
        */}
        <div
          className={`absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none ${vibrateTrigger ? "animate-relic-vibrate" : ""}`}
          id="soul-vase"
        >
          {/* Increased widths and heights below, removed container card styles (bg, border, p, shadow removed) */}
          <div className="w-[370px] h-[580px] bg-transparent flex flex-col items-center justify-center relative p-0 rounded-none">
            
            {/* 1. LARGER BLACK SOUL-VASE ORGANIC SHADOW WITH BLURRED EDGES + MULTIPLY BLEND MODE (PLACED AT BOTTOM LAYER) */}
            <div
              className="absolute inset-0 w-full h-full scale-[1.58] pointer-events-none select-none z-0"
              style={{
                filter: "blur(38px)",
                mixBlendMode: "multiply",
                opacity: 0.95,
              }}
            >
              <svg
                viewBox="0 0 300 450"
                className="w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M 150 110 C 165 110, 178 112, 182 116 C 184 122, 172 135, 168 142 C 165 147, 180 160, 205 178 C 220 188, 222 210, 222 235 C 222 285, 210 370, 185 410 C 183 413, 180 415, 178 415 L 150 415 L 122 415 C 120 415, 117 413, 115 410 C 90 370, 78 285, 78 235 C 78 210, 80 188, 95 178 C 120 160, 135 147, 132 142 C 128 135, 116 122, 118 116 C 122 112, 135 110, 150 110 Z"
                  fill="#000000"
                />
              </svg>
            </div>

            {/* 1.2 SPLENDID MULTIPLY BLENDED WATER RIPPLES EXPANDING OVER THE CENTER DIVIDER PAGE UNDER THE VESSEL */}
            {rippleTrigger && (
              <div className="absolute inset-x-0 inset-y-0 pointer-events-none select-none z-0 flex items-center justify-center overflow-visible">
                {/* Precise charcoal ink outline ripple */}
                <div 
                  className="absolute w-[180px] h-[180px] rounded-full border-[0.5px] border-black opacity-0 animate-ripple-1"
                  style={{
                    mixBlendMode: "multiply",
                    filter: "blur(1.2px)",
                  }}
                />
                {/* Secondary larger outer soft slate ink wave */}
                <div 
                  className="absolute w-[180px] h-[180px] rounded-full border-[0.5px] border-[#1e2424] opacity-0 animate-ripple-2"
                  style={{
                    mixBlendMode: "multiply",
                    filter: "blur(2.2px)",
                  }}
                />
                {/* Organic wide filled moisture fade ripple */}
                <div 
                  className="absolute w-[180px] h-[180px] rounded-full bg-black/4 opacity-0 animate-ripple-3"
                  style={{
                    mixBlendMode: "multiply",
                    filter: "blur(5px)",
                  }}
                />
              </div>
            )}

            {/* 2. THE MAIN ACTIVE BOTTLE CONTAINER WITH GLOWING GOLDEN SPIRIT & DEEP BLACK BACKING, ANIMATING GENTLY */}
            <svg
              className="absolute inset-0 w-full h-full select-none animate-vase-breathe z-10"
              viewBox="0 0 300 450"
              xmlns="http://www.w3.org/2000/svg"
              id="vessel-contour-svg"
            >
              <defs>
                {/* Clipping mask matching the pristine plum vase contour outline */}
                <clipPath id="meiping-clip">
                  <path d="M 150 110 C 165 110, 178 112, 182 116 C 184 122, 172 135, 168 142 C 165 147, 180 160, 205 178 C 220 188, 222 210, 222 235 C 222 285, 210 370, 185 410 C 183 413, 180 415, 178 415 L 150 415 L 122 415 C 120 415, 117 413, 115 410 C 90 370, 78 285, 78 235 C 78 210, 80 188, 95 178 C 120 160, 135 147, 132 142 C 128 135, 116 122, 118 116 C 122 112, 135 110, 150 110 Z" />
                </clipPath>

                {/* Filter B: Rich glowing orange gold mist for the '瀹垮￥' preset */}
                <filter id="gold-glow-B" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="15" result="blur" />
                  <feColorMatrix type="matrix" values="1 0 0 0 0  0 0.65 0 0 0  0 0.22 0 0 0  0 0 0 0.95 0" />
                </filter>

                {/* Linear Gradients matching the user confirmed default Gold preset B (瀹垮￥) */}
                <linearGradient id="grad-B" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#ee9c27" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#b25d0c" stopOpacity="0.60" />
                  <stop offset="85%" stopColor="#552103" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#080a0a" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Dynamic breathing & pulsating styles linked directly to interface controls */}
              <style>{`
                @keyframes spirit-pulse {
                  0%, 100% {
                    transform: scale(1) translate(0px, 0px);
                    opacity: 0.65;
                    filter: drop-shadow(0 0 ${4 * glowIntensity}px rgba(209, 225, 228, ${0.15 * glowIntensity}));
                  }
                  50% {
                    transform: scale(1.008) translate(0px, -0.8px);
                    opacity: 0.95;
                    filter: drop-shadow(0 0 ${11 * glowIntensity}px rgba(209, 225, 228, ${0.40 * glowIntensity}));
                  }
                }
                .animate-spirit {
                  transform-origin: 150px 260px;
                  animation: spirit-pulse ${pulseSpeed}s ease-in-out infinite;
                  transition: filter 0.3s ease, stroke-width 0.4s ease;
                }
                
                @keyframes internal-swirl {
                  0%, 100% {
                    transform: scale(1) rotate(0deg) translate(0px, 0px);
                  }
                  50% {
                    transform: scale(1.03) rotate(3deg) translate(1px, -2px);
                  }
                }
                .swirling-spirit {
                  transform-origin: 150px 300px;
                  animation: internal-swirl 14s ease-in-out infinite;
                }

                @keyframes vase-breathe {
                  0%, 100% {
                    transform: scale(0.98);
                  }
                  50% {
                    transform: scale(1.02);
                  }
                }
                .animate-vase-breathe {
                  transform-origin: center center;
                  animation: vase-breathe ${pulseSpeed}s ease-in-out infinite;
                }

                @keyframes relic-impact-vibrate {
                  0% { transform: scale(1); }
                  12% { transform: scale(0.978); }
                  100% { transform: scale(1); }
                }
                .animate-relic-vibrate {
                  animation: relic-impact-vibrate 0.64s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
                }

                @keyframes ripple-wave-1 {
                  0% {
                    transform: scale(0.1);
                    opacity: 0.28;
                  }
                  15% {
                    opacity: 0.18;
                  }
                  100% {
                    transform: scale(18);
                    opacity: 0;
                  }
                }
                .animate-ripple-1 {
                  animation: ripple-wave-1 4.0s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
                }

                @keyframes ripple-wave-2 {
                  0% {
                    transform: scale(0.05);
                    opacity: 0;
                  }
                  12% {
                    transform: scale(0.15);
                    opacity: 0.16;
                  }
                  100% {
                    transform: scale(22);
                    opacity: 0;
                  }
                }
                .animate-ripple-2 {
                  animation: ripple-wave-2 4.0s cubic-bezier(0.15, 0.75, 0.4, 1) forwards;
                  animation-delay: 0.35s;
                }

                @keyframes ripple-wave-3 {
                  0% {
                    transform: scale(0.02);
                    opacity: 0;
                  }
                  8% {
                    transform: scale(0.1);
                    opacity: 0.08;
                  }
                  100% {
                    transform: scale(14);
                    opacity: 0;
                  }
                }
                .animate-ripple-3 {
                  animation: ripple-wave-3 4.0s cubic-bezier(0.2, 0.7, 0.5, 1) forwards;
                  animation-delay: 0.18s;
                }

                /* Custom narrow scrollbar styling for the museum catalog card */
                .custom-narrow-scrollbar::-webkit-scrollbar {
                  width: 3.5px;
                }
                .custom-narrow-scrollbar::-webkit-scrollbar-track {
                  background: rgba(45, 56, 56, 0.12);
                  border-radius: 9px;
                }
                .custom-narrow-scrollbar::-webkit-scrollbar-thumb {
                  background: rgba(223, 205, 173, 0.28);
                  border-radius: 9px;
                  transition: background 0.3s ease;
                }
                .custom-narrow-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: rgba(223, 205, 173, 0.65);
                }
                .custom-narrow-scrollbar {
                  scrollbar-width: thin;
                  scrollbar-color: rgba(223, 205, 173, 0.28) rgba(45, 56, 56, 0.12);
                }
              `}</style>

              {/* Inner content: masked inside the vessel path */}
              <g clipPath="url(#meiping-clip)">
                {/* Complete dark backing inside the vessel, matching the deep void look */}
                <rect x="0" y="0" width="300" height="450" fill="#030404" />
                
                {/* Dynamically rising golden fluid rect */}
                <rect
                  x="20"
                  y={yPosition}
                  width="260"
                  height={heightValue}
                  fill={`url(#grad-${goldEdition})`}
                  filter={`url(#gold-glow-${goldEdition})`}
                  style={{
                    opacity: isVesselDissipating ? 0 : (vesselFillCount === 0 ? 0 : goldDensity),
                    transition: vesselFillCount === 0 && !isVesselDissipating ? "none" : "opacity 1500ms cubic-bezier(0.16, 1, 0.3, 1), y 1000ms ease-in-out, height 1000ms ease-in-out"
                  }}
                />

                {/* Additional swirling core inside the bottle to improve soft cloudiness */}
                <circle
                  cx="150"
                  cy={yPosition + 35}
                  r="55"
                  fill={`url(#grad-${goldEdition})`}
                  filter={`url(#gold-glow-${goldEdition})`}
                  style={{
                    opacity: isVesselDissipating ? 0 : (vesselFillCount === 0 ? 0 : (goldDensity * 0.75)),
                    transition: vesselFillCount === 0 && !isVesselDissipating ? "none" : "opacity 1500ms cubic-bezier(0.16, 1, 0.3, 1), cy 1000ms ease-in-out"
                  }}
                  className="swirling-spirit"
                />

                {/* Rising spiritual embers/sparkles when filled */}
                <g 
                  style={{
                    opacity: isVesselDissipating ? 0 : (vesselFillCount === 0 ? 0 : particleOpacity),
                    transition: vesselFillCount === 0 && !isVesselDissipating ? "none" : "opacity 1500ms ease-out"
                  }}
                >
                  <circle cx="115" cy="350" r="1.5" fill="#ffd179" className="animate-pulse" style={{ animationDuration: '3.5s' }} />
                  <circle cx="185" cy="310" r="1.2" fill="#ffeaa5" className="animate-ping" style={{ animationDuration: '4.5s' }} />
                  <circle cx="130" cy="245" r="1.0" fill="#ffd179" className="animate-pulse" style={{ animationDuration: '2.8s' }} />
                  <circle cx="155" cy="275" r="1.4" fill="#fff" className="animate-pulse" style={{ animationDuration: '3.2s' }} />
                  <circle cx="145" cy="180" r="0.8" fill="#ffeaa5" className="animate-pulse" style={{ animationDuration: '5.2s' }} />
                  <circle cx="178" cy="210" r="1.0" fill="#fff" className="animate-ping" style={{ animationDuration: '6s' }} />
                </g>
              </g>
            </svg>
          </div>
        </div>

      </div>

      {/* ================= 4. GLOBAL FLOATING BOTTOM SELECTIONS ================= */}
      {/* 
        Simplified exactly as requested:
        - Transparent background with a smooth horizontal split color gradient matching left & right backgrounds.
        - Backblurred (frosted-glass/姣涚幓鐠? blending seamlessly with the columns above.
        - Option text maintains a unified blue-grey (闈掔伆) tone.
        - Underline appears upon hover or selection:
          * Normal state: Blue-grey text, no underline.
          * Hover state: Brighter slate-grey text with a grey/slate underline.
          * Pressed/Selected state: Elegant cream-gold text with a gold/amber glowing underline.
      */}
      <div
        className={`w-full min-w-[1440px] border-t border-[#525e5e]/15 bg-gradient-to-r from-[#3b4343]/45 via-[#1f2525]/80 to-[#131616]/95 backdrop-blur-xl ${
          isChengtaoNpc ? "chengtao-tabs-shell" : ""
        }`}
      >
        <footer 
          id="global-tabs-dock" className={`w-full py-6 bg-transparent px-6 flex justify-center items-center z-30 transition-opacity duration-700 ${isJinNpc && isJinIntroPlaying ? "opacity-0" : "opacity-100"} ${isChengtaoNpc ? "chengtao-tabs-dock" : ""}`}
        >
          <div className="w-full max-w-6xl flex flex-col items-center justify-center space-y-4">
            {isJinNpc ? (
              <div className="w-full max-w-4xl text-center">
                {jinState === 1 && (
                  <div className="grid grid-cols-2 gap-12">
                    {jinNpcData.round_1.options.map((option, index) => (
                      <button
                        key={`jin-r1-${option.option_id}`} style={{ animationDelay: `${index * 80}ms` }}
                        onClick={() => handleJinRound1Select(option.option_id)}
                        className="font-serif text-base tracking-[0.25em] text-[#dfcdad] hover:text-[#ffd179] transition-all duration-300 cursor-pointer py-3 stagger-up"
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                )}
                {jinState === 3 && (
                  <div className="grid grid-cols-3 gap-10">
                    {jinNpcData.round_2.options.map((option, index) => (
                      <button
                        key={`jin-r2-${option.option_id}`} style={{ animationDelay: `${index * 80}ms` }}
                        onClick={() => handleJinRound2Select(option.option_id)}
                        className="font-serif text-base tracking-[0.2em] text-[#dfcdad] hover:text-[#ffd179] transition-all duration-300 cursor-pointer py-3 stagger-up"
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                )}
                {jinState === 5 && (
                  <div className="grid grid-cols-2 gap-12">
                    {jinNpcData.round_3.options.map((option, index) => (
                      <button
                        key={`jin-r3-${option.option_id}`} style={{ animationDelay: `${index * 80}ms` }}
                        onClick={() => handleJinRound3Select(option.option_id)}
                        className="font-serif text-base tracking-[0.2em] text-[#dfcdad] hover:text-[#ffd179] transition-all duration-300 cursor-pointer py-3 stagger-up"
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`${isTwoRowOptions ? "two-row-options" : "grid grid-cols-4 gap-12"} w-full max-w-4xl text-center`}
              >
                {isChengtaoNpc ? (
                  <>
                    <div className="chengtao-top-row">
                      <div className="chengtao-option-pair">
                        {chengtaoTextOptionIds.slice(0, 2).map((tag) => renderOptionCard(tag))}
                      </div>
                      <div className="chengtao-option-pair">
                        {chengtaoTextOptionIds.slice(2, 4).map((tag) => renderOptionCard(tag))}
                      </div>
                    </div>
                    <div className="chengtao-bottom-row">
                      {chengtaoItemOptionIds.map((tag) => renderOptionCard(tag))}
                    </div>
                  </>
                ) : (
                  optionSlots.map((item) => renderOptionCard(item.tag as ActiveTab))
                )}
              </div>
            )}

          </div>
        </footer>
      </div>

      {shouldShowTutorialOverlay && (
        <div className="fixed left-1/2 bottom-[126px] z-[70] w-[720px] -translate-x-1/2 border border-[#637575]/25 bg-[#101313]/90 backdrop-blur-xl px-6 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] animate-fadeIn">
          <div className="flex items-center gap-5">
            <span className="shrink-0 font-serif text-[11px] tracking-[0.28em] text-[#dfcdad]/75">
              指引 {tutorialStepIndex + 1} / {tutorialSteps.length}
            </span>
            <p className="min-w-0 flex-1 font-serif text-sm tracking-[0.16em] leading-relaxed text-[#d4dddd]">
              {tutorialSteps[tutorialStepIndex]}
            </p>
            <div className="shrink-0 flex items-center gap-4">
              <button
                onClick={completeTutorial}
                className="font-serif text-[11px] tracking-[0.24em] text-[#819595] hover:text-[#dfcdad] transition-colors cursor-pointer"
              >
                跳过
              </button>
              <button
                onClick={handleTutorialNext}
                className="font-serif text-xs tracking-[0.28em] text-[#dfcdad] hover:text-[#ffd179] transition-colors cursor-pointer"
              >
                {tutorialStepIndex >= tutorialSteps.length - 1 ? "完成" : "下一步"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAboutAuthorPlaceholder && (
        <div className="fixed inset-0 z-[90] bg-[#101313]/95 backdrop-blur-xl flex items-center justify-center animate-fadeIn">
          <div className="w-full max-w-2xl px-10 py-12 border border-[#637575]/25 bg-[#131616]/85">
            <div className="space-y-6">
              <div className="space-y-3">
                <h1 className="font-serif text-3xl tracking-[0.45em] text-[#dfcdad] font-light">
                  关于本游戏
                </h1>
                <div className="h-[1px] w-20 bg-[#dfcdad]/35" />
              </div>
              <p className="font-serif text-sm tracking-[0.18em] leading-loose text-[#9bb1b1]">
                制作说明与致谢
              </p>
              <div className="flex items-center gap-5 pt-4">
                <button
                  onClick={() => setShowAboutAuthorPlaceholder(false)}
                  className="font-serif text-xs tracking-[0.3em] text-[#9bb1b1] hover:text-[#dfcdad] transition-colors cursor-pointer"
                >
                  返回游戏
                </button>
                <button
                  onClick={handleReturnToCover}
                  className="font-serif text-xs tracking-[0.3em] text-[#9bb1b1] hover:text-[#dfcdad] transition-colors cursor-pointer"
                >
                  回到封面
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showJinArtifactOverlay && isJinNpc && jinPrimaryArtifact && (
        <div className="fixed inset-0 z-50 bg-[#0d0f0f]/75 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 lg:p-12 animate-fadeIn">
          <div className="w-full max-w-5xl h-[90vh] md:h-[80vh] bg-[#060707]/60 backdrop-blur-lg border border-[#2d3838]/25 rounded flex flex-col md:flex-row relative overflow-hidden shadow-2xl">
            <button
              onClick={handleJinCloseArtifactOverlay}
              className="absolute top-4 right-4 text-[#819595]/60 hover:text-[#dfcdad] transition-all duration-300 font-serif text-xs tracking-widest cursor-pointer z-50 py-1.5 px-3 border border-[#525e5e]/15 hover:border-[#dfcdad]/40 rounded bg-[#131616]/70"
              title="关闭"
            >
              关闭
            </button>

            <div className="w-full md:w-[42%] border-b md:border-b-0 md:border-r border-[#2d3838]/25 p-6 md:p-8 flex flex-col items-center justify-center h-[40%] md:h-full box-border relative">
              <div className="w-full h-full border border-[#2d3838]/30 bg-[#030404] flex flex-col items-center justify-center p-4 relative box-border rounded overflow-hidden">
                <div className="absolute w-44 h-44 rounded-full bg-[#ee9c27]/10 filter blur-[45px] animate-pulse z-0 pointer-events-none" />
                <div className="w-full h-[85%] relative z-10 flex items-center justify-center select-none">
                  <img
                    src={jinPrimaryArtifact.imageSrc ?? "/jiedie.jpeg"}
                    alt={jinPrimaryArtifact.caption ?? jinPrimaryArtifact.title ?? "金诚泽文物"}
                    className="w-full h-full max-h-[260px] md:max-h-[350px] object-contain opacity-95"
                  />
                </div>
                <div className="absolute bottom-2 text-center">
                  <span className="font-serif text-[10px] md:text-[11px] tracking-[0.2em] text-[#dfcdad] block">
                    {jinPrimaryArtifact.caption ?? jinPrimaryArtifact.title}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-[58%] flex flex-col justify-between p-6 md:p-10 lg:p-12 h-[60%] md:h-full box-border relative overflow-hidden">
              <div className="space-y-3 pt-6 md:pt-4 z-10">
                <h2 className="font-serif text-lg md:text-xl lg:text-2xl tracking-[0.35em] text-[#dfcdad] leading-tight font-medium">
                  {jinPrimaryArtifact.title}
                </h2>
                <span className="font-serif text-[10px] md:text-xs tracking-[0.2em] text-[#7c9595] block whitespace-pre-line">
                  {jinPrimaryArtifact.subtitle}
                </span>
                <div className="h-[1px] w-20 bg-[#dfcdad]/30 mt-4" />
              </div>

              <div className="flex-1 my-6 pr-4 overflow-y-auto custom-narrow-scrollbar space-y-6 z-10 scroll-smooth">
                {jinPrimaryArtifact.sections.map((section, index) => (
                  <div key={`jin-artifact-modal-section-${index}`} className="space-y-3">
                    {isRenderableText(section.section_title) && (
                      <span className="font-serif text-[10px] md:text-[11px] tracking-[0.3em] text-[#dfcdad]/70 block font-medium">
                        {section.section_title}
                      </span>
                    )}
                    {isRenderableText(section.text) && (
                      <p className="font-serif text-xs md:text-sm tracking-widest text-[#819a9a] text-justify leading-relaxed whitespace-pre-line">
                        {section.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 5. ARTIFACT MUSEUM OVERLAY ================= */}
      {showArtifactOverlay && currentArtifact && (
        <div className="fixed inset-0 z-50 bg-[#0d0f0f]/75 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 lg:p-12 animate-fadeIn">
          {/* Main Display Pane matching the screenshot dual-layout */}
          <div className="w-full max-w-5xl h-[90vh] md:h-[80vh] bg-[#060707]/60 backdrop-blur-lg border border-[#2d3838]/25 rounded flex flex-col md:flex-row relative overflow-hidden shadow-2xl">
            
            {/* Elegant Close Button in the upper right corner */}
            <button
              onClick={() => setShowArtifactOverlay(false)}
              className="absolute top-4 right-4 text-[#819595]/60 hover:text-[#dfcdad] transition-all duration-300 font-serif text-xs tracking-widest cursor-pointer z-50 py-1.5 px-3 border border-[#525e5e]/15 hover:border-[#dfcdad]/40 rounded bg-[#131616]/70"
              title="关闭"
            >
              关闭
            </button>

            {/* LEFT COLUMN: THE ARTIFACT FRAME (Takes 42% on desktop) */}
            <div className="w-full md:w-[42%] border-b md:border-b-0 md:border-r border-[#2d3838]/25 p-6 md:p-8 flex flex-col items-center justify-center h-[40%] md:h-full box-border relative">
              {/* Museum Display Case Frame (thin clean outline) */}
              <div className="w-full h-full border border-[#2d3838]/30 bg-[#030404] flex flex-col items-center justify-center p-4 relative box-border rounded overflow-hidden">
                {/* Spiritual Ambient Gold Background Blur under the artifact */}
                <div className="absolute w-44 h-44 rounded-full bg-[#ee9c27]/10 filter blur-[45px] animate-pulse z-0 pointer-events-none" />

                {/* Artifact Canvas */}
                <div className="w-full h-[85%] relative z-10 flex items-center justify-center select-none">
                  <img
                    src={currentArtifact.imageSrc ?? "/shuihudi-slip.png"}
                    alt={currentArtifact.caption ?? currentArtifact.name}
                    className="w-full h-full max-h-[260px] md:max-h-[350px] object-contain opacity-95"
                  />
                </div>

                {/* Exhibit Label */}
                <div className="absolute bottom-2 text-center">
                  <span className="font-serif text-[10px] md:text-[11px] tracking-[0.2em] text-[#dfcdad] block">
                    {currentArtifact.caption ?? currentArtifact.name}
                  </span>
                </div>
              </div>

              {currentArtifacts.length > 1 && (
                <div className="mt-4 flex items-center gap-3 text-[#9bb1b1]">
                  <button
                    onClick={() => setArtifactPageIndex((index) => Math.max(0, index - 1))}
                    disabled={artifactPageIndex === 0}
                    className="cursor-pointer disabled:cursor-default disabled:opacity-35 hover:text-[#dfcdad] transition-colors"
                    title="上一页文物"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="font-serif text-xs tracking-[0.25em]">
                    {artifactPageIndex + 1} / {currentArtifacts.length}
                  </span>
                  <button
                    onClick={() =>
                      setArtifactPageIndex((index) =>
                        Math.min(currentArtifacts.length - 1, index + 1)
                      )
                    }
                    disabled={artifactPageIndex === currentArtifacts.length - 1}
                    className="cursor-pointer disabled:cursor-default disabled:opacity-35 hover:text-[#dfcdad] transition-colors"
                    title="下一页文物"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: THE MUSEUM CATALOG CARD (Takes 58% on desktop) */}
            <div className="w-full md:w-[58%] flex flex-col justify-between p-6 md:p-10 lg:p-12 h-[60%] md:h-full box-border relative overflow-hidden">
              
              {/* Headings */}
              <div className="space-y-3 pt-6 md:pt-4 z-10">
                <h2 className="font-serif text-lg md:text-xl lg:text-2xl tracking-[0.35em] text-[#dfcdad] leading-tight font-medium">
                  {currentArtifact.name}
                </h2>
                <span className="font-serif text-[10px] md:text-xs tracking-[0.2em] text-[#7c9595] block">
                  {currentArtifact.subtitle}
                </span>
                <div className="h-[1px] w-20 bg-[#dfcdad]/30 mt-4" />
              </div>

              {/* Explanatory Texts block with elegant scrollable container */}
              <div className="flex-1 my-6 pr-4 overflow-y-auto custom-narrow-scrollbar space-y-6 z-10 scroll-smooth">
                
                {/* Section I: Archaeological Origin */}
                <div className="space-y-3">
                  <span className="font-serif text-[10px] md:text-[11px] tracking-[0.3em] text-[#dfcdad]/70 block font-medium">
                    释文：
                  </span>
                  <p className="font-serif text-xs md:text-sm tracking-widest text-[#819a9a] text-justify leading-relaxed whitespace-pre-line">
                    {renderTextWithBold(currentArtifact.sourceText)}
                  </p>
                </div>

                {currentArtifact.translation?.trim() && (
                  <div className="space-y-3 pt-4 border-t border-[#2d3838]/20">
                    <span className="font-serif text-[10px] md:text-[11px] tracking-[0.3em] text-[#dfcdad]/70 block font-medium">
                      译文：
                    </span>
                    <p className="font-serif text-xs md:text-sm tracking-widest text-[#819a9a] text-justify leading-relaxed whitespace-pre-line">
                      {renderTextWithBold(currentArtifact.translation)}
                    </p>
                  </div>
                )}

                {/* Section III: Classical Oath Verses */}
                <div className="space-y-3 pt-4 border-t border-[#2d3838]/20">
                  {showExplanationHeading && (
                    <span className="font-serif text-[10px] md:text-[11px] tracking-[0.3em] text-[#dfcdad]/70 block font-medium">
                      解释文本：
                    </span>
                  )}
                  <p className="font-serif text-xs md:text-sm tracking-widest text-[#819a9a] text-justify leading-relaxed whitespace-pre-line">
                    {currentArtifact.explanation}
                  </p>
                </div>

              </div>

              <div className="mt-2 pt-4 border-t border-[#2d3838]/25 min-h-[44px]">
                {canGuideNext && (
                  <button
                    onClick={handleGuideNextNpc}
                    className="font-serif text-xs md:text-sm tracking-[0.35em] text-[#dfcdad] hover:text-[#ffd179] transition-all duration-300 underline underline-offset-8 decoration-[#dfcdad]/40 hover:decoration-[#dfcdad]/80 cursor-pointer font-semibold"
                    title="接引下一位"
                  >
                    接引下一位
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
    </>
  );
}
