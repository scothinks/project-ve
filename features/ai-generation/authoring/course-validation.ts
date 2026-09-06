import { validateAssistance } from './assistance-validation.ts';
import type { AssistanceContext, LessonDraftCandidate, QuizCandidate } from './assistance-contracts.ts';
import type { CourseContext, CourseLesson, CourseOutline } from './course-contracts.ts';
import { teachingFingerprint } from './course-teaching.ts';
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Check the outline text.');
  return value.trim();
}
export function validateCourseOutline(value: unknown, count?: number): CourseOutline {
  if (!value || typeof value !== 'object') throw new Error('Outline required.');
  const v = value as CourseOutline;
  if (!Array.isArray(v.lessons) || v.lessons.length < 1 || v.lessons.length > 6 || (count !== undefined && v.lessons.length !== count)) throw new Error('Choose one to six lessons.');
  const lessons = v.lessons.map(l => ({ title: text(l.title, 180), description: text(l.description, 1000) }));
  if (new Set(lessons.map(l => l.title.toLowerCase())).size !== lessons.length) throw new Error('Give each lesson a distinct title.');
  return { title: text(v.title, 180), description: text(v.description, 1000), lessons };
}
export function validateCourseLesson(value: unknown, context: CourseContext): CourseLesson {
  const outline = context.outline; const index = context.index;
  if (!outline || index === undefined || !outline.lessons[index]) throw new Error('Lesson scope unavailable.');
  const ctx: AssistanceContext = { kind: 'lesson_draft', count: 1, focus: '', refinementInstruction: '',
    course: outline, lessons: [], existingQuestions: [], suggestion: null, priorDraft: null };
  const draft = validateAssistance(value, ctx) as LessonDraftCandidate;
  const questions = (value as CourseLesson).questions;
  if (!Array.isArray(questions) || questions.length !== context.questionsPerLesson) throw new Error('Questions must match the accepted scope.');
  const validated = questions.length ? (validateAssistance({ title: draft.title, questions }, { ...ctx, kind: 'quiz', count: questions.length,
    lessons: [{ title: draft.title, description: draft.description, pages: draft.pages.map(p => ({ title: p.title, content: JSON.stringify(p.blocks) })) }] }) as QuizCandidate).questions : [];
  const lesson = { ...draft, title: outline.lessons[index].title, questions: validated };
  const fingerprint = teachingFingerprint(lesson);
  if (context.completed?.some(c => teachingFingerprint(c.lesson) === fingerprint)) throw new Error('This lesson repeats completed teaching. Refine the outline before trying again.');
  return lesson;
}
