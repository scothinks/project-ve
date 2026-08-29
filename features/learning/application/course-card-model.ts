import type {
  Course,
  CourseLevel,
  CourseStatus,
  ImageAsset,
  LessonRetryPolicy,
  LessonStatus,
} from "@/lib/lessons";

export type LearningPageReference = {
  id: string;
  order: number;
};

export type LearningQuizReference = {
  id: string;
  questionIds: string[];
};

export type LearningLessonCard = {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  summary: string;
  order: number;
  estimatedMinutes: number;
  status: LessonStatus;
  coverImage: ImageAsset;
  retryPolicy: LessonRetryPolicy;
  pages: LearningPageReference[];
  quiz: LearningQuizReference;
  xp: number;
};

export type LearningCourseCard = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  level: CourseLevel;
  status: CourseStatus;
  thumbnail: ImageAsset;
  estimatedMinutes: number;
  lessons: LearningLessonCard[];
  xp: number;
};

export function toLearningCourseCard(course: Course): LearningCourseCard {
  const lessons = course.lessons.map((lesson): LearningLessonCard => {
    const xp = lesson.quiz.questions.reduce((total, question) => total + question.xp, 0);

    return {
      id: lesson.id,
      courseId: lesson.courseId,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      order: lesson.order,
      estimatedMinutes: lesson.estimatedMinutes,
      status: lesson.status,
      coverImage: lesson.coverImage,
      retryPolicy: lesson.retryPolicy,
      pages: lesson.pages.map((page) => ({ id: page.id, order: page.order })),
      quiz: {
        id: lesson.quiz.id,
        questionIds: lesson.quiz.questions.map((question) => question.id),
      },
      xp,
    };
  });

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    category: course.category,
    description: course.description,
    level: course.level,
    status: course.status,
    thumbnail: course.thumbnail,
    estimatedMinutes: lessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0),
    lessons,
    xp: lessons.reduce((total, lesson) => total + lesson.xp, 0),
  };
}

export function toLearningCourseCards(courses: Course[]): LearningCourseCard[] {
  return courses.map(toLearningCourseCard);
}
