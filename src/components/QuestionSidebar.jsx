import React from 'react';

export default function QuestionSidebar({
  questions,
  currentQuestionIndex,
  sectionResults,
  totalQuestions,
  onSwitchQuestion,
  children
}) {
  return (
    <div className="w-80 border-l border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Section Questions</h3>
        <span className="text-xs text-gray-500">{totalQuestions} total</span>
      </div>
      {questions.length > 0 ? (
        <div className="grid grid-cols-5 gap-2">
          {questions.map((questionItem, idx) => {
            const answered = Boolean(sectionResults[idx]);
            return (
              <button
                key={questionItem.id || idx}
                onClick={() => onSwitchQuestion(idx)}
                className={`w-12 h-12 rounded-lg font-semibold transition ${
                  idx === currentQuestionIndex
                    ? 'bg-purple-600 text-white'
                    : answered
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No questions configured for this section yet.</p>
      )}
      {children}
    </div>
  );
}
