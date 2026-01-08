import React from 'react';
import { useState } from 'react';
import logo from '../assets/Adira_Logo_Black without BG.png';

export default function LoginView({ studentId, setStudentId, studentPass, setStudentPass, authError, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-100">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-purple-100">
        <div className="flex justify-center mb-6">
          <img 
            src={logo} 
            alt="Adira Academy" 
            className="h-28 w-auto object-contain"
          />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Entrance Examination</h1>
          <p className="text-purple-600 font-semibold text-lg">2026-27</p>
        </div>
        <p className="text-slate-500 text-sm text-center mb-6">Please enter your credentials to begin</p>
        {authError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {authError}
          </div>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Student ID</label>
            <input
              type="text"
              placeholder="Enter your student ID"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                required
                value={studentPass}
                onChange={(e) => setStudentPass(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-purple-500 text-sm font-medium hover:text-purple-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white font-semibold py-3.5 px-4 rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 hover:shadow-purple-300 mt-2"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
