create or replace function private.current_request_is_service_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), current_user, '') = 'service_role'
    or current_user = 'service_role';
$$;

revoke execute on function private.current_request_is_service_role()
  from public, anon, authenticated, service_role;
