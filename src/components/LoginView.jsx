import React from 'react';
import { useState } from 'react';
import logo from '../assets/logo.png';

export default function LoginView({ studentId, setStudentId, studentPass, setStudentPass, authError, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-purple-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl">
        <img 
          src={logo} 
          alt="App Logo" 
          className="mx-auto mb-4 w-24 h-24 object-contain"
        />
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Adira Academy Entrance Examination</h1>
        <h3 className="text-xl font-bold text-slate-500 mb-2">2026-27</h3>
        <p className="text-slate-600 mb-8">Please enter your username and password to begin</p>
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
          <input
            type="text"
            placeholder="Enter Your Student ID"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Your Password"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              required
              value={studentPass}
              onChange={(e) => setStudentPass(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500"
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-transform transform hover:scale-105"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
