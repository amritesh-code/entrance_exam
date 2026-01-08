import { useState, useRef, useCallback, useMemo } from "react";
import { API_BASE_URL } from "../config.js";

export function useSpeechRecognition(showWarning) {
  const [status, setStatus] = useState(null);
  const [transcript, setTranscript] = useState("");

  const SpeechRecognitionClass = useMemo(
    () => window.SpeechRecognition || window.webkitSpeechRecognition || null,
    []
  );
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const capturedRef = useRef("");
  const stopRequestedRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startListening = useCallback(
    async (studentId, activeSection, currentQuestion, onAnswer) => {
      if (!SpeechRecognitionClass) {
        showWarning(
          "Unsupported browser",
          "Please use Chrome or Edge for speech recording."
        );
        setStatus("idle");
        onAnswer("");
        return;
      }
      if (listeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const isSpeakingSection = activeSection?.id === "speaking";
      if (isSpeakingSection) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm",
          });
          audioChunksRef.current = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };
          mediaRecorder.start();
          mediaRecorderRef.current = mediaRecorder;
        } catch (e) {
          console.error("Failed to start audio recording", e);
        }
      }

      const recog = new SpeechRecognitionClass();
      recog.continuous = true;
      recog.lang = "en-IN";
      recog.interimResults = true;
      recognitionRef.current = recog;
      listeningRef.current = true;
      stopRequestedRef.current = false;
      capturedRef.current = "";
      let answeredRef = false;
      setTranscript("");
      setStatus("listening");

      let handled = false;
      const timeoutId = setTimeout(() => {
        if (handled || answeredRef) return;
        handled = true;
        answeredRef = true;
        try {
          recog.stop();
        } catch {}
        setStatus("idle");
        onAnswer(capturedRef.current || "");
      }, 120000);

      recog.onresult = (event) => {
        let full = "";
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript;
        }
        capturedRef.current = full;
        setTranscript(full.trim());
      };

      recog.onspeechend = () => {};

      recog.onend = () => {
        listeningRef.current = false;
        if (answeredRef) return;
        if (stopRequestedRef.current) {
          answeredRef = true;
          const finalText = (capturedRef.current || "").trim();
          onAnswer(finalText || "");
          return;
        }
        if (!handled) {
          handled = true;
          answeredRef = true;
          clearTimeout(timeoutId);
          setStatus("idle");
          onAnswer(capturedRef.current || "");
        }
      };

      recog.onerror = (event) => {
        if (handled) return;
        if (event.error === "aborted" || event.error === "no-speech") return;
        handled = true;
        clearTimeout(timeoutId);
        setStatus("error");
        try {
          recog.abort();
        } catch {}
        onAnswer("");
      };

      try {
        recog.start();
      } catch (e) {
        try {
          recog.abort();
        } catch (_) {}
        try {
          recog.start();
        } catch (_) {}
      }
    },
    [SpeechRecognitionClass, showWarning]
  );

  const stopAndSubmit = useCallback(
    async (studentId, activeSection, currentQuestion) => {
      const recog = recognitionRef.current;
      if (!recog) return;
      stopRequestedRef.current = true;
      setStatus("evaluating");
      try {
        recog.stop();
      } catch {}

      if (mediaRecorderRef.current && activeSection?.id === "speaking") {
        const recorder = mediaRecorderRef.current;
        recorder.stop();

        await new Promise((resolve) => {
          recorder.onstop = resolve;
        });

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          const formData = new FormData();
          formData.append("file", audioBlob, "speaking.webm");
          formData.append("student_id", studentId);
          formData.append("question_id", currentQuestion?.id || "speaking");

          try {
            await fetch(`${API_BASE_URL}/save_audio`, {
              method: "POST",
              body: formData,
            });
          } catch (e) {
            console.error("Failed to upload audio", e);
          }
        }

        recorder.stream?.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      }
    },
    []
  );

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      listeningRef.current = false;
    }
  }, []);

  const speak = useCallback((text) => {
    try {
      window.speechSynthesis.cancel();
    } catch {}
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("ready");
    window.speechSynthesis.speak(utterance);
  }, []);

  return {
    status,
    setStatus,
    transcript,
    setTranscript,
    recognitionRef,
    listeningRef,
    startListening,
    stopAndSubmit,
    cleanup,
    speak,
  };
}
