-- Close the remaining Platform Catalog operational boundary gaps without
-- promoting catalog staff to cross-tenant platform administrators.

create or replace function private.current_user_can_manage_platform_reward_unchecked(
  p_reward_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or (
      public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager'
        ]::public.organization_role_key[]
      )
      and coalesce((
        select reward.organization_id is null
        from public.rewards reward
        where reward.id = p_reward_id
      ), true)
    );
$$;

create or replace function private.current_user_can_manage_platform_rewards_unchecked(
  p_reward_ids text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or (
      public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager'
        ]::public.organization_role_key[]
      )
      and not exists (
        select 1
        from public.rewards reward
        where reward.id = any(coalesce(p_reward_ids, '{}'::text[]))
          and reward.organization_id is not null
      )
    );
$$;

create or replace function private.current_user_can_manage_platform_perk_prize_unchecked(
  p_prize_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or (
      public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager'
        ]::public.organization_role_key[]
      )
      and exists (
        select 1
        from public.perk_bundle_prizes prize
        join public.rewards reward on reward.id = prize.bundle_reward_id
        where prize.id = p_prize_id
          and reward.organization_id is null
      )
    );
$$;

create or replace function private.current_user_can_manage_platform_perk_prizes_unchecked(
  p_prize_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or (
      public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager'
        ]::public.organization_role_key[]
      )
      and not exists (
        select 1
        from public.perk_bundle_prizes prize
        join public.rewards reward on reward.id = prize.bundle_reward_id
        where prize.id = any(coalesce(p_prize_ids, '{}'::uuid[]))
          and reward.organization_id is not null
      )
    );
$$;

create or replace function private.current_user_can_manage_platform_perk_release_bucket_unchecked(
  p_bucket_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or exists (
      select 1
      from public.perk_prize_release_buckets bucket
      where bucket.id = p_bucket_id
        and private.current_user_can_manage_platform_perk_prize_unchecked(bucket.prize_id)
    );
$$;

revoke execute on function private.current_user_can_manage_platform_reward_unchecked(text)
  from public, anon, authenticated, service_role;
revoke execute on function private.current_user_can_manage_platform_rewards_unchecked(text[])
  from public, anon, authenticated, service_role;
revoke execute on function private.current_user_can_manage_platform_perk_prize_unchecked(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function private.current_user_can_manage_platform_perk_prizes_unchecked(uuid[])
  from public, anon, authenticated, service_role;
revoke execute on function private.current_user_can_manage_platform_perk_release_bucket_unchecked(uuid)
  from public, anon, authenticated, service_role;

-- The legacy reward functions contain the accepted validation, inventory and
-- notification behavior. Replace only their single administrator predicate
-- with a resource-scoped Platform Catalog predicate.
do $catalog_reward_authorization$
declare
  v_function record;
  v_definition text;
  v_replacement text;
begin
  for v_function in
    select procedure.oid, procedure.proname
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'admin_adjust_reward_quantity',
        'admin_create_reward',
        'admin_set_reward_enabled',
        'admin_update_reward',
        'admin_upsert_perk_bundle_prize',
        'admin_delete_perk_bundle_prize',
        'admin_assign_reward_stock_to_perk_prize',
        'admin_release_reward_stock_from_perk_prize',
        'admin_upsert_perk_prize_release_bucket',
        'admin_delete_perk_prize_release_bucket',
        'admin_reward_assignment_counts',
        'admin_perk_prize_assignment_counts'
      ])
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_replacement := case v_function.proname
      when 'admin_upsert_perk_bundle_prize'
        then 'private.current_user_can_manage_platform_reward_unchecked(p_bundle_reward_id)'
      when 'admin_delete_perk_bundle_prize'
        then 'private.current_user_can_manage_platform_perk_prize_unchecked(p_prize_id)'
      when 'admin_assign_reward_stock_to_perk_prize'
        then 'private.current_user_can_manage_platform_perk_prize_unchecked(p_prize_id)'
      when 'admin_release_reward_stock_from_perk_prize'
        then 'private.current_user_can_manage_platform_perk_prize_unchecked(p_prize_id)'
      when 'admin_upsert_perk_prize_release_bucket'
        then 'private.current_user_can_manage_platform_perk_prize_unchecked(p_prize_id)'
      when 'admin_delete_perk_prize_release_bucket'
        then 'private.current_user_can_manage_platform_perk_release_bucket_unchecked(p_bucket_id)'
      when 'admin_reward_assignment_counts'
        then 'private.current_user_can_manage_platform_rewards_unchecked(p_reward_ids)'
      when 'admin_perk_prize_assignment_counts'
        then 'private.current_user_can_manage_platform_perk_prizes_unchecked(p_prize_ids)'
      else 'private.current_user_can_manage_platform_reward_unchecked(p_reward_id)'
    end;

    if position('public.current_user_is_admin()' in v_definition) = 0 then
      raise exception 'Expected administrator predicate is missing from %.', v_function.oid::regprocedure;
    end if;

    execute replace(v_definition, 'public.current_user_is_admin()', v_replacement);
  end loop;
end;
$catalog_reward_authorization$;

do $catalog_campaign_authorization$
declare
  v_function record;
  v_definition text;
  v_replacement constant text := '(
    public.current_user_is_admin()
    or public.current_user_has_platform_catalog_role(
      array[''organisation_owner'',''organisation_admin'',''programme_manager'']::public.organization_role_key[]
    )
  )';
begin
  for v_function in
    select procedure.oid
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'admin_upsert_campaign'
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    if position('public.current_user_is_admin()' in v_definition) = 0 then
      raise exception 'Expected administrator predicate is missing from %.', v_function.oid::regprocedure;
    end if;
    execute replace(v_definition, 'public.current_user_is_admin()', v_replacement);
  end loop;
end;
$catalog_campaign_authorization$;

drop policy if exists "Platform catalog staff can read reward campaigns" on public.campaigns;
create policy "Platform catalog staff can read reward campaigns"
  on public.campaigns for select
  using (
    public.current_user_has_platform_catalog_role(
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager'
      ]::public.organization_role_key[]
    )
  );

create or replace function public.admin_set_reward_campaign_enabled(
  p_campaign_id text,
  p_is_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_platform_admin boolean := public.current_user_is_admin();
  v_updated_rewards integer := 0;
begin
  if v_actor_id is null or not (
    v_is_platform_admin
    or public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager']::public.organization_role_key[]
    )
  ) then
    raise exception 'Platform Catalog reward manager access required.' using errcode = '42501';
  end if;

  update public.campaigns
  set status = case when p_is_enabled then 'active' else 'draft' end,
      updated_at = now()
  where id = p_campaign_id;
  if not found then raise exception 'Campaign not found.'; end if;

  update public.rewards
  set is_enabled = p_is_enabled, updated_at = now()
  where campaign_id = p_campaign_id
    and (v_is_platform_admin or organization_id is null);
  get diagnostics v_updated_rewards = row_count;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'reward_campaign_store_state_changed',
    'campaign',
    p_campaign_id,
    jsonb_build_object('isEnabled', p_is_enabled, 'updatedRewards', v_updated_rewards)
  );
  return jsonb_build_object(
    'campaignId', p_campaign_id,
    'isEnabled', p_is_enabled,
    'updatedRewards', v_updated_rewards
  );
end;
$$;

revoke execute on function public.admin_set_reward_campaign_enabled(text, boolean) from public, anon;
grant execute on function public.admin_set_reward_campaign_enabled(text, boolean) to authenticated, service_role;

-- Platform mission publishing and public-proof review are Catalog editorial
-- operations; organisation proof review remains tenant scoped.
create or replace function private.queue_platform_mission_published_notification(
  p_mission_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_count integer := 0;
  v_notification_id uuid;
  v_user_id uuid;
begin
  if auth.uid() is null
    or not (
      public.current_user_is_admin()
      or public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'content_editor'
        ]::public.organization_role_key[]
      )
    )
    or not exists (
      select 1 from public.missions mission
      where mission.id = p_mission_id
        and mission.catalog_scope = 'platform'
        and mission.organization_id is null
        and mission.status = 'published'
    )
  then
    raise exception 'Platform Catalog mission publisher access required.' using errcode = '42501';
  end if;

  for v_user_id in
    select id from public.profiles where role = 'learner'
  loop
    select private.queue_user_notification(
      v_user_id,
      'missions',
      'new_mission',
      'New mission',
      'A new mission is ready. Earn more XP.',
      '/missions',
      'View mission',
      jsonb_build_object('missionId', p_mission_id),
      'broadcast-new-mission:' || p_mission_id || ':' || v_user_id::text
    ) into v_notification_id;
    if v_notification_id is not null then
      v_created_count := v_created_count + 1;
    end if;
  end loop;

  return v_created_count;
end;
$$;

revoke execute on function private.queue_platform_mission_published_notification(text)
  from public, anon, authenticated, service_role;

create or replace function public.admin_set_mission_status(
  p_mission_id text,
  p_status public.content_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_status public.content_status := coalesce(p_status, 'draft'::public.content_status);
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.';
  end if;
  if v_status not in ('draft'::public.content_status, 'published'::public.content_status) then
    raise exception 'Missions can only be published or moved to draft from this control.';
  end if;

  select * into v_mission
  from public.missions
  where id = p_mission_id
  for update;
  if not found then raise exception 'Mission not found.'; end if;

  if v_mission.catalog_scope = 'platform'::public.mission_catalog_scope then
    if not (
      public.current_user_is_admin()
      or public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'content_editor'
        ]::public.organization_role_key[]
      )
    ) then
      raise exception 'Platform Catalog mission manager access required.';
    end if;
  elsif not public.current_user_can_manage_organization_missions(v_mission.organization_id) then
    raise exception 'Organization mission manager access required.';
  end if;

  update public.missions set status = v_status, updated_at = now() where id = p_mission_id;
  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'mission_status_changed',
    'mission',
    p_mission_id,
    jsonb_build_object(
      'status', v_status,
      'previousStatus', v_mission.status,
      'catalogScope', v_mission.catalog_scope,
      'organizationId', v_mission.organization_id
    )
  );

  if v_mission.catalog_scope = 'platform'::public.mission_catalog_scope
    and v_mission.status is distinct from 'published'::public.content_status
    and v_status = 'published'::public.content_status
  then
    perform private.queue_platform_mission_published_notification(p_mission_id);
  end if;
  return jsonb_build_object('missionId', p_mission_id, 'status', v_status);
end;
$$;

create or replace function public.admin_review_mission_proof_submission(
  p_user_id uuid,
  p_mission_id text,
  p_award_scope text,
  p_status public.review_status,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_required_fields text[];
  v_valid boolean := false;
  v_requirement_mode text := 'all';
  v_organization_id uuid;
  v_programme_id uuid;
  v_programme_mission_id text;
begin
  if v_actor_id is null then raise exception 'Authentication is required.'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'Review status must be approved or rejected.'; end if;

  select organization_id, programme_id, programme_mission_id
    into v_organization_id, v_programme_id, v_programme_mission_id
  from public.mission_proofs
  where user_id = p_user_id and mission_id = p_mission_id and award_scope = p_award_scope
  order by created_at asc limit 1;
  if not found then raise exception 'Mission proof submission was not found.'; end if;

  if v_organization_id is null then
    if not (
      public.current_user_is_admin()
      or public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'reviewer'
        ]::public.organization_role_key[]
      )
    ) then
      raise exception 'Platform Catalog proof reviewer access required.';
    end if;
  elsif not (
    public.current_user_is_admin()
    or public.current_user_has_organization_role(
      v_organization_id,
      array['organisation_owner','organisation_admin','programme_manager','reviewer']::public.organization_role_key[]
    )
    or public.current_user_can_act_on_scoped_learner(v_organization_id, p_user_id)
  ) then
    raise exception 'Only organization proof reviewers can review this mission proof.';
  end if;

  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found or v_mission.validation_type <> 'proof_upload' then
    raise exception 'Mission proof submission was not found.';
  end if;

  update public.mission_proofs
  set status = p_status,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      rejection_reason = case when p_status = 'rejected' then nullif(trim(coalesce(p_rejection_reason, '')), '') else null end,
      updated_at = now()
  where user_id = p_user_id and mission_id = p_mission_id and award_scope = p_award_scope;
  if not found then raise exception 'Mission proof submission was not found.'; end if;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'mission_proof_' || p_status::text,
    'mission_proof',
    p_user_id::text || ':' || p_mission_id || ':' || p_award_scope,
    jsonb_build_object(
      'userId', p_user_id,
      'missionId', p_mission_id,
      'awardScope', p_award_scope,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id,
      'rejectionReason', p_rejection_reason
    )
  );

  if p_status = 'rejected' then return jsonb_build_object('status', 'rejected'); end if;

  select array_agg(value::text) into v_required_fields
  from jsonb_array_elements_text(
    coalesce(v_mission.validation_config -> 'requiredFields', v_mission.validation_config -> 'requiredProofFields', '[]'::jsonb)
  ) as value;
  v_requirement_mode := coalesce(
    v_mission.validation_config ->> 'requirementMode',
    v_mission.validation_config ->> 'proofRequirementMode',
    'all'
  );
  v_valid := public.mission_proof_fields_satisfy(
    coalesce(v_required_fields, '{}'::text[]), v_requirement_mode,
    p_user_id, p_mission_id, p_award_scope, array['approved']::text[]
  );
  if not coalesce(v_valid, false) then
    return jsonb_build_object('status', 'approved_pending_required_fields');
  end if;
  return public.grant_mission_award(
    p_user_id,
    v_mission.id,
    p_award_scope,
    jsonb_build_object(
      'reviewedBy', v_actor_id,
      'organizationId', v_organization_id,
      'programmeId', v_programme_id,
      'programmeMissionId', v_programme_mission_id
    )
  );
end;
$$;

drop policy if exists "Platform catalog reviewers can read public mission proofs" on public.mission_proofs;
create policy "Platform catalog reviewers can read public mission proofs"
  on public.mission_proofs for select
  using (
    organization_id is null
    and public.current_user_has_platform_catalog_role(
      array[
        'organisation_owner',
        'organisation_admin',
        'programme_manager',
        'reviewer'
      ]::public.organization_role_key[]
    )
  );

-- Assessment authoring uses the same immutable-version workflow for platform
-- templates and organisation adaptations. A null organisation denotes the
-- Platform Catalog; it is never treated as an arbitrary organisation.
create or replace function public.current_user_can_manage_organization_assessments(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_organization_id is null then
      public.current_user_is_admin()
      or public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'content_editor'
        ]::public.organization_role_key[]
      )
    else
      public.current_user_is_admin()
      or public.current_user_has_organization_role(
        p_organization_id,
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'content_editor'
        ]::public.organization_role_key[]
      )
  end;
$$;

create or replace function private.assert_manage_draft_organization_assessment(
  p_assessment_version_id uuid
)
returns public.assessment_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assessment public.assessment_versions%rowtype;
begin
  select * into v_assessment
  from public.assessment_versions
  where id = p_assessment_version_id;
  if not found then raise exception 'Assessment version not found.'; end if;

  if v_actor_id is null
    or not public.current_user_can_manage_organization_assessments(v_assessment.organization_id)
    or (
      v_assessment.organization_id is null
      and v_assessment.owner_scope <> 'platform'
    )
    or (
      v_assessment.organization_id is not null
      and v_assessment.owner_scope <> 'organization'
    )
  then
    raise exception 'Assessment manager access required.';
  end if;

  if v_assessment.organization_id is not null
    and not private.organization_has_assessment_capability_unchecked(
      v_assessment.organization_id,
      'template_adaptation'
    )
  then
    raise exception 'Assessment editing requires a Professional or higher organization plan.';
  end if;
  if v_assessment.status <> 'draft' then
    raise exception 'Published assessment versions are immutable.';
  end if;
  return v_assessment;
end;
$$;

create or replace function public.admin_create_organization_assessment_revision(
  p_organization_id uuid,
  p_source_assessment_version_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_introduction_copy text,
  p_completion_copy text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_source public.assessment_versions%rowtype;
  v_new_assessment_id uuid := gen_random_uuid();
  v_new_question_id uuid;
  v_new_option_id uuid;
  v_question record;
  v_option record;
  v_title text := trim(coalesce(p_title, ''));
  v_slug text := public.admin_slugify(coalesce(nullif(trim(coalesce(p_slug, '')), ''), p_title));
  v_version_number integer := 1;
  v_owner_scope text := case
    when p_organization_id is null then 'platform'
    else 'organization'
  end;
begin
  if v_actor_id is null
    or not public.current_user_can_manage_organization_assessments(p_organization_id)
  then
    raise exception 'Assessment manager access required.';
  end if;
  if p_organization_id is not null
    and not private.organization_has_assessment_capability_unchecked(p_organization_id, 'template_adaptation')
  then
    raise exception 'Assessment adaptation requires a Professional or higher organization plan.';
  end if;

  select * into v_source
  from public.assessment_versions
  where id = p_source_assessment_version_id and status = 'published';
  if not found then raise exception 'Source assessment version must be published.'; end if;
  if p_organization_id is null and v_source.owner_scope <> 'platform' then
    raise exception 'Platform Catalog revisions require a platform assessment source.';
  end if;
  if p_organization_id is not null
    and v_source.owner_scope = 'organization'
    and v_source.organization_id <> p_organization_id
  then
    raise exception 'Organization assessment versions can only be revised by their owning organization.';
  end if;
  if v_title = '' then raise exception 'Assessment title is required.'; end if;
  if v_slug = '' then v_slug := 'assessment'; end if;
  if exists(select 1 from public.assessment_versions where slug = v_slug) then
    raise exception 'Assessment slug is already in use.';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_version_number
  from public.assessment_versions
  where owner_scope = v_owner_scope
    and organization_id is not distinct from p_organization_id
    and coalesce(source_assessment_version_id, id) = coalesce(v_source.source_assessment_version_id, v_source.id);

  insert into public.assessment_versions (
    id, slug, title, description, xp_award, status, owner_scope,
    organization_id, source_assessment_version_id, version_number,
    introduction_copy, completion_copy, scoring_config
  ) values (
    v_new_assessment_id, v_slug, v_title,
    nullif(trim(coalesce(p_description, '')), ''), v_source.xp_award, 'draft',
    v_owner_scope, p_organization_id, v_source.id, v_version_number,
    trim(coalesce(p_introduction_copy, '')), trim(coalesce(p_completion_copy, '')),
    coalesce(v_source.scoring_config, '{}'::jsonb)
  );

  for v_question in
    select * from public.assessment_questions
    where assessment_version_id = v_source.id order by sort_order, id
  loop
    insert into public.assessment_questions (
      assessment_version_id, prompt, helper_text, question_type, sort_order
    ) values (
      v_new_assessment_id, v_question.prompt, v_question.helper_text,
      v_question.question_type, v_question.sort_order
    ) returning id into v_new_question_id;

    for v_option in
      select * from public.assessment_question_options
      where question_id = v_question.id order by sort_order, id
    loop
      insert into public.assessment_question_options (
        question_id, label, description, sort_order
      ) values (
        v_new_question_id, v_option.label, v_option.description, v_option.sort_order
      ) returning id into v_new_option_id;

      insert into public.assessment_option_dimension_weights (option_id, dimension_id, weight)
      select v_new_option_id, weight.dimension_id, weight.weight
      from public.assessment_option_dimension_weights weight
      where weight.option_id = v_option.id;
    end loop;
  end loop;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when p_organization_id is null
      then 'platform_assessment_revision_created'
      else 'organization_assessment_revision_created'
    end,
    'assessment_version',
    v_new_assessment_id::text,
    jsonb_build_object(
      'organizationId', p_organization_id,
      'ownerScope', v_owner_scope,
      'sourceAssessmentVersionId', v_source.id,
      'versionNumber', v_version_number
    )
  );
  return jsonb_build_object(
    'assessmentVersionId', v_new_assessment_id,
    'status', 'draft',
    'versionNumber', v_version_number
  );
end;
$$;

create or replace function public.admin_publish_organization_assessment_version(
  p_assessment_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assessment public.assessment_versions%rowtype;
  v_question_count integer := 0;
begin
  select * into v_assessment
  from public.assessment_versions
  where id = p_assessment_version_id;
  if not found then raise exception 'Assessment version not found.'; end if;

  if v_actor_id is null
    or not public.current_user_can_manage_organization_assessments(v_assessment.organization_id)
    or (v_assessment.organization_id is null and v_assessment.owner_scope <> 'platform')
    or (v_assessment.organization_id is not null and v_assessment.owner_scope <> 'organization')
  then
    raise exception 'Assessment manager access required.';
  end if;
  if v_assessment.organization_id is not null
    and not private.organization_has_assessment_capability_unchecked(v_assessment.organization_id, 'template_adaptation')
  then
    raise exception 'Assessment adaptation requires a Professional or higher organization plan.';
  end if;
  if v_assessment.status <> 'draft' then
    raise exception 'Only draft assessment versions can be published.';
  end if;

  select count(*)::integer into v_question_count
  from public.assessment_questions where assessment_version_id = v_assessment.id;
  if v_question_count = 0 then raise exception 'Assessment requires at least one question before publishing.'; end if;
  if exists (
    select 1
    from public.assessment_questions question
    left join lateral (
      select count(*)::integer as option_count
      from public.assessment_question_options option
      where option.question_id = question.id
    ) options on true
    where question.assessment_version_id = v_assessment.id
      and coalesce(options.option_count, 0) < 2
  ) then
    raise exception 'Every assessment question requires at least two options before publishing.';
  end if;

  update public.assessment_versions
  set status = 'published', published_at = coalesce(published_at, now())
  where id = v_assessment.id;
  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    case when v_assessment.organization_id is null
      then 'platform_assessment_published'
      else 'organization_assessment_published'
    end,
    'assessment_version',
    v_assessment.id::text,
    jsonb_build_object('organizationId', v_assessment.organization_id, 'ownerScope', v_assessment.owner_scope)
  );
  return jsonb_build_object('assessmentVersionId', v_assessment.id, 'status', 'published');
end;
$$;

drop policy if exists "Platform catalog staff can read platform assessment versions" on public.assessment_versions;
create policy "Platform catalog staff can read platform assessment versions"
  on public.assessment_versions for select
  using (
    owner_scope = 'platform'
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  );

drop policy if exists "Platform catalog staff can read platform assessment questions" on public.assessment_questions;
create policy "Platform catalog staff can read platform assessment questions"
  on public.assessment_questions for select
  using (exists (
    select 1 from public.assessment_versions version
    where version.id = assessment_questions.assessment_version_id
      and version.owner_scope = 'platform'
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
      )
  ));

drop policy if exists "Platform catalog staff can read platform assessment options" on public.assessment_question_options;
create policy "Platform catalog staff can read platform assessment options"
  on public.assessment_question_options for select
  using (exists (
    select 1
    from public.assessment_questions question
    join public.assessment_versions version on version.id = question.assessment_version_id
    where question.id = assessment_question_options.question_id
      and version.owner_scope = 'platform'
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
      )
  ));

drop policy if exists "Platform catalog staff can read platform assessment weights" on public.assessment_option_dimension_weights;
create policy "Platform catalog staff can read platform assessment weights"
  on public.assessment_option_dimension_weights for select
  using (exists (
    select 1
    from public.assessment_question_options option
    join public.assessment_questions question on question.id = option.question_id
    join public.assessment_versions version on version.id = question.assessment_version_id
    where option.id = assessment_option_dimension_weights.option_id
      and version.owner_scope = 'platform'
      and public.current_user_has_platform_catalog_role(
        array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
      )
  ));

-- Course-adjacent AI, media, template duplication and personalization tags
-- follow the existing course-edit boundary instead of the global admin bit.
drop policy if exists "Platform catalog editors can insert platform courses" on public.courses;
create policy "Platform catalog editors can insert platform courses"
  on public.courses for insert
  with check (
    catalog_scope = 'platform'
    and organization_id is null
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  );

drop policy if exists "Platform catalog editors can update platform courses" on public.courses;
create policy "Platform catalog editors can update platform courses"
  on public.courses for update
  using (catalog_scope = 'platform' and public.current_user_can_edit_course(id))
  with check (
    catalog_scope = 'platform'
    and organization_id is null
    and public.current_user_can_edit_course(id)
  );

drop policy if exists "Platform catalog editors can delete platform courses" on public.courses;
create policy "Platform catalog editors can delete platform courses"
  on public.courses for delete
  using (catalog_scope = 'platform' and public.current_user_can_edit_course(id));

drop policy if exists "Course editors can insert lessons" on public.lessons;
create policy "Course editors can insert lessons"
  on public.lessons for insert
  with check (public.current_user_can_edit_course(course_id));
drop policy if exists "Course editors can update lessons" on public.lessons;
create policy "Course editors can update lessons"
  on public.lessons for update
  using (public.current_user_can_edit_course(course_id))
  with check (public.current_user_can_edit_course(course_id));
drop policy if exists "Course editors can delete lessons" on public.lessons;
create policy "Course editors can delete lessons"
  on public.lessons for delete
  using (public.current_user_can_edit_course(course_id));

drop policy if exists "Course editors can insert lesson pages" on public.lesson_pages;
create policy "Course editors can insert lesson pages"
  on public.lesson_pages for insert
  with check (exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_pages.lesson_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can update lesson pages" on public.lesson_pages;
create policy "Course editors can update lesson pages"
  on public.lesson_pages for update
  using (exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_pages.lesson_id
      and public.current_user_can_edit_course(lesson.course_id)
  ))
  with check (exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_pages.lesson_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can delete lesson pages" on public.lesson_pages;
create policy "Course editors can delete lesson pages"
  on public.lesson_pages for delete
  using (exists (
    select 1 from public.lessons lesson
    where lesson.id = lesson_pages.lesson_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));

drop policy if exists "Course editors can insert lesson blocks" on public.lesson_content_blocks;
create policy "Course editors can insert lesson blocks"
  on public.lesson_content_blocks for insert
  with check (exists (
    select 1
    from public.lesson_pages page
    join public.lessons lesson on lesson.id = page.lesson_id
    where page.id = lesson_content_blocks.page_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can update lesson blocks" on public.lesson_content_blocks;
create policy "Course editors can update lesson blocks"
  on public.lesson_content_blocks for update
  using (exists (
    select 1
    from public.lesson_pages page
    join public.lessons lesson on lesson.id = page.lesson_id
    where page.id = lesson_content_blocks.page_id
      and public.current_user_can_edit_course(lesson.course_id)
  ))
  with check (exists (
    select 1
    from public.lesson_pages page
    join public.lessons lesson on lesson.id = page.lesson_id
    where page.id = lesson_content_blocks.page_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can delete lesson blocks" on public.lesson_content_blocks;
create policy "Course editors can delete lesson blocks"
  on public.lesson_content_blocks for delete
  using (exists (
    select 1
    from public.lesson_pages page
    join public.lessons lesson on lesson.id = page.lesson_id
    where page.id = lesson_content_blocks.page_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));

drop policy if exists "Course editors can insert quizzes" on public.quizzes;
create policy "Course editors can insert quizzes"
  on public.quizzes for insert
  with check (exists (
    select 1 from public.lessons lesson
    where lesson.id = quizzes.lesson_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can update quizzes" on public.quizzes;
create policy "Course editors can update quizzes"
  on public.quizzes for update
  using (exists (
    select 1 from public.lessons lesson
    where lesson.id = quizzes.lesson_id
      and public.current_user_can_edit_course(lesson.course_id)
  ))
  with check (exists (
    select 1 from public.lessons lesson
    where lesson.id = quizzes.lesson_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can delete quizzes" on public.quizzes;
create policy "Course editors can delete quizzes"
  on public.quizzes for delete
  using (exists (
    select 1 from public.lessons lesson
    where lesson.id = quizzes.lesson_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));

drop policy if exists "Course editors can insert quiz questions" on public.quiz_questions;
create policy "Course editors can insert quiz questions"
  on public.quiz_questions for insert
  with check (exists (
    select 1
    from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where quiz.id = quiz_questions.quiz_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can update quiz questions" on public.quiz_questions;
create policy "Course editors can update quiz questions"
  on public.quiz_questions for update
  using (exists (
    select 1
    from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where quiz.id = quiz_questions.quiz_id
      and public.current_user_can_edit_course(lesson.course_id)
  ))
  with check (exists (
    select 1
    from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where quiz.id = quiz_questions.quiz_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can delete quiz questions" on public.quiz_questions;
create policy "Course editors can delete quiz questions"
  on public.quiz_questions for delete
  using (exists (
    select 1
    from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where quiz.id = quiz_questions.quiz_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));

drop policy if exists "Course editors can insert quiz options" on public.quiz_options;
create policy "Course editors can insert quiz options"
  on public.quiz_options for insert
  with check (exists (
    select 1
    from public.quiz_questions question
    join public.quizzes quiz on quiz.id = question.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where question.id = quiz_options.question_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can update quiz options" on public.quiz_options;
create policy "Course editors can update quiz options"
  on public.quiz_options for update
  using (exists (
    select 1
    from public.quiz_questions question
    join public.quizzes quiz on quiz.id = question.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where question.id = quiz_options.question_id
      and public.current_user_can_edit_course(lesson.course_id)
  ))
  with check (exists (
    select 1
    from public.quiz_questions question
    join public.quizzes quiz on quiz.id = question.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where question.id = quiz_options.question_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));
drop policy if exists "Course editors can delete quiz options" on public.quiz_options;
create policy "Course editors can delete quiz options"
  on public.quiz_options for delete
  using (exists (
    select 1
    from public.quiz_questions question
    join public.quizzes quiz on quiz.id = question.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    where question.id = quiz_options.question_id
      and public.current_user_can_edit_course(lesson.course_id)
  ));

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
  if auth.uid() is null
    or not (
      public.current_user_is_admin()
      or public.current_user_can_edit_course(p_course_id)
    )
  then
    raise exception 'Course editor access required.';
  end if;
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
  where id = p_course_id and ai_generated = true;
  update public.lessons
  set ai_text_status = p_text_status,
      ai_media_status = 'not_started',
      ai_publish_status = 'not_ready',
      text_approved_at = null,
      text_approved_by = null,
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where course_id = p_course_id and ai_generated = true;
  update public.quizzes quiz
  set ai_text_status = p_text_status,
      text_approved_at = null,
      text_approved_by = null,
      updated_at = now()
  from public.lessons lesson
  where quiz.lesson_id = lesson.id
    and lesson.course_id = p_course_id
    and quiz.ai_generated = true;
end;
$$;

create or replace function public.admin_reset_ai_course_media(
  p_course_id text,
  p_lesson_id text default null,
  p_media_status text default 'draft'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or not (
      public.current_user_is_admin()
      or public.current_user_can_edit_course(p_course_id)
    )
  then
    raise exception 'Course editor access required.';
  end if;
  if p_media_status not in ('draft', 'changes_requested') then
    raise exception 'Unsupported AI media reset status.';
  end if;
  update public.courses
  set ai_media_status = p_media_status,
      ai_publish_status = 'not_ready',
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where id = p_course_id and ai_generated = true;
  update public.lessons
  set ai_media_status = p_media_status,
      ai_publish_status = 'not_ready',
      media_approved_at = null,
      media_approved_by = null,
      updated_at = now()
  where course_id = p_course_id
    and (p_lesson_id is null or id = p_lesson_id)
    and ai_generated = true;
end;
$$;

create or replace function public.admin_duplicate_course_template(
  p_source_course_id text,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_result jsonb;
  v_new_course_id text;
  v_source public.courses%rowtype;
begin
  if v_actor_id is null then raise exception 'Authentication is required.'; end if;
  select * into v_source from public.courses where id = p_source_course_id;
  if not found then raise exception 'Source course not found.'; end if;
  if not public.current_user_is_admin()
    and not (
      v_source.organization_id is null
      and public.current_user_has_platform_catalog_role(
        array[
          'organisation_owner',
          'organisation_admin',
          'programme_manager',
          'content_editor'
        ]::public.organization_role_key[]
      )
    )
  then
    raise exception 'Platform Catalog course editor access required.';
  end if;

  v_result := private.admin_duplicate_course_template_base_v20260802(p_source_course_id, p_title);
  v_new_course_id := v_result ->> 'courseId';
  update public.courses
  set intended_audience = coalesce(v_source.intended_audience, ''),
      learning_outcomes = coalesce(v_source.learning_outcomes, '{}'::text[]),
      organization_id = null,
      catalog_scope = 'platform',
      updated_at = now()
  where id = v_new_course_id;
  return v_result;
end;
$$;

drop policy if exists "Course editors can read learning media assets" on public.learning_media_assets;
create policy "Course editors can read learning media assets"
  on public.learning_media_assets for select
  using (
    (course_id is not null and public.current_user_can_edit_course(course_id))
    or exists (
      select 1 from public.lessons lesson
      where lesson.id = learning_media_assets.lesson_id
        and public.current_user_can_edit_course(lesson.course_id)
    )
  );
drop policy if exists "Course editors can insert learning media assets" on public.learning_media_assets;
create policy "Course editors can insert learning media assets"
  on public.learning_media_assets for insert
  with check (
    (course_id is not null and public.current_user_can_edit_course(course_id))
    or exists (
      select 1 from public.lessons lesson
      where lesson.id = learning_media_assets.lesson_id
        and public.current_user_can_edit_course(lesson.course_id)
    )
  );
drop policy if exists "Course editors can update learning media assets" on public.learning_media_assets;
create policy "Course editors can update learning media assets"
  on public.learning_media_assets for update
  using (
    (course_id is not null and public.current_user_can_edit_course(course_id))
    or exists (
      select 1 from public.lessons lesson
      where lesson.id = learning_media_assets.lesson_id
        and public.current_user_can_edit_course(lesson.course_id)
    )
  )
  with check (
    (course_id is not null and public.current_user_can_edit_course(course_id))
    or exists (
      select 1 from public.lessons lesson
      where lesson.id = learning_media_assets.lesson_id
        and public.current_user_can_edit_course(lesson.course_id)
    )
  );

drop policy if exists "Catalog authors can read their AI course plans" on public.ai_course_plans;
create policy "Catalog authors can read their AI course plans"
  on public.ai_course_plans for select
  using (
    created_by = auth.uid()
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  );
drop policy if exists "Catalog authors can create AI course plans" on public.ai_course_plans;
create policy "Catalog authors can create AI course plans"
  on public.ai_course_plans for insert
  with check (
    created_by = auth.uid()
    and (course_id is null or public.current_user_can_edit_course(course_id))
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  );
drop policy if exists "Catalog authors can update their AI course plans" on public.ai_course_plans;
create policy "Catalog authors can update their AI course plans"
  on public.ai_course_plans for update
  using (
    created_by = auth.uid()
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  )
  with check (
    created_by = auth.uid()
    and (course_id is null or public.current_user_can_edit_course(course_id))
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  );

drop policy if exists "Catalog authors can read their AI generation jobs" on public.ai_generation_jobs;
create policy "Catalog authors can read their AI generation jobs"
  on public.ai_generation_jobs for select
  using (
    organization_id is null
    and created_by = auth.uid()
    and (course_id is null or public.current_user_can_edit_course(course_id))
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  );
drop policy if exists "Catalog authors can create AI generation jobs" on public.ai_generation_jobs;
create policy "Catalog authors can create AI generation jobs"
  on public.ai_generation_jobs for insert
  with check (
    organization_id is null
    and created_by = auth.uid()
    and (course_id is null or public.current_user_can_edit_course(course_id))
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  );
drop policy if exists "Catalog authors can update their AI generation jobs" on public.ai_generation_jobs;
create policy "Catalog authors can update their AI generation jobs"
  on public.ai_generation_jobs for update
  using (
    organization_id is null
    and created_by = auth.uid()
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  )
  with check (
    organization_id is null
    and created_by = auth.uid()
    and (course_id is null or public.current_user_can_edit_course(course_id))
    and public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
    )
  );

drop policy if exists "Content editors can read scoped value tags" on public.content_value_tags;
create policy "Content editors can read scoped value tags"
  on public.content_value_tags for select
  using (
    (content_type = 'course' and public.current_user_can_edit_course(content_id))
    or (content_type = 'lesson' and exists (
      select 1 from public.lessons lesson
      where lesson.id = content_value_tags.content_id
        and public.current_user_can_edit_course(lesson.course_id)
    ))
    or (content_type = 'mission' and exists (
      select 1 from public.missions mission
      where mission.id = content_value_tags.content_id
        and (
          (mission.organization_id is null and public.current_user_has_platform_catalog_role(
            array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
          ))
          or (mission.organization_id is not null and public.current_user_can_manage_organization_missions(mission.organization_id))
        )
    ))
  );
drop policy if exists "Content editors can insert scoped value tags" on public.content_value_tags;
create policy "Content editors can insert scoped value tags"
  on public.content_value_tags for insert
  with check (
    (content_type = 'course' and public.current_user_can_edit_course(content_id))
    or (content_type = 'lesson' and exists (
      select 1 from public.lessons lesson
      where lesson.id = content_value_tags.content_id
        and public.current_user_can_edit_course(lesson.course_id)
    ))
    or (content_type = 'mission' and exists (
      select 1 from public.missions mission
      where mission.id = content_value_tags.content_id
        and mission.organization_id is null
        and public.current_user_has_platform_catalog_role(
          array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
        )
    ))
  );
drop policy if exists "Content editors can update scoped value tags" on public.content_value_tags;
create policy "Content editors can update scoped value tags"
  on public.content_value_tags for update
  using (
    (content_type = 'course' and public.current_user_can_edit_course(content_id))
    or (content_type = 'lesson' and exists (
      select 1 from public.lessons lesson
      where lesson.id = content_value_tags.content_id
        and public.current_user_can_edit_course(lesson.course_id)
    ))
    or (content_type = 'mission' and exists (
      select 1 from public.missions mission
      where mission.id = content_value_tags.content_id
        and mission.organization_id is null
        and public.current_user_has_platform_catalog_role(
          array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
        )
    ))
  ) with check (
    (content_type = 'course' and public.current_user_can_edit_course(content_id))
    or (content_type = 'lesson' and exists (
      select 1 from public.lessons lesson
      where lesson.id = content_value_tags.content_id
        and public.current_user_can_edit_course(lesson.course_id)
    ))
    or (content_type = 'mission' and exists (
      select 1 from public.missions mission
      where mission.id = content_value_tags.content_id
        and mission.organization_id is null
        and public.current_user_has_platform_catalog_role(
          array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
        )
    ))
  );
drop policy if exists "Content editors can delete scoped value tags" on public.content_value_tags;
create policy "Content editors can delete scoped value tags"
  on public.content_value_tags for delete
  using (
    (content_type = 'course' and public.current_user_can_edit_course(content_id))
    or (content_type = 'lesson' and exists (
      select 1 from public.lessons lesson
      where lesson.id = content_value_tags.content_id
        and public.current_user_can_edit_course(lesson.course_id)
    ))
    or (content_type = 'mission' and exists (
      select 1 from public.missions mission
      where mission.id = content_value_tags.content_id
        and mission.organization_id is null
        and public.current_user_has_platform_catalog_role(
          array['organisation_owner','organisation_admin','programme_manager','content_editor']::public.organization_role_key[]
        )
    ))
  );

-- Platform Points controls are separate catalog operations so the accepted
-- organisation-account RPC contract remains unchanged.
drop policy if exists "Platform catalog managers can read the platform XP account" on public.xp_accounts;

create or replace function public.admin_update_platform_xp_account_presentation(
  p_xp_account_id uuid,
  p_display_name text,
  p_display_name_plural text,
  p_short_label text,
  p_icon text,
  p_display_format text,
  p_status public.xp_account_status
)
returns public.xp_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_before public.xp_accounts%rowtype;
  v_account public.xp_accounts%rowtype;
begin
  if v_actor_id is null or not public.current_user_can_manage_platform_catalog() then
    raise exception 'Platform Catalog manager access required.' using errcode = '42501';
  end if;
  select * into v_before
  from public.xp_accounts
  where id = p_xp_account_id and scope = 'platform' and organization_id is null
  for update;
  if not found then raise exception 'Platform XP account not found.'; end if;
  if nullif(trim(p_display_name), '') is null
    or nullif(trim(p_display_name_plural), '') is null
    or nullif(trim(p_short_label), '') is null
  then
    raise exception 'XP account labels are required.';
  end if;
  if p_display_format not in ('amount_name', 'amount_short_label') then
    raise exception 'Unsupported XP account display format.';
  end if;

  update public.xp_accounts
  set name = left(trim(p_display_name), 80),
      plural_name = left(trim(p_display_name_plural), 80),
      short_label = left(trim(p_short_label), 20),
      icon_url = left(trim(coalesce(p_icon, 'coins')), 200),
      display_name = left(trim(p_display_name), 80),
      display_name_plural = left(trim(p_display_name_plural), 80),
      icon = left(trim(coalesce(p_icon, 'coins')), 80),
      display_format = p_display_format,
      status = p_status,
      updated_at = now()
  where id = p_xp_account_id
  returning * into v_account;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'platform_xp_account_presentation_updated',
    'xp_account',
    v_account.id::text,
    jsonb_build_object(
      'beforeName', v_before.name,
      'afterName', v_account.name,
      'shortLabel', v_account.short_label,
      'displayFormat', v_account.display_format,
      'status', v_account.status
    )
  );
  return v_account;
end;
$$;

create or replace function public.admin_update_platform_xp_account_controls(
  p_xp_account_id uuid,
  p_accounting_currency text,
  p_accounting_value_per_unit numeric,
  p_issuance_period_days integer,
  p_issuance_cap_per_period integer,
  p_issuance_cap_per_user integer,
  p_funded_reward_budget numeric default null,
  p_exposure_warning_threshold numeric default null,
  p_exposure_hard_threshold numeric default null
)
returns public.xp_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_currency text := nullif(upper(btrim(coalesce(p_accounting_currency, ''))), '');
  v_before public.xp_accounts%rowtype;
  v_account public.xp_accounts%rowtype;
begin
  if v_actor_id is null or not public.current_user_can_manage_platform_catalog() then
    raise exception 'Platform Catalog manager access required.' using errcode = '42501';
  end if;
  select * into v_before
  from public.xp_accounts
  where id = p_xp_account_id and scope = 'platform' and organization_id is null
  for update;
  if not found then raise exception 'Platform XP account not found.'; end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Accounting currency must be a three-letter ISO currency code.';
  end if;
  if p_accounting_value_per_unit is null or p_accounting_value_per_unit < 0 then
    raise exception 'Accounting value per unit is required.';
  end if;
  if p_issuance_period_days is null or p_issuance_period_days <= 0 then
    raise exception 'Issuance period must be at least 1 day.';
  end if;
  if p_issuance_cap_per_period is null or p_issuance_cap_per_period < 0 then
    raise exception 'Period issuance cap is required.';
  end if;
  if p_issuance_cap_per_user is null or p_issuance_cap_per_user < 0 then
    raise exception 'Per-user issuance cap is required.';
  end if;
  if p_funded_reward_budget is not null and p_funded_reward_budget < 0 then
    raise exception 'Funded reward budget must be zero or greater.';
  end if;
  if p_exposure_warning_threshold is not null and p_exposure_warning_threshold < 0 then
    raise exception 'Exposure warning threshold must be zero or greater.';
  end if;
  if p_exposure_hard_threshold is not null and p_exposure_hard_threshold < 0 then
    raise exception 'Exposure hard threshold must be zero or greater.';
  end if;
  if p_exposure_warning_threshold is not null
    and p_exposure_hard_threshold is not null
    and p_exposure_hard_threshold < p_exposure_warning_threshold
  then
    raise exception 'Exposure hard threshold cannot be below the warning threshold.';
  end if;

  update public.xp_accounts
  set accounting_currency = v_currency,
      accounting_value_per_unit = p_accounting_value_per_unit,
      issuance_period_days = p_issuance_period_days,
      issuance_cap_per_period = p_issuance_cap_per_period,
      issuance_cap_per_user = p_issuance_cap_per_user,
      funded_reward_budget = p_funded_reward_budget,
      exposure_warning_threshold = p_exposure_warning_threshold,
      exposure_hard_threshold = p_exposure_hard_threshold,
      updated_at = now()
  where id = p_xp_account_id
  returning * into v_account;

  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'platform_xp_account_controls_updated',
    'xp_account',
    v_account.id::text,
    jsonb_build_object(
      'before', jsonb_build_object(
        'accountingCurrency', v_before.accounting_currency,
        'accountingValuePerUnit', v_before.accounting_value_per_unit,
        'issuancePeriodDays', v_before.issuance_period_days,
        'issuanceCapPerPeriod', v_before.issuance_cap_per_period,
        'issuanceCapPerUser', v_before.issuance_cap_per_user
      ),
      'after', jsonb_build_object(
        'accountingCurrency', v_account.accounting_currency,
        'accountingValuePerUnit', v_account.accounting_value_per_unit,
        'issuancePeriodDays', v_account.issuance_period_days,
        'issuanceCapPerPeriod', v_account.issuance_cap_per_period,
        'issuanceCapPerUser', v_account.issuance_cap_per_user
      )
    )
  );
  return v_account;
end;
$$;

create or replace function public.admin_adjust_platform_xp_account(
  p_xp_account_id uuid,
  p_target_user_id uuid,
  p_amount integer,
  p_direction public.xp_direction,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_account public.xp_accounts%rowtype;
  v_transaction_id uuid;
  v_source_id text := gen_random_uuid()::text;
  v_local_date date := (now() at time zone 'Africa/Lagos')::date;
  v_daily_limit integer := 500;
  v_granted_today integer := 0;
begin
  if v_actor_id is null or not public.current_user_can_manage_platform_catalog() then
    raise exception 'Platform Catalog manager access required.' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'A positive adjustment amount and target learner are required.';
  end if;
  if p_direction not in ('earn', 'spend') then raise exception 'Adjustment direction is invalid.'; end if;
  select * into v_account
  from public.xp_accounts
  where id = p_xp_account_id and scope = 'platform' and organization_id is null and status = 'active'
  for update;
  if not found then raise exception 'Active platform XP account not found.'; end if;
  if not exists(select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'Target learner not found.';
  end if;

  if p_direction = 'earn' then
    perform pg_advisory_xact_lock(
      hashtextextended(v_actor_id::text || ':platform_manual_xp:' || v_local_date::text, 0)
    );
    v_daily_limit := private.resolve_manual_grant_daily_limit(null);
    select coalesce(sum(transaction.amount), 0) into v_granted_today
    from public.xp_transactions transaction
    where transaction.xp_account_id = v_account.id
      and transaction.direction = 'earn'
      and transaction.source_type = 'adjustment'
      and transaction.metadata ->> 'adjustedBy' = v_actor_id::text
      and (transaction.created_at at time zone 'Africa/Lagos')::date = v_local_date;
    if v_granted_today + p_amount > v_daily_limit then
      raise exception 'Daily admin grant limit reached. % XP remaining today.',
        greatest(v_daily_limit - v_granted_today, 0);
    end if;
  end if;

  v_transaction_id := private.post_xp_transaction(
    p_target_user_id,
    v_account.id,
    p_direction,
    p_amount,
    'adjustment',
    v_source_id,
    'admin_adjustment:' || v_source_id,
    jsonb_build_object(
      'kind', 'admin_manual_grant',
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'organizationId', null,
      'xpAccountId', v_account.id,
      'adjustedBy', v_actor_id,
      'localDate', v_local_date
    )
  );
  insert into public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor_id,
    'platform_xp_account_adjusted',
    'xp_account',
    v_account.id::text,
    jsonb_build_object(
      'targetUserId', p_target_user_id,
      'amount', p_amount,
      'direction', p_direction,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'transactionId', v_transaction_id,
      'dailyLimit', case when p_direction = 'earn' then v_daily_limit else null end
    )
  );
  return jsonb_build_object(
    'transactionId', v_transaction_id,
    'xpAccountId', v_account.id,
    'dailyLimit', case when p_direction = 'earn' then v_daily_limit else null end,
    'remainingToday', case when p_direction = 'earn'
      then greatest(v_daily_limit - v_granted_today - p_amount, 0)
      else null
    end
  );
end;
$$;

revoke execute on function public.admin_update_platform_xp_account_presentation(uuid, text, text, text, text, text, public.xp_account_status)
  from public, anon;
grant execute on function public.admin_update_platform_xp_account_presentation(uuid, text, text, text, text, text, public.xp_account_status)
  to authenticated, service_role;
revoke execute on function public.admin_update_platform_xp_account_controls(uuid, text, numeric, integer, integer, integer, numeric, numeric, numeric)
  from public, anon;
grant execute on function public.admin_update_platform_xp_account_controls(uuid, text, numeric, integer, integer, integer, numeric, numeric, numeric)
  to authenticated, service_role;
revoke execute on function public.admin_adjust_platform_xp_account(uuid, uuid, integer, public.xp_direction, text)
  from public, anon;
grant execute on function public.admin_adjust_platform_xp_account(uuid, uuid, integer, public.xp_direction, text)
  to authenticated, service_role;

-- Catalog operators may resolve participant identity only when that user is
-- already present in a catalog ledger, redemption, or public-proof workflow.
drop policy if exists "Platform catalog operators can read catalog participants" on public.profiles;
create policy "Platform catalog operators can read catalog participants"
  on public.profiles for select
  using (
    public.current_user_has_platform_catalog_role(
      array['organisation_owner','organisation_admin','programme_manager','reviewer']::public.organization_role_key[]
    )
    and (
      exists (
        select 1
        from public.reward_redemptions redemption
        join public.rewards reward on reward.id = redemption.reward_id
        where redemption.user_id = profiles.id and reward.organization_id is null
      )
      or exists (
        select 1 from public.mission_proofs proof
        where proof.user_id = profiles.id and proof.organization_id is null
      )
      or exists (
        select 1
        from public.xp_transactions transaction
        join public.xp_accounts account on account.id = transaction.xp_account_id
        where transaction.user_id = profiles.id and account.scope = 'platform'
      )
    )
  );

update private.rpc_security_classifications
set intended_callers = 'Platform administrators, scoped organisation managers, and Platform Catalog staff operating on catalog-owned records.',
    authorization_rule = 'Catalog roles are accepted only for organization_id-null platform content; organisation records remain tenant-scoped and platform administrators retain cross-scope access.',
    reviewed_at = now()
where function_schema = 'public'
  and function_name = any(array[
    'admin_adjust_reward_quantity',
    'admin_create_reward',
    'admin_set_reward_enabled',
    'admin_update_reward',
    'admin_upsert_perk_bundle_prize',
    'admin_delete_perk_bundle_prize',
    'admin_assign_reward_stock_to_perk_prize',
    'admin_release_reward_stock_from_perk_prize',
    'admin_upsert_perk_prize_release_bucket',
    'admin_delete_perk_prize_release_bucket',
    'admin_reward_assignment_counts',
    'admin_perk_prize_assignment_counts',
    'admin_upsert_campaign',
    'admin_set_mission_status',
    'admin_review_mission_proof_submission',
    'admin_create_organization_assessment_revision',
    'admin_publish_organization_assessment_version',
    'admin_update_organization_assessment_overview',
    'admin_upsert_organization_assessment_question',
    'admin_delete_organization_assessment_question',
    'admin_reset_ai_course_tree',
    'admin_reset_ai_course_media',
    'admin_duplicate_course_template'
  ]);

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
    'admin_set_reward_campaign_enabled',
    'p_campaign_id text, p_is_enabled boolean',
    'ADMIN_AUTHENTICATED',
    'Platform administrators and Platform Catalog reward managers changing a reward campaign and its platform rewards in one set-wise operation.',
    'Requires a platform administrator or a Platform Catalog owner/admin/programme-manager; Catalog callers update only organization_id-null rewards.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_platform_xp_account_presentation',
    'p_xp_account_id uuid, p_display_name text, p_display_name_plural text, p_short_label text, p_icon text, p_display_format text, p_status xp_account_status',
    'ADMIN_AUTHENTICATED',
    'Platform Catalog owners/admins configuring the platform Points presentation.',
    'Requires current_user_can_manage_platform_catalog() and an organization_id-null platform XP account.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_update_platform_xp_account_controls',
    'p_xp_account_id uuid, p_accounting_currency text, p_accounting_value_per_unit numeric, p_issuance_period_days integer, p_issuance_cap_per_period integer, p_issuance_cap_per_user integer, p_funded_reward_budget numeric, p_exposure_warning_threshold numeric, p_exposure_hard_threshold numeric',
    'ADMIN_AUTHENTICATED',
    'Platform Catalog owners/admins configuring platform Points issuance and exposure controls.',
    'Requires current_user_can_manage_platform_catalog() and an organization_id-null platform XP account.',
    array['authenticated', 'service_role']
  ),
  (
    'public',
    'admin_adjust_platform_xp_account',
    'p_xp_account_id uuid, p_target_user_id uuid, p_amount integer, p_direction xp_direction, p_reason text',
    'ADMIN_AUTHENTICATED',
    'Platform Catalog owners/admins making audited manual platform Points adjustments.',
    'Requires current_user_can_manage_platform_catalog(), an active platform XP account, an existing learner, and the configured per-actor Lagos-day grant cap.',
    array['authenticated', 'service_role']
  )
on conflict (function_schema, function_name, identity_arguments) do update
set classification = excluded.classification,
    intended_callers = excluded.intended_callers,
    authorization_rule = excluded.authorization_rule,
    execute_roles = excluded.execute_roles,
    reviewed_at = now();
