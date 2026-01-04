import { useState, useRef, useCallback } from "react";

export function useFullscreen(showWarning, registerIncident) {
  const [fullscreenWarningCount, setFullscreenWarningCount] = useState(0);
  const fullscreenWarningCountRef = useRef(0);
  const endingSessionRef = useRef(false);

  const enterFullscreen = useCallback(
    async (resetCount = false, logFailure = false) => {
      const el = document.documentElement;
      if (!el?.requestFullscreen) return;
      if (document.fullscreenElement) {
        if (resetCount) {
          fullscreenWarningCountRef.current = 0;
          setFullscreenWarningCount(0);
        }
        return;
      }
      try {
        await el.requestFullscreen();
        if (resetCount) {
          fullscreenWarningCountRef.current = 0;
          setFullscreenWarningCount(0);
        }
      } catch (err) {
        showWarning(
          "Fullscreen blocked",
          "Allow fullscreen access to continue the exam."
        );
        if (logFailure) {
          registerIncident("fullscreen_denied", {
            ts: Date.now(),
            message: "Fullscreen request denied",
          });
        }
      }
    },
    [showWarning, registerIncident]
  );

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Failed to exit fullscreen", err);
      }
    }
  }, []);

  const handleFullscreenExit = useCallback(
    (onForceSubmit) => {
      if (endingSessionRef.current) return;
      if (document.fullscreenElement) return;

      const next = fullscreenWarningCountRef.current + 1;
      fullscreenWarningCountRef.current = next;
      setFullscreenWarningCount(next);
      registerIncident("fullscreen_exit", {
        ts: Date.now(),
        message: `Exited fullscreen (${next}/2)`,
      });

      if (next >= 2) {
        showWarning(
          "Exam ended",
          "Exam submitted because fullscreen was exited twice."
        );
        onForceSubmit();
      } else {
        showWarning(
          "Fullscreen warning",
          `Return to fullscreen to continue. Warning ${next}/2.`
        );
        enterFullscreen(false);
      }
    },
    [enterFullscreen, registerIncident, showWarning]
  );

  return {
    fullscreenWarningCount,
    fullscreenWarningCountRef,
    endingSessionRef,
    enterFullscreen,
    exitFullscreen,
    handleFullscreenExit,
  };
}
