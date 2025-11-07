import React, { useEffect, useRef, useState } from "react";

export default function CameraMonitor({
  onIncident,
  onSnapshot,
  onStatus,
  snapshotIntervalMs=10000,
  useBackend=true,
  backendUrl="http://localhost:8000"
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [faces, setFaces] = useState(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        onIncident?.("tab_hidden", { ts: Date.now() });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
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

    if (!streamRef.current) {
      boot();
    }

    return () => {
      stopped = true;
      setActive(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let timer = null;
    const takeShot = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return schedule();

      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);

      canvas.toBlob(async (blob) => {
        const ts = Date.now();
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        let faceCount = null;

        if (useBackend && blob) {
          try {
            const formData = new FormData();
            formData.append("file", blob, "snapshot.jpg");
            const res = await fetch(`${backendUrl}/detect`, { method: "POST", body: formData });
            const data = await res.json();
            faceCount = data.faces;
            setFaces(faceCount);
            if (data.flag) onIncident?.(data.flag, { ts: data.timestamp });
            
            if (faceCount === 1) {
              const gazeFormData = new FormData();
              gazeFormData.append("file", blob, "snapshot.jpg");
              const gazeRes = await fetch(`${backendUrl}/gaze`, { method: "POST", body: gazeFormData });
              const gazeData = await gazeRes.json();
              if (gazeData.flag === "gaze_away") {
                onIncident?.("gaze_away", { ts: gazeData.timestamp });
              }
            }
          } catch (err) {
            console.error("Backend detection failed:", err);
          }
        }

        onSnapshot?.({ blob, dataUrl, faces: faceCount, ts });
      }, "image/jpeg", 0.85);

      schedule();
    };

    const schedule = () => { timer = setTimeout(takeShot, snapshotIntervalMs); };
    schedule();
    return () => clearTimeout(timer);
  }, [active, snapshotIntervalMs, useBackend, backendUrl]);

  return (
    <div className="w-full">
      {typeof faces === "number" && faces !== 1 && (
        <div className="mb-2 p-2 bg-red-100 border border-red-400 rounded text-sm text-red-700 font-medium">
          ⚠️ {faces === 0 ? "No face detected" : `Multiple faces detected (${faces})`}
        </div>
      )}
      {error && (
        <div className="mb-2 p-2 bg-red-100 border border-red-400 rounded text-sm text-red-700">
          Camera error: {error}
        </div>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full max-h-64 rounded-lg border border-slate-200 bg-black"
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}