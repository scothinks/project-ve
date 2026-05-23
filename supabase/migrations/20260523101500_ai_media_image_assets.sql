alter table public.learning_media_assets
  add column if not exists storage_path text,
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists generation_status text not null default 'pending',
  add column if not exists generation_error text;

alter table public.learning_media_assets
  drop constraint if exists learning_media_assets_generation_status_check;

alter table public.learning_media_assets
  add constraint learning_media_assets_generation_status_check
    check (generation_status in ('pending', 'running', 'completed', 'failed', 'skipped'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'learning-media', 'learning-media', true, 10485760, array['image/png']
where not exists (
  select 1
  from storage.buckets
  where id = 'learning-media'
);

update storage.buckets
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/png']
where id = 'learning-media';

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

  update public.learning_media_assets
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'stale', true,
    'staleAt', now(),
    'staleReason', 'text_updated'
  ),
      updated_at = now()
  where course_id = p_course_id;
end;
$$;
