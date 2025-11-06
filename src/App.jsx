import React, { useEffect, useMemo, useRef, useState } from 'react';
import LoginView from './components/LoginView.jsx';
import SystemCheck from './components/SystemCheck.jsx';
import InstructionsView from './components/InstructionsView.jsx';
import TestView from './components/TestView.jsx';
import FinishView from './components/FinishView.jsx';
import CameraMonitor from './components/CameraMonitor.jsx';
import DraggableCamera from './components/DraggableCamera.jsx';

export default function App() {
  // --- Application State and Configuration ---
  const [currentView, setCurrentView] = useState('login'); // 'login' | 'systemcheck' | 'instructions' | 'test' | 'finish'
  const [studentId, setStudentId] = useState('');
  const [studentPass, setStudentPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timer, setTimer] = useState(60);
  const [startEnabled, setStartEnabled] = useState(false);
  const [status, setStatus] = useState(null); // 'speaking' | 'listening' | 'evaluating' | 'error' | null
  const [transcript, setTranscript] = useState('...');
  const [questionText, setQuestionText] = useState('Loading question...');

  const questions = useMemo(() => ([
    "What is the capital of France?",

    "What is 8 multiplied by 7?"
  ]), []);

  // --- Speech Synthesis & Recognition ---
  const SpeechRecognition = useMemo(() => window.SpeechRecognition || window.webkitSpeechRecognition, []);
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const capturedRef = useRef('');
  const stopRequestedRef = useRef(false);
  const wsRef = useRef(null);

  const [incidents, setIncidents] = useState([]);
  const [shots, setShots] = useState([]);

  // Mock upload hooks (replace with real API later)
  async function mockUploadSnapshot({ blob, ts, faces }) {
    console.log("[Proctoring] Snapshot @", new Date(ts).toISOString(), "faces:", faces, "size:", blob?.size);
  }
  const lastAlertRef = useRef({});
  
  function handleIncident(type, payload) {
    setIncidents(prev => [...prev, { type, ...payload }]);
    console.warn("[Proctoring Incident]", type, payload || {});
    
    const now = Date.now();
    const lastAlert = lastAlertRef.current[type] || 0;
    
    if (now - lastAlert < 5000) {
      return;
    }
    
    const warnings = {
      'no_face': 'Warning: No face detected',
      'multiple_faces': 'Warning: Multiple people detected',
      'gaze_away': 'Warning: Looking away',
      'tab_hidden': 'Warning: You switched tabs',
      'window_blur': 'Warning: Window focus lost'
    };
    
    if (warnings[type] && type !== 'window_blur' && type !== 'window_focus') {
      lastAlertRef.current[type] = now;
      alert(warnings[type]);
    }
  }
  function handleSnapshot({ blob, dataUrl, faces, ts }) {
    setShots(prev => [...prev, { ts, faces }]);
    mockUploadSnapshot({ blob, ts, faces });
  }
  useEffect(() => {
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = true; // keep listening across short pauses
      recog.lang = 'en-US';
      recog.interimResults = true; // accumulate partial speech
      recognitionRef.current = recog;
    }
  }, [SpeechRecognition]);

  useEffect(() => {
    if (currentView !== 'test') return;
    if (currentQuestionIndex >= questions.length) {
      finishTest();
      return;
    }
    const q = questions[currentQuestionIndex];
    setQuestionText(q);
    setTranscript('...');
    speak(q);
    }, [currentQuestionIndex, currentView]);

  useEffect(() => {
    if (currentView !== 'instructions') return;
    setTimer(10);
    setStartEnabled(false);

    const interval = setInterval(() => {
      setTimer((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          setStartEnabled(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentView]);

  // --- Navigation helpers ---
  const navigateTo = (view) => setCurrentView(view);

  const startTest = () => {
    navigateTo('test');
    setIncidents([]);
    setShots([]);
    setCurrentQuestionIndex(0);
    initWebSocket();
  };

  const initWebSocket = () => {
    if (!studentId) return;
    const ws = new WebSocket(`ws://localhost:8000/heartbeat/${studentId}`);
    ws.onopen = () => {
      wsRef.current = ws;
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 5000);
      ws.onclose = () => clearInterval(ping);
    };
    ws.onerror = (err) => console.error("WebSocket error:", err);
  };

  const speak = (text) => {
    try { window.speechSynthesis.cancel(); } catch {}
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('ready');
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const recog = recognitionRef.current;
    if (!recog) {
      alert("Sorry, your browser does not support the Web Speech API. Please use Google Chrome or Microsoft Edge.");
      setStatus('error');
      handleAnswer("Error: API unsupported.");
      return;
    }
    if (listeningRef.current) {
      try { recog.abort(); } catch {}
    }
    listeningRef.current = true;
    stopRequestedRef.current = false;
    capturedRef.current = '';
    setTranscript('');
    setStatus('listening');

    let handled = false;
    const timeoutId = setTimeout(() => {
      if (handled) return;
      handled = true;
      try { recog.stop(); } catch {}
      setStatus('error');
      handleAnswer("Error: Timeout / no speech detected.");
    }, 120000); // 2 minutes safety timeout for manual-stop mode

    recog.onresult = (event) => {
      // Rebuild full transcript from all results to avoid duplication or loss
      let full = '';
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      capturedRef.current = full;
      setTranscript(full.trim());
    };

    recog.onspeechend = () => {};

    recog.onend = () => {
      listeningRef.current = false;
      if (stopRequestedRef.current) {
        // Manual stop: submit whatever we captured (may be empty)
        const finalText = (capturedRef.current || '').trim();
        handleAnswer(finalText || '');
        return;
      }
      if (!handled) {
        handled = true;
        clearTimeout(timeoutId);
        setStatus('error');
        handleAnswer("Error: Could not recognize speech.");
      }
    };

    recog.onerror = (event) => {
      if (handled) return;
      handled = true;
      clearTimeout(timeoutId);
      setStatus('error');
      try { recog.abort(); } catch {}
      handleAnswer(`Error: ${event.error}`);
    };

    try {
      recog.start();
    } catch (e) {
      try { recog.abort(); } catch (_) {}
      try { recog.start(); } catch (_) {}
    }
  };

  const stopAndSubmit = () => {
    const recog = recognitionRef.current;
    if (!recog) return;
    stopRequestedRef.current = true;
    setStatus('evaluating');
    try { recog.stop(); } catch {}
  };

  async function handleAnswer(answer) {
    setStatus('evaluating');
    const question = questions[currentQuestionIndex];
    const evaluation = await mockEvaluateOnBackend(question, answer);
    await mockSaveToSheet({ studentId, question, answer, ...evaluation });
    setCurrentQuestionIndex((idx) => idx + 1);
  }

  const finishTest = async () => {
    setStatus(null);
    navigateTo('finish');
    try { window.speechSynthesis.cancel(); } catch {}
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      listeningRef.current = false;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    await saveIncidentsLog();
  };
  
  const saveIncidentsLog = async () => {
    if (incidents.length === 0) return;
    
    try {
      const csv = [
        'Student ID,Incident Type,Timestamp (IST),Details',
        ...incidents.map(inc => {
          // Convert UTC to IST (UTC + 5:30)
          const date = new Date(inc.ts || Date.now());
          const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
          const istTimestamp = istDate.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          
          // Build details based on incident type
          let details = '';
          if (inc.message) {
            details = inc.message;
          } else if (inc.type === 'no_face') {
            details = 'Student face not visible in frame';
          } else if (inc.type === 'multiple_faces') {
            details = 'Multiple faces detected in frame';
          } else if (inc.type === 'gaze_away') {
            details = 'Student looking away from screen';
          } else if (inc.type === 'tab_hidden') {
            details = 'Student switched to another tab/window';
          } else if (inc.type === 'voice_detected') {
            details = 'Voice/audio detected in background';
          }
          
          return `${studentId},${inc.type},${istTimestamp},"${details}"`;
        })
      ].join('\n');
      
      const formData = new FormData();
      const blob = new Blob([csv], { type: 'text/csv' });
      
      // Generate filename with IST timestamp
      const testStartTime = new Date().toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/[\/: ]/g, '-');
      
      formData.append('file', blob, `${studentId}_${testStartTime}.csv`);
      formData.append('student_id', studentId);
      
      await fetch('http://localhost:8000/save_incidents', {
        method: 'POST',
        body: formData
      });
      
      console.log(`Saved ${incidents.length} incidents to backend`);
    } catch (err) {
      console.error('Failed to save incidents log:', err);
    }
  };

  async function mockEvaluateOnBackend(question, answer) {
    console.log(`[Backend MOCK] Evaluating Q: "${question}" | A: "${answer}"`);
    await new Promise((r) => setTimeout(r, 1200));
    return {
      accuracy: Math.floor(Math.random() * 5) + 1,
      clarity: Math.floor(Math.random() * 3) + 1,
      feedback: "This is a simulated feedback from the AI."
    };
  }

  async function mockSaveToSheet(resultData) {
    console.log("[Backend MOCK] Saving to Sheet:", resultData);
    await new Promise((r) => setTimeout(r, 400));
    return { success: true };
  }

  return (
    <div className="bg-slate-100 text-slate-800 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8 text-center">
        {currentView === 'login' && (
          <LoginView
            studentId={studentId}
            setStudentId={setStudentId}
            studentPass={studentPass}
            setStudentPass={setStudentPass}
            authError={authError}
            onSubmit={async () => {
              setAuthError('');
              try {
                const res = await fetch('/students.csv');
                const text = await res.text();
                const rows = text.trim().split('\n').slice(1);
                const match = rows.find(row => {
                  const [id, pass] = row.split(',');
                  return id === studentId.trim() && pass === studentPass.trim();
                });
                if (match) {
                  navigateTo('systemcheck');
                } else {
                  setAuthError('Invalid Student ID or Password');
                }
              } catch (err) {
                setAuthError('Error loading credentials database');
              }
            }}
          />
        )}

        {currentView === 'systemcheck' && (
          <SystemCheck studentId={studentId} onProceed={() => navigateTo('instructions')} />
        )}

        {currentView === 'instructions' && (
          <InstructionsView timer={timer} startEnabled={startEnabled} onStart={startTest} />
        )}

        {currentView === 'test' && (
          <>
            <DraggableCamera>
              <CameraMonitor
                onIncident={handleIncident}
                onSnapshot={handleSnapshot}
                onStatus={(s) => console.log("[Camera]", s)}
                snapshotIntervalMs={10000} // 10s
              />
            </DraggableCamera>
            <TestView
              questionIndex={Math.min(currentQuestionIndex + 1, questions.length)}
              totalQuestions={questions.length}
              questionText={questionText}
              status={status}
              transcript={transcript}
              onStartRecording={startListening}
              onStopRecording={stopAndSubmit}
            />
          </>
        )}

        {currentView === 'finish' && <FinishView />}
      </div>
    </div>
  );
}
