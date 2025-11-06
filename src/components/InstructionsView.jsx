import React from 'react';
import logo from '../assets/logo.png';

export default function InstructionsView({ timer, startEnabled, onStart }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-purple-100">
     <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl">
      <img 
          src={logo} 
          alt="App Logo" 
          className="mx-auto mb-4 w-24 h-24 object-contain"
        />
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Instructions</h2>
      <div className="text-left space-y-3 text-slate-600 mb-8">
        <p>1. This is a voice-based test. Please ensure you are in a quiet environment and your microphone is working.</p>
        <p>2. A question will be read out to you. Press the mic button to record your answer.</p>
        <p>3. Speak clearly and concisely. Press stop when done. You only have one attempt per question.</p>
        <p>4. The test will begin automatically after the timer below ends.</p>
      </div>

      <div className="mb-6">
        <p className="text-lg">The test will start in:</p>
        <p className="text-5xl font-bold text-blue-600">
          {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
        </p>
      </div>

      <button
        disabled={!startEnabled}
        onClick={onStart}
        className={`w-full text-white font-bold py-3 px-4 rounded-lg ${
          startEnabled
            ? 'bg-green-600 hover:bg-green-700 transition-transform transform hover:scale-105'
            : 'bg-slate-400 cursor-not-allowed'
        }`}
      >
        Start Test
      </button>
    </div>
  </div>
  );
}
