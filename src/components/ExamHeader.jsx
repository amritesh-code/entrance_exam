import React from 'react';
import logo from '../assets/logo.png';

export default function ExamHeader({
  activeSubject,
  subjectTimers,
  fullscreenWarningCount,
  onEndExam
}) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="bg-purple-700 text-white px-6 py-3 flex items-center shadow-md">
      <div className="flex items-center gap-3">
        <img src={logo} alt="Adira Academy" className="h-10 w-10 rounded-full bg-white p-1" />
        <span className="text-xl font-bold">Adira Entrance Exam</span>
      </div>
      <div className="flex-1"></div>
      <div className="flex items-center gap-4">
        <span className="text-base font-medium text-white">
          {formatTime(subjectTimers[activeSubject])}
        </span>
        {fullscreenWarningCount > 0 && (
          <span className="text-sm font-semibold text-yellow-200">
            Fullscreen warning {fullscreenWarningCount}/2
          </span>
        )}
        <button
          onClick={onEndExam}
          className="bg-white text-purple-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition"
        >
          End Exam
        </button>
      </div>
    </div>
  );
}
