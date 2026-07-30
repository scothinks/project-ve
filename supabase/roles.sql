do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'cli_login_postgres'
  ) then
    create role cli_login_postgres login;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
