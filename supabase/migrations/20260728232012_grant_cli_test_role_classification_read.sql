drop policy if exists "cli test role can read all classifications" on private.rpc_security_classifications;

create policy "cli test role can read all classifications"
  on private.rpc_security_classifications
  for select
  to cli_login_postgres
  using (true);
