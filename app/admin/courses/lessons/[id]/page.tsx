import { notFound } from "next/navigation";
import { LessonPageBuilder } from "@/components/admin/LessonPageBuilder";
import { requireAdmin } from "@/lib/admin";
import { getAdminLesson } from "@/features/learning/admin/data";
import { resolveOrganizationEntitlements } from "@/features/organizations/application/entitlements";
import { pageAuthoringEnabled } from "@/features/ai-generation/authoring/availability";

type LessonDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; notice?: string; aiResult?: string }>;
};

export default async function LessonDetailPage({ params, searchParams }: LessonDetailPageProps) {
  const { id } = await params;
  const { page: selectedPageId, notice, aiResult } = await searchParams;
  const { supabase } = await requireAdmin();
  const data = await getAdminLesson(supabase, id);

  if (!data) {
    notFound();
  }

  const { blocks, lesson, pages, questions } = data;
  const { data: courseContext, error: courseContextError } = await supabase
    .from("courses")
    .select("organization_id")
    .eq("id", lesson.course_id)
    .maybeSingle();

  if (courseContextError) {
    throw courseContextError;
  }

  const organizationEntitlements = courseContext?.organization_id
    ? (await resolveOrganizationEntitlements(supabase, courseContext.organization_id)).entitlements
    : null;
  const aiGenerationAvailable = organizationEntitlements?.aiAuthoringEnabled ?? true;
  const allowedBlockTypes = organizationEntitlements?.allowedLessonBlockTypes;

  return (
    <LessonPageBuilder
      key={`${lesson.id}:${lesson.draft_revision ?? 0}`}
      aiGenerationAvailable={aiGenerationAvailable}
      aiPagePilotEnabled={pageAuthoringEnabled()}
      initialAiResultId={aiResult}
      allowedBlockTypes={allowedBlockTypes}
      blocks={blocks}
      initialPageId={selectedPageId}
      lesson={lesson}
      notice={notice}
      pages={pages}
      questionCount={questions.length}
    />
  );
}
