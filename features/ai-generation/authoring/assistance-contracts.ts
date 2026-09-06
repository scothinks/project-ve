import type { AuthoringResult, PageCandidate } from './contracts.ts';
export type AssistanceKind = 'quiz' | 'lesson_plan' | 'lesson_draft';
export type QuizCandidate = { title: string; questions: Array<{ prompt: string; questionType: 'single_choice'; explanation: string; xp: 10; options: Array<{ label: string; isCorrect: boolean }> }> };
export type LessonPlanCandidate = { title: string; suggestions: Array<{ title: string; description: string; reason: string }> };
export type LessonDraftCandidate = { title: string; description: string; pages: PageCandidate[] };
export type AssistanceCandidate = QuizCandidate | LessonPlanCandidate | LessonDraftCandidate;
export type AssistanceReceipt = { status: 'saved'; kind: AssistanceKind; lessonId: string; ids: string[]; savedAt: string };
export type AssistanceResult = Omit<AuthoringResult, 'candidate' | 'receipt' | 'lessonId' | 'kind'> & {
  kind: AssistanceKind; lessonId: string | null; count: number; selection: number[] | null;
  candidate: AssistanceCandidate | null; receipt: AssistanceReceipt | null;
};
export type AssistanceContext = {
  kind: AssistanceKind; count: number; focus: string; refinementInstruction: string;
  course: Record<string, unknown>; lessons: Array<{ title: string; description: string; pages: Array<{ title: string; content: string }> | null }>;
  existingQuestions: string[]; suggestion: LessonPlanCandidate['suggestions'][number] | null;
  priorDraft: AssistanceCandidate | null;
};
export function assistanceDestination(result: Pick<AssistanceResult, 'id' | 'kind' | 'lessonId' | 'courseId'>) {
  const path = result.kind === 'quiz' ? `/admin/courses/lessons/${result.lessonId}/quiz` : `/admin/courses/${result.courseId}/expand`;
  return `${path}?aiResult=${encodeURIComponent(result.id)}`;
}
