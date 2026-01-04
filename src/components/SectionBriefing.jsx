import React from 'react';

export default function SectionBriefing({ instructions, onDismiss }) {
  return (
    <div className="mb-6 p-5 bg-white border border-slate-200 rounded-lg shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Section Briefing</p>
          <p className="text-sm text-slate-700 leading-relaxed">{instructions}</p>
        </div>
        <button
          onClick={onDismiss}
          className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Start Section
        </button>
      </div>
    </div>
  );
}
