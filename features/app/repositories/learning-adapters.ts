import type { Course, Lesson, Quiz } from "../../../lib/lessons";
import {
  toLearningCourseCards,
  type LearningCourseCard,
} from "../../learning/application/course-card-model";
import type { LearningRepository } from "./contracts";

export type SupabaseLearningLoaders<TSupabase> = {
  getCatalog(supabase: TSupabase): Promise<Course[]>;
  getCourseCards(supabase: TSupabase): Promise<LearningCourseCard[]>;
  getCourse(supabase: TSupabase, idOrSlug: string): Promise<Course | null>;
  getLesson(supabase: TSupabase, idOrSlug: string): Promise<{ lesson: Lesson; course: Course } | null>;
  getQuiz(supabase: TSupabase, idOrLessonId: string): Promise<{ lesson: Lesson; quiz: Quiz } | null>;
};

function findCourse(courses: Course[], idOrSlug: string) {
  return courses.find((course) => course.id === idOrSlug || course.slug === idOrSlug) ?? null;
}

function findLesson(courses: Course[], idOrSlug: string) {
  for (const course of courses) {
    const lesson = course.lessons.find((item) => item.id === idOrSlug || item.slug === idOrSlug);
    if (lesson) return { lesson, course };
  }

  return null;
}

function findQuiz(courses: Course[], idOrLessonId: string) {
  for (const course of courses) {
    const lesson = course.lessons.find(
      (item) =>
        item.id === idOrLessonId ||
        item.slug === idOrLessonId ||
        item.quiz.id === idOrLessonId,
    );
    if (lesson) return { lesson, quiz: lesson.quiz };
  }

  return null;
}

export class DemoLearningRepository implements LearningRepository {
  private readonly courses: Course[];

  constructor(courses: Course[]) {
    this.courses = courses;
  }

  async getCatalog() {
    return this.courses;
  }

  async getCourseCards() {
    return toLearningCourseCards(this.courses);
  }

  async getCourse(idOrSlug: string) {
    return findCourse(this.courses, idOrSlug);
  }

  async getLesson(idOrSlug: string) {
    return findLesson(this.courses, idOrSlug);
  }

  async getQuiz(idOrLessonId: string) {
    return findQuiz(this.courses, idOrLessonId);
  }
}

export class SupabaseLearningRepository<TSupabase> implements LearningRepository {
  private readonly supabase: TSupabase;
  private readonly loaders: SupabaseLearningLoaders<TSupabase>;

  constructor(
    supabase: TSupabase,
    loaders: SupabaseLearningLoaders<TSupabase>,
  ) {
    this.supabase = supabase;
    this.loaders = loaders;
  }

  getCatalog() {
    return this.loaders.getCatalog(this.supabase);
  }

  getCourseCards() {
    return this.loaders.getCourseCards(this.supabase);
  }

  getCourse(idOrSlug: string) {
    return this.loaders.getCourse(this.supabase, idOrSlug);
  }

  getLesson(idOrSlug: string) {
    return this.loaders.getLesson(this.supabase, idOrSlug);
  }

  getQuiz(idOrLessonId: string) {
    return this.loaders.getQuiz(this.supabase, idOrLessonId);
  }
}
