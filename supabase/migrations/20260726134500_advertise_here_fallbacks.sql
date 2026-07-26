alter table public.ad_placements
  add column if not exists house_fallback_enabled boolean not null default true,
  add column if not exists house_fallback_eyebrow text not null default 'Support learner rewards',
  add column if not exists house_fallback_headline text not null default 'Help keep high-value rewards available to everyone.',
  add column if not exists house_fallback_body text not null default 'Sponsor this space to reach motivated learners and help Project VE keep meaningful rewards accessible across the community.',
  add column if not exists house_fallback_cta_label text not null default 'Advertise here',
  add column if not exists house_fallback_cta_url text not null default '/advertise';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ad_placements_house_fallback_cta_url_safe'
      and conrelid = 'public.ad_placements'::regclass
  ) then
    alter table public.ad_placements
      add constraint ad_placements_house_fallback_cta_url_safe
      check (
        house_fallback_cta_url = '/advertise'
        or house_fallback_cta_url = '/advertise/inquiry'
        or house_fallback_cta_url ~ '^/advertise[?#][^[:space:]]*$'
      );
  end if;
end $$;

create or replace function public.admin_update_ad_placement_fallback(
  p_placement_key text,
  p_enabled boolean,
  p_eyebrow text,
  p_headline text,
  p_body text,
  p_cta_label text,
  p_cta_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_cta_url text := coalesce(nullif(trim(p_cta_url), ''), '/advertise');
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can update ad placement fallbacks.';
  end if;

  if p_placement_key is null or trim(p_placement_key) = '' then
    raise exception 'Placement key is required.';
  end if;

  if not (
    v_cta_url = '/advertise'
    or v_cta_url = '/advertise/inquiry'
    or v_cta_url ~ '^/advertise[?#][^[:space:]]*$'
  ) then
    raise exception 'Fallback CTA URL must stay on the Project VE advertising page.';
  end if;

  select to_jsonb(item) into v_before
  from public.ad_placements item
  where item.key = p_placement_key;

  update public.ad_placements
  set house_fallback_enabled = coalesce(p_enabled, false),
      house_fallback_eyebrow = coalesce(nullif(trim(p_eyebrow), ''), 'Support learner rewards'),
      house_fallback_headline = coalesce(nullif(trim(p_headline), ''), 'Help keep high-value rewards available to everyone.'),
      house_fallback_body = coalesce(
        nullif(trim(p_body), ''),
        'Sponsor this space to reach motivated learners and help Project VE keep meaningful rewards accessible across the community.'
      ),
      house_fallback_cta_label = coalesce(nullif(trim(p_cta_label), ''), 'Advertise here'),
      house_fallback_cta_url = v_cta_url,
      updated_at = now()
  where key = p_placement_key;

  select to_jsonb(item) into v_after
  from public.ad_placements item
  where item.key = p_placement_key;

  if v_after is null then
    raise exception 'Ad placement not found.';
  end if;

  insert into public.ad_audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    before_state,
    after_state,
    reason
  )
  values (
    v_actor_id,
    'ad_placement_fallback_updated',
    'placement',
    p_placement_key,
    v_before,
    v_after,
    'Admin placement fallback save'
  );

  return jsonb_build_object('placementKey', p_placement_key);
end;
$$;

revoke execute on function public.admin_update_ad_placement_fallback(text, boolean, text, text, text, text, text) from public;
grant execute on function public.admin_update_ad_placement_fallback(text, boolean, text, text, text, text, text) to authenticated;
