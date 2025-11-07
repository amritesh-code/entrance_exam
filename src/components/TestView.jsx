import React from 'react';

export default function TestView({ questionIndex, totalQuestions, questionText, status, transcript, onStartRecording, onStopRecording, onPlayAudio }) {
  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-medium text-slate-500 mb-6">
          Question {questionIndex} / {totalQuestions}
        </p>

        <div className="grid grid-cols-2 gap-8">
          <div className="border-r border-gray-300 pr-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-2 leading-relaxed">
              Listen to the audio carefully before answering.
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              <span className="font-semibold">Note:</span> You will be allowed to listen to the audio once only. You would not be able to pause the audio in between.
            </p>

            <div className="border-t border-gray-200 pt-6">
              <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                <p className="text-xs text-orange-600 font-semibold mb-3">You can play this media: 1 times</p>
                
                <button
                  onClick={onPlayAudio}
                  disabled={status === 'speaking'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                    status === 'speaking' 
                      ? 'bg-gray-400 text-white cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Play Audio
                </button>
              </div>
            </div>
          </div>

          <div className="pl-4 flex flex-col h-full">
            <div className="border-t border-gray-200 pt-6 mb-6">
              {status === 'ready' && (
                <button
                  onClick={onStartRecording}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Record
                </button>
              )}
              {status === 'speaking' && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.636 5.636a9 9 0 0112.728 0M8.464 15.536a5 5 0 010-7.072"></path>
                  </svg>
                  <span className="font-semibold text-blue-600 text-lg">Speaking...</span>
                </div>
              )}
              {status === 'listening' && (
                <button
                  onClick={onStopRecording}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition shadow-sm hover:shadow-md"
                >
                  <div className="w-5 h-5 bg-white rounded-full animate-pulse"></div>
                  Stop
                </button>
              )}
              {status === 'evaluating' && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                  <svg className="animate-spin h-10 w-10 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-semibold text-slate-700 text-lg">Processing...</span>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
                  <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                    </path>
                  </svg>
                  <span className="font-semibold text-yellow-600">No audio detected</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mt-auto">
              <p className="text-slate-500 font-medium mb-2">Transcribed answer:</p>
              <p className="text-slate-700 italic">{transcript}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
