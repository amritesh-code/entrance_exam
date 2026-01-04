import React, { useEffect, useMemo, useRef, useState } from 'react';
import LoginView from './components/LoginView.jsx';
import SystemCheck from './components/SystemCheck.jsx';
import InstructionsView from './components/InstructionsView.jsx';
import TestView from './components/TestView.jsx';
import FinishView from './components/FinishView.jsx';
import CameraMonitor from './components/CameraMonitor.jsx';
import ExamHeader from './components/ExamHeader.jsx';
import SubjectTabs from './components/SubjectTabs.jsx';
import SectionTabs from './components/SectionTabs.jsx';
import SectionBriefing from './components/SectionBriefing.jsx';
import QuestionSidebar from './components/QuestionSidebar.jsx';
import { WarningModal, SubmitModal } from './components/ExamModals.jsx';
import { API_BASE_URL, WS_BASE_URL } from './config.js';
import { useExamData, useFullscreen, useSpeechRecognition, useProctoring } from './hooks';

export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [studentId, setStudentId] = useState('');
  const [studentPass, setStudentPass] = useState('');
  const [studentExamSet, setStudentExamSet] = useState('A');
  const [authError, setAuthError] = useState('');
  const [subjectTimers, setSubjectTimers] = useState({ english: 2700, maths: 2700 });
  const [startEnabled, setStartEnabled] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [warningModal, setWarningModal] = useState(null);
  const [attemptId, setAttemptId] = useState('');
  const [instructionTimer, setInstructionTimer] = useState(10);
  const wsRef = useRef(null);

  const showWarning = (title, message) => setWarningModal({ title, message });
  const closeWarning = () => setWarningModal(null);
  const navigateTo = (view) => setCurrentView(view);

  // Custom hooks
  const examData = useExamData(studentExamSet);
  const proctoring = useProctoring(studentId);
  
  const registerIncidentWithContext = (type, payload = {}) => {
    const questionContext = examData.currentQuestion 
      ? `${examData.activeSection?.title || ''} - Q${examData.currentQuestionIndex + 1}: ${examData.currentQuestion.id}`
      : '';
    proctoring.registerIncident(type, payload, questionContext);
  };

  const fullscreen = useFullscreen(showWarning, registerIncidentWithContext);
  const speech = useSpeechRecognition(showWarning);

  // Reference handling
  const resolvedReferenceId = useMemo(() => {
    if (!examData.currentQuestion || !examData.activeSection) return null;
    const direct = examData.currentQuestion.referenceId;
    if (direct) return direct;
    const sectionRefs = examData.sectionReferenceMatrix[examData.activeSection.id] || [];
    return sectionRefs[examData.currentQuestionIndex] || null;
  }, [examData.activeSection, examData.currentQuestion, examData.currentQuestionIndex, examData.sectionReferenceMatrix]);

  const currentReference = useMemo(() => {
    if (!resolvedReferenceId || !examData.activeSection) return null;
    return (examData.activeSection.references || []).find((ref) => ref.id === resolvedReferenceId) || null;
  }, [examData.activeSection, resolvedReferenceId]);

  const referenceDefaultOpen = Boolean(examData.currentQuestion?.referenceId && currentReference);
  const referenceDisplayMode = referenceDefaultOpen ? 'anchor' : currentReference ? 'toggle' : 'none';

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

  // Section directions
  const activeSectionDirectionsSeen = examData.activeSection ? examData.sectionDirectionsSeen[examData.activeSection.id] : true;
  const showSectionDirections = Boolean(examData.activeSection && !activeSectionDirectionsSeen);
  const sectionDirectionsCopy = examData.activeSection?.instructions
    ? `${examData.activeSection.instructions} Keep your face centered, remain in fullscreen, and speak clearly before recording.`
    : 'Review the prompt carefully, stay in fullscreen, keep your face centered, and speak clearly before recording.';

  const dismissSectionDirections = () => {
    if (!examData.activeSection) return;
    examData.setSectionDirectionsSeen(prev => ({ ...prev, [examData.activeSection.id]: true }));
  };

  // Audio tracking
  const currentSectionAudioMap = examData.activeSection ? examData.sectionAudioPlayed[examData.activeSection.id] || {} : {};
  const hasAudioPlayed = !!currentSectionAudioMap[examData.currentQuestionIndex];
  const activeSectionResults = examData.activeSection ? examData.sectionResults[examData.activeSection.id] || [] : [];

  // Navigation
  const navigationLocked = speech.status === 'listening' || speech.status === 'evaluating';
  const disablePrev = !examData.previousQuestionTarget || navigationLocked;
  const disableNext = navigationLocked;

  const primaryActionLabel = useMemo(() => {
    if (!examData.activeSection) return 'Next';
    if (examData.totalQuestions === 0) return examData.isLastSection ? 'Submit Exam' : 'Next Section';
    if (examData.currentQuestionIndex < examData.totalQuestions - 1) return 'Next Question';
    if (!examData.isLastSection) return 'Next Section';
    return 'Submit Exam';
  }, [examData.activeSection, examData.currentQuestionIndex, examData.totalQuestions, examData.isLastSection]);

  // Effects
  useEffect(() => {
    if (currentView !== 'test') return;
    speech.setTranscript('...');
    speech.setStatus('ready');
  }, [currentView, examData.currentQuestionIndex, examData.activeSectionId]);

  useEffect(() => {
    if (!examData.activeSection || activeSectionDirectionsSeen || examData.currentQuestionIndex === 0) return;
    examData.setSectionDirectionsSeen(prev => ({ ...prev, [examData.activeSection.id]: true }));
  }, [examData.activeSection, activeSectionDirectionsSeen, examData.currentQuestionIndex]);

  useEffect(() => {
    if (currentView !== 'instructions') return;
    setInstructionTimer(10);
    setStartEnabled(false);
    const interval = setInterval(() => {
      setInstructionTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); setStartEnabled(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentView]);

  useEffect(() => {
    if (currentView !== 'test') return;
    const interval = setInterval(() => {
      setSubjectTimers((prev) => {
        const currentTimer = prev[examData.activeSubject] || 0;
        if (currentTimer <= 1) {
          clearInterval(interval);
          if (examData.activeSubject === 'english') {
            examData.setEnglishCompleted(true);
            examData.setEnglishLocked(true);
            examData.setActiveSubject('maths');
            const firstMathsSection = examData.subjects['maths']?.[0];
            if (firstMathsSection) examData.setActiveSectionId(firstMathsSection.id);
            showWarning('English Time Up', 'Moving to Maths section.');
          } else if (examData.activeSubject === 'maths') {
            finishTest();
          }
          return { ...prev, [examData.activeSubject]: 0 };
        }
        return { ...prev, [examData.activeSubject]: currentTimer - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentView, examData.activeSubject, examData.subjects]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (currentView !== 'test') return;
      fullscreen.handleFullscreenExit(confirmSubmit);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [currentView, fullscreen.handleFullscreenExit]);

  // Actions
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

  const initWebSocket = () => {
    if (!studentId) return;
    const ws = new WebSocket(`${WS_BASE_URL}/heartbeat/${studentId}`);
    ws.onopen = () => {
      wsRef.current = ws;
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 5000);
      ws.onclose = () => clearInterval(ping);
    };
    ws.onerror = (err) => console.error("WebSocket error:", err);
  };

  const startTest = async () => {
    const sessionStamp = new Date().toISOString().replace(/[:.]/g, '-');
    setAttemptId(`${studentId || 'student'}_${sessionStamp}`);
    await fullscreen.enterFullscreen(true, true);
    navigateTo('test');
    proctoring.resetProctoring();
    examData.resetSectionState();
    setSubjectTimers({ english: 2700, maths: 2700 });
    examData.setEnglishLocked(false);
    fullscreen.endingSessionRef.current = false;
    initWebSocket();
  };

  const playAudio = () => {
    if (!examData.currentQuestion || !examData.activeSection) return;
    if (examData.currentQuestion.delivery !== 'tts') {
      showWarning('Audio unavailable', 'This question must be read on-screen.');
      return;
    }
    if (hasAudioPlayed) {
      showWarning('Audio Limit', 'Audio has already been played once for this question.');
      return;
    }
    speech.speak(examData.currentQuestion.spokenText || examData.currentQuestion.prompt);
    examData.setSectionAudioPlayed((prev) => ({
      ...prev,
      [examData.activeSection.id]: { ...(prev[examData.activeSection.id] || {}), [examData.currentQuestionIndex]: true }
    }));
  };

  const playReferenceAudio = () => {
    if (!currentReference?.text?.trim()) {
      showWarning('Audio unavailable', 'No passage audio is available.');
      return;
    }
    speech.speak(currentReference.text.trim());
  };

  const switchQuestion = (index) => {
    if (!examData.activeSection || navigationLocked) {
      showWarning('Action blocked', 'Complete the current question before switching.');
      return;
    }
    if (examData.activeSection.subject === 'maths' && examData.currentQuestion?.options?.length > 0) {
      const hasSelected = examData.selectedOptions[examData.activeSection.id]?.[examData.currentQuestionIndex] !== undefined;
      const hasRecorded = Boolean(activeSectionResults[examData.currentQuestionIndex]);
      if (!hasSelected) { showWarning('Select an answer', 'Please select an option before switching.'); return; }
      if (!hasRecorded) { showWarning('Record explanation', 'Please record your explanation before switching.'); return; }
    }
    examData.setSectionIndices((prev) => ({ ...prev, [examData.activeSection.id]: Math.max(0, Math.min(index, examData.totalQuestions - 1)) }));
  };

  const handleSectionChange = (sectionId) => {
    if (sectionId === examData.activeSectionId || navigationLocked) return;
    const targetSection = examData.examSections.find(s => s.id === sectionId);
    if (targetSection?.subject === 'maths' && !examData.englishCompleted) {
      showWarning('Section locked', 'You must complete all English sections before accessing Maths.');
      return;
    }
    if (targetSection?.subject) examData.setActiveSubject(targetSection.subject);
    examData.setActiveSectionId(sectionId);
  };

  const handleNextQuestion = () => {
    if (!examData.activeSection || navigationLocked) return;
    if (examData.activeSection.subject === 'maths' && examData.currentQuestion?.options?.length > 0) {
      const hasSelected = examData.selectedOptions[examData.activeSection.id]?.[examData.currentQuestionIndex] !== undefined;
      const hasRecorded = Boolean(activeSectionResults[examData.currentQuestionIndex]);
      if (!hasSelected) { showWarning('Select an answer', 'Please select an option before proceeding.'); return; }
      if (!hasRecorded) { showWarning('Record explanation', 'Please record your explanation before proceeding.'); return; }
    }
    if (examData.totalQuestions === 0) {
      if (examData.nextSection) examData.setActiveSectionId(examData.nextSection.id);
      else finishTest();
      return;
    }
    if (examData.currentQuestionIndex < examData.totalQuestions - 1) {
      switchQuestion(examData.currentQuestionIndex + 1);
      return;
    }
    if (examData.nextSection) {
      if (examData.activeSection?.subject === 'english' && examData.nextSection?.subject === 'maths') examData.setEnglishCompleted(true);
      if (examData.nextSection.subject) examData.setActiveSubject(examData.nextSection.subject);
      examData.setActiveSectionId(examData.nextSection.id);
      return;
    }
    finishTest();
  };

  const handlePreviousQuestion = () => {
    if (!examData.previousQuestionTarget || navigationLocked) return;
    const { sectionId, questionIndex } = examData.previousQuestionTarget;
    if (sectionId === examData.activeSection?.id) { switchQuestion(questionIndex); return; }
    const targetSection = examData.examSections.find(s => s.id === sectionId);
    if (targetSection?.subject) examData.setActiveSubject(targetSection.subject);
    examData.setSectionIndices((prev) => ({ ...prev, [sectionId]: questionIndex }));
    examData.setActiveSectionId(sectionId);
  };

  const handleAnswer = async (answer) => {
    if (!examData.currentQuestion || !examData.activeSection) { speech.setStatus('ready'); return; }
    speech.setStatus('evaluating');
    const selectedOptionIndex = examData.selectedOptions[examData.activeSection.id]?.[examData.currentQuestionIndex];
    const selectedOptionObj = selectedOptionIndex !== undefined && examData.currentQuestion.options 
      ? examData.currentQuestion.options[selectedOptionIndex] : null;
    const selectedOptionKey = selectedOptionObj?.key || null;
    
    examData.setSectionResults((prev) => {
      const updated = { ...prev };
      const sectionArray = [...(updated[examData.activeSection.id] || new Array(examData.activeSection.questions.length).fill(null))];
      sectionArray[examData.currentQuestionIndex] = { questionId: examData.currentQuestion.id, prompt: examData.currentQuestion.prompt, selectedOption: selectedOptionKey, answer };
      updated[examData.activeSection.id] = sectionArray;
      return updated;
    });
    
    await persistAnswerScript({
      student_id: studentId,
      exam_set: studentExamSet,
      section_id: examData.activeSection.id,
      section_title: examData.activeSection.title,
      question_number: examData.currentQuestionIndex + 1,
      question_id: examData.currentQuestion.id,
      question_prompt: examData.currentQuestion.prompt,
      selected_option: selectedOptionKey,
      answer
    });
    speech.setStatus('ready');
  };

  const finishTest = () => setShowSubmitModal(true);

  const confirmSubmit = async () => {
    setShowSubmitModal(false);
    speech.setStatus(null);
    try {
      await fetch(`${API_BASE_URL}/finish_exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId })
      });
    } catch (err) {
      console.error('Failed to trigger grading', err);
    }
    navigateTo('finish');
    fullscreen.endingSessionRef.current = true;
    await fullscreen.exitFullscreen();
    try { window.speechSynthesis.cancel(); } catch {}
    speech.cleanup();
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    fullscreen.endingSessionRef.current = false;
  };

  const handleLogin = async () => {
    setAuthError('');
    try {
      const res = await fetch('/students.csv');
      const text = await res.text();
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',');
      const examSetIndex = headers.indexOf('exam_set');
      const match = lines.slice(1).find(row => {
        const cols = row.split(',');
        return cols[0] === studentId.trim() && cols[1] === studentPass.trim();
      });
      if (match) {
        const cols = match.split(',');
        setStudentExamSet(examSetIndex >= 0 ? (cols[examSetIndex] || 'A') : 'A');
        try {
          await fetch(`${API_BASE_URL}/start_exam`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId.trim() })
          });
        } catch (e) {
          console.error('Failed to start exam session', e);
        }
        navigateTo('systemcheck');
      } else {
        setAuthError('Invalid Student ID or Password');
      }
    } catch (err) {
      setAuthError('Error loading credentials database');
    }
  };

  return (
    <>
      {currentView === 'login' && (
        <LoginView
          studentId={studentId} setStudentId={setStudentId}
          studentPass={studentPass} setStudentPass={setStudentPass}
          authError={authError} onSubmit={handleLogin}
        />
      )}

      {currentView === 'systemcheck' && (
        <SystemCheck studentId={studentId} onProceed={() => navigateTo('instructions')} />
      )}

      {currentView === 'instructions' && (
        <InstructionsView timer={instructionTimer} startEnabled={startEnabled} onStart={startTest} />
      )}

      {currentView === 'test' && (
        <div className="min-h-screen bg-white">
          <ExamHeader
            activeSubject={examData.activeSubject}
            subjectTimers={subjectTimers}
            fullscreenWarningCount={fullscreen.fullscreenWarningCount}
            onEnterFullscreen={() => fullscreen.enterFullscreen(false, true)}
            onEndExam={finishTest}
          />
          <div className="flex bg-white">
            <div className="flex-1 p-8">
              <SubjectTabs
                subjects={examData.subjects}
                activeSubject={examData.activeSubject}
                englishCompleted={examData.englishCompleted}
                englishLocked={examData.englishLocked}
                onSubjectChange={(subjectKey) => {
                  examData.setActiveSubject(subjectKey);
                  const firstSection = examData.subjects[subjectKey][0];
                  if (firstSection) examData.setActiveSectionId(firstSection.id);
                }}
                onShowWarning={showWarning}
              />
              <SectionTabs
                sections={examData.subjects[examData.activeSubject] || []}
                activeSectionId={examData.activeSectionId}
                onSectionChange={handleSectionChange}
              />
              {showSectionDirections && (
                <SectionBriefing instructions={sectionDirectionsCopy} onDismiss={dismissSectionDirections} />
              )}
              <TestView
                questionIndex={examData.totalQuestions ? examData.currentQuestionIndex + 1 : 0}
                totalQuestions={examData.totalQuestions}
                question={examData.currentQuestion}
                status={speech.status}
                transcript={speech.transcript}
                onStartRecording={() => speech.startListening(studentId, examData.activeSection, examData.currentQuestion, handleAnswer)}
                onStopRecording={() => speech.stopAndSubmit(studentId, examData.activeSection, examData.currentQuestion)}
                onPlayAudio={playAudio}
                onPrevQuestion={handlePreviousQuestion}
                onNextQuestion={handleNextQuestion}
                disablePrev={disablePrev}
                disableNext={disableNext}
                canPlayAudio={examData.currentQuestion?.delivery === 'tts'}
                hasAudioPlayed={hasAudioPlayed}
                primaryActionLabel={primaryActionLabel}
                referenceMaterial={currentReference}
                isReferenceOpen={isReferencePanelOpen}
                onToggleReferencePanel={() => setIsReferencePanelOpen(prev => !prev)}
                referenceDisplayMode={referenceDisplayMode}
                onPlayReferenceAudio={playReferenceAudio}
                showReferenceAudio={examData.activeSection?.id !== 'cloze-passage' && examData.activeSection?.id !== 'reading-comprehension'}
                isMathsQuestion={examData.activeSection?.subject === 'maths'}
                savedAnswer={activeSectionResults[examData.currentQuestionIndex]?.answer || null}
                selectedOption={examData.activeSection && examData.currentQuestion ? examData.selectedOptions[examData.activeSection.id]?.[examData.currentQuestionIndex] : null}
                onSelectOption={(optionIndex) => {
                  if (!examData.activeSection || !examData.currentQuestion) return;
                  examData.setSelectedOptions(prev => ({
                    ...prev,
                    [examData.activeSection.id]: { ...(prev[examData.activeSection.id] || {}), [examData.currentQuestionIndex]: optionIndex }
                  }));
                }}
              />
            </div>
            <QuestionSidebar
              questions={examData.activeQuestions}
              currentQuestionIndex={examData.currentQuestionIndex}
              sectionResults={activeSectionResults}
              totalQuestions={examData.totalQuestions}
              onSwitchQuestion={switchQuestion}
            >
              <div className="mt-6">
                <div className="bg-slate-100 rounded-lg p-3 border border-slate-300">
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">Camera Monitor</h4>
                  <CameraMonitor
                    onIncident={(type, payload) => proctoring.handleIncident(type, payload, showWarning)}
                    onSnapshot={proctoring.handleSnapshot}
                    onStatus={(s) => console.log("[Camera]", s)}
                  />
                </div>
              </div>
            </QuestionSidebar>
          </div>
        </div>
      )}

      {currentView === 'finish' && <FinishView />}

      {warningModal && <WarningModal title={warningModal.title} message={warningModal.message} onClose={closeWarning} />}
      {showSubmitModal && <SubmitModal onCancel={() => setShowSubmitModal(false)} onConfirm={confirmSubmit} />}
    </>
  );
}
