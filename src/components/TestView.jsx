import React from 'react';

export default function TestView({ questionIndex, totalQuestions, questionText, status, transcript, onStartRecording, onStopRecording }) {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">
          Question {questionIndex} / {totalQuestions}
        </p>
        <h2 className="text-2xl font-semibold text-slate-800 h-20 flex items-center justify-center">
          {questionText}
        </h2>
      </div>

      <div className="flex items-center justify-center space-x-3 h-16">
        {status === 'ready' && (
          <button
            onClick={onStartRecording}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            Record
          </button>
        )}
        {status === 'speaking' && (
          <>
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.636 5.636a9 9 0 0112.728 0M8.464 15.536a5 5 0 010-7.072"></path>
            </svg>
            <span className="font-medium text-blue-600">Speaking question...</span>
          </>
        )}
        {status === 'listening' && (
          <>
            <button
              onClick={onStopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
            >
              <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
              Stop
            </button>
          </>
        )}
        {status === 'evaluating' && (
          <>
            <svg className="animate-spin h-8 w-8 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-medium text-slate-700">Processing and evaluating...</span>
          </>
        )}
        {status === 'error' && (
          <>
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
              </path>
            </svg>
            <span className="font-medium text-yellow-600">Could not hear audio. Moving to next question.</span>
          </>
        )}
      </div>

      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg min-h-[100px]">
        <p className="text-slate-500 font-medium mb-2">Your transcribed answer:</p>
        <p className="text-slate-700 italic">{transcript}</p>
      </div>
    </div>
  );
}
