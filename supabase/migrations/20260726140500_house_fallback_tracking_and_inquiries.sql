create table if not exists public.ad_house_fallback_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('impression', 'viewable_impression', 'click')),
  fallback_key text not null,
  placement_key text not null references public.ad_placements(key) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  session_key_hash text,
  ip_hash text,
  device_hash text,
  user_agent_hash text,
  route text,
  metadata jsonb not null default '{}'::jsonb,
  event_dedupe_key text,
  client_event_time timestamptz,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists ad_house_fallback_events_dedupe_key_idx
  on public.ad_house_fallback_events(event_dedupe_key)
  where event_dedupe_key is not null;

create index if not exists ad_house_fallback_events_reporting_idx
  on public.ad_house_fallback_events(placement_key, event_type, created_at desc);

alter table public.ad_house_fallback_events enable row level security;

drop policy if exists "Admins can read ad house fallback events" on public.ad_house_fallback_events;
create policy "Admins can read ad house fallback events" on public.ad_house_fallback_events for select
  using (public.current_user_is_admin());

create table if not exists public.ad_sponsor_inquiries (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  organization_name text not null,
  email text not null,
  website_url text,
  role_title text,
  campaign_goal text not null,
  placement_interest text,
  budget_range text,
  timing text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'contacted', 'qualified', 'closed')),
  source text not null default 'advertise_page',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_sponsor_inquiries_status_idx
  on public.ad_sponsor_inquiries(status, created_at desc);

alter table public.ad_sponsor_inquiries enable row level security;

drop policy if exists "Admins can read sponsor inquiries" on public.ad_sponsor_inquiries;
create policy "Admins can read sponsor inquiries" on public.ad_sponsor_inquiries for select
  using (public.current_user_is_admin());

create or replace function public.record_ad_house_fallback_event(
  p_event_type text,
  p_fallback_key text,
  p_placement_key text,
  p_event_dedupe_key text,
  p_client_event_time timestamptz,
  p_ip_hash text,
  p_device_hash text,
  p_user_agent_hash text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_existing uuid;
begin
  if p_event_type not in ('impression', 'viewable_impression', 'click') then
    raise exception 'Unsupported house fallback event type.';
  end if;

  if p_fallback_key is null or trim(p_fallback_key) = '' then
    raise exception 'Fallback key is required.';
  end if;

  if not exists (
    select 1
    from public.ad_placements
    where key = p_placement_key
      and status = 'active'
      and house_fallback_enabled = true
  ) then
    raise exception 'House fallback placement is not active.';
  end if;

  if p_event_dedupe_key is not null then
    select id into v_existing
    from public.ad_house_fallback_events
    where event_dedupe_key = p_event_dedupe_key;

    if v_existing is not null then
      return jsonb_build_object('eventId', v_existing, 'status', 'duplicate');
    end if;
  end if;

  insert into public.ad_house_fallback_events (
    event_type,
    fallback_key,
    placement_key,
    user_id,
    session_key_hash,
    ip_hash,
    device_hash,
    user_agent_hash,
    route,
    metadata,
    event_dedupe_key,
    client_event_time
  )
  values (
    p_event_type,
    p_fallback_key,
    p_placement_key,
    auth.uid(),
    nullif(p_metadata ->> 'sessionKeyHash', ''),
    p_ip_hash,
    p_device_hash,
    p_user_agent_hash,
    nullif(p_metadata ->> 'route', ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_event_dedupe_key,
    p_client_event_time
  )
  returning id into v_event_id;

  return jsonb_build_object('eventId', v_event_id, 'status', 'recorded');
end;
$$;

create or replace function public.submit_ad_sponsor_inquiry(
  p_contact_name text,
  p_organization_name text,
  p_email text,
  p_website_url text,
  p_role_title text,
  p_campaign_goal text,
  p_placement_interest text,
  p_budget_range text,
  p_timing text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inquiry_id uuid;
begin
  if length(trim(coalesce(p_contact_name, ''))) < 2 then
    raise exception 'Contact name is required.';
  end if;

  if length(trim(coalesce(p_organization_name, ''))) < 2 then
    raise exception 'Organization name is required.';
  end if;

  if trim(coalesce(p_email, '')) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid email is required.';
  end if;

  if length(trim(coalesce(p_campaign_goal, ''))) < 10 then
    raise exception 'Campaign goal is required.';
  end if;

  insert into public.ad_sponsor_inquiries (
    contact_name,
    organization_name,
    email,
    website_url,
    role_title,
    campaign_goal,
    placement_interest,
    budget_range,
    timing,
    metadata
  )
  values (
    trim(p_contact_name),
    trim(p_organization_name),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_website_url, '')), ''),
    nullif(trim(coalesce(p_role_title, '')), ''),
    trim(p_campaign_goal),
    nullif(trim(coalesce(p_placement_interest, '')), ''),
    nullif(trim(coalesce(p_budget_range, '')), ''),
    nullif(trim(coalesce(p_timing, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_inquiry_id;

  return jsonb_build_object('inquiryId', v_inquiry_id);
end;
$$;

revoke execute on function public.record_ad_house_fallback_event(text, text, text, text, timestamptz, text, text, text, jsonb) from public;
grant execute on function public.record_ad_house_fallback_event(text, text, text, text, timestamptz, text, text, text, jsonb) to anon;
grant execute on function public.record_ad_house_fallback_event(text, text, text, text, timestamptz, text, text, text, jsonb) to authenticated;

revoke execute on function public.submit_ad_sponsor_inquiry(text, text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_ad_sponsor_inquiry(text, text, text, text, text, text, text, text, text, jsonb) to anon;
grant execute on function public.submit_ad_sponsor_inquiry(text, text, text, text, text, text, text, text, text, jsonb) to authenticated;
