create table if not exists public.static_content_pages (
  slug text primary key,
  title text not null,
  subtitle text,
  body text not null default '',
  faq_items jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists static_content_pages_set_updated_at on public.static_content_pages;
create trigger static_content_pages_set_updated_at
  before update on public.static_content_pages
  for each row execute function public.set_updated_at();

alter table public.static_content_pages enable row level security;

drop policy if exists "Published static content pages are readable" on public.static_content_pages;
create policy "Published static content pages are readable"
  on public.static_content_pages for select
  using (
    is_published
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can insert static content pages" on public.static_content_pages;
create policy "Admins can insert static content pages"
  on public.static_content_pages for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update static content pages" on public.static_content_pages;
create policy "Admins can update static content pages"
  on public.static_content_pages for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

insert into public.static_content_pages (slug, title, subtitle, faq_items, body, is_published)
values
  (
    'faq',
    'Frequently asked questions',
    'Quick answers about lessons, XP, rewards, and missions.',
    '[
      {"question":"How do I earn XP?","answer":"You earn XP by answering quiz questions correctly and by completing valid missions."},
      {"question":"Why can''t I earn quiz XP right now?","answer":"You may have reached your daily quiz XP limit. You can keep reading lessons and return when quiz XP unlocks again."},
      {"question":"Can I repeat a lesson?","answer":"Yes. Some lessons allow retries right away, while others require a reread or cooldown before more XP can be earned."},
      {"question":"Where do I use my XP?","answer":"Open the XP Store to redeem eligible rewards or unlock a surprise perk."},
      {"question":"How do missions work?","answer":"Missions reward extra XP for validated actions like finishing learning tasks, referrals, or approved proof submissions."}
    ]'::jsonb,
    '',
    true
  ),
  (
    'terms',
    'Terms',
    'The rules for using Project VE.',
    '[]'::jsonb,
    'Project VE is a learning product. We may change lessons, rewards, missions, or XP rules when needed to protect fairness, prevent abuse, or improve the experience.

You are responsible for using accurate account information. Rewards, mission approvals, and XP grants may be paused, reversed, or cancelled if we detect abuse, duplicate accounts, or misleading submissions.

Some rewards are fulfilled by third parties. When that applies, your reward details may be shared only as needed to complete the redemption process.

XP has no cash value. We may set caps, cooldowns, retry rules, or reward limits to protect the system and keep access fair.

By continuing to use Project VE, you agree to these rules and any future updates shown in the app.',
    true
  )
on conflict (slug) do nothing;
