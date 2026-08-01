alter table private.rpc_security_classifications
  drop constraint if exists rpc_security_classifications_classification_check;

alter table private.rpc_security_classifications
  add constraint rpc_security_classifications_classification_check
  check (
    classification = any (
      array[
        'PUBLIC_ANON',
        'PUBLIC_ANON_READ',
        'PUBLIC_ANON_TELEMETRY',
        'PUBLIC_AUTHENTICATED_SELF',
        'PUBLIC_AUTHENTICATED_READ',
        'PUBLIC_AUTHENTICATED_CONTEXT_WRITE',
        'ADMIN_AUTHENTICATED',
        'SERVICE_ROLE_ONLY',
        'INTERNAL_HELPER',
        'TRIGGER_ONLY'
      ]
    )
  );

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
    'current_user_is_admin',
    '',
    'PUBLIC_ANON_READ',
    'Anonymous, authenticated, and service contexts that need a safe current-caller admin boolean.',
    'Derives identity only from auth.uid(); returns false when no current user or no admin profile is present.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'get_ad_click_target',
    'p_decision_id uuid',
    'PUBLIC_ANON_READ',
    'Public ad click redirect route.',
    'Reads only the approved CTA URL for an existing ad decision and validates the target domain against partner allowlist or website host.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'record_signup_attempt',
    'p_email_domain text, p_ip_hash text, p_device_hash text, p_captcha_passed boolean',
    'PUBLIC_ANON_TELEMETRY',
    'Signup and OAuth callback risk instrumentation.',
    'Records constrained signup risk telemetry without trusting caller identity for privileged authorization.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'record_ad_event',
    'p_event_type ad_event_type, p_decision_id uuid, p_event_dedupe_key text, p_client_event_time timestamp with time zone, p_ip_hash text, p_device_hash text, p_user_agent_hash text, p_metadata jsonb',
    'PUBLIC_ANON_TELEMETRY',
    'Public ad impression, viewability, and click event endpoints.',
    'Requires a valid ad decision, filters invalid or mismatched events, deduplicates by event key, and records billing only after server-side qualification.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'record_ad_house_fallback_event',
    'p_event_type text, p_fallback_key text, p_placement_key text, p_event_dedupe_key text, p_client_event_time timestamp with time zone, p_ip_hash text, p_device_hash text, p_user_agent_hash text, p_metadata jsonb',
    'PUBLIC_ANON_TELEMETRY',
    'Public house-ad fallback impression, viewability, and click event endpoints.',
    'Accepts only supported event types for active house fallback placements and deduplicates by event key.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'submit_ad_sponsor_inquiry',
    'p_contact_name text, p_organization_name text, p_email text, p_website_url text, p_role_title text, p_campaign_goal text, p_placement_interest text, p_budget_range text, p_timing text, p_metadata jsonb',
    'PUBLIC_ANON_TELEMETRY',
    'Public advertiser inquiry form.',
    'Validates required contact, organization, email, goal, placement, and timing fields before inserting an inquiry.',
    array['anon', 'authenticated', 'service_role']
  ),
  (
    'public',
    'campaign_is_live',
    'p_campaign_id text',
    'PUBLIC_AUTHENTICATED_READ',
    'Authenticated reward and perk availability checks, plus trusted reward RPC internals.',
    'Read-only helper that returns whether a campaign id is null or currently active within its configured serving window.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'get_ad_runtime_counts',
    'p_session_key_hash text, p_partner_id text, p_campaign_id text, p_creative_version_id uuid, p_placement_key text',
    'PUBLIC_AUTHENTICATED_READ',
    'Authenticated ad selection pipeline.',
    'Read-only aggregate helper that derives user scope from auth.uid() when present and otherwise uses the supplied session hash for ad frequency and campaign spend checks.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'get_ad_session_competitor_keys',
    'p_session_key_hash text',
    'PUBLIC_AUTHENTICATED_READ',
    'Authenticated ad selection pipeline.',
    'Read-only session aggregate helper that returns recent competitor exclusion keys for a supplied session hash.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'get_ad_recent_lesson_decision',
    'p_session_key_hash text, p_placement_key text',
    'PUBLIC_AUTHENTICATED_READ',
    'Authenticated lesson ad selection pipeline.',
    'Read-only session helper that returns the latest recent lesson ad decision metadata for a supplied session and placement.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'reward_available_inventory_counts',
    '',
    'PUBLIC_AUTHENTICATED_READ',
    'Authenticated reward listing and XP store availability displays.',
    'Read-only helper returning available inventory counts for published enabled rewards and live reward campaigns.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'record_ad_decision',
    'p_user_id uuid, p_session_key_hash text, p_partner_id text, p_campaign_id text, p_flight_id uuid, p_creative_id text, p_creative_version_id uuid, p_placement_key text, p_decision_context jsonb, p_eligible_flight_count integer, p_ineligible_reasons jsonb, p_score_breakdown jsonb, p_experiment_key text, p_variant_key text',
    'PUBLIC_AUTHENTICATED_CONTEXT_WRITE',
    'Authenticated ad selection pipeline.',
    'Rejects authenticated p_user_id/auth.uid() mismatches, validates active ad entity relationships and serving windows, then records a server-qualified ad decision.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
