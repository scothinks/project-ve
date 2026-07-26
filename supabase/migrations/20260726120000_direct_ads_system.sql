do $$ begin
  create type public.ad_entity_status as enum ('draft', 'submitted', 'approved', 'active', 'published', 'rejected', 'paused', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_campaign_type as enum ('guaranteed', 'priority', 'house', 'bonus');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_pricing_model as enum ('cpm', 'cpc', 'flat_fee', 'make_good', 'house');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_pacing_mode as enum ('even', 'asap', 'manual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_creative_format as enum ('native_card', 'image_banner', 'text_card', 'video_card');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_asset_type as enum ('image', 'logo', 'video', 'poster', 'caption');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_event_type as enum ('impression', 'viewable_impression', 'click');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_qualification_status as enum ('raw', 'filtered', 'qualified', 'billable');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_frequency_scope_type as enum ('session', 'user', 'device', 'campaign', 'creative', 'partner', 'placement');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ad_frequency_window_type as enum ('rolling', 'calendar');
exception when duplicate_object then null;
end $$;

create table if not exists public.ad_partners (
  id text primary key,
  name text not null,
  slug text not null unique,
  status public.ad_entity_status not null default 'draft',
  contact_name text,
  contact_email text,
  website_url text,
  allowed_cta_domains text[] not null default '{}',
  terms_accepted_at timestamptz,
  terms_accepted_by uuid references auth.users(id) on delete set null,
  terms_version text,
  contract_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_campaigns (
  id text primary key,
  partner_id text not null references public.ad_partners(id) on delete restrict,
  name text not null,
  status public.ad_entity_status not null default 'draft',
  campaign_type public.ad_campaign_type not null default 'guaranteed',
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'Africa/Lagos',
  budget_label text,
  pricing_model public.ad_pricing_model not null default 'flat_fee',
  rate_amount integer not null default 0 check (rate_amount >= 0),
  currency text not null default 'NGN',
  minor_unit integer not null default 2 check (minor_unit >= 0 and minor_unit <= 4),
  rounding_mode text not null default 'half_up' check (rounding_mode in ('half_up', 'floor', 'ceil')),
  gross_budget_amount integer check (gross_budget_amount is null or gross_budget_amount >= 0),
  billable_budget_amount integer check (billable_budget_amount is null or billable_budget_amount >= 0),
  spend_cap_amount integer check (spend_cap_amount is null or spend_cap_amount >= 0),
  allow_overspend boolean not null default false,
  overspend_tolerance_percent numeric(5,2) not null default 0 check (overspend_tolerance_percent >= 0),
  contracted_impressions integer check (contracted_impressions is null or contracted_impressions >= 0),
  contracted_clicks integer check (contracted_clicks is null or contracted_clicks >= 0),
  contracted_viewable_impressions integer check (contracted_viewable_impressions is null or contracted_viewable_impressions >= 0),
  included_content_tags text[] not null default '{}',
  excluded_content_tags text[] not null default '{}',
  included_course_categories text[] not null default '{}',
  excluded_course_categories text[] not null default '{}',
  included_course_ids text[] not null default '{}',
  excluded_course_ids text[] not null default '{}',
  included_lesson_ids text[] not null default '{}',
  excluded_lesson_ids text[] not null default '{}',
  excluded_page_types text[] not null default '{}',
  competitor_exclusion_keys text[] not null default '{}',
  priority integer not null default 0,
  pacing_mode public.ad_pacing_mode not null default 'even',
  make_good_policy text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (char_length(currency) = 3)
);

create table if not exists public.ad_creative_assets (
  id uuid primary key default gen_random_uuid(),
  partner_id text references public.ad_partners(id) on delete set null,
  storage_bucket text not null default 'ad-creatives',
  storage_path text not null,
  public_url text,
  asset_type public.ad_asset_type not null,
  mime_type text not null,
  file_size_bytes integer not null check (file_size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  checksum text,
  alt_text text,
  status public.ad_entity_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.ad_creatives (
  id text primary key,
  campaign_id text not null references public.ad_campaigns(id) on delete cascade,
  name text not null,
  status public.ad_entity_status not null default 'draft',
  creative_format public.ad_creative_format not null default 'native_card',
  current_version_id uuid,
  weight integer not null default 1 check (weight > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_creative_versions (
  id uuid primary key default gen_random_uuid(),
  creative_id text not null references public.ad_creatives(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status public.ad_entity_status not null default 'draft',
  headline text,
  body text,
  eyebrow text,
  image_asset_id uuid references public.ad_creative_assets(id) on delete restrict,
  image_alt text,
  logo_asset_id uuid references public.ad_creative_assets(id) on delete restrict,
  video_asset_id uuid references public.ad_creative_assets(id) on delete restrict,
  poster_asset_id uuid references public.ad_creative_assets(id) on delete restrict,
  caption_asset_id uuid references public.ad_creative_assets(id) on delete restrict,
  cta_label text,
  cta_url text,
  sponsor_label text not null,
  disclosure_label text not null default 'Sponsored',
  legal_text text,
  theme jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  paused_by uuid references auth.users(id) on delete set null,
  paused_at timestamptz,
  pause_reason text,
  created_at timestamptz not null default now(),
  unique (creative_id, version_number)
);

alter table public.ad_creatives
  add constraint ad_creatives_current_version_fk
  foreign key (current_version_id)
  references public.ad_creative_versions(id)
  on delete set null
  deferrable initially deferred;

create table if not exists public.ad_placements (
  key text primary key,
  name text not null,
  route_pattern text not null,
  surface text not null,
  status public.ad_entity_status not null default 'active',
  allowed_creative_formats public.ad_creative_format[] not null default array['native_card'::public.ad_creative_format, 'text_card'::public.ad_creative_format],
  required_asset_aspect_ratio text,
  max_asset_weight_kb integer check (max_asset_weight_kb is null or max_asset_weight_kb > 0),
  supports_video boolean not null default false,
  supports_sequence boolean not null default false,
  max_ads_per_view integer not null default 1 check (max_ads_per_view >= 0),
  default_frequency_cap jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_flights (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.ad_campaigns(id) on delete cascade,
  creative_id text not null references public.ad_creatives(id) on delete cascade,
  creative_version_id uuid not null references public.ad_creative_versions(id) on delete restrict,
  placement_key text not null references public.ad_placements(key) on delete restrict,
  status public.ad_entity_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  weight integer not null default 1 check (weight > 0),
  targeting_rules jsonb not null default '{}'::jsonb,
  frequency_caps jsonb not null default '{}'::jsonb,
  sequence_rules jsonb not null default '{}'::jsonb,
  brand_safety_rules jsonb not null default '{}'::jsonb,
  competitor_exclusion_keys text[] not null default '{}',
  delivery_goal_impressions integer check (delivery_goal_impressions is null or delivery_goal_impressions >= 0),
  delivery_goal_clicks integer check (delivery_goal_clicks is null or delivery_goal_clicks >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.ad_decisions (
  id uuid primary key default gen_random_uuid(),
  request_key text,
  user_id uuid references auth.users(id) on delete set null,
  session_key_hash text,
  selected_partner_id text references public.ad_partners(id) on delete set null,
  selected_campaign_id text references public.ad_campaigns(id) on delete set null,
  selected_flight_id uuid references public.ad_flights(id) on delete set null,
  selected_creative_id text references public.ad_creatives(id) on delete set null,
  selected_creative_version_id uuid references public.ad_creative_versions(id) on delete set null,
  placement_key text not null references public.ad_placements(key) on delete restrict,
  decision_context jsonb not null default '{}'::jsonb,
  eligible_flight_count integer not null default 0 check (eligible_flight_count >= 0),
  ineligible_reasons jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  experiment_key text,
  variant_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  event_type public.ad_event_type not null,
  partner_id text references public.ad_partners(id) on delete set null,
  campaign_id text references public.ad_campaigns(id) on delete set null,
  creative_id text references public.ad_creatives(id) on delete set null,
  creative_version_id uuid references public.ad_creative_versions(id) on delete set null,
  flight_id uuid references public.ad_flights(id) on delete set null,
  decision_id uuid references public.ad_decisions(id) on delete set null,
  placement_key text not null references public.ad_placements(key) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  session_key_hash text,
  ip_hash text,
  device_hash text,
  user_agent_hash text,
  route text,
  course_id text,
  lesson_id text,
  page_id text,
  page_number integer,
  segment_keys text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  qualification_status public.ad_qualification_status not null default 'raw',
  ivt_reason text,
  risk_score integer not null default 0 check (risk_score >= 0),
  billable_amount integer not null default 0 check (billable_amount >= 0),
  event_dedupe_key text,
  client_event_time timestamptz,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists ad_events_dedupe_key_idx
  on public.ad_events (event_dedupe_key)
  where event_dedupe_key is not null;

create table if not exists public.ad_frequency_counters (
  id uuid primary key default gen_random_uuid(),
  scope_type public.ad_frequency_scope_type not null,
  scope_key_hash text not null,
  window_type public.ad_frequency_window_type not null default 'rolling',
  window_name text not null,
  timezone text not null default 'Africa/Lagos',
  campaign_id text references public.ad_campaigns(id) on delete cascade,
  creative_id text references public.ad_creatives(id) on delete cascade,
  creative_version_id uuid references public.ad_creative_versions(id) on delete cascade,
  partner_id text references public.ad_partners(id) on delete cascade,
  placement_key text references public.ad_placements(key) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  impression_count integer not null default 0 check (impression_count >= 0),
  viewable_impression_count integer not null default 0 check (viewable_impression_count >= 0),
  click_count integer not null default 0 check (click_count >= 0),
  updated_at timestamptz not null default now(),
  check (window_end > window_start)
);

create unique index if not exists ad_frequency_counters_unique_window_idx
  on public.ad_frequency_counters (
    scope_type,
    scope_key_hash,
    window_type,
    window_name,
    (coalesce(campaign_id, '')),
    (coalesce(creative_id, '')),
    (coalesce(creative_version_id::text, '')),
    (coalesce(partner_id, '')),
    (coalesce(placement_key, '')),
    window_start,
    window_end
  );

create table if not exists public.ad_traffic_quality_events (
  id uuid primary key default gen_random_uuid(),
  ad_event_id uuid references public.ad_events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  session_key_hash text,
  ip_hash text,
  device_hash text,
  rule_key text not null,
  severity integer not null default 1 check (severity between 1 and 5),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_billing_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.ad_campaigns(id) on delete cascade,
  flight_id uuid references public.ad_flights(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  pricing_model public.ad_pricing_model not null,
  currency text not null,
  billable_impressions integer not null default 0 check (billable_impressions >= 0),
  billable_viewable_impressions integer not null default 0 check (billable_viewable_impressions >= 0),
  billable_clicks integer not null default 0 check (billable_clicks >= 0),
  gross_spend integer not null default 0 check (gross_spend >= 0),
  billable_spend integer not null default 0 check (billable_spend >= 0),
  filtered_event_count integer not null default 0 check (filtered_event_count >= 0),
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);

create table if not exists public.ad_make_goods (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.ad_campaigns(id) on delete cascade,
  reason text not null,
  owed_impressions integer not null default 0 check (owed_impressions >= 0),
  owed_clicks integer not null default 0 check (owed_clicks >= 0),
  owed_value_amount integer not null default 0 check (owed_value_amount >= 0),
  status public.ad_entity_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_event_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date date not null,
  timezone text not null,
  partner_id text references public.ad_partners(id) on delete set null,
  campaign_id text references public.ad_campaigns(id) on delete cascade,
  flight_id uuid references public.ad_flights(id) on delete cascade,
  creative_id text references public.ad_creatives(id) on delete set null,
  creative_version_id uuid references public.ad_creative_versions(id) on delete set null,
  placement_key text references public.ad_placements(key) on delete set null,
  gross_impressions integer not null default 0 check (gross_impressions >= 0),
  qualified_impressions integer not null default 0 check (qualified_impressions >= 0),
  billable_viewable_impressions integer not null default 0 check (billable_viewable_impressions >= 0),
  billable_clicks integer not null default 0 check (billable_clicks >= 0),
  filtered_events integer not null default 0 check (filtered_events >= 0),
  billable_spend integer not null default 0 check (billable_spend >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (summary_date, timezone, campaign_id, flight_id, creative_version_id, placement_key)
);

create index if not exists ad_campaigns_active_idx on public.ad_campaigns (status, starts_at, ends_at, priority desc);
create index if not exists ad_creatives_campaign_idx on public.ad_creatives (campaign_id, status);
create index if not exists ad_creative_versions_creative_idx on public.ad_creative_versions (creative_id, status, version_number desc);
create index if not exists ad_flights_serving_idx on public.ad_flights (placement_key, status, starts_at, ends_at, priority desc);
create index if not exists ad_decisions_created_idx on public.ad_decisions (created_at desc);
create index if not exists ad_events_reporting_idx on public.ad_events (campaign_id, placement_key, event_type, qualification_status, created_at desc);
create index if not exists ad_events_user_created_idx on public.ad_events (user_id, created_at desc) where user_id is not null;
create index if not exists ad_events_session_created_idx on public.ad_events (session_key_hash, created_at desc) where session_key_hash is not null;
create index if not exists ad_traffic_quality_events_created_idx on public.ad_traffic_quality_events (created_at desc, rule_key);
create index if not exists ad_audit_events_entity_idx on public.ad_audit_events (entity_type, entity_id, created_at desc);
create index if not exists ad_event_daily_summaries_campaign_date_idx on public.ad_event_daily_summaries (campaign_id, summary_date desc);

drop trigger if exists ad_partners_set_updated_at on public.ad_partners;
create trigger ad_partners_set_updated_at before update on public.ad_partners
  for each row execute function public.set_updated_at();

drop trigger if exists ad_campaigns_set_updated_at on public.ad_campaigns;
create trigger ad_campaigns_set_updated_at before update on public.ad_campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists ad_creative_assets_set_updated_at on public.ad_creative_assets;
create trigger ad_creative_assets_set_updated_at before update on public.ad_creative_assets
  for each row execute function public.set_updated_at();

drop trigger if exists ad_creatives_set_updated_at on public.ad_creatives;
create trigger ad_creatives_set_updated_at before update on public.ad_creatives
  for each row execute function public.set_updated_at();

drop trigger if exists ad_placements_set_updated_at on public.ad_placements;
create trigger ad_placements_set_updated_at before update on public.ad_placements
  for each row execute function public.set_updated_at();

drop trigger if exists ad_flights_set_updated_at on public.ad_flights;
create trigger ad_flights_set_updated_at before update on public.ad_flights
  for each row execute function public.set_updated_at();

drop trigger if exists ad_make_goods_set_updated_at on public.ad_make_goods;
create trigger ad_make_goods_set_updated_at before update on public.ad_make_goods
  for each row execute function public.set_updated_at();

alter table public.ad_partners enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_creative_assets enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_creative_versions enable row level security;
alter table public.ad_placements enable row level security;
alter table public.ad_flights enable row level security;
alter table public.ad_decisions enable row level security;
alter table public.ad_events enable row level security;
alter table public.ad_frequency_counters enable row level security;
alter table public.ad_traffic_quality_events enable row level security;
alter table public.ad_audit_events enable row level security;
alter table public.ad_billing_snapshots enable row level security;
alter table public.ad_make_goods enable row level security;
alter table public.ad_event_daily_summaries enable row level security;

drop policy if exists "Active ad placements are readable" on public.ad_placements;
create policy "Active ad placements are readable" on public.ad_placements for select
  using (status = 'active' or public.current_user_is_admin());

drop policy if exists "Active ad partners are readable" on public.ad_partners;
create policy "Active ad partners are readable" on public.ad_partners for select
  using (status in ('active', 'approved', 'published') or public.current_user_is_admin());

drop policy if exists "Active ad campaigns are readable" on public.ad_campaigns;
create policy "Active ad campaigns are readable" on public.ad_campaigns for select
  using (
    public.current_user_is_admin()
    or (
      status in ('active', 'published', 'approved')
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    )
  );

drop policy if exists "Approved ad creative assets are readable" on public.ad_creative_assets;
create policy "Approved ad creative assets are readable" on public.ad_creative_assets for select
  using (status in ('approved', 'active', 'published') or public.current_user_is_admin());

drop policy if exists "Active ad creatives are readable" on public.ad_creatives;
create policy "Active ad creatives are readable" on public.ad_creatives for select
  using (status in ('active', 'published', 'approved') or public.current_user_is_admin());

drop policy if exists "Approved ad creative versions are readable" on public.ad_creative_versions;
create policy "Approved ad creative versions are readable" on public.ad_creative_versions for select
  using (status = 'approved' or public.current_user_is_admin());

drop policy if exists "Active ad flights are readable" on public.ad_flights;
create policy "Active ad flights are readable" on public.ad_flights for select
  using (
    public.current_user_is_admin()
    or (
      status in ('active', 'published', 'approved')
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    )
  );

drop policy if exists "Ad decisions can be inserted by runtime" on public.ad_decisions;
drop policy if exists "Admins can manage ad decisions" on public.ad_decisions;
create policy "Admins can manage ad decisions" on public.ad_decisions for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Admins can read ad decisions" on public.ad_decisions;
create policy "Admins can read ad decisions" on public.ad_decisions for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read ad events" on public.ad_events;
create policy "Admins can read ad events" on public.ad_events for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read ad frequency counters" on public.ad_frequency_counters;
create policy "Admins can read ad frequency counters" on public.ad_frequency_counters for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read ad quality events" on public.ad_traffic_quality_events;
create policy "Admins can read ad quality events" on public.ad_traffic_quality_events for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read ad audit events" on public.ad_audit_events;
create policy "Admins can read ad audit events" on public.ad_audit_events for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read ad billing snapshots" on public.ad_billing_snapshots;
create policy "Admins can read ad billing snapshots" on public.ad_billing_snapshots for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read ad make goods" on public.ad_make_goods;
create policy "Admins can read ad make goods" on public.ad_make_goods for select
  using (public.current_user_is_admin());

drop policy if exists "Admins can read ad event summaries" on public.ad_event_daily_summaries;
create policy "Admins can read ad event summaries" on public.ad_event_daily_summaries for select
  using (public.current_user_is_admin());

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'ad_partners',
    'ad_campaigns',
    'ad_creative_assets',
    'ad_creatives',
    'ad_creative_versions',
    'ad_placements',
    'ad_flights',
    'ad_billing_snapshots',
    'ad_make_goods',
    'ad_event_daily_summaries'
  ] loop
    execute format('drop policy if exists "Admins can manage %s" on public.%I', v_table, v_table);
    execute format(
      'create policy "Admins can manage %s" on public.%I for all using (public.current_user_is_admin()) with check (public.current_user_is_admin())',
      v_table,
      v_table
    );
  end loop;
end $$;

insert into public.ad_placements (
  key,
  name,
  route_pattern,
  surface,
  status,
  allowed_creative_formats,
  required_asset_aspect_ratio,
  max_asset_weight_kb,
  supports_video,
  supports_sequence,
  max_ads_per_view,
  default_frequency_cap
)
values
  (
    'lesson_footer_card',
    'Lesson footer card',
    '/lessons/[id]',
    'lesson',
    'active',
    array['native_card'::public.ad_creative_format, 'text_card'::public.ad_creative_format],
    '16:9',
    1024,
    false,
    true,
    1,
    '{"sessionMaxPaidAds":3,"userDailyCampaignImpressions":3,"userDailyCreativeVersionImpressions":2,"userWeeklyPartnerImpressions":5}'::jsonb
  ),
  (
    'home_feed_card',
    'Home feed card',
    '/dashboard',
    'dashboard',
    'active',
    array['native_card'::public.ad_creative_format, 'text_card'::public.ad_creative_format],
    '16:9',
    1024,
    false,
    false,
    1,
    '{"sessionMaxPaidAds":5}'::jsonb
  ),
  (
    'course_detail_card',
    'Course detail card',
    '/courses/[id]',
    'course',
    'active',
    array['native_card'::public.ad_creative_format, 'text_card'::public.ad_creative_format],
    '16:9',
    1024,
    false,
    false,
    1,
    '{"sessionMaxPaidAds":5}'::jsonb
  ),
  (
    'missions_card',
    'Missions card',
    '/missions',
    'missions',
    'draft',
    array['native_card'::public.ad_creative_format, 'text_card'::public.ad_creative_format],
    '16:9',
    1024,
    false,
    false,
    1,
    '{"sessionMaxPaidAds":5}'::jsonb
  ),
  (
    'xp_store_card',
    'XP store card',
    '/xp-store',
    'store',
    'draft',
    array['native_card'::public.ad_creative_format, 'text_card'::public.ad_creative_format],
    '16:9',
    1024,
    false,
    false,
    1,
    '{"sessionMaxPaidAds":5}'::jsonb
  )
on conflict (key) do update
set name = excluded.name,
    route_pattern = excluded.route_pattern,
    surface = excluded.surface,
    allowed_creative_formats = excluded.allowed_creative_formats,
    required_asset_aspect_ratio = excluded.required_asset_aspect_ratio,
    max_asset_weight_kb = excluded.max_asset_weight_kb,
    supports_video = excluded.supports_video,
    supports_sequence = excluded.supports_sequence,
    max_ads_per_view = excluded.max_ads_per_view,
    default_frequency_cap = excluded.default_frequency_cap,
    updated_at = now();

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute $storage$
      insert into storage.buckets (id, name, public)
      values ('ad-creatives', 'ad-creatives', true)
      on conflict (id) do nothing
    $storage$;

    execute $storage$
      drop policy if exists "Admins can upload ad creative assets" on storage.objects
    $storage$;
    execute $storage$
      create policy "Admins can upload ad creative assets"
      on storage.objects for insert
      with check (bucket_id = 'ad-creatives' and public.current_user_is_admin())
    $storage$;

    execute $storage$
      drop policy if exists "Admins can update ad creative assets" on storage.objects
    $storage$;
    execute $storage$
      create policy "Admins can update ad creative assets"
      on storage.objects for update
      using (bucket_id = 'ad-creatives' and public.current_user_is_admin())
      with check (bucket_id = 'ad-creatives' and public.current_user_is_admin())
    $storage$;

    execute $storage$
      drop policy if exists "Ad creative assets are publicly readable" on storage.objects
    $storage$;
    execute $storage$
      create policy "Ad creative assets are publicly readable"
      on storage.objects for select
      using (bucket_id = 'ad-creatives')
    $storage$;
  end if;
end $$;

create or replace function public.admin_audit_ad_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_before_state jsonb,
  p_after_state jsonb,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can write ad audit events.';
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
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_before_state,
    p_after_state,
    p_reason
  );
end;
$$;

create or replace function public.admin_set_ad_entity_status(
  p_entity_type text,
  p_entity_id text,
  p_status public.ad_entity_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_entity_type text := lower(trim(coalesce(p_entity_type, '')));
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage ads.';
  end if;

  if v_entity_type = 'partner' then
    select to_jsonb(item) into v_before from public.ad_partners item where item.id = p_entity_id;
    update public.ad_partners set status = p_status, updated_at = now() where id = p_entity_id;
    select to_jsonb(item) into v_after from public.ad_partners item where item.id = p_entity_id;
  elsif v_entity_type = 'campaign' then
    select to_jsonb(item) into v_before from public.ad_campaigns item where item.id = p_entity_id;
    update public.ad_campaigns set status = p_status, updated_at = now() where id = p_entity_id;
    select to_jsonb(item) into v_after from public.ad_campaigns item where item.id = p_entity_id;
  elsif v_entity_type = 'creative' then
    select to_jsonb(item) into v_before from public.ad_creatives item where item.id = p_entity_id;
    update public.ad_creatives set status = p_status, updated_at = now() where id = p_entity_id;
    select to_jsonb(item) into v_after from public.ad_creatives item where item.id = p_entity_id;
  elsif v_entity_type = 'creative_version' then
    select to_jsonb(item) into v_before from public.ad_creative_versions item where item.id::text = p_entity_id;
    update public.ad_creative_versions
    set status = p_status,
        approved_by = case when p_status = 'approved' then v_actor_id else approved_by end,
        approved_at = case when p_status = 'approved' then now() else approved_at end,
        rejected_by = case when p_status = 'rejected' then v_actor_id else rejected_by end,
        rejected_at = case when p_status = 'rejected' then now() else rejected_at end,
        rejection_reason = case when p_status = 'rejected' then p_reason else rejection_reason end,
        paused_by = case when p_status = 'paused' then v_actor_id else paused_by end,
        paused_at = case when p_status = 'paused' then now() else paused_at end,
        pause_reason = case when p_status = 'paused' then p_reason else pause_reason end
    where id::text = p_entity_id;
    select to_jsonb(item) into v_after from public.ad_creative_versions item where item.id::text = p_entity_id;
  elsif v_entity_type = 'flight' then
    select to_jsonb(item) into v_before from public.ad_flights item where item.id::text = p_entity_id;
    update public.ad_flights set status = p_status, updated_at = now() where id::text = p_entity_id;
    select to_jsonb(item) into v_after from public.ad_flights item where item.id::text = p_entity_id;
  elsif v_entity_type = 'placement' then
    select to_jsonb(item) into v_before from public.ad_placements item where item.key = p_entity_id;
    update public.ad_placements set status = p_status, updated_at = now() where key = p_entity_id;
    select to_jsonb(item) into v_after from public.ad_placements item where item.key = p_entity_id;
  else
    raise exception 'Unsupported ad entity type.';
  end if;

  if v_after is null then
    raise exception 'Ad entity not found.';
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
    'ad_' || v_entity_type || '_status_changed',
    v_entity_type,
    p_entity_id,
    v_before,
    v_after,
    p_reason
  );

  return jsonb_build_object('entityType', v_entity_type, 'entityId', p_entity_id, 'status', p_status);
end;
$$;

create or replace function public.admin_upsert_ad_partner(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id text := p_payload ->> 'id';
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage ad partners.';
  end if;

  if coalesce(v_id, '') = '' or coalesce(p_payload ->> 'name', '') = '' then
    raise exception 'Partner id and name are required.';
  end if;

  select to_jsonb(item) into v_before from public.ad_partners item where item.id = v_id;

  insert into public.ad_partners (
    id,
    name,
    slug,
    status,
    contact_name,
    contact_email,
    website_url,
    allowed_cta_domains,
    terms_accepted_at,
    terms_accepted_by,
    terms_version,
    contract_reference,
    notes
  )
  values (
    v_id,
    p_payload ->> 'name',
    coalesce(p_payload ->> 'slug', v_id),
    coalesce((p_payload ->> 'status')::public.ad_entity_status, 'draft'),
    nullif(p_payload ->> 'contactName', ''),
    nullif(p_payload ->> 'contactEmail', ''),
    nullif(p_payload ->> 'websiteUrl', ''),
    coalesce(array(select lower(trim(value)) from jsonb_array_elements_text(coalesce(p_payload -> 'allowedCtaDomains', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    case when coalesce((p_payload ->> 'termsAccepted')::boolean, false) then now() else null end,
    case when coalesce((p_payload ->> 'termsAccepted')::boolean, false) then v_actor_id else null end,
    case when coalesce((p_payload ->> 'termsAccepted')::boolean, false) then coalesce(p_payload ->> 'termsVersion', 'ads-v1') else null end,
    nullif(p_payload ->> 'contractReference', ''),
    nullif(p_payload ->> 'notes', '')
  )
  on conflict (id) do update
  set name = excluded.name,
      slug = excluded.slug,
      status = excluded.status,
      contact_name = excluded.contact_name,
      contact_email = excluded.contact_email,
      website_url = excluded.website_url,
      allowed_cta_domains = excluded.allowed_cta_domains,
      terms_accepted_at = coalesce(excluded.terms_accepted_at, public.ad_partners.terms_accepted_at),
      terms_accepted_by = coalesce(excluded.terms_accepted_by, public.ad_partners.terms_accepted_by),
      terms_version = coalesce(excluded.terms_version, public.ad_partners.terms_version),
      contract_reference = excluded.contract_reference,
      notes = excluded.notes,
      updated_at = now();

  select to_jsonb(item) into v_after from public.ad_partners item where item.id = v_id;

  insert into public.ad_audit_events (actor_user_id, event_type, entity_type, entity_id, before_state, after_state, reason)
  values (v_actor_id, 'ad_partner_upserted', 'partner', v_id, v_before, v_after, 'Admin partner save');

  return jsonb_build_object('partnerId', v_id);
end;
$$;

create or replace function public.admin_upsert_ad_campaign(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id text := p_payload ->> 'id';
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage ad campaigns.';
  end if;

  if coalesce(v_id, '') = '' or coalesce(p_payload ->> 'partnerId', '') = '' or coalesce(p_payload ->> 'name', '') = '' then
    raise exception 'Campaign id, partner, and name are required.';
  end if;

  select to_jsonb(item) into v_before from public.ad_campaigns item where item.id = v_id;

  insert into public.ad_campaigns (
    id,
    partner_id,
    name,
    status,
    campaign_type,
    starts_at,
    ends_at,
    timezone,
    budget_label,
    pricing_model,
    rate_amount,
    currency,
    minor_unit,
    rounding_mode,
    gross_budget_amount,
    billable_budget_amount,
    spend_cap_amount,
    allow_overspend,
    overspend_tolerance_percent,
    contracted_impressions,
    contracted_clicks,
    contracted_viewable_impressions,
    included_content_tags,
    excluded_content_tags,
    included_course_categories,
    excluded_course_categories,
    included_course_ids,
    excluded_course_ids,
    included_lesson_ids,
    excluded_lesson_ids,
    excluded_page_types,
    competitor_exclusion_keys,
    priority,
    pacing_mode,
    make_good_policy,
    notes
  )
  values (
    v_id,
    p_payload ->> 'partnerId',
    p_payload ->> 'name',
    coalesce((p_payload ->> 'status')::public.ad_entity_status, 'draft'),
    coalesce((p_payload ->> 'campaignType')::public.ad_campaign_type, 'guaranteed'),
    nullif(p_payload ->> 'startsAt', '')::timestamptz,
    nullif(p_payload ->> 'endsAt', '')::timestamptz,
    coalesce(nullif(p_payload ->> 'timezone', ''), 'Africa/Lagos'),
    nullif(p_payload ->> 'budgetLabel', ''),
    coalesce((p_payload ->> 'pricingModel')::public.ad_pricing_model, 'flat_fee'),
    coalesce((p_payload ->> 'rateAmount')::integer, 0),
    upper(coalesce(nullif(p_payload ->> 'currency', ''), 'NGN')),
    coalesce((p_payload ->> 'minorUnit')::integer, 2),
    coalesce(nullif(p_payload ->> 'roundingMode', ''), 'half_up'),
    nullif(p_payload ->> 'grossBudgetAmount', '')::integer,
    nullif(p_payload ->> 'billableBudgetAmount', '')::integer,
    nullif(p_payload ->> 'spendCapAmount', '')::integer,
    coalesce((p_payload ->> 'allowOverspend')::boolean, false),
    coalesce((p_payload ->> 'overspendTolerancePercent')::numeric, 0),
    nullif(p_payload ->> 'contractedImpressions', '')::integer,
    nullif(p_payload ->> 'contractedClicks', '')::integer,
    nullif(p_payload ->> 'contractedViewableImpressions', '')::integer,
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'includedContentTags', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'excludedContentTags', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'includedCourseCategories', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'excludedCourseCategories', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'includedCourseIds', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'excludedCourseIds', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'includedLessonIds', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'excludedLessonIds', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select trim(value) from jsonb_array_elements_text(coalesce(p_payload -> 'excludedPageTypes', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce(array(select lower(trim(value)) from jsonb_array_elements_text(coalesce(p_payload -> 'competitorExclusionKeys', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    coalesce((p_payload ->> 'priority')::integer, 0),
    coalesce((p_payload ->> 'pacingMode')::public.ad_pacing_mode, 'even'),
    nullif(p_payload ->> 'makeGoodPolicy', ''),
    nullif(p_payload ->> 'notes', '')
  )
  on conflict (id) do update
  set partner_id = excluded.partner_id,
      name = excluded.name,
      status = excluded.status,
      campaign_type = excluded.campaign_type,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      timezone = excluded.timezone,
      budget_label = excluded.budget_label,
      pricing_model = excluded.pricing_model,
      rate_amount = excluded.rate_amount,
      currency = excluded.currency,
      minor_unit = excluded.minor_unit,
      rounding_mode = excluded.rounding_mode,
      gross_budget_amount = excluded.gross_budget_amount,
      billable_budget_amount = excluded.billable_budget_amount,
      spend_cap_amount = excluded.spend_cap_amount,
      allow_overspend = excluded.allow_overspend,
      overspend_tolerance_percent = excluded.overspend_tolerance_percent,
      contracted_impressions = excluded.contracted_impressions,
      contracted_clicks = excluded.contracted_clicks,
      contracted_viewable_impressions = excluded.contracted_viewable_impressions,
      included_content_tags = excluded.included_content_tags,
      excluded_content_tags = excluded.excluded_content_tags,
      included_course_categories = excluded.included_course_categories,
      excluded_course_categories = excluded.excluded_course_categories,
      included_course_ids = excluded.included_course_ids,
      excluded_course_ids = excluded.excluded_course_ids,
      included_lesson_ids = excluded.included_lesson_ids,
      excluded_lesson_ids = excluded.excluded_lesson_ids,
      excluded_page_types = excluded.excluded_page_types,
      competitor_exclusion_keys = excluded.competitor_exclusion_keys,
      priority = excluded.priority,
      pacing_mode = excluded.pacing_mode,
      make_good_policy = excluded.make_good_policy,
      notes = excluded.notes,
      updated_at = now();

  select to_jsonb(item) into v_after from public.ad_campaigns item where item.id = v_id;

  insert into public.ad_audit_events (actor_user_id, event_type, entity_type, entity_id, before_state, after_state, reason)
  values (v_actor_id, 'ad_campaign_upserted', 'campaign', v_id, v_before, v_after, 'Admin campaign save');

  return jsonb_build_object('campaignId', v_id);
end;
$$;

create or replace function public.admin_register_ad_creative_asset(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_asset_id uuid;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage ad creative assets.';
  end if;

  insert into public.ad_creative_assets (
    partner_id,
    storage_bucket,
    storage_path,
    public_url,
    asset_type,
    mime_type,
    file_size_bytes,
    width,
    height,
    duration_seconds,
    checksum,
    alt_text,
    status
  )
  values (
    nullif(p_payload ->> 'partnerId', ''),
    coalesce(nullif(p_payload ->> 'storageBucket', ''), 'ad-creatives'),
    p_payload ->> 'storagePath',
    nullif(p_payload ->> 'publicUrl', ''),
    coalesce((p_payload ->> 'assetType')::public.ad_asset_type, 'image'),
    p_payload ->> 'mimeType',
    coalesce((p_payload ->> 'fileSizeBytes')::integer, 0),
    nullif(p_payload ->> 'width', '')::integer,
    nullif(p_payload ->> 'height', '')::integer,
    nullif(p_payload ->> 'durationSeconds', '')::integer,
    nullif(p_payload ->> 'checksum', ''),
    nullif(p_payload ->> 'altText', ''),
    coalesce((p_payload ->> 'status')::public.ad_entity_status, 'approved')
  )
  returning id into v_asset_id;

  insert into public.ad_audit_events (actor_user_id, event_type, entity_type, entity_id, after_state, reason)
  values (v_actor_id, 'ad_creative_asset_registered', 'creative_asset', v_asset_id::text, p_payload, 'Admin asset upload');

  return jsonb_build_object('assetId', v_asset_id);
end;
$$;

create or replace function public.admin_upsert_ad_creative(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id text := p_payload ->> 'id';
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage ad creatives.';
  end if;

  if coalesce(v_id, '') = '' or coalesce(p_payload ->> 'campaignId', '') = '' or coalesce(p_payload ->> 'name', '') = '' then
    raise exception 'Creative id, campaign, and name are required.';
  end if;

  select to_jsonb(item) into v_before from public.ad_creatives item where item.id = v_id;

  insert into public.ad_creatives (
    id,
    campaign_id,
    name,
    status,
    creative_format,
    weight
  )
  values (
    v_id,
    p_payload ->> 'campaignId',
    p_payload ->> 'name',
    coalesce((p_payload ->> 'status')::public.ad_entity_status, 'draft'),
    coalesce((p_payload ->> 'creativeFormat')::public.ad_creative_format, 'native_card'),
    coalesce((p_payload ->> 'weight')::integer, 1)
  )
  on conflict (id) do update
  set campaign_id = excluded.campaign_id,
      name = excluded.name,
      status = excluded.status,
      creative_format = excluded.creative_format,
      weight = excluded.weight,
      updated_at = now();

  select to_jsonb(item) into v_after from public.ad_creatives item where item.id = v_id;

  insert into public.ad_audit_events (actor_user_id, event_type, entity_type, entity_id, before_state, after_state, reason)
  values (v_actor_id, 'ad_creative_upserted', 'creative', v_id, v_before, v_after, 'Admin creative save');

  return jsonb_build_object('creativeId', v_id);
end;
$$;

create or replace function public.admin_insert_ad_creative_version(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
  v_creative_id text := p_payload ->> 'creativeId';
  v_status public.ad_entity_status := coalesce((p_payload ->> 'status')::public.ad_entity_status, 'submitted');
  v_version_number integer;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage ad creative versions.';
  end if;

  if v_status = 'approved' then
    raise exception 'Creative versions must be approved through the review status action.';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_version_number
  from public.ad_creative_versions
  where creative_id = v_creative_id;

  insert into public.ad_creative_versions (
    creative_id,
    version_number,
    status,
    headline,
    body,
    eyebrow,
    image_asset_id,
    image_alt,
    logo_asset_id,
    video_asset_id,
    poster_asset_id,
    caption_asset_id,
    cta_label,
    cta_url,
    sponsor_label,
    disclosure_label,
    legal_text,
    theme,
    created_by,
    submitted_by,
    submitted_at
  )
  values (
    v_creative_id,
    v_version_number,
    v_status,
    nullif(p_payload ->> 'headline', ''),
    nullif(p_payload ->> 'body', ''),
    nullif(p_payload ->> 'eyebrow', ''),
    nullif(p_payload ->> 'imageAssetId', '')::uuid,
    nullif(p_payload ->> 'imageAlt', ''),
    nullif(p_payload ->> 'logoAssetId', '')::uuid,
    nullif(p_payload ->> 'videoAssetId', '')::uuid,
    nullif(p_payload ->> 'posterAssetId', '')::uuid,
    nullif(p_payload ->> 'captionAssetId', '')::uuid,
    nullif(p_payload ->> 'ctaLabel', ''),
    nullif(p_payload ->> 'ctaUrl', ''),
    p_payload ->> 'sponsorLabel',
    coalesce(nullif(p_payload ->> 'disclosureLabel', ''), 'Sponsored'),
    nullif(p_payload ->> 'legalText', ''),
    coalesce(p_payload -> 'theme', '{}'::jsonb),
    v_actor_id,
    case when v_status = 'submitted' then v_actor_id else null end,
    case when v_status = 'submitted' then now() else null end
  )
  returning id into v_id;

  update public.ad_creatives
  set current_version_id = v_id,
      updated_at = now()
  where id = v_creative_id;

  insert into public.ad_audit_events (actor_user_id, event_type, entity_type, entity_id, after_state, reason)
  values (v_actor_id, 'ad_creative_version_inserted', 'creative_version', v_id::text, p_payload, 'Admin creative version save');

  return jsonb_build_object('creativeVersionId', v_id, 'versionNumber', v_version_number);
end;
$$;

create or replace function public.admin_insert_ad_flight(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
  v_version public.ad_creative_versions%rowtype;
  v_creative public.ad_creatives%rowtype;
  v_placement public.ad_placements%rowtype;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can manage ad flights.';
  end if;

  select * into v_version from public.ad_creative_versions where id = (p_payload ->> 'creativeVersionId')::uuid;
  if not found then
    raise exception 'Creative version not found.';
  end if;

  select * into v_creative from public.ad_creatives where id = v_version.creative_id;
  select * into v_placement from public.ad_placements where key = p_payload ->> 'placementKey';

  if not found or not (v_creative.creative_format = any(v_placement.allowed_creative_formats)) then
    raise exception 'Creative format is not compatible with the placement.';
  end if;

  if v_creative.creative_format = 'video_card' and not v_placement.supports_video then
    raise exception 'Video creatives are not supported for this placement.';
  end if;

  insert into public.ad_flights (
    campaign_id,
    creative_id,
    creative_version_id,
    placement_key,
    status,
    starts_at,
    ends_at,
    priority,
    weight,
    targeting_rules,
    frequency_caps,
    sequence_rules,
    brand_safety_rules,
    competitor_exclusion_keys,
    delivery_goal_impressions,
    delivery_goal_clicks
  )
  values (
    p_payload ->> 'campaignId',
    v_version.creative_id,
    v_version.id,
    p_payload ->> 'placementKey',
    coalesce((p_payload ->> 'status')::public.ad_entity_status, 'draft'),
    nullif(p_payload ->> 'startsAt', '')::timestamptz,
    nullif(p_payload ->> 'endsAt', '')::timestamptz,
    coalesce((p_payload ->> 'priority')::integer, 0),
    coalesce((p_payload ->> 'weight')::integer, 1),
    coalesce(p_payload -> 'targetingRules', '{}'::jsonb),
    coalesce(p_payload -> 'frequencyCaps', '{}'::jsonb),
    coalesce(p_payload -> 'sequenceRules', '{}'::jsonb),
    coalesce(p_payload -> 'brandSafetyRules', '{}'::jsonb),
    coalesce(array(select lower(trim(value)) from jsonb_array_elements_text(coalesce(p_payload -> 'competitorExclusionKeys', '[]'::jsonb)) value where trim(value) <> ''), '{}'),
    nullif(p_payload ->> 'deliveryGoalImpressions', '')::integer,
    nullif(p_payload ->> 'deliveryGoalClicks', '')::integer
  )
  returning id into v_id;

  insert into public.ad_audit_events (actor_user_id, event_type, entity_type, entity_id, after_state, reason)
  values (v_actor_id, 'ad_flight_inserted', 'flight', v_id::text, p_payload, 'Admin flight save');

  return jsonb_build_object('flightId', v_id);
end;
$$;

create or replace function public.record_ad_decision(
  p_user_id uuid,
  p_session_key_hash text,
  p_partner_id text,
  p_campaign_id text,
  p_flight_id uuid,
  p_creative_id text,
  p_creative_version_id uuid,
  p_placement_key text,
  p_decision_context jsonb,
  p_eligible_flight_count integer,
  p_ineligible_reasons jsonb,
  p_score_breakdown jsonb,
  p_experiment_key text default null,
  p_variant_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_partner public.ad_partners%rowtype;
  v_campaign public.ad_campaigns%rowtype;
  v_creative public.ad_creatives%rowtype;
  v_version public.ad_creative_versions%rowtype;
  v_flight public.ad_flights%rowtype;
  v_placement public.ad_placements%rowtype;
  v_decision_id uuid;
begin
  if p_user_id is not null and v_actor_id is not null and p_user_id <> v_actor_id then
    raise exception 'Ad decision user mismatch.';
  end if;

  select * into v_partner from public.ad_partners where id = p_partner_id;
  select * into v_campaign from public.ad_campaigns where id = p_campaign_id;
  select * into v_creative from public.ad_creatives where id = p_creative_id;
  select * into v_version from public.ad_creative_versions where id = p_creative_version_id;
  select * into v_flight from public.ad_flights where id = p_flight_id;
  select * into v_placement from public.ad_placements where key = p_placement_key;

  if v_partner.id is null
    or v_campaign.id is null
    or v_creative.id is null
    or v_version.id is null
    or v_flight.id is null
    or v_placement.key is null then
    raise exception 'Invalid ad decision entity.';
  end if;

  if v_placement.status <> 'active'
    or v_partner.status not in ('active', 'approved', 'published')
    or v_campaign.status not in ('active', 'approved', 'published')
    or v_creative.status not in ('active', 'approved', 'published')
    or v_version.status <> 'approved'
    or v_flight.status not in ('active', 'approved', 'published') then
    raise exception 'Ad decision entity is not active.';
  end if;

  if v_campaign.campaign_type <> 'house' and v_partner.terms_accepted_at is null then
    raise exception 'Partner terms are required for paid ad delivery.';
  end if;

  if (v_campaign.starts_at is not null and v_campaign.starts_at > now())
    or (v_campaign.ends_at is not null and v_campaign.ends_at < now())
    or (v_flight.starts_at is not null and v_flight.starts_at > now())
    or (v_flight.ends_at is not null and v_flight.ends_at < now()) then
    raise exception 'Ad decision entity is outside its serving window.';
  end if;

  if v_campaign.id <> v_flight.campaign_id
    or v_campaign.id <> v_creative.campaign_id
    or v_creative.id <> v_flight.creative_id
    or v_creative.id <> v_version.creative_id
    or v_version.id <> v_flight.creative_version_id
    or v_flight.placement_key <> p_placement_key
    or not (v_creative.creative_format = any(v_placement.allowed_creative_formats))
    or (v_creative.creative_format = 'video_card' and not v_placement.supports_video) then
    raise exception 'Ad decision entity relationship is invalid.';
  end if;

  insert into public.ad_decisions (
    user_id,
    session_key_hash,
    selected_partner_id,
    selected_campaign_id,
    selected_flight_id,
    selected_creative_id,
    selected_creative_version_id,
    placement_key,
    decision_context,
    eligible_flight_count,
    ineligible_reasons,
    score_breakdown,
    experiment_key,
    variant_key
  )
  values (
    p_user_id,
    p_session_key_hash,
    p_partner_id,
    p_campaign_id,
    p_flight_id,
    p_creative_id,
    p_creative_version_id,
    p_placement_key,
    coalesce(p_decision_context, '{}'::jsonb),
    greatest(coalesce(p_eligible_flight_count, 0), 0),
    coalesce(p_ineligible_reasons, '{}'::jsonb),
    coalesce(p_score_breakdown, '{}'::jsonb),
    p_experiment_key,
    p_variant_key
  )
  returning id into v_decision_id;

  return jsonb_build_object('decisionId', v_decision_id);
end;
$$;

create or replace function public.upsert_ad_frequency_counter(
  p_scope_type public.ad_frequency_scope_type,
  p_scope_key_hash text,
  p_window_name text,
  p_window_duration interval,
  p_timezone text,
  p_campaign_id text,
  p_creative_id text,
  p_creative_version_id uuid,
  p_partner_id text,
  p_placement_key text,
  p_event_type public.ad_event_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := date_trunc('hour', now());
  v_window_end timestamptz := date_trunc('hour', now()) + p_window_duration;
begin
  if p_scope_key_hash is null or p_scope_key_hash = '' then
    return;
  end if;

  insert into public.ad_frequency_counters (
    scope_type,
    scope_key_hash,
    window_type,
    window_name,
    timezone,
    campaign_id,
    creative_id,
    creative_version_id,
    partner_id,
    placement_key,
    window_start,
    window_end,
    impression_count,
    viewable_impression_count,
    click_count
  )
  values (
    p_scope_type,
    p_scope_key_hash,
    'rolling',
    p_window_name,
    coalesce(nullif(p_timezone, ''), 'Africa/Lagos'),
    p_campaign_id,
    p_creative_id,
    p_creative_version_id,
    p_partner_id,
    p_placement_key,
    v_window_start,
    v_window_end,
    case when p_event_type = 'impression' then 1 else 0 end,
    case when p_event_type = 'viewable_impression' then 1 else 0 end,
    case when p_event_type = 'click' then 1 else 0 end
  )
  on conflict (
    scope_type,
    scope_key_hash,
    window_type,
    window_name,
    (coalesce(campaign_id, '')),
    (coalesce(creative_id, '')),
    (coalesce(creative_version_id::text, '')),
    (coalesce(partner_id, '')),
    (coalesce(placement_key, '')),
    window_start,
    window_end
  )
  do update
  set impression_count = public.ad_frequency_counters.impression_count + excluded.impression_count,
      viewable_impression_count = public.ad_frequency_counters.viewable_impression_count + excluded.viewable_impression_count,
      click_count = public.ad_frequency_counters.click_count + excluded.click_count,
      updated_at = now();
end;
$$;

create or replace function public.record_ad_event(
  p_event_type public.ad_event_type,
  p_decision_id uuid,
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
  v_decision public.ad_decisions%rowtype;
  v_existing uuid;
  v_user_id uuid := auth.uid();
  v_status public.ad_qualification_status := 'qualified';
  v_reason text;
  v_risk_score integer := 0;
  v_event_id uuid;
  v_recent_click_count integer := 0;
  v_recent_impression_count integer := 0;
  v_recent_session_event_count integer := 0;
  v_recent_ip_event_count integer := 0;
  v_recent_session_click_count integer := 0;
  v_millis_after_decision numeric;
  v_partner public.ad_partners%rowtype;
  v_campaign public.ad_campaigns%rowtype;
  v_flight public.ad_flights%rowtype;
  v_creative_version public.ad_creative_versions%rowtype;
  v_billable_amount integer := 0;
begin
  if p_decision_id is null then
    raise exception 'decisionId is required.';
  end if;

  select *
    into v_decision
  from public.ad_decisions
  where id = p_decision_id;

  if not found or v_decision.selected_flight_id is null then
    raise exception 'Invalid ad decision.';
  end if;

  select * into v_partner from public.ad_partners where id = v_decision.selected_partner_id;
  select * into v_campaign from public.ad_campaigns where id = v_decision.selected_campaign_id;
  select * into v_flight from public.ad_flights where id = v_decision.selected_flight_id;
  select * into v_creative_version from public.ad_creative_versions where id = v_decision.selected_creative_version_id;

  if v_decision.user_id is not null and v_user_id is not null and v_decision.user_id <> v_user_id then
    v_status := 'filtered';
    v_reason := 'user_mismatch';
    v_risk_score := 5;
  elsif v_campaign.id is null or v_flight.id is null or v_creative_version.id is null or v_partner.id is null then
    v_status := 'filtered';
    v_reason := 'missing_serving_entity';
    v_risk_score := 5;
  elsif v_campaign.status not in ('active', 'approved', 'published')
    or v_flight.status not in ('active', 'approved', 'published')
    or v_creative_version.status <> 'approved'
    or v_partner.status not in ('active', 'approved', 'published') then
    v_status := 'filtered';
    v_reason := 'inactive_serving_entity';
    v_risk_score := 4;
  elsif v_campaign.campaign_type <> 'house' and v_partner.terms_accepted_at is null then
    v_status := 'filtered';
    v_reason := 'missing_partner_terms';
    v_risk_score := 4;
  elsif (v_campaign.starts_at is not null and v_campaign.starts_at > now())
    or (v_campaign.ends_at is not null and v_campaign.ends_at < now())
    or (v_flight.starts_at is not null and v_flight.starts_at > now())
    or (v_flight.ends_at is not null and v_flight.ends_at < now()) then
    v_status := 'filtered';
    v_reason := 'outside_serving_window';
    v_risk_score := 4;
  elsif v_decision.created_at < now() - interval '24 hours' then
    v_status := 'filtered';
    v_reason := 'stale_decision';
    v_risk_score := 3;
  end if;

  if p_event_dedupe_key is not null then
    select id into v_existing
    from public.ad_events
    where event_dedupe_key = p_event_dedupe_key;

    if v_existing is not null then
      return jsonb_build_object(
        'eventId', v_existing,
        'status', 'duplicate',
        'qualificationStatus', 'filtered',
        'ivtReason', 'duplicate_event'
      );
    end if;
  end if;

  if v_status <> 'filtered' then
    v_millis_after_decision := extract(epoch from (now() - v_decision.created_at)) * 1000;

    select count(*)
      into v_recent_session_event_count
    from public.ad_events
    where session_key_hash = v_decision.session_key_hash
      and v_decision.session_key_hash is not null
      and created_at >= now() - interval '1 minute';

    select count(*)
      into v_recent_ip_event_count
    from public.ad_events
    where ip_hash = p_ip_hash
      and p_ip_hash is not null
      and created_at >= now() - interval '1 minute';

    if v_recent_session_event_count >= 40 or v_recent_ip_event_count >= 120 then
      v_status := 'filtered';
      v_reason := 'event_velocity_anomaly';
      v_risk_score := 5;
    end if;
  end if;

  if v_status <> 'filtered' then
    if p_event_type = 'click' then
      select count(*)
        into v_recent_session_click_count
      from public.ad_events
      where session_key_hash = v_decision.session_key_hash
        and v_decision.session_key_hash is not null
        and event_type = 'click'
        and created_at >= now() - interval '1 minute';

      select count(*)
        into v_recent_click_count
      from public.ad_events
      where decision_id = p_decision_id
        and event_type = 'click';

      if v_recent_session_click_count >= 5 then
        v_status := 'filtered';
        v_reason := 'click_velocity_anomaly';
        v_risk_score := 5;
      elsif v_recent_click_count > 0 then
        v_status := 'filtered';
        v_reason := 'duplicate_click';
        v_risk_score := 4;
      elsif v_millis_after_decision < 750 then
        v_status := 'filtered';
        v_reason := 'impossible_click_speed';
        v_risk_score := 4;
      elsif not exists (
        select 1
        from public.ad_events
        where decision_id = p_decision_id
          and event_type in ('impression', 'viewable_impression')
      ) then
        v_status := 'filtered';
        v_reason := 'click_before_impression';
        v_risk_score := 3;
      else
        v_status := 'billable';
      end if;
    elsif p_event_type = 'viewable_impression' then
      if v_millis_after_decision < 1000 then
        v_status := 'filtered';
        v_reason := 'viewable_too_fast';
        v_risk_score := 3;
      elsif exists (
        select 1 from public.ad_events
        where decision_id = p_decision_id
          and event_type = 'viewable_impression'
      ) then
        v_status := 'filtered';
        v_reason := 'duplicate_viewable_impression';
        v_risk_score := 2;
      else
        v_status := 'billable';
      end if;
    else
      select count(*)
        into v_recent_impression_count
      from public.ad_events
      where decision_id = p_decision_id
        and event_type = 'impression';

      if v_recent_impression_count > 0 then
        v_status := 'filtered';
        v_reason := 'duplicate_impression';
        v_risk_score := 2;
      end if;
    end if;
  end if;

  if v_status = 'billable' then
    if v_campaign.pricing_model = 'cpc' and p_event_type = 'click' then
      v_billable_amount := v_campaign.rate_amount;
    else
      v_billable_amount := 0;
    end if;
  end if;

  insert into public.ad_events (
    event_type,
    partner_id,
    campaign_id,
    creative_id,
    creative_version_id,
    flight_id,
    decision_id,
    placement_key,
    user_id,
    session_key_hash,
    ip_hash,
    device_hash,
    user_agent_hash,
    route,
    course_id,
    lesson_id,
    page_id,
    page_number,
    segment_keys,
    metadata,
    qualification_status,
    ivt_reason,
    risk_score,
    billable_amount,
    event_dedupe_key,
    client_event_time
  )
  values (
    p_event_type,
    v_decision.selected_partner_id,
    v_decision.selected_campaign_id,
    v_decision.selected_creative_id,
    v_decision.selected_creative_version_id,
    v_decision.selected_flight_id,
    p_decision_id,
    coalesce(v_decision.placement_key, 'unknown'),
    coalesce(v_user_id, v_decision.user_id),
    v_decision.session_key_hash,
    p_ip_hash,
    p_device_hash,
    p_user_agent_hash,
    v_decision.decision_context ->> 'route',
    v_decision.decision_context ->> 'courseId',
    v_decision.decision_context ->> 'lessonId',
    v_decision.decision_context ->> 'pageId',
    nullif(v_decision.decision_context ->> 'pageNumber', '')::integer,
    coalesce(array(select jsonb_array_elements_text(v_decision.decision_context -> 'segmentKeys')), '{}'),
    coalesce(p_metadata, '{}'::jsonb),
    v_status,
    v_reason,
    v_risk_score,
    v_billable_amount,
    p_event_dedupe_key,
    p_client_event_time
  )
  returning id into v_event_id;

  if v_status = 'filtered' then
    insert into public.ad_traffic_quality_events (
      ad_event_id,
      user_id,
      session_key_hash,
      ip_hash,
      device_hash,
      rule_key,
      severity,
      reason,
      metadata
    )
    values (
      v_event_id,
      coalesce(v_user_id, v_decision.user_id),
      v_decision.session_key_hash,
      p_ip_hash,
      p_device_hash,
      coalesce(v_reason, 'filtered'),
      greatest(1, least(5, v_risk_score)),
      coalesce(v_reason, 'Filtered ad event.'),
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  if v_status in ('qualified', 'billable') then
    perform public.upsert_ad_frequency_counter(
      'session',
      v_decision.session_key_hash,
      'session_6h',
      interval '6 hours',
      coalesce(v_campaign.timezone, 'Africa/Lagos'),
      null,
      null,
      null,
      null,
      v_decision.placement_key,
      p_event_type
    );

    perform public.upsert_ad_frequency_counter(
      'user',
      coalesce(coalesce(v_user_id, v_decision.user_id)::text, v_decision.session_key_hash),
      'campaign_24h',
      interval '24 hours',
      coalesce(v_campaign.timezone, 'Africa/Lagos'),
      v_decision.selected_campaign_id,
      null,
      null,
      null,
      v_decision.placement_key,
      p_event_type
    );

    perform public.upsert_ad_frequency_counter(
      'user',
      coalesce(coalesce(v_user_id, v_decision.user_id)::text, v_decision.session_key_hash),
      'creative_version_24h',
      interval '24 hours',
      coalesce(v_campaign.timezone, 'Africa/Lagos'),
      null,
      null,
      v_decision.selected_creative_version_id,
      null,
      v_decision.placement_key,
      p_event_type
    );

    perform public.upsert_ad_frequency_counter(
      'user',
      coalesce(coalesce(v_user_id, v_decision.user_id)::text, v_decision.session_key_hash),
      'partner_7d',
      interval '7 days',
      coalesce(v_campaign.timezone, 'Africa/Lagos'),
      null,
      null,
      null,
      v_decision.selected_partner_id,
      v_decision.placement_key,
      p_event_type
    );
  end if;

  return jsonb_build_object(
    'eventId', v_event_id,
    'qualificationStatus', v_status,
    'ivtReason', v_reason
  );
end;
$$;

create or replace function public.get_ad_runtime_counts(
  p_session_key_hash text,
  p_partner_id text,
  p_campaign_id text,
  p_creative_version_id uuid,
  p_placement_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_paid_count integer := 0;
  v_user_campaign_count integer := 0;
  v_user_creative_version_count integer := 0;
  v_user_partner_count integer := 0;
  v_campaign_billable_impressions integer := 0;
  v_campaign_billable_viewable_impressions integer := 0;
  v_campaign_billable_clicks integer := 0;
  v_campaign_billable_spend integer := 0;
  v_campaign public.ad_campaigns%rowtype;
begin
  if p_session_key_hash is not null then
    select coalesce(sum(impression_count), 0)
      into v_session_paid_count
    from public.ad_frequency_counters
    where scope_type = 'session'
      and scope_key_hash = p_session_key_hash
      and window_type = 'rolling'
      and window_name = 'session_6h'
      and placement_key = p_placement_key
      and window_start <= now()
      and window_end > now();
  end if;

  if coalesce(v_user_id::text, p_session_key_hash) is not null then
    select coalesce(sum(impression_count), 0)
      into v_user_campaign_count
    from public.ad_frequency_counters
    where scope_type = 'user'
      and scope_key_hash = coalesce(v_user_id::text, p_session_key_hash)
      and campaign_id = p_campaign_id
      and window_type = 'rolling'
      and window_name = 'campaign_24h'
      and window_start <= now()
      and window_end > now();

    select coalesce(sum(impression_count), 0)
      into v_user_creative_version_count
    from public.ad_frequency_counters
    where scope_type = 'user'
      and scope_key_hash = coalesce(v_user_id::text, p_session_key_hash)
      and creative_version_id = p_creative_version_id
      and window_type = 'rolling'
      and window_name = 'creative_version_24h'
      and window_start <= now()
      and window_end > now();

    select coalesce(sum(impression_count), 0)
      into v_user_partner_count
    from public.ad_frequency_counters
    where scope_type = 'user'
      and scope_key_hash = coalesce(v_user_id::text, p_session_key_hash)
      and partner_id = p_partner_id
      and window_type = 'rolling'
      and window_name = 'partner_7d'
      and window_start <= now()
      and window_end > now();
  end if;

  select *
    into v_campaign
  from public.ad_campaigns
  where id = p_campaign_id;

  if found then
    select
      count(*) filter (where event_type = 'impression' and qualification_status = 'billable'),
      count(*) filter (where event_type = 'viewable_impression' and qualification_status = 'billable'),
      count(*) filter (where event_type = 'click' and qualification_status = 'billable')
      into
        v_campaign_billable_impressions,
        v_campaign_billable_viewable_impressions,
        v_campaign_billable_clicks
    from public.ad_events
    where campaign_id = p_campaign_id;

    if v_campaign.pricing_model = 'cpc' then
      v_campaign_billable_spend := v_campaign_billable_clicks * v_campaign.rate_amount;
    elsif v_campaign.pricing_model = 'cpm' then
      v_campaign_billable_spend :=
        floor(
          (greatest(v_campaign_billable_viewable_impressions, v_campaign_billable_impressions)::numeric
            * v_campaign.rate_amount::numeric
          ) / 1000
        )::integer;
    else
      v_campaign_billable_spend := 0;
    end if;
  end if;

  return jsonb_build_object(
    'sessionPaidImpressions', v_session_paid_count,
    'userCampaignImpressions24h', v_user_campaign_count,
    'userCreativeVersionImpressions24h', v_user_creative_version_count,
    'userPartnerImpressions7d', v_user_partner_count,
    'campaignBillableImpressions', v_campaign_billable_impressions,
    'campaignBillableViewableImpressions', v_campaign_billable_viewable_impressions,
    'campaignBillableClicks', v_campaign_billable_clicks,
    'campaignBillableSpend', v_campaign_billable_spend,
    'placementKey', p_placement_key
  );
end;
$$;

create or replace function public.get_ad_click_target(p_decision_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision public.ad_decisions%rowtype;
  v_version public.ad_creative_versions%rowtype;
  v_partner public.ad_partners%rowtype;
  v_host text;
  v_website_host text;
begin
  select *
    into v_decision
  from public.ad_decisions
  where id = p_decision_id;

  if not found or v_decision.selected_creative_version_id is null then
    raise exception 'Ad decision not found.';
  end if;

  select *
    into v_version
  from public.ad_creative_versions
  where id = v_decision.selected_creative_version_id
    and status = 'approved';

  if not found or v_version.cta_url is null or v_version.cta_url !~* '^https://[^[:space:]]+$' then
    raise exception 'Ad click target is not available.';
  end if;

  select * into v_partner from public.ad_partners where id = v_decision.selected_partner_id;
  v_host := lower(split_part(regexp_replace(v_version.cta_url, '^https://', '', 'i'), '/', 1));
  v_host := split_part(v_host, ':', 1);
  v_website_host := lower(split_part(regexp_replace(coalesce(v_partner.website_url, ''), '^https://', '', 'i'), '/', 1));
  v_website_host := split_part(v_website_host, ':', 1);

  if v_partner.id is not null
    and array_length(v_partner.allowed_cta_domains, 1) is not null
    and not (v_host = any(v_partner.allowed_cta_domains)) then
    raise exception 'Ad click target domain is not allowlisted.';
  elsif v_partner.id is not null
    and array_length(v_partner.allowed_cta_domains, 1) is null
    and v_website_host <> ''
    and v_host <> v_website_host then
    raise exception 'Ad click target domain does not match partner website.';
  end if;

  return jsonb_build_object(
    'decisionId', p_decision_id,
    'ctaUrl', v_version.cta_url,
    'creativeVersionId', v_version.id
  );
end;
$$;

create or replace function public.get_ad_session_competitor_keys(p_session_key_hash text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[] := '{}';
begin
  if p_session_key_hash is null or p_session_key_hash = '' then
    return v_keys;
  end if;

  select coalesce(array_agg(distinct competitor_key.value), '{}')
    into v_keys
  from public.ad_events event
  left join public.ad_campaigns campaign on campaign.id = event.campaign_id
  left join public.ad_flights flight on flight.id = event.flight_id
  cross join lateral unnest(coalesce(campaign.competitor_exclusion_keys, '{}') || coalesce(flight.competitor_exclusion_keys, '{}')) as competitor_key(value)
  where event.session_key_hash = p_session_key_hash
    and event.event_type = 'impression'
    and event.qualification_status <> 'filtered'
    and event.created_at >= now() - interval '6 hours';

  return v_keys;
end;
$$;

create or replace function public.refresh_ad_billing_snapshot(
  p_campaign_id text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_campaign public.ad_campaigns%rowtype;
  v_snapshot_id uuid;
  v_billable_impressions integer := 0;
  v_billable_viewable_impressions integer := 0;
  v_billable_clicks integer := 0;
  v_filtered_events integer := 0;
  v_billable_spend integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can refresh ad billing snapshots.';
  end if;

  if p_period_end <= p_period_start then
    raise exception 'Billing period end must be after start.';
  end if;

  select * into v_campaign from public.ad_campaigns where id = p_campaign_id;
  if not found then
    raise exception 'Campaign not found.';
  end if;

  select
    count(*) filter (where event_type = 'impression' and qualification_status = 'billable'),
    count(*) filter (where event_type = 'viewable_impression' and qualification_status = 'billable'),
    count(*) filter (where event_type = 'click' and qualification_status = 'billable'),
    count(*) filter (where qualification_status = 'filtered')
    into
      v_billable_impressions,
      v_billable_viewable_impressions,
      v_billable_clicks,
      v_filtered_events
  from public.ad_events
  where campaign_id = p_campaign_id
    and created_at >= p_period_start
    and created_at < p_period_end;

  if v_campaign.pricing_model = 'cpc' then
    v_billable_spend := v_billable_clicks * v_campaign.rate_amount;
  elsif v_campaign.pricing_model = 'cpm' then
    if v_campaign.rounding_mode = 'ceil' then
      v_billable_spend := ceil((v_billable_viewable_impressions::numeric * v_campaign.rate_amount::numeric) / 1000)::integer;
    elsif v_campaign.rounding_mode = 'floor' then
      v_billable_spend := floor((v_billable_viewable_impressions::numeric * v_campaign.rate_amount::numeric) / 1000)::integer;
    else
      v_billable_spend := round((v_billable_viewable_impressions::numeric * v_campaign.rate_amount::numeric) / 1000)::integer;
    end if;
  else
    v_billable_spend := 0;
  end if;

  insert into public.ad_billing_snapshots (
    campaign_id,
    period_start,
    period_end,
    pricing_model,
    currency,
    billable_impressions,
    billable_viewable_impressions,
    billable_clicks,
    gross_spend,
    billable_spend,
    filtered_event_count
  )
  values (
    p_campaign_id,
    p_period_start,
    p_period_end,
    v_campaign.pricing_model,
    v_campaign.currency,
    v_billable_impressions,
    v_billable_viewable_impressions,
    v_billable_clicks,
    v_billable_spend,
    v_billable_spend,
    v_filtered_events
  )
  returning id into v_snapshot_id;

  insert into public.ad_audit_events (actor_user_id, event_type, entity_type, entity_id, after_state, reason)
  values (
    v_actor_id,
    'ad_billing_snapshot_refreshed',
    'billing_snapshot',
    v_snapshot_id::text,
    jsonb_build_object('campaignId', p_campaign_id, 'periodStart', p_period_start, 'periodEnd', p_period_end),
    'Admin billing snapshot refresh'
  );

  return jsonb_build_object(
    'snapshotId', v_snapshot_id,
    'campaignId', p_campaign_id,
    'billableSpend', v_billable_spend,
    'billableViewableImpressions', v_billable_viewable_impressions,
    'billableClicks', v_billable_clicks,
    'filteredEvents', v_filtered_events
  );
end;
$$;

create or replace function public.create_ad_make_good_recommendations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_created integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can create ad make-good recommendations.';
  end if;

  insert into public.ad_make_goods (
    campaign_id,
    reason,
    owed_impressions,
    owed_clicks,
    owed_value_amount,
    status,
    notes
  )
  select
    campaign.id,
    'under_delivery',
    greatest(coalesce(campaign.contracted_viewable_impressions, campaign.contracted_impressions, 0) - coalesce(delivery.billable_viewable_impressions, 0), 0),
    greatest(coalesce(campaign.contracted_clicks, 0) - coalesce(delivery.billable_clicks, 0), 0),
    0,
    'draft',
    'Generated from current billable delivery totals.'
  from public.ad_campaigns campaign
  left join (
    select
      campaign_id,
      count(*) filter (where event_type = 'viewable_impression' and qualification_status = 'billable') as billable_viewable_impressions,
      count(*) filter (where event_type = 'click' and qualification_status = 'billable') as billable_clicks
    from public.ad_events
    group by campaign_id
  ) delivery on delivery.campaign_id = campaign.id
  where campaign.ends_at is not null
    and campaign.ends_at < now()
    and (
      coalesce(campaign.contracted_viewable_impressions, campaign.contracted_impressions, 0) > coalesce(delivery.billable_viewable_impressions, 0)
      or coalesce(campaign.contracted_clicks, 0) > coalesce(delivery.billable_clicks, 0)
    )
    and not exists (
      select 1 from public.ad_make_goods existing
      where existing.campaign_id = campaign.id
        and existing.reason = 'under_delivery'
        and existing.status in ('draft', 'submitted', 'approved', 'active')
    );

  get diagnostics v_created = row_count;

  insert into public.ad_audit_events (actor_user_id, event_type, entity_type, entity_id, after_state, reason)
  values (
    v_actor_id,
    'ad_make_goods_recommended',
    'make_good',
    'batch',
    jsonb_build_object('created', v_created),
    'Admin make-good recommendation refresh'
  );

  return jsonb_build_object('created', v_created);
end;
$$;

create or replace function public.aggregate_ad_events_daily(
  p_start_date date default (now() - interval '90 days')::date,
  p_end_date date default now()::date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rows integer := 0;
begin
  if v_actor_id is not null and not public.current_user_is_admin() then
    raise exception 'Only an admin can aggregate ad events.';
  end if;

  insert into public.ad_event_daily_summaries (
    summary_date,
    timezone,
    partner_id,
    campaign_id,
    flight_id,
    creative_id,
    creative_version_id,
    placement_key,
    gross_impressions,
    qualified_impressions,
    billable_viewable_impressions,
    billable_clicks,
    filtered_events,
    billable_spend
  )
  select
    (event.created_at at time zone coalesce(campaign.timezone, 'Africa/Lagos'))::date as summary_date,
    coalesce(campaign.timezone, 'Africa/Lagos') as timezone,
    event.partner_id,
    event.campaign_id,
    event.flight_id,
    event.creative_id,
    event.creative_version_id,
    event.placement_key,
    count(*) filter (where event.event_type = 'impression')::integer,
    count(*) filter (where event.event_type = 'impression' and event.qualification_status in ('qualified', 'billable'))::integer,
    count(*) filter (where event.event_type = 'viewable_impression' and event.qualification_status = 'billable')::integer,
    count(*) filter (where event.event_type = 'click' and event.qualification_status = 'billable')::integer,
    count(*) filter (where event.qualification_status = 'filtered')::integer,
    coalesce(sum(event.billable_amount), 0)::integer
  from public.ad_events event
  left join public.ad_campaigns campaign on campaign.id = event.campaign_id
  where event.created_at >= p_start_date::timestamptz
    and event.created_at < (p_end_date + 1)::timestamptz
  group by
    (event.created_at at time zone coalesce(campaign.timezone, 'Africa/Lagos'))::date,
    coalesce(campaign.timezone, 'Africa/Lagos'),
    event.partner_id,
    event.campaign_id,
    event.flight_id,
    event.creative_id,
    event.creative_version_id,
    event.placement_key
  on conflict (summary_date, timezone, campaign_id, flight_id, creative_version_id, placement_key)
  do update
  set gross_impressions = excluded.gross_impressions,
      qualified_impressions = excluded.qualified_impressions,
      billable_viewable_impressions = excluded.billable_viewable_impressions,
      billable_clicks = excluded.billable_clicks,
      filtered_events = excluded.filtered_events,
      billable_spend = excluded.billable_spend,
      updated_at = now();

  get diagnostics v_rows = row_count;

  return jsonb_build_object('summariesUpserted', v_rows);
end;
$$;

create or replace function public.purge_old_ad_runtime_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_deleted_events integer := 0;
  v_deleted_quality integer := 0;
  v_deleted_decisions integer := 0;
  v_deleted_counters integer := 0;
begin
  if v_actor_id is null or not public.current_user_is_admin() then
    raise exception 'Only an admin can purge ad runtime data.';
  end if;

  perform public.aggregate_ad_events_daily((now() - interval '120 days')::date, (now() - interval '90 days')::date);

  delete from public.ad_events
  where created_at < now() - interval '90 days';
  get diagnostics v_deleted_events = row_count;

  delete from public.ad_traffic_quality_events
  where created_at < now() - interval '180 days';
  get diagnostics v_deleted_quality = row_count;

  delete from public.ad_decisions
  where created_at < now() - interval '90 days';
  get diagnostics v_deleted_decisions = row_count;

  delete from public.ad_frequency_counters
  where window_end < now() - interval '30 days';
  get diagnostics v_deleted_counters = row_count;

  insert into public.ad_audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    after_state,
    reason
  )
  values (
    v_actor_id,
    'ad_runtime_data_purged',
    'ad_runtime_data',
    'retention',
    jsonb_build_object(
      'deletedEvents', v_deleted_events,
      'deletedQualityEvents', v_deleted_quality,
      'deletedDecisions', v_deleted_decisions,
      'deletedCounters', v_deleted_counters
    ),
    'Retention policy cleanup'
  );

  return jsonb_build_object(
    'deletedEvents', v_deleted_events,
    'deletedQualityEvents', v_deleted_quality,
    'deletedDecisions', v_deleted_decisions,
    'deletedCounters', v_deleted_counters
  );
end;
$$;

revoke execute on function public.admin_audit_ad_event(text, text, text, jsonb, jsonb, text) from public;
revoke execute on function public.admin_set_ad_entity_status(text, text, public.ad_entity_status, text) from public;
revoke execute on function public.admin_upsert_ad_partner(jsonb) from public;
revoke execute on function public.admin_upsert_ad_campaign(jsonb) from public;
revoke execute on function public.admin_register_ad_creative_asset(jsonb) from public;
revoke execute on function public.admin_upsert_ad_creative(jsonb) from public;
revoke execute on function public.admin_insert_ad_creative_version(jsonb) from public;
revoke execute on function public.admin_insert_ad_flight(jsonb) from public;
grant execute on function public.admin_audit_ad_event(text, text, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.admin_set_ad_entity_status(text, text, public.ad_entity_status, text) to authenticated;
grant execute on function public.admin_upsert_ad_partner(jsonb) to authenticated;
grant execute on function public.admin_upsert_ad_campaign(jsonb) to authenticated;
grant execute on function public.admin_register_ad_creative_asset(jsonb) to authenticated;
grant execute on function public.admin_upsert_ad_creative(jsonb) to authenticated;
grant execute on function public.admin_insert_ad_creative_version(jsonb) to authenticated;
grant execute on function public.admin_insert_ad_flight(jsonb) to authenticated;
revoke execute on function public.record_ad_decision(uuid, text, text, text, uuid, text, uuid, text, jsonb, integer, jsonb, jsonb, text, text) from public;
revoke execute on function public.upsert_ad_frequency_counter(public.ad_frequency_scope_type, text, text, interval, text, text, text, uuid, text, text, public.ad_event_type) from public;
grant execute on function public.record_ad_decision(uuid, text, text, text, uuid, text, uuid, text, jsonb, integer, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.record_ad_event(public.ad_event_type, uuid, text, timestamptz, text, text, text, jsonb) to anon;
grant execute on function public.record_ad_event(public.ad_event_type, uuid, text, timestamptz, text, text, text, jsonb) to authenticated;
revoke execute on function public.get_ad_runtime_counts(text, text, text, uuid, text) from public;
grant execute on function public.get_ad_runtime_counts(text, text, text, uuid, text) to authenticated;
revoke execute on function public.get_ad_session_competitor_keys(text) from public;
grant execute on function public.get_ad_session_competitor_keys(text) to authenticated;
grant execute on function public.get_ad_click_target(uuid) to anon;
grant execute on function public.get_ad_click_target(uuid) to authenticated;
revoke execute on function public.refresh_ad_billing_snapshot(text, timestamptz, timestamptz) from public;
revoke execute on function public.create_ad_make_good_recommendations() from public;
revoke execute on function public.aggregate_ad_events_daily(date, date) from public;
revoke execute on function public.purge_old_ad_runtime_data() from public;
grant execute on function public.refresh_ad_billing_snapshot(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.create_ad_make_good_recommendations() to authenticated;
grant execute on function public.aggregate_ad_events_daily(date, date) to authenticated;
grant execute on function public.purge_old_ad_runtime_data() to authenticated;
