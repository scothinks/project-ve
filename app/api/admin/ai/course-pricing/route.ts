import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { courseWorkspaceId } from '@/features/ai-generation/authoring/course-availability';

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind');
  const lessons = Number(params.get('lessons') ?? 3), questions = Number(params.get('questions') ?? 0);
  const retryId = params.get('retryId');
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!['course_outline', 'course_draft'].includes(kind || '') || !Number.isInteger(lessons) || lessons < 1 || lessons > 6
    || !Number.isInteger(questions) || questions < 0 || questions > 3 || (retryId && !/^[0-9a-f-]{36}$/i.test(retryId))) {
    return NextResponse.json({ error: 'Choose one to six lessons and zero to three questions.' }, { status: 400, headers });
  }
  const { data, error } = await admin.supabase.rpc('admin_preview_ai_course_price', { p_kind: kind, p_lessons: lessons,
    p_questions: questions, p_retry_id: retryId ?? undefined, p_organization_id: courseWorkspaceId(admin) ?? undefined });
  if (error) return NextResponse.json({ error: 'Pricing is unavailable for this selection. Review the course or try again.' }, { status: error.code === '42501' ? 403 : error.code === 'PT409' ? 409 : 503, headers });
  return NextResponse.json(data, { headers });
}
