import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLISHED_LEARNING_COURSE_CARDS_CACHE_TAG } from "@/features/learning/data/course-card-data";

export function revalidatePublishedLearningCourseCards() {
  revalidateTag(PUBLISHED_LEARNING_COURSE_CARDS_CACHE_TAG);
}

export function revalidateLearningPaths(courseId: string, lessonIds: string[]) {
  revalidatePublishedLearningCourseCards();
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  for (const lessonId of lessonIds) {
    revalidatePath(`/admin/courses/lessons/${lessonId}`);
    revalidatePath(`/lessons/${lessonId}`);
    revalidatePath(`/quiz/${lessonId}`);
  }
}
