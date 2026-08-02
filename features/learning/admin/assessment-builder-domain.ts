import type { AdminQuizQuestionRow } from "@/features/learning/admin/data";

export type AssessmentIssue = {
  message: string;
  questionId?: string;
  severity: "error" | "warning";
};

export function getSortedQuestionOptions(question: AdminQuizQuestionRow) {
  return [...(question.options ?? [])].sort((first, second) => first.option_order - second.option_order);
}

export function getCorrectOptionCount(question: AdminQuizQuestionRow) {
  return getSortedQuestionOptions(question).filter((option) => option.is_correct).length;
}

export function getQuestionIssues(question: AdminQuizQuestionRow): AssessmentIssue[] {
  const issues: AssessmentIssue[] = [];
  const options = getSortedQuestionOptions(question);
  const correctCount = options.filter((option) => option.is_correct).length;

  if (!question.prompt.trim()) {
    issues.push({ message: "Question prompt is required.", questionId: question.id, severity: "error" });
  }

  if (question.xp < 1 || question.xp > 20) {
    issues.push({ message: "XP must be between 1 and 20.", questionId: question.id, severity: "error" });
  }

  if (options.length < 2) {
    issues.push({ message: "At least two answer options are required.", questionId: question.id, severity: "error" });
  }

  if (options.length > 4) {
    issues.push({ message: "The current quiz model supports up to four options.", questionId: question.id, severity: "error" });
  }

  if (correctCount === 0) {
    issues.push({ message: "Mark at least one correct answer.", questionId: question.id, severity: "error" });
  }

  if (question.question_type === "single_choice" && correctCount !== 1) {
    issues.push({ message: "Single-choice questions must have exactly one correct answer.", questionId: question.id, severity: "error" });
  }

  if (question.question_type === "multiple_choice" && correctCount === options.length && options.length > 1) {
    issues.push({ message: "Multiple-choice questions need at least one incorrect option.", questionId: question.id, severity: "error" });
  }

  if (question.question_type === "true_false") {
    const normalizedLabels = options.map((option) => option.label.trim().toLowerCase()).sort();

    if (options.length !== 2 || normalizedLabels[0] !== "false" || normalizedLabels[1] !== "true") {
      issues.push({ message: "True/false questions must use exactly True and False options.", questionId: question.id, severity: "error" });
    }

    if (correctCount !== 1) {
      issues.push({ message: "True/false questions must have exactly one correct answer.", questionId: question.id, severity: "error" });
    }
  }

  if (!question.explanation?.trim()) {
    issues.push({ message: "Add feedback explaining the correct answer.", questionId: question.id, severity: "warning" });
  }

  return issues;
}

export function getAssessmentIssues(questions: AdminQuizQuestionRow[]) {
  const issues: AssessmentIssue[] = [];

  if (questions.length === 0) {
    issues.push({ message: "Add at least one question before publishing.", severity: "error" });
  }

  for (const question of questions) {
    issues.push(...getQuestionIssues(question));
  }

  return issues;
}

export function getAssessmentXp(questions: AdminQuizQuestionRow[]) {
  return questions.reduce((total, question) => total + question.xp, 0);
}
