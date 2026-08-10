import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSelectedAdminWorkspaceId } from "@/features/admin/application/context";
import {
  buildCourseReadiness,
  getCourseReadinessIssueLabels,
} from "@/features/learning/admin/course-readiness";

export type AdminCourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  intended_audience: string;
  learning_outcomes: string[];
  category: string;
  level: string;
  thumbnail: Record<string, unknown> | null;
  status: string;
  sort_order: number;
  estimated_minutes: number;
  catalog_scope: string;
  organization_id: string | null;
  source_course_id: string | null;
  source_catalog_version: number | null;
  copied_at: string | null;
  local_changes: Record<string, unknown>;
  upstream_update_available: boolean;
  catalog_version: number;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
  ai_generated: boolean;
  ai_generation_notes: Record<string, unknown>;
  text_approved_at: string | null;
  text_approved_by: string | null;
  text_approved_by_name?: string | null;
  media_approved_at: string | null;
  media_approved_by: string | null;
  media_approved_by_name?: string | null;
  lesson_count?: number;
  draft_lesson_count?: number;
  published_lesson_count?: number;
  readiness_issues?: string[];
  created_at: string;
  updated_at: string;
};

export type AdminLessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image: Record<string, unknown> | null;
  status: string;
  sort_order: number;
  estimated_minutes: number;
  retry_mode: string;
  retry_cooldown_seconds: number | null;
  retry_requires_reread: boolean;
  quiz_requires_lesson_completion: boolean;
  max_earning_attempts: number | null;
  ai_text_status: string;
  ai_media_status: string;
  ai_publish_status: string;
  ai_generated: boolean;
  ai_generation_notes: Record<string, unknown>;
  text_approved_at: string | null;
  text_approved_by: string | null;
  text_approved_by_name?: string | null;
  media_approved_at: string | null;
  media_approved_by: string | null;
  media_approved_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminLessonPageRow = {
  id: string;
  lesson_id: string;
  page_number: number;
  title: string;
  subtitle: string | null;
  page_type: string;
  cover_image: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AdminLessonBlockRow = {
  id: string;
  page_id: string;
  block_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

export type AdminQuizRow = {
  id: string;
  lesson_id: string;
  title: string;
  version: number;
  status: string;
  ai_text_status: string;
  ai_generated: boolean;
  ai_generation_notes: Record<string, unknown>;
  text_approved_at: string | null;
  text_approved_by: string | null;
  text_approved_by_name?: string | null;
};

export type AdminLearningMediaAssetRow = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  asset_type: string;
  placement: string;
  source: string;
  prompt: string | null;
  script: string | null;
  url: string | null;
  storage_path: string | null;
  provider: string | null;
  model: string | null;
  alt_text: string | null;
  caption: string | null;
  metadata: Record<string, unknown>;
  review_status: string;
  generation_status: string;
  generation_error: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  lesson?: Pick<AdminLessonRow, "id" | "title"> | null;
};

export type AdminAiCoursePlanRow = {
  id: string;
  mode: string;
  course_id: string | null;
  status: string;
  input_prompt: string;
  generated_plan: Record<string, unknown>;
  selected_items: unknown[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  course?: Pick<AdminCourseRow, "id" | "title" | "status"> | null;
};

export type AdminQuizQuestionRow = {
  id: string;
  quiz_id: string;
  question_order: number;
  question_type: string;
  prompt: string;
  explanation: string | null;
  xp: number;
  options?: AdminQuizOptionRow[];
};

export type AdminQuizOptionRow = {
  id: string;
  question_id: string;
  option_order: number;
  label: string;
  is_correct: boolean;
};

type AdminApprovalProfileRow = {
  id: string;
  display_name: string | null;
};

async function getProfilesByIds(
  supabase: SupabaseClient,
  userIds: Array<string | null | undefined>,
) {
  const uniqueIds = Array.from(new Set(userIds)).filter(
    (userId): userId is string => typeof userId === "string" && userId.length > 0,
  );

  if (uniqueIds.length === 0) {
    return new Map<string, AdminApprovalProfileRow>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as AdminApprovalProfileRow[]).map((profile) => [profile.id, profile]));
}

function attachApprovalNames<
  T extends {
    text_approved_by: string | null;
    media_approved_by?: string | null;
  },
>(
  rows: T[],
  profilesById: Map<string, AdminApprovalProfileRow>,
) {
  return rows.map((row) => ({
    ...row,
    text_approved_by_name: row.text_approved_by
      ? profilesById.get(row.text_approved_by)?.display_name ?? null
      : null,
    media_approved_by_name: row.media_approved_by
      ? profilesById.get(row.media_approved_by)?.display_name ?? null
      : null,
  }));
}

export async function getAdminCourses(supabase: SupabaseClient, workspaceId?: string) {
  const selectedWorkspaceId = workspaceId ?? await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("courses")
    .select("id, slug, title, description, intended_audience, learning_outcomes, category, level, thumbnail, status, sort_order, estimated_minutes, catalog_scope, organization_id, source_course_id, source_catalog_version, copied_at, local_changes, upstream_update_available, catalog_version, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .order("sort_order", { ascending: true });

  if (selectedWorkspaceId !== "platform") {
    query = query.or(`organization_id.eq.${selectedWorkspaceId},catalog_scope.eq.platform`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const courses = (data ?? []) as AdminCourseRow[];
  const courseIds = courses.map((course) => course.id);
  const approvalUserIds = courses.flatMap((course) => [
    course.text_approved_by,
    course.media_approved_by,
  ]);

  if (courseIds.length === 0) {
    return [];
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, course_id, slug, title, description, cover_image, status, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .in("course_id", courseIds);

  if (lessonsError) {
    throw lessonsError;
  }

  const lessonRows = (lessons ?? []) as AdminLessonRow[];
  const lessonIds = lessonRows.map((lesson) => lesson.id);
  const [pagesResult, mediaResult, quizzesResult] = lessonIds.length > 0
    ? await Promise.all([
        supabase
          .from("lesson_pages")
          .select("id, lesson_id, page_number, title, subtitle, page_type, cover_image, created_at, updated_at")
          .in("lesson_id", lessonIds),
        supabase
          .from("learning_media_assets")
          .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order, created_at, updated_at")
          .in("course_id", courseIds),
        supabase
          .from("quizzes")
          .select("id, lesson_id, title, version, status, ai_text_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by")
          .in("lesson_id", lessonIds),
      ])
    : [
        { data: [] as AdminLessonPageRow[], error: null },
        { data: [] as AdminLearningMediaAssetRow[], error: null },
        { data: [] as AdminQuizRow[], error: null },
      ];

  if (pagesResult.error) throw pagesResult.error;
  if (mediaResult.error) throw mediaResult.error;
  if (quizzesResult.error) throw quizzesResult.error;

  const pageRows = (pagesResult.data ?? []) as AdminLessonPageRow[];
  const pageIds = pageRows.map((page) => page.id);
  const quizRows = (quizzesResult.data ?? []) as AdminQuizRow[];
  const quizIds = quizRows.map((quiz) => quiz.id);
  const [blocksResult, questionsResult] = await Promise.all([
    pageIds.length > 0
      ? supabase
        .from("lesson_content_blocks")
        .select("id, page_id, block_type, sort_order, payload")
        .in("page_id", pageIds)
      : { data: [] as AdminLessonBlockRow[], error: null },
    quizIds.length > 0
      ? supabase
        .from("quiz_questions")
        .select("id, quiz_id, question_order, question_type, prompt, explanation, xp")
        .in("quiz_id", quizIds)
      : { data: [] as AdminQuizQuestionRow[], error: null },
  ]);

  if (blocksResult.error) throw blocksResult.error;
  if (questionsResult.error) throw questionsResult.error;

  const blockRows = (blocksResult.data ?? []) as AdminLessonBlockRow[];
  const questionRows = (questionsResult.data ?? []) as AdminQuizQuestionRow[];
  const questionIds = questionRows.map((question) => question.id);
  const optionsResult = questionIds.length > 0
    ? await supabase
      .from("quiz_options")
      .select("id, question_id, option_order, label, is_correct")
      .in("question_id", questionIds)
    : { data: [] as AdminQuizOptionRow[], error: null };

  if (optionsResult.error) throw optionsResult.error;

  const profilesById = await getProfilesByIds(supabase, approvalUserIds);
  const mediaRows = (mediaResult.data ?? []) as AdminLearningMediaAssetRow[];
  const optionsByQuestionId = new Map<string, AdminQuizOptionRow[]>();
  for (const option of (optionsResult.data ?? []) as AdminQuizOptionRow[]) {
    const existing = optionsByQuestionId.get(option.question_id) ?? [];
    existing.push(option);
    optionsByQuestionId.set(option.question_id, existing);
  }
  const questionsWithOptions = questionRows.map((question) => ({
    ...question,
    options: optionsByQuestionId.get(question.id) ?? [],
  }));

  const summariesByCourseId = new Map<
    string,
    { draft: number; minutes: number; published: number; total: number }
  >();
  for (const lesson of lessonRows) {
    const summary = summariesByCourseId.get(lesson.course_id) ?? {
      draft: 0,
      minutes: 0,
      published: 0,
      total: 0,
    };
    summary.total += 1;
    summary.minutes += lesson.estimated_minutes;
    if (lesson.status === "draft") summary.draft += 1;
    if (lesson.status === "published") summary.published += 1;
    summariesByCourseId.set(lesson.course_id, summary);
  }

  return attachApprovalNames(courses, profilesById).map((course) => {
    const summary = summariesByCourseId.get(course.id) ?? {
      draft: 0,
      minutes: 0,
      published: 0,
      total: 0,
    };

    return {
      ...course,
      draft_lesson_count: summary.draft,
      estimated_minutes: summary.minutes,
      lesson_count: summary.total,
      published_lesson_count: summary.published,
      readiness_issues: getCourseReadinessIssueLabels(buildCourseReadiness({
        blocks: blockRows.filter((block) => {
          const page = pageRows.find((item) => item.id === block.page_id);
          const lesson = page ? lessonRows.find((item) => item.id === page.lesson_id) : null;
          return lesson?.course_id === course.id;
        }),
        course,
        lessons: lessonRows.filter((lesson) => lesson.course_id === course.id),
        mediaAssets: mediaRows.filter((asset) => asset.course_id === course.id),
        pages: pageRows.filter((page) => {
          const lesson = lessonRows.find((item) => item.id === page.lesson_id);
          return lesson?.course_id === course.id;
        }),
        questions: questionsWithOptions.filter((question) => {
          const quiz = quizRows.find((item) => item.id === question.quiz_id);
          const lesson = quiz ? lessonRows.find((item) => item.id === quiz.lesson_id) : null;
          return lesson?.course_id === course.id;
        }),
        quizzes: quizRows.filter((quiz) => {
          const lesson = lessonRows.find((item) => item.id === quiz.lesson_id);
          return lesson?.course_id === course.id;
        }),
      })),
    };
  });
}

export async function getAdminCourseCategories(supabase: SupabaseClient) {
  const selectedWorkspaceId = await getSelectedAdminWorkspaceId();
  let query = supabase
    .from("courses")
    .select("category");

  if (selectedWorkspaceId !== "platform") {
    query = query.or(`organization_id.eq.${selectedWorkspaceId},catalog_scope.eq.platform`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Array.from(
    new Set(
      ((data ?? []) as Array<{ category: string | null }>)
        .map((row) => row.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort((first, second) => first.localeCompare(second));
}

export async function getAdminCourse(supabase: SupabaseClient, courseId: string) {
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, description, intended_audience, learning_outcomes, category, level, thumbnail, status, sort_order, estimated_minutes, catalog_scope, organization_id, source_course_id, source_catalog_version, copied_at, local_changes, upstream_update_available, catalog_version, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const course = data as AdminCourseRow | null;

  if (!course) return course;

  const profilesById = await getProfilesByIds(supabase, [
    course.text_approved_by,
    course.media_approved_by,
  ]);

  return attachApprovalNames([course], profilesById)[0] ?? course;
}

export async function getAdminLessons(
  supabase: SupabaseClient,
  filters: { courseId?: string } = {},
) {
  let query = supabase
    .from("lessons")
    .select("id, course_id, slug, title, description, cover_image, status, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .order("sort_order", { ascending: true });

  if (filters.courseId) {
    query = query.eq("course_id", filters.courseId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const lessons = (data ?? []) as AdminLessonRow[];
  const profilesById = await getProfilesByIds(
    supabase,
    lessons.flatMap((lesson) => [lesson.text_approved_by, lesson.media_approved_by]),
  );

  return attachApprovalNames(lessons, profilesById);
}

export async function getAdminLesson(supabase: SupabaseClient, lessonId: string) {
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, course_id, slug, title, description, cover_image, status, sort_order, estimated_minutes, retry_mode, retry_cooldown_seconds, retry_requires_reread, quiz_requires_lesson_completion, max_earning_attempts, ai_text_status, ai_media_status, ai_publish_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by, media_approved_at, media_approved_by, created_at, updated_at")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const lessonRow = lesson as AdminLessonRow | null;

  if (!lessonRow) {
    return null;
  }

  const [pagesResult, blocksResult, quizResult] = await Promise.all([
    supabase
      .from("lesson_pages")
      .select("id, lesson_id, page_number, title, subtitle, page_type, cover_image, created_at, updated_at")
      .eq("lesson_id", lessonId)
      .order("page_number", { ascending: true }),
    supabase
      .from("lesson_content_blocks")
      .select("id, page_id, block_type, sort_order, payload")
      .order("sort_order", { ascending: true }),
    supabase
      .from("quizzes")
      .select("id, lesson_id, title, version, status, ai_text_status, ai_generated, ai_generation_notes, text_approved_at, text_approved_by")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
  ]);

  if (pagesResult.error) throw pagesResult.error;
  if (blocksResult.error) throw blocksResult.error;
  if (quizResult.error) throw quizResult.error;

  const pages = (pagesResult.data ?? []) as AdminLessonPageRow[];
  const pageIds = new Set(pages.map((page) => page.id));
  const blocks = ((blocksResult.data ?? []) as AdminLessonBlockRow[]).filter((block) => pageIds.has(block.page_id));
  const quizRow = quizResult.data as AdminQuizRow | null;
  let questions: AdminQuizQuestionRow[] = [];

  if (quizRow) {
    const [questionsResult, optionsResult] = await Promise.all([
      supabase
        .from("quiz_questions")
        .select("id, quiz_id, question_order, question_type, prompt, explanation, xp")
        .eq("quiz_id", quizRow.id)
        .order("question_order", { ascending: true }),
      supabase
        .from("quiz_options")
        .select("id, question_id, option_order, label, is_correct")
        .order("option_order", { ascending: true }),
    ]);

    if (questionsResult.error) throw questionsResult.error;
    if (optionsResult.error) throw optionsResult.error;

    const questionRows = (questionsResult.data ?? []) as AdminQuizQuestionRow[];
    const optionRows = (optionsResult.data ?? []) as AdminQuizOptionRow[];
    const questionIds = new Set(questionRows.map((question) => question.id));
    const optionsByQuestionId = new Map<string, AdminQuizOptionRow[]>();

    for (const option of optionRows.filter((option) => questionIds.has(option.question_id))) {
      const existing = optionsByQuestionId.get(option.question_id) ?? [];
      existing.push(option);
      optionsByQuestionId.set(option.question_id, existing);
    }

    questions = questionRows.map((question) => ({
      ...question,
      options: optionsByQuestionId.get(question.id) ?? [],
    }));
  }

  const profilesById = await getProfilesByIds(supabase, [
    lessonRow.text_approved_by,
    lessonRow.media_approved_by,
    quizRow?.text_approved_by ?? null,
  ]);

  const [lessonWithNames] = attachApprovalNames([lessonRow], profilesById);
  const quizWithNames = quizRow
    ? {
        ...quizRow,
        text_approved_by_name: quizRow.text_approved_by
          ? profilesById.get(quizRow.text_approved_by)?.display_name ?? null
          : null,
      }
    : null;

  return {
    lesson: lessonWithNames,
    pages,
    blocks,
    quiz: quizWithNames,
    questions,
  };
}

export async function getAdminLearningMediaAssets(
  supabase: SupabaseClient,
  filters: { courseId?: string; lessonId?: string } = {},
) {
  let query = supabase
    .from("learning_media_assets")
    .select("id, course_id, lesson_id, asset_type, placement, source, prompt, script, url, storage_path, provider, model, alt_text, caption, metadata, review_status, generation_status, generation_error, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters.courseId) {
    query = query.eq("course_id", filters.courseId);
  }

  if (filters.lessonId) {
    query = query.eq("lesson_id", filters.lessonId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const assets = (data ?? []) as AdminLearningMediaAssetRow[];
  const lessonIds = Array.from(new Set(assets.map((asset) => asset.lesson_id).filter(Boolean))) as string[];

  if (lessonIds.length === 0) {
    return assets;
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, title")
    .in("id", lessonIds);

  if (lessonsError) {
    throw lessonsError;
  }

  const lessonsById = new Map(((lessons ?? []) as Array<Pick<AdminLessonRow, "id" | "title">>).map((lesson) => [lesson.id, lesson]));

  return assets.map((asset) => ({
    ...asset,
    lesson: asset.lesson_id ? lessonsById.get(asset.lesson_id) ?? null : null,
  }));
}

export async function getAdminAiCoursePlans(
  supabase: SupabaseClient,
  filters: {
    courseId?: string;
    mode?: string;
    limit?: number;
    planId?: string;
    orderBy?: "created_at" | "updated_at";
    excludeStatuses?: string[];
  } = {},
) {
  const orderBy = filters.orderBy ?? "created_at";
  let query = supabase
    .from("ai_course_plans")
    .select(`
      id,
      mode,
      course_id,
      status,
      input_prompt,
      generated_plan,
      selected_items,
      created_by,
      created_at,
      updated_at,
      course:courses(id, title, status)
    `)
    .order(orderBy, { ascending: false });

  if (filters.planId) {
    query = query.eq("id", filters.planId);
  }

  if (filters.courseId) {
    query = query.eq("course_id", filters.courseId);
  }

  if (filters.mode) {
    query = query.eq("mode", filters.mode);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const excludeStatuses = new Set(filters.excludeStatuses ?? []);

  return ((data ?? []) as unknown as AdminAiCoursePlanRow[])
    .map((plan) => ({
      ...plan,
      selected_items: Array.isArray(plan.selected_items) ? plan.selected_items : [],
    }))
    .filter((plan) => !excludeStatuses.has(plan.status));
}
