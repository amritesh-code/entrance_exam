import { useState, useRef, useCallback } from "react";
import { API_BASE_URL } from "../config.js";

export function useProctoring(studentId) {
  const [incidents, setIncidents] = useState([]);
  const [shots, setShots] = useState([]);
  const lastAlertRef = useRef({});

  const persistIncident = useCallback(
    async (type, details, questionContext) => {
      try {
        await fetch(`${API_BASE_URL}/save_incident`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: studentId,
            incident_type: type,
            details: details || "",
            question_context: questionContext || "",
          }),
        });
      } catch (err) {
        console.error("Failed to store incident", err);
      }
    },
    [studentId]
  );

  const registerIncident = useCallback(
    (type, payload = {}, questionContext = "") => {
      setIncidents((prev) => [...prev, { type, questionContext, ...payload }]);
      persistIncident(type, payload.message || "", questionContext);
    },
    [persistIncident]
  );

  const handleIncident = useCallback(
    (type, payload, showWarning) => {
      registerIncident(type, payload);
      console.warn("[Proctoring Incident]", type, payload || {});

      const now = Date.now();
      const lastAlert = lastAlertRef.current[type] || 0;
      if (now - lastAlert < 5000) return;

      const warnings = {
        no_face: "No face detected. Position yourself in view.",
        multiple_faces: "Only the registered student should be visible.",
        gaze_away: "Keep your gaze on the screen.",
        unknown_person: "Unrecognized person detected.",
        tab_hidden: "Do not switch tabs during the exam.",
        window_blur: "Return focus to the exam window.",
      };

      if (warnings[type] && type !== "window_blur" && type !== "window_focus") {
        lastAlertRef.current[type] = now;
        showWarning("Proctoring Alert", warnings[type]);
      }
    },
    [registerIncident]
  );

  const handleSnapshot = useCallback(({ blob, dataUrl, faces, ts }) => {
    setShots((prev) => [...prev, { ts, faces }]);
    console.log(
      "[Proctoring] Snapshot @",
      new Date(ts).toISOString(),
      "faces:",
      faces,
      "size:",
      blob?.size
    );
  }, []);

  const resetProctoring = useCallback(() => {
    setIncidents([]);
    setShots([]);
  }, []);

  return {
    incidents,
    shots,
    registerIncident,
    handleIncident,
    handleSnapshot,
    resetProctoring,
  };
}
