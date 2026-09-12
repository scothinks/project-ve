import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getLessonAssistanceAvailability } from "@/features/ai-generation/authoring/lesson-availability";
import { AiAssistanceAuthoring } from "@/components/admin/ai/AiAssistanceAuthoring";
export default async function ExpandPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aiResult?: string }> }) {
  const { id } = await params; const { aiResult } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: course, error } = await supabase.from("courses").select("id,title,organization_id").eq("id", id).maybeSingle();
  if (error) throw error; if (!course) notFound();
  const availability = await getLessonAssistanceAvailability({ supabase }, course.organization_id);
  return <div className="mx-auto max-w-3xl space-y-6 py-8">
    <Link className="text-sm font-bold" href={`/admin/courses/${id}`}>{course.title}</Link>
    <h1 className="text-3xl font-black">What could help learners next?</h1>
    <p className="text-sm leading-6">Review lesson suggestions, draft the ones you want, then add them to your course.</p>
    <AiAssistanceAuthoring courseId={id} kind="lesson_plan" enabled={availability.enabled} unavailableReason={availability.reason ?? undefined} initialResultId={aiResult} />
    {!availability.enabled && <Link className="inline-flex rounded-full bg-[var(--ui-action)] px-5 py-3 text-sm font-bold text-[var(--ui-on-action)]" href={`/admin/courses/${id}`}>Back to course</Link>}
  </div>;
}
