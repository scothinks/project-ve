import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateLearningPaths(courseId: string, lessonIds: string[]) {
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
