import { LessonDeliveryPage } from "@/features/learning/application/lesson-delivery-page";

type LessonPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; ref?: string }>;
};

export const dynamic = "force-dynamic";

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const { id } = await params;
  const { page, ref } = await searchParams;

  return <LessonDeliveryPage lessonId={id} pageParam={page} refCode={ref} />;
}
