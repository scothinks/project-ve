import { NextResponse } from 'next/server';
import { requireAdmin, PLATFORM_CATALOG_WORKSPACE_ID } from '@/lib/admin';
import { getAdminWorkspaceAiAuthoringNotice } from '@/features/organizations/admin/entitlement-guards';
import { pageAuthoringEnabled } from '@/features/ai-generation/authoring/availability';
import { starterAdvice, validateDiscoveryInput } from '@/features/ai-generation/authoring/course-discovery';
import { generateCourseAdvice } from '@/features/ai-generation/authoring/course-discovery-provider';

export const maxDuration = 30;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const admin = await requireAdmin();
  let body;
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 9000) return json({ error: 'Shorten your idea before continuing.' }, 400);
    body = JSON.parse(raw);
    input = validateDiscoveryInput(body.input);
    if (!uuid.test(body.requestId) || !uuid.test(body.sessionId)) throw new Error('Reopen guidance to continue.');
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Check your idea.' }, 400); }
  const fallback = (notice: string) => json({ advice: starterAdvice(input), source: 'starter', notice });
  if (!pageAuthoringEnabled() || await getAdminWorkspaceAiAuthoringNotice(admin)) return fallback('AI guidance is unavailable here. You can use these starting suggestions and edit the brief yourself.');
  if (process.env.AI_AUTHORING_GUIDANCE_ENABLED !== 'true' || !process.env.OPENAI_API_KEY) return fallback('Use these starting suggestions, or describe the course in your own words.');
  const org = admin.workspace.type === 'organization' && admin.workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID ? admin.workspace.id : undefined;
  const { data, error } = await admin.supabase.rpc('admin_reserve_ai_course_guidance', { p_id: body.requestId, p_session: body.sessionId, p_organization_id: org });
  if (error || data !== true) return fallback('The included guidance allowance is unavailable. Your idea is still here to edit and use.');
  try { return json({ advice: await generateCourseAdvice(input), source: 'assistant' }); }
  catch { return fallback('AI guidance could not finish. You can use these starting suggestions or edit your brief.'); }
}
