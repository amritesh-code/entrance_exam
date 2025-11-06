import React from 'react';
import logo from '../assets/logo.png';

export default function FinishView() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-purple-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-xl">
        <img 
          src={logo}
          alt="App Logo" 
          className="mx-auto mb-4 w-24 h-24 object-contain"
        />
        <h1 className="text-3xl font-bold text-green-600 mb-4">Test Complete!</h1>
        <p className="text-slate-600">Thank you for participating. Your results have been submitted for evaluation.</p>
        <p className="text-slate-600 mt-2">You may now close this window.</p>
      </div>
    </div>
  );
}
