import React, { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config.js";

const PROCTOR_INTERVAL_MS = 2500;
const SNAPSHOT_INTERVAL_MS = 10000;
const INCIDENT_COOLDOWN_MS = 8000;
const NO_FACE_THRESHOLD = 2;
const GAZE_THRESHOLD = 1;

export default function CameraMonitor({
  onIncident,
  onSnapshot,
  onStatus,
  useBackend=true,
  backendUrl=API_BASE_URL
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [faces, setFaces] = useState(null);
  const [gazeStatus, setGazeStatus] = useState(null);
  const [active, setActive] = useState(false);
  
  const consecutiveNoFaceRef = useRef(0);
  const consecutiveGazeAwayRef = useRef(0);
  const lastIncidentTimeRef = useRef({});

  const canTriggerIncident = (type) => {
    const now = Date.now();
    const last = lastIncidentTimeRef.current[type] || 0;
    if (now - last < INCIDENT_COOLDOWN_MS) return false;
    lastIncidentTimeRef.current[type] = now;
    return true;
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && canTriggerIncident("tab_hidden")) {
        onIncident?.("tab_hidden", { ts: Date.now() });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [onIncident]);

  useEffect(() => {
    let stopped = false;
    async function boot() {
      try {
        onStatus?.("Requesting camera…");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        if (stopped) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setActive(true);
        onStatus?.("Camera active");
      } catch (e) {
        setError(e?.message || String(e));
        onStatus?.("Camera error");
        onIncident?.("camera_error", { message: e?.message || String(e) });
      }
    }
    if (!streamRef.current) boot();
    return () => {
      stopped = true;
      setActive(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.8);
    });
  };

  useEffect(() => {
    if (!active || !useBackend) return;
    let timer = null;
    
    const runProctorCheck = async () => {
      const blob = await captureFrame();
      if (!blob) return schedule();
      
      try {
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");
        const res = await fetch(`${backendUrl}/analyze`, { method: "POST", body: formData });
        const data = await res.json();
        
        setFaces(data.faces);
        
        if (data.faces === 0) {
          consecutiveNoFaceRef.current++;
          consecutiveGazeAwayRef.current = 0;
          setGazeStatus(null);
          if (consecutiveNoFaceRef.current >= NO_FACE_THRESHOLD && canTriggerIncident("no_face")) {
            onIncident?.("no_face", { ts: data.timestamp });
          }
        } else if (data.faces > 1) {
          consecutiveNoFaceRef.current = 0;
          consecutiveGazeAwayRef.current = 0;
          setGazeStatus(null);
          if (canTriggerIncident("multiple_faces")) {
            onIncident?.("multiple_faces", { ts: data.timestamp, count: data.faces });
          }
        } else {
          consecutiveNoFaceRef.current = 0;
          if (data.flag === "gaze_away") {
            consecutiveGazeAwayRef.current++;
            setGazeStatus("away");
            if (consecutiveGazeAwayRef.current >= GAZE_THRESHOLD && canTriggerIncident("gaze_away")) {
              onIncident?.("gaze_away", { ts: data.timestamp, yaw: data.yaw, pitch: data.pitch });
            }
          } else {
            consecutiveGazeAwayRef.current = 0;
            setGazeStatus("ok");
          }
        }
      } catch (err) {
        console.error("Proctor check failed:", err);
      }
      schedule();
    };
    
    const schedule = () => { timer = setTimeout(runProctorCheck, PROCTOR_INTERVAL_MS); };
    runProctorCheck();
    return () => clearTimeout(timer);
  }, [active, useBackend, backendUrl, onIncident]);

  useEffect(() => {
    if (!active) return;
    let timer = null;
    
    const takeSnapshot = async () => {
      const blob = await captureFrame();
      if (!blob) return scheduleSnapshot();
      const canvas = canvasRef.current;
      const dataUrl = canvas?.toDataURL("image/jpeg", 0.85) || null;
      onSnapshot?.({ blob, dataUrl, faces, ts: Date.now() });
      scheduleSnapshot();
    };
    
    const scheduleSnapshot = () => { timer = setTimeout(takeSnapshot, SNAPSHOT_INTERVAL_MS); };
    scheduleSnapshot();
    return () => clearTimeout(timer);
  }, [active, faces, onSnapshot]);

  const getStatusColor = () => {
    if (faces === 0) return "bg-red-500";
    if (faces > 1) return "bg-red-500";
    if (gazeStatus === "away") return "bg-yellow-500";
    if (gazeStatus === "ok") return "bg-green-500";
    return "bg-gray-400";
  };

  const getStatusText = () => {
    if (faces === 0) return "No face";
    if (faces > 1) return `${faces} faces`;
    if (gazeStatus === "away") return "Look at screen";
    if (gazeStatus === "ok") return "OK";
    return "Checking...";
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-2 p-2 bg-red-100 border border-red-400 rounded text-xs text-red-700">
          Camera error: {error}
        </div>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full max-h-48 rounded-lg border border-slate-200 bg-black"
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}