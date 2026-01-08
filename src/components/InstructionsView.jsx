import React from 'react';
import logo from '../assets/logo.png';

export default function InstructionsView({ timer, startEnabled, onStart }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-lg border border-purple-100">
        <img 
          src={logo} 
          alt="App Logo" 
          className="mx-auto mb-6 h-16 w-auto object-contain"
        />
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Before You Begin</h2>
        
        <div className="space-y-4 text-slate-600 text-sm mb-8">
          <p>Use <strong>earphones with a working microphone</strong> in a quiet, well lit environment.</p>
          <p>Keep your <strong>face visible</strong> in the camera and stay in fullscreen mode throughout.</p>
          <p>Press <strong>Record</strong> to answer, speak clearly, then press <strong>Stop</strong> to save.</p>
          <p>The test includes <strong>English</strong> (MCQs, Cloze, Reading, 2-min Speaking) and <strong>Maths</strong> (MCQs with explanation).</p>
        </div>

        <div className="text-center mb-6 py-5 bg-slate-50 rounded-xl">
          <p className="text-sm text-slate-500 mb-1">Test begins in</p>
          <p className="text-4xl font-bold text-purple-600">
            {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
          </p>
        </div>

        <button
          disabled={!startEnabled}
          onClick={onStart}
          className={`w-full text-white font-semibold py-3.5 px-4 rounded-xl transition-all ${
            startEnabled
              ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200'
              : 'bg-slate-300 cursor-not-allowed'
          }`}
        >
          Start Test
        </button>
      </div>
    </div>
  );
}
