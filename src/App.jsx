import React, { useEffect, useMemo, useRef, useState } from 'react';
import LoginView from './components/LoginView.jsx';
import SystemCheck from './components/SystemCheck.jsx';
import InstructionsView from './components/InstructionsView.jsx';
import TestView from './components/TestView.jsx';
import FinishView from './components/FinishView.jsx';
import CameraMonitor from './components/CameraMonitor.jsx';
import DraggableCamera from './components/DraggableCamera.jsx';
import logo from './assets/logo.png';
import englishExam from '../QuestionBank/english_exam.json';
import { API_BASE_URL, WS_BASE_URL } from './config.js';

export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [studentId, setStudentId] = useState('');
  const [studentPass, setStudentPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [timer, setTimer] = useState(2700);
  const [startEnabled, setStartEnabled] = useState(false);
  const [status, setStatus] = useState(null);
  const [transcript, setTranscript] = useState('...');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [warningModal, setWarningModal] = useState(null);
  const [fullscreenWarningCount, setFullscreenWarningCount] = useState(0);
  const [attemptId, setAttemptId] = useState('');
  const examSections = useMemo(() => englishExam.sections || [], []);
  const sectionReferenceMatrix = useMemo(() => {
    const matrix = {};
    examSections.forEach((section) => {
      const questions = section.questions || [];
      let lastReferenceId = null;
      matrix[section.id] = questions.map((question) => {
        if (question.referenceId) {
          lastReferenceId = question.referenceId;
        }
        return lastReferenceId;
      });
    });
    return matrix;
  }, [examSections]);

  const [activeSectionId, setActiveSectionId] = useState(examSections[0]?.id || '');
  const [sectionIndices, setSectionIndices] = useState(() => {
    const initial = {};
    examSections.forEach(section => {
      initial[section.id] = 0;
    });
    return initial;
  });
  const [sectionAudioPlayed, setSectionAudioPlayed] = useState(() => {
    const initial = {};
    examSections.forEach(section => {
      initial[section.id] = {};
    });
    return initial;
  });
  const [sectionDirectionsSeen, setSectionDirectionsSeen] = useState(() => {
    const initial = {};
    examSections.forEach(section => {
      initial[section.id] = false;
    });
    return initial;
  });

  const SpeechRecognitionClass = useMemo(() => window.SpeechRecognition || window.webkitSpeechRecognition || null, []);
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const capturedRef = useRef('');
  const stopRequestedRef = useRef(false);
  const wsRef = useRef(null);

  const [incidents, setIncidents] = useState([]);
  const [shots, setShots] = useState([]);
  const [sectionResults, setSectionResults] = useState(() => {
    const initial = {};
    examSections.forEach(section => {
      initial[section.id] = [];
    });
    return initial;
  });

  const activeSection = useMemo(() => {
    return examSections.find(section => section.id === activeSectionId) || examSections[0];
  }, [examSections, activeSectionId]);
  const currentSectionPosition = useMemo(() => (
    examSections.findIndex(section => section.id === activeSection?.id)
  ), [examSections, activeSection?.id]);
  const totalQuestions = activeSection?.questions?.length || 0;
  const currentQuestionIndex = activeSection ? sectionIndices[activeSection.id] || 0 : 0;
  const activeQuestions = activeSection?.questions || [];
  const currentQuestion = totalQuestions ? activeQuestions[currentQuestionIndex] : null;
  const resolvedReferenceId = useMemo(() => {
    if (!currentQuestion || !activeSection) return null;
    const direct = currentQuestion.referenceId;
    if (direct) return direct;
    const sectionRefs = sectionReferenceMatrix[activeSection.id] || [];
    return sectionRefs[currentQuestionIndex] || null;
  }, [activeSection, currentQuestion, currentQuestionIndex, sectionReferenceMatrix]);

  const currentReference = useMemo(() => {
    if (!resolvedReferenceId || !activeSection) return null;
    const references = activeSection.references || [];
    return references.find((ref) => ref.id === resolvedReferenceId) || null;
  }, [activeSection, resolvedReferenceId]);
  const referenceDefaultOpen = Boolean(currentQuestion?.referenceId && currentReference);
  const isReferenceAnchorQuestion = Boolean(referenceDefaultOpen);
  const referenceDisplayMode = isReferenceAnchorQuestion
    ? 'anchor'
    : currentReference
    ? 'toggle'
    : 'none';
  const activeSectionDirectionsSeen = activeSection ? sectionDirectionsSeen[activeSection.id] : true;
  const dismissSectionDirections = () => {
    if (!activeSection) return;
    setSectionDirectionsSeen(prev => ({
      ...prev,
      [activeSection.id]: true
    }));
  };
  const showSectionDirections = Boolean(activeSection && !activeSectionDirectionsSeen);
  const sectionDirectionsCopy = activeSection?.instructions
    ? `${activeSection.instructions} Keep your face centered, remain in fullscreen, and speak clearly before recording.`
    : 'Review the prompt carefully, stay in fullscreen, keep your face centered, and speak clearly before recording.';
  const [isReferencePanelOpen, setIsReferencePanelOpen] = useState(referenceDefaultOpen);
  const lastReferenceIdRef = useRef(resolvedReferenceId || null);
  useEffect(() => {
    if (!resolvedReferenceId) {
      lastReferenceIdRef.current = null;
      setIsReferencePanelOpen(false);
      return;
    }
    if (lastReferenceIdRef.current !== resolvedReferenceId) {
      lastReferenceIdRef.current = resolvedReferenceId;
      setIsReferencePanelOpen(referenceDefaultOpen);
      return;
    }
    if (referenceDefaultOpen && !isReferencePanelOpen) {
      setIsReferencePanelOpen(true);
    }
  }, [resolvedReferenceId, referenceDefaultOpen, isReferencePanelOpen]);
  const currentSectionAudioMap = activeSection ? sectionAudioPlayed[activeSection.id] || {} : {};
  const hasAudioPlayed = !!currentSectionAudioMap[currentQuestionIndex];
  const activeSectionResults = activeSection ? sectionResults[activeSection.id] || [] : [];
  const nextSection = useMemo(() => {
    if (currentSectionPosition === -1) return null;
    return examSections[currentSectionPosition + 1] || null;
  }, [examSections, currentSectionPosition]);
  const previousQuestionTarget = useMemo(() => {
    if (!activeSection || currentSectionPosition === -1) return null;
    if (totalQuestions > 0 && currentQuestionIndex > 0) {
      return { sectionId: activeSection.id, questionIndex: currentQuestionIndex - 1 };
    }
    for (let i = currentSectionPosition - 1; i >= 0; i--) {
      const section = examSections[i];
      const count = section.questions?.length || 0;
      if (count > 0) {
        return { sectionId: section.id, questionIndex: count - 1 };
      }
    }
    return null;
  }, [activeSection, currentQuestionIndex, currentSectionPosition, examSections, totalQuestions]);
  const isLastSection = useMemo(() => (
    currentSectionPosition !== -1 && currentSectionPosition === examSections.length - 1
  ), [currentSectionPosition, examSections.length]);
  const primaryActionLabel = useMemo(() => {
    if (!activeSection) return 'Next';
    if (totalQuestions === 0) {
      return isLastSection ? 'Submit Exam' : 'Next Section';
    }
    if (currentQuestionIndex < totalQuestions - 1) {
      return 'Next Question';
    }
    if (!isLastSection) {
      return 'Next Section';
    }
    return 'Submit Exam';
  }, [activeSection, currentQuestionIndex, totalQuestions, isLastSection]);
  const navigationLocked = status === 'listening' || status === 'evaluating';
  const disablePrev = !previousQuestionTarget || navigationLocked;
  const disableNext = navigationLocked;

  const resetSectionState = () => {
    const indices = {};
    const audioFlags = {};
    const results = {};
    const directionsFlags = {};
    examSections.forEach(section => {
      indices[section.id] = 0;
      audioFlags[section.id] = {};
      results[section.id] = new Array(section.questions.length).fill(null);
      directionsFlags[section.id] = false;
    });
    setSectionIndices(indices);
    setSectionAudioPlayed(audioFlags);
    setSectionResults(results);
    setSectionDirectionsSeen(directionsFlags);
    setActiveSectionId(examSections[0]?.id || '');
  };
  async function mockUploadSnapshot({ blob, ts, faces }) {
    console.log("[Proctoring] Snapshot @", new Date(ts).toISOString(), "faces:", faces, "size:", blob?.size);
  }
  const persistAnswerScript = async (entry) => {
    try {
      await fetch(`${API_BASE_URL}/save_answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (err) {
      console.error('Failed to store answer script', err);
    }
  };
  const lastAlertRef = useRef({});
  const registerIncident = (type, payload = {}) => {
    setIncidents(prev => [...prev, { type, ...payload }]);
  };
  const showWarning = (title, message) => setWarningModal({ title, message });
  const closeWarning = () => setWarningModal(null);
  const enterFullscreen = async (resetCount = false, logFailure = false) => {
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
      showWarning('Fullscreen blocked', 'Allow fullscreen access to continue the exam.');
      if (logFailure) {
        registerIncident('fullscreen_denied', { ts: Date.now(), message: 'Fullscreen request denied' });
      }
    }
  };
  const fullscreenWarningCountRef = useRef(0);
  const endingSessionRef = useRef(false);
  
  function handleIncident(type, payload) {
    registerIncident(type, payload);
    console.warn('[Proctoring Incident]', type, payload || {});
    const now = Date.now();
    const lastAlert = lastAlertRef.current[type] || 0;
    if (now - lastAlert < 5000) {
      return;
    }
    const warnings = {
      'no_face': 'No face detected. Position yourself in view.',
      'multiple_faces': 'Only the registered student should be visible.',
      'gaze_away': 'Keep your gaze on the screen.',
      'tab_hidden': 'Do not switch tabs during the exam.',
      'window_blur': 'Return focus to the exam window.'
    };
    if (warnings[type] && type !== 'window_blur' && type !== 'window_focus') {
      lastAlertRef.current[type] = now;
      showWarning('Proctoring Alert', warnings[type]);
    }
  }
  function handleSnapshot({ blob, dataUrl, faces, ts }) {
    setShots(prev => [...prev, { ts, faces }]);
    mockUploadSnapshot({ blob, ts, faces });
  }
  useEffect(() => {
    if (currentView !== 'test') return;
    setTranscript('...');
    setStatus('ready');
  }, [currentView, currentQuestionIndex, activeSectionId]);

  useEffect(() => {
    if (!activeSection) return;
    if (activeSectionDirectionsSeen) return;
    if (currentQuestionIndex > 0) {
      setSectionDirectionsSeen(prev => ({
        ...prev,
        [activeSection.id]: true
      }));
    }
  }, [activeSection, activeSectionDirectionsSeen, currentQuestionIndex]);

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

  const startTest = async () => {
    const sessionStamp = new Date().toISOString().replace(/[:.]/g, '-');
    setAttemptId(`${studentId || 'student'}_${sessionStamp}`);
    await enterFullscreen(true, true);
    navigateTo('test');
    setIncidents([]);
    setShots([]);
    resetSectionState();
    setTimer(2700);
    endingSessionRef.current = false;
    initWebSocket();
  };

  const initWebSocket = () => {
    if (!studentId) return;
    const ws = new WebSocket(`${WS_BASE_URL}/heartbeat/${studentId}`);
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
    if (!currentQuestion || !activeSection) return;
    if (currentQuestion.delivery !== 'tts') {
      showWarning('Audio unavailable', 'This question must be read on-screen.');
      return;
    }
    if (hasAudioPlayed) {
      showWarning('Audio Limit', 'Audio has already been played once for this question.');
      return;
    }
    const spokenText = currentQuestion.spokenText || currentQuestion.prompt;
    speak(spokenText);
    setSectionAudioPlayed((prev) => ({
      ...prev,
      [activeSection.id]: {
        ...(prev[activeSection.id] || {}),
        [currentQuestionIndex]: true
      }
    }));
  };

  const playReferenceAudio = () => {
    if (!currentReference) {
      showWarning('Audio unavailable', 'No passage audio is available for this question.');
      return;
    }
    const textToSpeak = currentReference.text?.trim();
    if (!textToSpeak) {
      showWarning('Audio unavailable', 'This passage has no narratable text.');
      return;
    }
    speak(textToSpeak);
  };

  const switchQuestion = (index) => {
    if (!activeSection) return;
    if (status === 'listening' || status === 'evaluating') {
      showWarning('Action blocked', 'Complete the current question before switching.');
      return;
    }
    const safeIndex = Math.max(0, Math.min(index, (activeSection.questions?.length || 1) - 1));
    setSectionIndices((prev) => ({
      ...prev,
      [activeSection.id]: safeIndex
    }));
  };

  const handleSectionChange = (sectionId) => {
    if (sectionId === activeSectionId) return;
    if (status === 'listening' || status === 'evaluating') {
      showWarning('Action blocked', 'Complete the current question before switching sections.');
      return;
    }
    setActiveSectionId(sectionId);
  };

  const handleNextQuestion = () => {
    if (!activeSection) return;
    if (navigationLocked) {
      showWarning('Action blocked', 'Complete the current question before moving forward.');
      return;
    }

    if (totalQuestions === 0) {
      if (nextSection) {
        setActiveSectionId(nextSection.id);
      } else {
        finishTest();
      }
      return;
    }

    const lastIndexInSection = totalQuestions - 1;
    const isLastInSection = currentQuestionIndex >= lastIndexInSection;
    if (!isLastInSection) {
      switchQuestion(currentQuestionIndex + 1);
      return;
    }

    if (nextSection) {
      setActiveSectionId(nextSection.id);
      return;
    }
    finishTest();
  };

  const handlePreviousQuestion = () => {
    if (!previousQuestionTarget) return;
    if (navigationLocked) {
      showWarning('Action blocked', 'Complete the current question before moving back.');
      return;
    }
    const { sectionId, questionIndex } = previousQuestionTarget;
    if (sectionId === activeSection?.id) {
      switchQuestion(questionIndex);
      return;
    }
    setSectionIndices((prev) => ({
      ...prev,
      [sectionId]: questionIndex
    }));
    setActiveSectionId(sectionId);
  };

  const startListening = () => {
    if (!SpeechRecognitionClass) {
      showWarning('Unsupported browser', 'Please use Chrome or Edge for speech recording.');
      setStatus('error');
      handleAnswer("Error: API unsupported.");
      return;
    }
    if (listeningRef.current && recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recog = new SpeechRecognitionClass();
    recog.continuous = true;
    recog.lang = 'en-US';
    recog.interimResults = true;
    recognitionRef.current = recog;
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
    if (!currentQuestion || !activeSection) {
      setStatus('ready');
      return;
    }
    setStatus('evaluating');
    const evaluation = await mockEvaluateOnBackend(currentQuestion.prompt, answer);
    const effectiveAttemptId = attemptId || `${studentId || 'student'}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    setSectionResults((prev) => {
      const updated = { ...prev };
      const sectionArray = [...(updated[activeSection.id] || new Array(activeSection.questions.length).fill(null))];
      sectionArray[currentQuestionIndex] = {
        questionId: currentQuestion.id,
        prompt: currentQuestion.prompt,
        answer,
        ...evaluation
      };
      updated[activeSection.id] = sectionArray;
      return updated;
    });
    await persistAnswerScript({
      student_id: studentId,
      attempt_id: effectiveAttemptId,
      section_id: activeSection.id,
      section_title: activeSection.title,
      question_number: currentQuestionIndex + 1,
      question_id: currentQuestion.id,
      question: currentQuestion.prompt,
      answer,
      accuracy: evaluation?.accuracy ?? null,
      clarity: evaluation?.clarity ?? null,
      feedback: evaluation?.feedback ?? '',
      timestamp: Date.now()
    });
    setStatus('ready');
  }

  const finishTest = async () => {
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    setShowSubmitModal(false);
    setStatus(null);
    navigateTo('finish');
    endingSessionRef.current = true;
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error('Failed to exit fullscreen', err);
      }
    }
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
    endingSessionRef.current = false;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (endingSessionRef.current) return;
      if (currentView !== 'test') return;
      if (document.fullscreenElement) return;
      const next = fullscreenWarningCountRef.current + 1;
      fullscreenWarningCountRef.current = next;
      setFullscreenWarningCount(next);
      registerIncident('fullscreen_exit', { ts: Date.now(), message: `Exited fullscreen (${next}/2)` });
      if (next >= 2) {
        showWarning('Exam ended', 'Exam submitted because fullscreen was exited twice.');
        confirmSubmit();
      } else {
        showWarning('Fullscreen warning', `Return to fullscreen to continue. Warning ${next}/2.`);
        enterFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [currentView, confirmSubmit, enterFullscreen, registerIncident, showWarning]);
  
  const saveIncidentsLog = async () => {
    try {
      const csvSections = [];
      csvSections.push('PROCTORING INCIDENTS');
      csvSections.push('Student ID,Incident Type,Timestamp (IST),Details');
      if (incidents.length === 0) {
        csvSections.push(`${studentId},none,${new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })},"No incidents recorded")`);
      } else {
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
          } else if (inc.type === 'fullscreen_exit') {
            details = 'Student exited fullscreen mode';
          } else if (inc.type === 'fullscreen_denied') {
            details = 'Student blocked fullscreen request';
          }
          
          csvSections.push(`${studentId},${inc.type},${istTimestamp},"${details}"`);
        });
      }
      const csv = csvSections.join('\n');
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
      
      await fetch(`${API_BASE_URL}/save_incidents`, {
        method: 'POST',
        body: formData
      });
      
      console.log(`Saved ${flattenedResults.length} answers and ${incidents.length} incidents to backend`);
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
          <div className="bg-purple-700 text-white px-6 py-3 flex items-center shadow-md">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Adira Academy" className="h-10 w-10 rounded-full bg-white p-1" />
              <span className="text-xl font-bold">Adira Entrance Exam</span>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-4">
              <span className="text-base font-medium text-white">
                Time: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </span>
              {fullscreenWarningCount > 0 && (
                <span className="text-sm font-semibold text-yellow-200">
                  Fullscreen warning {fullscreenWarningCount}/2
                </span>
              )}
              <button
                onClick={() => enterFullscreen(false, true)}
                className="bg-transparent border border-white/70 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white hover:text-purple-700 transition"
              >
                Fullscreen
              </button>
              <button
                onClick={finishTest}
                className="bg-white text-purple-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                End Exam
              </button>
            </div>
          </div>

          <div className="flex bg-white">
            <div className="flex-1 p-8">
              <div className="mb-6 rounded-lg bg-slate-100/60 p-1 overflow-x-auto">
                <div className="flex gap-2 min-w-full">
                  {examSections.map((section) => {
                    const isActive = section.id === activeSectionId;
                    const questionCount = section.questions?.length || 0;
                    return (
                      <button
                        key={section.id}
                        onClick={() => handleSectionChange(section.id)}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition whitespace-nowrap ${
                          isActive
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-slate-600 hover:bg-white/80'
                        }`}
                      >
                        {section.title}
                        <span className="text-xs font-normal text-slate-500 ml-2">({questionCount} Qs)</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {showSectionDirections && (
                <div className="mb-6 p-5 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Section Briefing</p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {sectionDirectionsCopy}
                      </p>
                    </div>
                    <button
                      onClick={dismissSectionDirections}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Start Section
                    </button>
                  </div>
                </div>
              )}

              <TestView
                questionIndex={totalQuestions ? currentQuestionIndex + 1 : 0}
                totalQuestions={totalQuestions}
                question={currentQuestion}
                status={status}
                transcript={transcript}
                onStartRecording={startListening}
                onStopRecording={stopAndSubmit}
                onPlayAudio={playAudio}
                onPrevQuestion={handlePreviousQuestion}
                onNextQuestion={handleNextQuestion}
                disablePrev={disablePrev}
                disableNext={disableNext}
                canPlayAudio={currentQuestion?.delivery === 'tts'}
                hasAudioPlayed={hasAudioPlayed}
                primaryActionLabel={primaryActionLabel}
                referenceMaterial={currentReference}
                isReferenceOpen={isReferencePanelOpen}
                onToggleReferencePanel={() => setIsReferencePanelOpen(prev => !prev)}
                referenceDisplayMode={referenceDisplayMode}
                onPlayReferenceAudio={playReferenceAudio}
              />
            </div>

            <div className="w-80 border-l border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Section Questions</h3>
                <span className="text-xs text-gray-500">{totalQuestions} total</span>
              </div>
              {activeQuestions.length > 0 ? (
                <div className="grid grid-cols-5 gap-2">
                  {activeQuestions.map((questionItem, idx) => {
                    const answered = Boolean(activeSectionResults[idx]);
                    return (
                      <button
                        key={questionItem.id || idx}
                        onClick={() => switchQuestion(idx)}
                        className={`w-12 h-12 rounded-lg font-semibold transition ${
                          idx === currentQuestionIndex
                            ? 'bg-purple-600 text-white'
                            : answered
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No questions configured for this section yet.</p>
              )}
              
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

      {warningModal && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-40 pt-20">
          <div className="bg-white rounded-lg shadow-xl p-5 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">{warningModal.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{warningModal.message}</p>
            <div className="flex justify-end">
                <button
                  onClick={closeWarning}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition"
                >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-medium transition-colors"
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
