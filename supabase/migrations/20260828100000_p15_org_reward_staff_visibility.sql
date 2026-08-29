-- P15-UI-001: organisation staff need to see their own organisation's rewards
-- (including perk bundles) — including drafts — the same way they can
-- already see their own missions and mission proofs. Additive only: the
-- existing platform-admin and public "published" policies are untouched.

drop policy if exists "Organization staff can read organization rewards" on public.rewards;
create policy "Organization staff can read organization rewards"
  on public.rewards for select
  using (
    organization_id is not null
    and public.current_user_has_organization_role(
      organization_id,
      array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
    )
  );

drop policy if exists "Organization staff can read organization perk prizes" on public.perk_bundle_prizes;
create policy "Organization staff can read organization perk prizes"
  on public.perk_bundle_prizes for select
  using (
    exists (
      select 1
      from public.rewards bundle_reward
      where bundle_reward.id = perk_bundle_prizes.bundle_reward_id
        and bundle_reward.organization_id is not null
        and public.current_user_has_organization_role(
          bundle_reward.organization_id,
          array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
        )
    )
  );

drop policy if exists "Organization staff can read organization perk draws" on public.perk_bundle_draws;
create policy "Organization staff can read organization perk draws"
  on public.perk_bundle_draws for select
  using (
    exists (
      select 1
      from public.rewards bundle_reward
      where bundle_reward.id = perk_bundle_draws.bundle_reward_id
        and bundle_reward.organization_id is not null
        and public.current_user_has_organization_role(
          bundle_reward.organization_id,
          array['organisation_owner', 'organisation_admin', 'programme_manager']::public.organization_role_key[]
        )
    )
  );
