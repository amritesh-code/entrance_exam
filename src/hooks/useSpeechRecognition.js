import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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
  const timeoutIdRef = useRef(null);
  const answeredRef = useRef(false);
  const watchdogRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const restartFnRef = useRef(null);
  const onAnswerRef = useRef(null);

  useEffect(() => {
    restartFnRef.current = () => {
      if (stopRequestedRef.current || answeredRef.current) return;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      if (!SpeechRecognitionClass) return;

      const recog = new SpeechRecognitionClass();
      recog.continuous = true;
      recog.lang = "en-IN";
      recog.interimResults = true;
      recog.maxAlternatives = 1;

      recognitionRef.current = recog;
      const previousText = capturedRef.current;
      lastActivityRef.current = Date.now();

      recog.onresult = (event) => {
        lastActivityRef.current = Date.now();
        let currentSession = "";
        for (let i = 0; i < event.results.length; i++) {
          currentSession += event.results[i][0].transcript;
        }
        const fullText = previousText
          ? `${previousText} ${currentSession}`
          : currentSession;
        capturedRef.current = fullText;
        setTranscript(fullText.trim());
      };

      recog.onend = () => {
        if (answeredRef.current || stopRequestedRef.current) return;
        recognitionRef.current = null;
        setTimeout(() => restartFnRef.current?.(), 50);
      };

      recog.onerror = (e) => {
        if (answeredRef.current || stopRequestedRef.current) return;
        // For "no-speech" or "aborted" errors, restart quickly
        recognitionRef.current = null;
        setTimeout(() => restartFnRef.current?.(), 50);
      };

      try {
        recog.start();
        listeningRef.current = true;
      } catch (err) {
        recognitionRef.current = null;
        setTimeout(() => restartFnRef.current?.(), 50);
      }
    };
  }, [SpeechRecognitionClass]);

  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

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

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (watchdogRef.current) clearInterval(watchdogRef.current);

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
          mediaRecorder.start(1000);
          mediaRecorderRef.current = mediaRecorder;
        } catch {}
      }

      stopRequestedRef.current = false;
      answeredRef.current = false;
      capturedRef.current = "";
      lastActivityRef.current = Date.now();
      onAnswerRef.current = onAnswer;
      setTranscript("");
      setStatus("listening");

      timeoutIdRef.current = setTimeout(() => {
        if (answeredRef.current) return;
        answeredRef.current = true;
        stopRequestedRef.current = true;
        if (watchdogRef.current) clearInterval(watchdogRef.current);
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
        }
        // handleAnswer will manage status (evaluating -> ready)
        if (onAnswerRef.current) {
          onAnswerRef.current(capturedRef.current || "");
          onAnswerRef.current = null;
        } else {
          setStatus("ready");
        }
      }, 120000);

      restartFnRef.current?.();

      watchdogRef.current = setInterval(() => {
        if (stopRequestedRef.current || answeredRef.current) {
          clearInterval(watchdogRef.current);
          return;
        }
        if (Date.now() - lastActivityRef.current > 8000) {
          lastActivityRef.current = Date.now();
          restartFnRef.current?.();
        }
      }, 3000);
    },
    [SpeechRecognitionClass, showWarning]
  );

  const stopAndSubmit = useCallback(
    async (studentId, activeSection, currentQuestion) => {
      stopRequestedRef.current = true;
      answeredRef.current = true;

      if (watchdogRef.current) clearInterval(watchdogRef.current);
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }

      if (mediaRecorderRef.current && activeSection?.id === "speaking") {
        setStatus("evaluating");
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
          fetch(`${API_BASE_URL}/save_audio`, {
            method: "POST",
            body: formData,
          });
        }

        recorder.stream?.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      }

      // Call the onAnswer callback with captured transcript
      // handleAnswer will manage status (evaluating -> ready)
      if (onAnswerRef.current) {
        onAnswerRef.current(capturedRef.current || "");
        onAnswerRef.current = null;
      } else {
        // No callback - just set to ready so user can re-record
        setStatus("ready");
      }
    },
    []
  );

  const cleanup = useCallback(() => {
    stopRequestedRef.current = true;
    answeredRef.current = true;
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
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
