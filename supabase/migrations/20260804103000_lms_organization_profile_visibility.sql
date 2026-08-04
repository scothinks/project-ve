drop policy if exists "Organization audience staff can read member profiles" on public.profiles;
create policy "Organization audience staff can read member profiles"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.organization_memberships membership
      where membership.user_id = profiles.id
        and membership.status = 'active'
        and public.current_user_can_read_organization_audience(membership.organization_id)
    )
  );

comment on policy "Organization audience staff can read member profiles" on public.profiles is
  'Allows contextual organisation audience staff to resolve display names for active organisation members without granting global profile visibility.';
