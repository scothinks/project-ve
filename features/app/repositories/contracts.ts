import type { Course, Lesson, Quiz } from "../../../lib/lessons";
import type { LearningCourseCard } from "../../learning/application/course-card-model";
import type { UserMissionSummary } from "../../../lib/missions";
import type { LessonProgressRecord } from "../../../lib/progress";
import type { RewardStoreSnapshot } from "../../../lib/rewards";

export interface LearningRepository {
  getCatalog(): Promise<Course[]>;
  getCourseCards(): Promise<LearningCourseCard[]>;
  getCourse(idOrSlug: string): Promise<Course | null>;
  getLesson(idOrSlug: string): Promise<{ lesson: Lesson; course: Course } | null>;
  getQuiz(idOrLessonId: string): Promise<{ lesson: Lesson; quiz: Quiz } | null>;
}

export interface ProgressRepository {
  getLessonProgress(userId: string): Promise<LessonProgressRecord[]>;
}

export interface RewardRepository {
  getStoreSnapshot(userId: string, xpBalance: number): Promise<RewardStoreSnapshot | null>;
}

export interface MissionRepository {
  getSummaries(params: {
    userId: string;
    referralCode: string | null;
    origin: string;
  }): Promise<UserMissionSummary[]>;
}
