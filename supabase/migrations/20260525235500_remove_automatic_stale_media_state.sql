create or replace function public.admin_reset_ai_course_tree(
  p_course_id text,
  p_text_status text default 'draft'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_text_status not in ('draft', 'changes_requested') then
    raise exception 'Unsupported AI text reset status.';
  end if;

  update public.courses
  set ai_text_status = p_text_status,
      ai_media_status = 'not_started',
      ai_publish_status = 'not_ready',
      text_approved_at = null,
      text_approved_by = null,
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where id = p_course_id
    and ai_generated = true;

  update public.lessons
  set ai_text_status = p_text_status,
      ai_media_status = 'not_started',
      ai_publish_status = 'not_ready',
      text_approved_at = null,
      text_approved_by = null,
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where course_id = p_course_id
    and ai_generated = true;

  update public.quizzes q
  set ai_text_status = p_text_status,
      text_approved_at = null,
      text_approved_by = null,
      updated_at = now()
  from public.lessons l
  where q.lesson_id = l.id
    and l.course_id = p_course_id
    and q.ai_generated = true;
end;
$$;

update public.learning_media_assets
set metadata = (coalesce(metadata, '{}'::jsonb) - 'stale' - 'staleAt' - 'staleReason'),
    updated_at = now()
where coalesce(metadata, '{}'::jsonb) ?| array['stale', 'staleAt', 'staleReason'];
