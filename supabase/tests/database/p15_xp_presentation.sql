begin;
\ir ./_test_constants.psql
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, private;
select extensions.plan(4);

set local role service_role;
insert into public.organizations (slug, name, status, created_by)
values ('p15c-xp-presentation-org', 'P15C XP Presentation Org', 'published', :'TEST_ADMIN_USER_ID'::uuid)
on conflict (slug) do update set name = excluded.name;
select id as p15c_xp_presentation_org_id from public.organizations where slug = 'p15c-xp-presentation-org' \gset
select id as p15c_xp_presentation_account_id from public.xp_accounts where organization_id = :'p15c_xp_presentation_org_id'::uuid and is_default \gset

select extensions.is((select display_name_plural from public.xp_accounts where id = :'p15c_xp_presentation_account_id'::uuid), 'Points', 'organisation account has a learner-facing plural label');

reset role;
select set_config('request.jwt.claim.sub', :'TEST_ADMIN_USER_ID', true);
set local role authenticated;
select public.admin_update_xp_account_presentation(:'p15c_xp_presentation_account_id'::uuid, 'Police Point', 'Police Points', 'PP', 'shield', 'amount_name');

select extensions.is((select display_name_plural from public.xp_accounts where id = :'p15c_xp_presentation_account_id'::uuid), 'Police Points', 'manager can configure account labels');
select extensions.is((select short_label from public.xp_accounts where id = :'p15c_xp_presentation_account_id'::uuid), 'PP', 'manager can configure account short label');
select extensions.is((select organization_id from public.xp_accounts where id = :'p15c_xp_presentation_account_id'::uuid), :'p15c_xp_presentation_org_id'::uuid, 'presentation configuration cannot change account ownership');
select * from extensions.finish();
rollback;
