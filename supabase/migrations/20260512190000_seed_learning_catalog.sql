insert into public.courses (
  id,
  slug,
  title,
  description,
  category,
  level,
  thumbnail,
  status,
  sort_order,
  estimated_minutes
)
values
  (
    'course-money-basics',
    'money-basics',
    'Money Basics',
    'Learn how to budget, save, and make practical everyday money decisions.',
    'Values Education',
    'beginner',
    '{"src":"https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80","alt":"Notebook, calculator, and money on a desk"}',
    'published',
    1,
    35
  ),
  (
    'course-digital-safety',
    'digital-safety',
    'Digital Safety',
    'Spot suspicious messages, protect your PIN, and verify before sending money.',
    'Security',
    'beginner',
    '{"src":"https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=900&q=80","alt":"Phone security and online protection concept"}',
    'published',
    2,
    22
  )
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  level = excluded.level,
  thumbnail = excluded.thumbnail,
  status = excluded.status,
  sort_order = excluded.sort_order,
  estimated_minutes = excluded.estimated_minutes;

insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  description,
  cover_image,
  status,
  sort_order,
  estimated_minutes,
  retry_mode,
  retry_cooldown_seconds,
  retry_requires_reread,
  quiz_requires_lesson_completion,
  max_earning_attempts
)
values
  (
    'lesson-starter-budget',
    'course-money-basics',
    'starter-budget',
    'Build a Starter Budget',
    'Split income into needs, wants, savings, and flexible rewards.',
    '{"src":"https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80","alt":"Budget notes and financial paperwork"}',
    'published',
    1,
    7,
    'anytime',
    null,
    true,
    true,
    5
  ),
  (
    'lesson-track-spending',
    'course-money-basics',
    'track-spending',
    'Track Spending for a Week',
    'Find where your money goes without judging yourself.',
    '{"src":"https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=900&q=80","alt":"Person writing financial notes"}',
    'published',
    2,
    6,
    'anytime',
    null,
    true,
    true,
    5
  ),
  (
    'lesson-avoid-scams',
    'course-digital-safety',
    'avoid-scams',
    'Avoid Common Money Scams',
    'Slow down, verify links, and protect private details.',
    '{"src":"https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=900&q=80","alt":"Digital lock on a screen"}',
    'published',
    1,
    5,
    'cooldown',
    86400,
    true,
    true,
    5
  )
on conflict (id) do update set
  course_id = excluded.course_id,
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  cover_image = excluded.cover_image,
  status = excluded.status,
  sort_order = excluded.sort_order,
  estimated_minutes = excluded.estimated_minutes,
  retry_mode = excluded.retry_mode,
  retry_cooldown_seconds = excluded.retry_cooldown_seconds,
  retry_requires_reread = excluded.retry_requires_reread,
  quiz_requires_lesson_completion = excluded.quiz_requires_lesson_completion,
  max_earning_attempts = excluded.max_earning_attempts;

insert into public.lesson_pages (
  id,
  lesson_id,
  page_number,
  title,
  subtitle,
  page_type,
  cover_image
)
values
  (
    'page-budget-primer',
    'lesson-starter-budget',
    1,
    'Start with what you can control',
    'A budget gives money a job before the week gets noisy.',
    'primer',
    null
  ),
  (
    'page-needs-wants',
    'lesson-starter-budget',
    2,
    'Separate needs from wants',
    'Essentials come first, then flexible spending.',
    'concept',
    null
  ),
  (
    'page-budget-summary',
    'lesson-starter-budget',
    3,
    'Give every naira a job',
    null,
    'summary',
    null
  ),
  (
    'page-track-primer',
    'lesson-track-spending',
    1,
    'Track before you change',
    'Awareness comes before better decisions.',
    'primer',
    null
  ),
  (
    'page-track-method',
    'lesson-track-spending',
    2,
    'Use a simple spending log',
    'Keep the habit small enough to repeat.',
    'concept',
    null
  ),
  (
    'page-track-summary',
    'lesson-track-spending',
    3,
    'Look for patterns',
    null,
    'summary',
    null
  ),
  (
    'page-scam-pressure',
    'lesson-avoid-scams',
    1,
    'Pressure is a warning sign',
    'Scammers use urgency to push fast decisions.',
    'primer',
    null
  ),
  (
    'page-scam-checks',
    'lesson-avoid-scams',
    2,
    'Run a quick safety check',
    'Verify the sender before you trust the message.',
    'concept',
    '{"src":"https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=900&q=80","alt":"Code and security checks on a laptop screen"}'
  ),
  (
    'page-scam-summary',
    'lesson-avoid-scams',
    3,
    'Pause, verify, then act',
    null,
    'summary',
    null
  )
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  page_number = excluded.page_number,
  title = excluded.title,
  subtitle = excluded.subtitle,
  page_type = excluded.page_type,
  cover_image = excluded.cover_image;
