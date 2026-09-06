import type { AuthoringResult } from './contracts.ts';
import type { LessonDraftCandidate, QuizCandidate } from './assistance-contracts.ts';
export type CourseOutline = { title: string; description: string; lessons: Array<{ title: string; description: string }> };
export type CourseBrief = { need: string; audience: string; tone: string; lessonCount: number };
export type CourseLesson = LessonDraftCandidate & { questions: QuizCandidate['questions'] };
export type CourseCandidate = CourseOutline & { completed: Array<{ index: number; lesson: CourseLesson }> };
export type CourseContext = { kind: 'course_outline' | 'course_draft'; brief: CourseBrief; outline: CourseOutline | null;
  questionsPerLesson: number; refinement: string; priorDraft: CourseOutline | null; index?: number;
  completed?: CourseCandidate['completed'] };
export type CourseResult = Omit<AuthoringResult, 'kind' | 'candidate' | 'receipt' | 'courseId' | 'lessonId'> & {
  kind: CourseContext['kind']; courseId: string | null; lessonId: null;
  brief: CourseBrief; outline: CourseOutline | null; outlineRevision: number; questionsPerLesson: number;
  completedCount: number; totalCount: number; candidate: CourseCandidate | null;
  receipt: { status: 'saved'; courseId: string; lessonIds: string[]; savedAt: string } | null;
};
