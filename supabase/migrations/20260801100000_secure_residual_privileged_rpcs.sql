revoke execute on function public.grant_mission_award(uuid, text, text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.refresh_reward_quantity_inventory_counts(text) from public, anon, authenticated, service_role;
revoke execute on function public.aggregate_ad_events_daily(date, date) from public, anon, authenticated, service_role;
revoke execute on function public.upsert_ad_frequency_counter(
  public.ad_frequency_scope_type,
  text,
  text,
  interval,
  text,
  text,
  text,
  uuid,
  text,
  text,
  public.ad_event_type
) from public, anon, authenticated, service_role;

revoke execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.generate_continue_learning_reminders() from public, anon, authenticated;
revoke execute on function public.increment_profile_xp(uuid, integer) from public, anon, authenticated;

grant execute on function public.queue_user_notification(uuid, text, text, text, text, text, text, jsonb, text) to service_role;
grant execute on function public.generate_continue_learning_reminders() to service_role;
grant execute on function public.increment_profile_xp(uuid, integer) to service_role;

insert into private.rpc_security_classifications (
  function_schema,
  function_name,
  identity_arguments,
  classification,
  intended_callers,
  authorization_rule,
  execute_roles
)
values
  (
    'public',
    'grant_mission_award',
    'p_user_id uuid, p_mission_id text, p_award_scope text, p_metadata jsonb',
    'INTERNAL_HELPER',
    'Trusted SECURITY DEFINER mission workflows only.',
    'No API role may execute directly. Supported callers must reach this helper through authorized mission completion or admin proof-review RPCs that derive or verify the actor first.',
    array[]::text[]
  ),
  (
    'public',
    'refresh_reward_quantity_inventory_counts',
    'p_reward_id text',
    'INTERNAL_HELPER',
    'Trusted reward inventory workflows only.',
    'No API role may execute directly. Reward inventory count refreshes are invoked by trusted reward redemption, allocation, and admin inventory functions.',
    array[]::text[]
  ),
  (
    'public',
    'aggregate_ad_events_daily',
    'p_start_date date, p_end_date date',
    'INTERNAL_HELPER',
    'Trusted ad maintenance workflows only.',
    'No API role may execute directly. Aggregation is invoked by authorized ad maintenance functions that perform their own admin checks.',
    array[]::text[]
  ),
  (
    'public',
    'upsert_ad_frequency_counter',
    'p_scope_type ad_frequency_scope_type, p_scope_key_hash text, p_window_name text, p_window_duration interval, p_timezone text, p_campaign_id text, p_creative_id text, p_creative_version_id uuid, p_partner_id text, p_placement_key text, p_event_type ad_event_type',
    'INTERNAL_HELPER',
    'Trusted ad event workflows only.',
    'No API role may execute directly. Frequency counters are updated through constrained ad decision/event RPCs.',
    array[]::text[]
  ),
  (
    'public',
    'queue_user_notification',
    'p_user_id uuid, p_category text, p_event_type text, p_title text, p_body text, p_cta_href text, p_cta_label text, p_data jsonb, p_dedupe_key text',
    'INTERNAL_HELPER',
    'Trusted database functions and service maintenance jobs.',
    'No anon or authenticated learner may execute directly. Trusted callers should use private.queue_user_notification from SECURITY DEFINER database workflows or service_role without a user JWT subject.',
    array['service_role']
  ),
  (
    'public',
    'generate_continue_learning_reminders',
    '',
    'SERVICE_ROLE_ONLY',
    'Notification dispatch job using the service role.',
    'Only service_role may execute directly. Authenticated learners cannot run reminder generation.',
    array['service_role']
  ),
  (
    'public',
    'increment_profile_xp',
    'p_user_id uuid, p_amount integer',
    'INTERNAL_HELPER',
    'Trusted database XP workflows and service maintenance jobs.',
    'No anon or authenticated learner may execute directly. Trusted callers should use private.increment_profile_xp from SECURITY DEFINER database workflows or service_role without a user JWT subject.',
    array['service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
