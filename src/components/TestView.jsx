import React, { useState, useEffect, useRef } from 'react';

const SPEAKING_TIME_LIMIT = 120;

export default function TestView({
  questionIndex,
  totalQuestions,
  question,
  status,
  transcript,
  onStartRecording,
  onStopRecording,
  onPlayAudio,
  onPrevQuestion,
  onNextQuestion,
  disablePrev,
  disableNext,
  canPlayAudio,
  hasAudioPlayed,
  primaryActionLabel,
  referenceMaterial,
  isReferenceOpen,
  onToggleReferencePanel,
  referenceDisplayMode = 'none',
  onPlayReferenceAudio,
  showReferenceAudio = true,
  isMathsQuestion = false,
  savedAnswer,
  selectedOption,
  onSelectOption,
  isSpeakingSection = false
}) {
  const [speakingTimer, setSpeakingTimer] = useState(SPEAKING_TIME_LIMIT);
  const timerIntervalRef = useRef(null);
  const onStopRecordingRef = useRef(onStopRecording);

  useEffect(() => {
    onStopRecordingRef.current = onStopRecording;
  }, [onStopRecording]);

  useEffect(() => {
    if (isSpeakingSection && status === 'listening') {
      setSpeakingTimer(SPEAKING_TIME_LIMIT);
      timerIntervalRef.current = setInterval(() => {
        setSpeakingTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            if (onStopRecordingRef.current) {
              onStopRecordingRef.current();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (status === 'ready') {
        setSpeakingTimer(SPEAKING_TIME_LIMIT);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isSpeakingSection, status]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const questionAvailable = Boolean(question);
  const promptText = question?.prompt || 'No question configured for this section yet.';
  const positionLabel = totalQuestions
    ? `Q ${Math.max(questionIndex || 1, 1)} / ${totalQuestions}`
    : '—';
  const isToggleMode = referenceDisplayMode === 'toggle';
  const isAnchorMode = referenceDisplayMode === 'anchor';
  const hasReference = referenceDisplayMode !== 'none' && Boolean(referenceMaterial?.text);
  const guidanceLine = (() => {
    if (isToggleMode && hasReference) {
      return 'Use Show Passage if you need to revisit the text, then respond when ready.';
    }
    if (isAnchorMode && hasReference) {
      return 'Review the passage beside the question, plan, then record your answer.';
    }
    if (canPlayAudio) {
      return 'Play the clip once, think of your response, then speak clearly.';
    }
    return 'Read the question, click the record button and respond aloud when ready.';
  })();
  const transcriptText = (() => {
    if (transcript?.trim()) return transcript.trim();
    if (savedAnswer) return savedAnswer;
    if (!questionAvailable) return 'This section does not have questions yet.';
    return 'Waiting for your response...';
  })();
  const referenceParagraphs = hasReference
    ? (referenceMaterial?.text || '')
        .split(/\n\s*\n/)
        .map(chunk => chunk.trim())
        .filter(Boolean)
    : [];
  const referencePanelOpen = isToggleMode ? Boolean(isReferenceOpen && hasReference) : true;
  const handlePlayReference = () => {
    if (typeof onPlayReferenceAudio === 'function') {
      onPlayReferenceAudio();
    }
  };

  const recordingPanel = (
    <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Record your answer</p>
          <p className="text-xs text-slate-500">
            {isSpeakingSection ? 'Speak for up to 2 minutes on the topic.' : 'Use the microphone when you are ready.'}
          </p>
        </div>
        {questionAvailable && status === 'ready' && (
          <button
            onClick={onStartRecording}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            Record
          </button>
        )}
        {status === 'listening' && (
          <div className="flex items-center gap-3">
            {isSpeakingSection && (
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${speakingTimer <= 30 ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                {formatTime(speakingTimer)}
              </div>
            )}
            <button
              onClick={onStopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 transition"
            >
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              Stop
            </button>
          </div>
        )}
      </div>

      {isSpeakingSection && status === 'ready' && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>You have <strong>2 minutes</strong> to speak on this topic. The timer will start when you click Record.</span>
        </div>
      )}

      {!questionAvailable && (
        <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800">
          Questions for this section will appear soon.
        </div>
      )}

      {status === 'speaking' && (
        <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
          <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.636 5.636a9 9 0 0112.728 0M8.464 15.536a5 5 0 010-7.072"></path>
          </svg>
          <span className="font-semibold text-purple-600">Speaking...</span>
        </div>
      )}

      {status === 'evaluating' && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
          <svg className="animate-spin h-8 w-8 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-semibold text-slate-700">Processing...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl">
          <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <span className="font-semibold text-yellow-600">No audio detected</span>
        </div>
      )}
    </div>
  );

  const transcriptPanel = (
    <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-900">Your answer</p>
        <span className="text-xs text-slate-400">Auto-transcribed</span>
      </div>
      <div className="min-h-[90px] max-h-[200px] overflow-y-auto text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3">
        {transcriptText}
      </div>
    </div>
  );

  const navigationControls = (
    <div className="flex flex-wrap justify-end gap-3">
      <button
        onClick={onPrevQuestion}
        disabled={disablePrev}
        className={`px-5 py-2 rounded-lg font-semibold transition ${
          disablePrev
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        Previous
      </button>
      <button
        onClick={onNextQuestion}
        disabled={disableNext}
        className={`px-6 py-2 rounded-lg font-semibold transition ${
          disableNext
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
        }`}
      >
        {primaryActionLabel || 'Next'}
      </button>
    </div>
  );

  const questionPanel = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-800">Question</p>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {positionLabel}
          </span>
        </div>
        {isToggleMode && hasReference && typeof onToggleReferencePanel === 'function' && (
          <button
            onClick={onToggleReferencePanel}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition ${
              referencePanelOpen
                ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                : 'bg-slate-900 text-white border-slate-900 hover:bg-black'
            }`}
          >
            {referencePanelOpen ? 'Hide Passage' : 'Show Passage'}
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600">{guidanceLine}</p>

      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <p className="text-sm font-semibold text-slate-900 mb-2">{questionAvailable ? 'Question' : 'No question available'}</p>
        <p className="text-base text-slate-900 leading-relaxed">{promptText}</p>
        {question?.options?.length > 0 && isMathsQuestion && (
          <div className="mt-4 space-y-2">
            {question.options.map((option, idx) => {
              const optionText = typeof option === 'string' ? option : option.text;
              const optionKey = typeof option === 'string' ? String.fromCharCode(65 + idx) : option.key;
              return (
                <button
                  key={`${question.id || 'option'}-${idx}`}
                  onClick={() => onSelectOption && onSelectOption(idx)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                    selectedOption === idx
                      ? 'border-purple-600 bg-purple-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <span className={`font-semibold min-w-[1.5rem] ${selectedOption === idx ? 'text-purple-600' : 'text-slate-600'}`}>
                      {optionKey}.
                    </span>
                    <span className="flex-1">{optionText}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {question?.options?.length > 0 && !isMathsQuestion && (
          <ul className="mt-4 space-y-3 text-sm text-slate-800">
            {question.options.map((option, idx) => {
              const optionText = typeof option === 'string' ? option : option.text;
              const optionKey = typeof option === 'string' ? String.fromCharCode(65 + idx) : option.key;
              return (
                <li key={`${question.id || 'option'}-${idx}`} className="flex gap-2">
                  <span className="font-semibold text-slate-600 min-w-[1.5rem]">{optionKey}.</span>
                  <span>{optionText}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canPlayAudio && (
        <div className="flex items-center justify-between p-4 bg-purple-50/60 border border-purple-100 rounded-2xl">
          <div className="text-sm text-purple-800">
            <p className="font-semibold">Question audio</p>
            <p className="text-xs">Available one time per question.</p>
          </div>
          <button
            onClick={onPlayAudio}
            disabled={status === 'speaking' || hasAudioPlayed}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition ${
              hasAudioPlayed
                ? 'bg-purple-200 text-purple-600 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            {hasAudioPlayed ? 'Played' : 'Play audio'}
          </button>
        </div>
      )}
    </>
  );

  const referencePanel = (
    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference Text</p>
          <h4 className="text-base font-semibold text-slate-900 mt-1">{referenceMaterial?.title || 'Passage'}</h4>
        </div>
        {showReferenceAudio && (
          <button
            onClick={handlePlayReference}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-full hover:bg-purple-700 transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            Play passage
          </button>
        )}
      </div>
      {referencePanelOpen ? (
        <div className="mt-4 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 text-sm text-slate-800 leading-7">
            {referenceParagraphs.length > 0
              ? referenceParagraphs.map((para, idx) => (
                  <p key={`ref-${idx}`} className="tracking-normal">
                    {para}
                  </p>
                ))
              : (
                  <p className="text-slate-500">Passage text will appear here.</p>
                )}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-start gap-2 text-sm text-slate-600">
          <p className="text-xs uppercase text-slate-500 tracking-wide">Passage hidden</p>
          <p>Use the Show Passage button above whenever you need to review the text again.</p>
        </div>
      )}
    </div>
  );

  const anchoredReferencePanel = (
    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference Text</p>
          <h4 className="text-base font-semibold text-slate-900 mt-1">{referenceMaterial?.title || 'Passage'}</h4>
        </div>
        {showReferenceAudio && (
          <button
            onClick={handlePlayReference}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-full hover:bg-purple-700 transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            Play passage
          </button>
        )}
      </div>
      <div className="mt-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 text-sm text-slate-800 leading-7">
          {referenceParagraphs.length > 0
            ? referenceParagraphs.map((para, idx) => (
                <p key={`ref-anchor-${idx}`} className="tracking-normal">
                  {para}
                </p>
              ))
            : (
                <p className="text-slate-500">Passage text will appear here.</p>
              )}
        </div>
      </div>
    </div>
  );

  if (isAnchorMode && hasReference) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div>{anchoredReferencePanel}</div>
        <div className="space-y-5">
          {navigationControls}
          {questionPanel}
          {recordingPanel}
          {transcriptPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div className="space-y-5">
        {questionPanel}
        {isToggleMode && hasReference && referencePanel}
      </div>
      <div className="space-y-5">
        {navigationControls}
        {recordingPanel}
        {transcriptPanel}
      </div>
    </div>
  );
}
