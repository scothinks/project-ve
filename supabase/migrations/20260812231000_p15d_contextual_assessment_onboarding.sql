create or replace function public.complete_values_assessment(
  p_assessment_version_id uuid,
  p_answers jsonb,
  p_programme_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_attempt_id uuid;
  v_account_id uuid := '00000000-0000-4000-8000-00000000e001'::uuid;
  v_had_public_profile boolean := false;
  v_public_profile public.user_value_profiles%rowtype;
  v_public_scores jsonb := '[]'::jsonb;
begin
  if p_programme_id is not null then
    v_account_id := private.resolve_programme_xp_account(
      v_user_id, p_programme_id, 'assessment', p_assessment_version_id::text
    );
    perform set_config('app.xp_account_id', v_account_id::text, true);
    perform set_config('app.xp_programme_id', p_programme_id::text, true);

    select exists (
      select 1 from public.user_value_profiles where user_id = v_user_id
    ) into v_had_public_profile;

    if v_had_public_profile then
      select *
        into v_public_profile
      from public.user_value_profiles
      where user_id = v_user_id;
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'dimension_id', dimension_id,
          'score', score,
          'confidence', confidence,
          'updated_at', updated_at
        )
        order by dimension_id
      ),
      '[]'::jsonb
    )
      into v_public_scores
    from public.user_value_dimension_scores
    where user_id = v_user_id;
  end if;

  begin
    v_result := public.complete_values_assessment_legacy(p_assessment_version_id, p_answers);
  exception when others then
    perform set_config('app.xp_account_id', '', true);
    perform set_config('app.xp_programme_id', '', true);
    raise;
  end;

  v_attempt_id := nullif(v_result ->> 'attempt_id', '')::uuid;
  if v_attempt_id is not null then
    update public.user_assessment_attempts
    set programme_id = p_programme_id,
        xp_account_id = v_account_id
    where id = v_attempt_id and user_id = v_user_id;
  end if;

  if p_programme_id is not null then
    delete from public.user_value_dimension_scores
    where user_id = v_user_id;

    insert into public.user_value_dimension_scores (
      user_id,
      dimension_id,
      score,
      confidence,
      updated_at
    )
    select
      v_user_id,
      restored.dimension_id,
      restored.score,
      restored.confidence,
      restored.updated_at
    from jsonb_to_recordset(v_public_scores) as restored(
      dimension_id text,
      score numeric,
      confidence numeric,
      updated_at timestamptz
    );

    if v_had_public_profile then
      delete from public.user_value_profiles
      where user_id = v_user_id;

      insert into public.user_value_profiles (
        user_id,
        latest_attempt_id,
        assessment_version_id,
        assessment_completed_at,
        readiness_level,
        primary_dimension_id,
        secondary_dimension_id,
        profile_summary,
        updated_at
      ) values (
        v_public_profile.user_id,
        v_public_profile.latest_attempt_id,
        v_public_profile.assessment_version_id,
        v_public_profile.assessment_completed_at,
        v_public_profile.readiness_level,
        v_public_profile.primary_dimension_id,
        v_public_profile.secondary_dimension_id,
        v_public_profile.profile_summary,
        v_public_profile.updated_at
      );
    else
      delete from public.user_value_profiles
      where user_id = v_user_id;
    end if;
  end if;

  perform set_config('app.xp_account_id', '', true);
  perform set_config('app.xp_programme_id', '', true);
  return v_result || jsonb_build_object('programme_id', p_programme_id, 'xp_account_id', v_account_id);
end;
$$;

revoke execute on function public.complete_values_assessment(uuid, jsonb, uuid) from public, anon;
grant execute on function public.complete_values_assessment(uuid, jsonb, uuid) to authenticated;
