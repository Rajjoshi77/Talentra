import { useState, useEffect, useCallback, useRef } from "react";

export interface ProctoringViolation {
  id: string;
  type: "tab_switch" | "window_blur" | "copy_attempt" | "paste_attempt" | "devtools_attempt" | "fullscreen_exit" | "camera_disabled";
  timestamp: string;
  message: string;
}

export interface ProctoringState {
  integrityScore: number;
  violations: ProctoringViolation[];
  tabSwitchCount: number;
  pasteCount: number;
  fullscreenExitCount: number;
  isFullscreen: boolean;
  activeWarning: {
    title: string;
    description: string;
    severity: "warning" | "danger";
  } | null;
}

export function useProctoring(interviewId?: string, enabled: boolean = true) {
  const [violations, setViolations] = useState<ProctoringViolation[]>(() => {
    if (!interviewId) return [];
    try {
      const saved = localStorage.getItem(`talentra_proctoring_${interviewId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.violations || [];
      }
    } catch (e) {}
    return [];
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== "undefined" && !!document.fullscreenElement;
  });

  const [activeWarning, setActiveWarning] = useState<{
    title: string;
    description: string;
    severity: "warning" | "danger";
  } | null>(null);

  const lastViolationTime = useRef<number>(0);

  const addViolation = useCallback(
    (type: ProctoringViolation["type"], message: string, penalty: number = 10) => {
      const now = Date.now();
      // Throttle identical alerts within 1.5 seconds to prevent flood
      if (now - lastViolationTime.current < 1500) return;
      lastViolationTime.current = now;

      const newViolation: ProctoringViolation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        timestamp: new Date().toLocaleTimeString(),
        message,
      };

      setViolations((prev) => {
        const updated = [...prev, newViolation];
        if (interviewId) {
          try {
            localStorage.setItem(
              `talentra_proctoring_${interviewId}`,
              JSON.stringify({
                violations: updated,
                lastUpdated: new Date().toISOString(),
              })
            );
          } catch (e) {}
        }
        return updated;
      });

      setActiveWarning({
        title:
          type === "tab_switch" || type === "window_blur"
            ? "Focus Lost / Tab Switch Detected"
            : type === "paste_attempt"
            ? "Paste Action Flagged"
            : type === "copy_attempt"
            ? "Question Copying Prohibited"
            : type === "devtools_attempt"
            ? "Developer Tools Restricted"
            : "Fullscreen Mode Exited",
        description: message,
        severity: penalty >= 10 ? "danger" : "warning",
      });
    },
    [interviewId]
  );

  const clearWarning = useCallback(() => {
    setActiveWarning(null);
  }, []);

  const requestFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed or was denied:", err);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Exit fullscreen failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 1. Visibility & Tab Switch detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation(
          "tab_switch",
          "Candidate switched to another browser tab or minimized window.",
          15
        );
      }
    };

    // 2. Window Blur (loss of active focus)
    const handleBlur = () => {
      // Don't trigger if already handled by visibility change
      if (!document.hidden) {
        addViolation(
          "window_blur",
          "Window focus lost. Secondary application or monitor interaction detected.",
          10
        );
      }
    };

    // 3. Fullscreen state monitoring
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        addViolation(
          "fullscreen_exit",
          "Exited fullscreen mode during an active interview session.",
          5
        );
      }
    };

    // 4. Clipboard & Devtools blocking / flagging
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation(
        "copy_attempt",
        "Copying interview content is restricted during the evaluation.",
        5
      );
    };

    const handlePaste = (e: ClipboardEvent) => {
      // Allow minimal pasting if inside normal inputs if needed, or flag external answer injection
      addViolation(
        "paste_attempt",
        "Pasting external clipboard content is flagged for academic integrity review.",
        10
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent inspect element right click
      e.preventDefault();
      addViolation(
        "devtools_attempt",
        "Context menu and code inspection are disabled during proctoring.",
        5
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
      const isDevKey =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U"));

      if (isDevKey) {
        e.preventDefault();
        addViolation(
          "devtools_attempt",
          "Developer tools shortcut intercepted and recorded.",
          10
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, addViolation]);

  // Compute stats
  const tabSwitchCount = violations.filter(
    (v) => v.type === "tab_switch" || v.type === "window_blur"
  ).length;
  const pasteCount = violations.filter((v) => v.type === "paste_attempt").length;
  const fullscreenExitCount = violations.filter((v) => v.type === "fullscreen_exit").length;

  // Deduct score based on violation penalties
  const deductions = violations.reduce((acc, v) => {
    switch (v.type) {
      case "tab_switch":
        return acc + 15;
      case "window_blur":
        return acc + 10;
      case "paste_attempt":
        return acc + 10;
      case "devtools_attempt":
        return acc + 10;
      case "copy_attempt":
        return acc + 5;
      case "fullscreen_exit":
        return acc + 5;
      default:
        return acc + 5;
    }
  }, 0);

  const integrityScore = Math.max(0, 100 - deductions);

  return {
    integrityScore,
    violations,
    tabSwitchCount,
    pasteCount,
    fullscreenExitCount,
    isFullscreen,
    activeWarning,
    clearWarning,
    requestFullscreen,
    exitFullscreen,
    addViolation,
  };
}
