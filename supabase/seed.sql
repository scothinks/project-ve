insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '5a28de43-2bb3-46f0-8566-9fcc07dbf042',
    'authenticated',
    'authenticated',
    'pgtap-learner@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '4b583f53-ae5d-4014-912e-ea7eaee43a5b',
    'authenticated',
    'authenticated',
    'pgtap-admin@example.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set email = excluded.email,
    aud = excluded.aud,
    role = excluded.role,
    email_confirmed_at = excluded.email_confirmed_at,
    updated_at = now();

insert into public.profiles (
  id,
  display_name,
  xp,
  xp_balance_cached,
  role
)
values
  (
    '5a28de43-2bb3-46f0-8566-9fcc07dbf042',
    'Local pgTAP Learner',
    0,
    0,
    'learner'
  ),
  (
    '4b583f53-ae5d-4014-912e-ea7eaee43a5b',
    'Local pgTAP Admin',
    0,
    0,
    'admin'
  )
on conflict (id) do update
set display_name = excluded.display_name,
    xp = excluded.xp,
    xp_balance_cached = excluded.xp_balance_cached,
    role = excluded.role,
    updated_at = now();
