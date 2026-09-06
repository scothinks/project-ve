-- Rebind the deployed invitation SELECT policy to the public authorization
-- boundary. Some hosted environments retained the original inline policy,
-- which called the deliberately private authenticated-email helper directly
-- even after the boundary function itself had been repaired.

drop policy if exists "Participants can read platform catalog invitations"
  on public.platform_catalog_invitations;

create policy "Participants can read platform catalog invitations"
  on public.platform_catalog_invitations for select
  using (public.current_user_can_read_platform_catalog_invitation(id));

comment on policy "Participants can read platform catalog invitations"
  on public.platform_catalog_invitations is
  'Allows Catalog managers and the invited participant to read invitations through the public security-definer authorization boundary.';

notify pgrst, 'reload schema';
