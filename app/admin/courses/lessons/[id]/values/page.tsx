import { notFound } from "next/navigation";
import { AdminNoticeBanner } from "@/components/admin/AdminPrimitives";
import { LessonAuthoringSteps } from "@/components/admin/LessonAuthoringSteps";
import { LessonValuesEditor } from "@/components/admin/LessonValuesEditor";
import { getLessonValuesPageData } from "@/features/learning/admin/lesson-values-data";
import { requireAdmin } from "@/lib/admin";

export default async function LessonValuesPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const { supabase } = await requireAdmin();
  const data = await getLessonValuesPageData(supabase, id);
  if (!data) notFound();
  return <div>
    <LessonAuthoringSteps current="values" lessonId={id} pageCount={data.pageCount} questionCount={data.questionCount} />
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {notice ? <AdminNoticeBanner>{notice}</AdminNoticeBanner> : null}
      <header className="space-y-3">
        <p className="text-sm font-bold text-[var(--ui-text-muted)]">{data.lesson.title}</p>
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-black sm:text-3xl">Values</h1><span className="rounded-full bg-[var(--ui-surface-soft)] px-3 py-1 text-xs font-bold text-[var(--ui-text-muted)]">Optional</span></div>
        <p className="text-sm leading-6 text-[var(--ui-text-muted)]">Choose the values this lesson helps learners develop.</p>
      </header>
      <LessonValuesEditor dimensions={data.dimensions} lessonId={id} tags={data.tags} />

    </div>
  </div>;
}
