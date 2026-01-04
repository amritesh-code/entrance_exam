import React from 'react';

export default function SectionTabs({
  sections,
  activeSectionId,
  onSectionChange
}) {
  return (
    <div className="mb-6 flex gap-4 flex-wrap">
      {sections.map((section) => {
        const isActive = section.id === activeSectionId;
        const questionCount = section.questions?.length || 0;
        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
              isActive
                ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            {section.title}
            <span className="ml-2 text-xs text-slate-500">({questionCount})</span>
          </button>
        );
      })}
    </div>
  );
}
