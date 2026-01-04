import { useState, useMemo } from "react";
import englishExamA from "../../QuestionBank/english_exam_A.json";
import englishExamB from "../../QuestionBank/english_exam_B.json";
import englishExamC from "../../QuestionBank/english_exam_C.json";
import mathsExam from "../../QuestionBank/maths_exam.json";

// Map exam sets to their question banks
const englishExamSets = {
  A: englishExamA,
  B: englishExamB,
  C: englishExamC,
};

export function useExamData(examSet = "A") {
  // Select the correct English exam based on set
  const englishExam = englishExamSets[examSet] || englishExamA;

  const examSections = useMemo(() => {
    const englishSections = (englishExam.sections || []).map((s) => ({
      ...s,
      subject: "english",
    }));
    const mathsSections = (mathsExam.sections || []).map((s) => ({
      ...s,
      subject: "maths",
    }));
    return [...englishSections, ...mathsSections];
  }, [englishExam]);

  const sectionReferenceMatrix = useMemo(() => {
    const matrix = {};
    examSections.forEach((section) => {
      const questions = section.questions || [];
      let lastReferenceId = null;
      matrix[section.id] = questions.map((question) => {
        if (question.referenceId) {
          lastReferenceId = question.referenceId;
        }
        return lastReferenceId;
      });
    });
    return matrix;
  }, [examSections]);

  const subjects = useMemo(() => {
    const subjectMap = {};
    examSections.forEach((section) => {
      const sub = section.subject || "other";
      if (!subjectMap[sub]) subjectMap[sub] = [];
      subjectMap[sub].push(section);
    });
    return subjectMap;
  }, [examSections]);

  const [activeSubject, setActiveSubject] = useState("english");
  const [activeSectionId, setActiveSectionId] = useState(
    examSections[0]?.id || ""
  );
  const [englishCompleted, setEnglishCompleted] = useState(false);
  const [englishLocked, setEnglishLocked] = useState(false);

  const [sectionIndices, setSectionIndices] = useState(() => {
    const initial = {};
    examSections.forEach((section) => {
      initial[section.id] = 0;
    });
    return initial;
  });

  const [sectionAudioPlayed, setSectionAudioPlayed] = useState(() => {
    const initial = {};
    examSections.forEach((section) => {
      initial[section.id] = {};
    });
    return initial;
  });

  const [sectionDirectionsSeen, setSectionDirectionsSeen] = useState(() => {
    const initial = {};
    examSections.forEach((section) => {
      initial[section.id] = false;
    });
    return initial;
  });

  const [selectedOptions, setSelectedOptions] = useState(() => {
    const initial = {};
    examSections.forEach((section) => {
      initial[section.id] = {};
    });
    return initial;
  });

  const [sectionResults, setSectionResults] = useState(() => {
    const initial = {};
    examSections.forEach((section) => {
      initial[section.id] = [];
    });
    return initial;
  });

  const activeSection = useMemo(() => {
    return (
      examSections.find((section) => section.id === activeSectionId) ||
      examSections[0]
    );
  }, [examSections, activeSectionId]);

  const currentSectionPosition = useMemo(
    () => examSections.findIndex((section) => section.id === activeSection?.id),
    [examSections, activeSection?.id]
  );

  const totalQuestions = activeSection?.questions?.length || 0;
  const currentQuestionIndex = activeSection
    ? sectionIndices[activeSection.id] || 0
    : 0;
  const activeQuestions = activeSection?.questions || [];
  const currentQuestion = totalQuestions
    ? activeQuestions[currentQuestionIndex]
    : null;

  const nextSection = useMemo(() => {
    if (currentSectionPosition === -1) return null;
    return examSections[currentSectionPosition + 1] || null;
  }, [examSections, currentSectionPosition]);

  const isLastSection = useMemo(
    () =>
      currentSectionPosition !== -1 &&
      currentSectionPosition === examSections.length - 1,
    [currentSectionPosition, examSections.length]
  );

  const previousQuestionTarget = useMemo(() => {
    if (!activeSection || currentSectionPosition === -1) return null;
    if (totalQuestions > 0 && currentQuestionIndex > 0) {
      return {
        sectionId: activeSection.id,
        questionIndex: currentQuestionIndex - 1,
      };
    }
    for (let i = currentSectionPosition - 1; i >= 0; i--) {
      const section = examSections[i];
      const count = section.questions?.length || 0;
      if (count > 0) return { sectionId: section.id, questionIndex: count - 1 };
    }
    return null;
  }, [
    activeSection,
    currentQuestionIndex,
    currentSectionPosition,
    examSections,
    totalQuestions,
  ]);

  const resetSectionState = () => {
    const indices = {};
    const audioFlags = {};
    const results = {};
    const directionsFlags = {};
    const selectedOpts = {};
    examSections.forEach((section) => {
      indices[section.id] = 0;
      audioFlags[section.id] = {};
      results[section.id] = new Array(section.questions.length).fill(null);
      directionsFlags[section.id] = false;
      selectedOpts[section.id] = {};
    });
    setSectionIndices(indices);
    setSectionAudioPlayed(audioFlags);
    setSectionResults(results);
    setSectionDirectionsSeen(directionsFlags);
    setSelectedOptions(selectedOpts);
    setActiveSectionId(examSections[0]?.id || "");
  };

  return {
    examSections,
    sectionReferenceMatrix,
    subjects,
    activeSubject,
    setActiveSubject,
    activeSectionId,
    setActiveSectionId,
    englishCompleted,
    setEnglishCompleted,
    englishLocked,
    setEnglishLocked,
    sectionIndices,
    setSectionIndices,
    sectionAudioPlayed,
    setSectionAudioPlayed,
    sectionDirectionsSeen,
    setSectionDirectionsSeen,
    selectedOptions,
    setSelectedOptions,
    sectionResults,
    setSectionResults,
    activeSection,
    currentSectionPosition,
    totalQuestions,
    currentQuestionIndex,
    activeQuestions,
    currentQuestion,
    nextSection,
    isLastSection,
    previousQuestionTarget,
    resetSectionState,
  };
}
