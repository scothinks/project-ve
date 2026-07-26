create or replace function public.get_ad_recent_lesson_decision(
  p_session_key_hash text,
  p_placement_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision public.ad_decisions%rowtype;
begin
  if p_session_key_hash is null or p_session_key_hash = '' then
    return null;
  end if;

  select *
    into v_decision
  from public.ad_decisions
  where session_key_hash = p_session_key_hash
    and placement_key = p_placement_key
    and selected_creative_id is not null
    and selected_creative_version_id is not null
    and decision_context ->> 'lessonId' is not null
    and decision_context ->> 'pageNumber' is not null
    and created_at >= now() - interval '6 hours'
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'creativeId', v_decision.selected_creative_id,
    'creativeVersionId', v_decision.selected_creative_version_id,
    'lessonId', v_decision.decision_context ->> 'lessonId',
    'pageNumber', nullif(v_decision.decision_context ->> 'pageNumber', '')::integer,
    'createdAt', v_decision.created_at
  );
end;
$$;

revoke execute on function public.get_ad_recent_lesson_decision(text, text) from public;
grant execute on function public.get_ad_recent_lesson_decision(text, text) to authenticated;
