import React, { useEffect, useMemo, useRef, useState } from 'react';
import LoginView from './components/LoginView.jsx';
import SystemCheck from './components/SystemCheck.jsx';
import InstructionsView from './components/InstructionsView.jsx';
import TestView from './components/TestView.jsx';
import FinishView from './components/FinishView.jsx';
import CameraMonitor from './components/CameraMonitor.jsx';
import DraggableCamera from './components/DraggableCamera.jsx';
import logo from './assets/logo.png';

export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [studentId, setStudentId] = useState('');
  const [studentPass, setStudentPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timer, setTimer] = useState(1200);
  const [startEnabled, setStartEnabled] = useState(false);
  const [status, setStatus] = useState(null);
  const [transcript, setTranscript] = useState('...');
  const [questionText, setQuestionText] = useState('Loading question...');
  const [audioPlayed, setAudioPlayed] = useState({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const questions = useMemo(() => ([
    "What is the capital of France?",
    "What is 8 multiplied by 7?",
    "Who wrote the book 'Wings of Fire'?",
    "What is the national bird of India?",
    "In which year did India gain independence?",
    "What is the largest planet in our solar system?",
    "Who is known as the Father of the Indian Constitution?"
  ]), []);

  const SpeechRecognition = useMemo(() => window.SpeechRecognition || window.webkitSpeechRecognition, []);
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const capturedRef = useRef('');
  const stopRequestedRef = useRef(false);
  const wsRef = useRef(null);

  const [incidents, setIncidents] = useState([]);
  const [shots, setShots] = useState([]);
  const [results, setResults] = useState([]);
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
    setStatus('ready');
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

  useEffect(() => {
    if (currentView !== 'test') return;
    
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentView]);

  const navigateTo = (view) => setCurrentView(view);

  const startTest = () => {
    navigateTo('test');
    setIncidents([]);
    setShots([]);
    setResults([]);
    setCurrentQuestionIndex(0);
    setAudioPlayed({});
    setTimer(1200);
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

  const playAudio = () => {
    if (!audioPlayed[currentQuestionIndex]) {
      const q = questions[currentQuestionIndex];
      speak(q);
      setAudioPlayed(prev => ({ ...prev, [currentQuestionIndex]: true }));
    } else {
      alert('Audio has already been played once for this question.');
    }
  };

  const switchQuestion = (index) => {
    if (status === 'listening' || status === 'evaluating') {
      alert('Please complete the current question before switching.');
      return;
    }
    setCurrentQuestionIndex(index);
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
    }, 120000);

    recog.onresult = (event) => {
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
    setResults(prev => {
      const updated = [...prev];
      updated[currentQuestionIndex] = { question, answer, ...evaluation };
      return updated;
    });
    setCurrentQuestionIndex((idx) => idx + 1);
  }

  const finishTest = async () => {
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);
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
    try {
      const sections = [];
      
      if (results.length > 0) {
        sections.push('EXAM RESULTS');
        sections.push('Question Number,Question,Answer,Accuracy,Clarity,Feedback');
        results.forEach((result, idx) => {
          if (result) {
            const qNum = idx + 1;
            const question = (result.question || '').replace(/"/g, '""');
            const answer = (result.answer || '').replace(/"/g, '""');
            const feedback = (result.feedback || '').replace(/"/g, '""');
            sections.push(`${qNum},"${question}","${answer}",${result.accuracy || 'N/A'},${result.clarity || 'N/A'},"${feedback}"`);
          }
        });
        sections.push('');
      }
      
      if (incidents.length > 0) {
        sections.push('PROCTORING INCIDENTS');
        sections.push('Student ID,Incident Type,Timestamp (IST),Details');
        incidents.forEach(inc => {
          const date = new Date(inc.ts || Date.now());
          const istTimestamp = date.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          
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
          
          sections.push(`${studentId},${inc.type},${istTimestamp},"${details}"`);
        });
      }
      
      const csv = sections.join('\n');
      const formData = new FormData();
      const blob = new Blob([csv], { type: 'text/csv' });
      
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
      
      console.log(`Saved ${results.length} answers and ${incidents.length} incidents to backend`);
    } catch (err) {
      console.error('Failed to save exam log:', err);
    }
  };

  async function mockEvaluateOnBackend(question, answer) {
    console.log(`[Backend MOCK] Evaluating Q: "${question}" | A: "${answer}"`);
    await new Promise((r) => setTimeout(r, 1200));
    return {
      feedback: "feedback from the AI."
    };
  }

  async function mockSaveToSheet(resultData) {
    console.log("[Backend MOCK] Saving to Sheet:", resultData);
    await new Promise((r) => setTimeout(r, 400));
    return { success: true };
  }

  return (
    <>
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
        <div className="min-h-screen bg-white">
          <div className="bg-blue-600 text-white px-6 py-3 flex items-center shadow-md">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Adira Academy" className="h-10 w-10 rounded-full bg-white p-1" />
              <span className="text-xl font-bold">Adira Entrance Exam</span>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-4">
              <span className="text-base font-medium text-white">
                Time: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </span>
              <button
                onClick={finishTest}
                className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                Submit
              </button>
            </div>
          </div>

          <div className="flex bg-white">
            <div className="flex-1 p-8">
              <TestView
                questionIndex={Math.min(currentQuestionIndex + 1, questions.length)}
                totalQuestions={questions.length}
                questionText={questionText}
                status={status}
                transcript={transcript}
                onStartRecording={startListening}
                onStopRecording={stopAndSubmit}
                onPlayAudio={playAudio}
              />
            </div>

            <div className="w-80 border-l border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => switchQuestion(idx)}
                    className={`w-12 h-12 rounded-lg font-semibold transition ${
                      idx === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : results[idx]
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              
              <div className="mt-6">
                <div className="bg-slate-100 rounded-lg p-3 border border-slate-300">
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">Camera Monitor</h4>
                  <CameraMonitor
                    onIncident={handleIncident}
                    onSnapshot={handleSnapshot}
                    onStatus={(s) => console.log("[Camera]", s)}
                    snapshotIntervalMs={10000}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView === 'finish' && <FinishView />}

      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Submit Exam</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to submit the exam? You cannot undo this action.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
