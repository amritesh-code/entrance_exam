import React from 'react';
import logo from '../assets/Adira_Logo_Black without BG.png';

export default function FinishView() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border border-purple-100 text-center">
        <img 
          src={logo}
          alt="Adira Academy" 
          className="mx-auto mb-8 h-20 w-auto object-contain"
        />
        <h1 className="text-2xl font-bold text-green-600 mb-2">Test Complete!</h1>
        <p className="text-slate-500 text-sm">Your results have been submitted.</p>
        <p className="text-slate-400 text-sm mt-6">You may now close this window.</p>
      </div>
    </div>
  );
}
