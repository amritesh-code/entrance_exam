import React from 'react';

export default function SubjectTabs({
  subjects,
  activeSubject,
  englishCompleted,
  englishLocked,
  onSubjectChange,
  onShowWarning
}) {
  return (
    <div className="mb-6 flex gap-8 border-b border-slate-200 pb-2">
      {Object.keys(subjects).map((subjectKey) => {
        const isActive = subjectKey === activeSubject;
        const isLocked = (subjectKey === 'maths' && !englishCompleted) || (subjectKey === 'english' && englishLocked);
        return (
          <button
            key={subjectKey}
            onClick={() => {
              if (isLocked) {
                if (subjectKey === 'english' && englishLocked) {
                  onShowWarning('English Locked', 'English time has expired.');
                } else {
                  onShowWarning('Section locked', 'Complete English before accessing Maths.');
                }
                return;
              }
              onSubjectChange(subjectKey);
            }}
            disabled={isLocked}
            className={`px-2 pb-2 text-sm font-semibold transition border-b-2 ${
              isActive
                ? 'border-purple-600 text-slate-900'
                : isLocked
                ? 'border-transparent text-slate-400 cursor-not-allowed'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {subjectKey.charAt(0).toUpperCase() + subjectKey.slice(1)}
          </button>
        );
      })}
    </div>
  );
}
