export const learningCourseCardSelections = {
  courses:
    "id, slug, title, description, category, level, thumbnail, sort_order, estimated_minutes",
  lessons:
    "id, course_id, slug, title, description, cover_image, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, max_earning_attempts",
  pages: "id, lesson_id, page_number",
  quizzes: "id, lesson_id",
  questions: "id, quiz_id, xp",
} as const;
