insert into public.missions (
  id,
  title,
  description,
  category,
  reward_xp,
  repeatability,
  validation_type,
  validation_config,
  status,
  sort_order
)
values
  (
    'mission-complete-starter-budget',
    'Finish Starter Budget',
    'Complete the starter budget lesson and its quiz.',
    'course',
    25,
    'once',
    'lesson_completed',
    '{"lessonId":"lesson-starter-budget"}',
    'published',
    1
  ),
  (
    'mission-complete-money-basics',
    'Complete Money Basics',
    'Finish every lesson in the Money Basics course.',
    'course',
    150,
    'once',
    'course_completed',
    '{"courseId":"course-money-basics"}',
    'published',
    2
  ),
  (
    'mission-two-lessons-week',
    'Two Lessons This Week',
    'Complete any 2 lessons within 7 days.',
    'campaign',
    75,
    'weekly',
    'lesson_count_completed',
    '{"count":2,"withinDays":7}',
    'published',
    3
  ),
  (
    'mission-referral-learner',
    'Bring a Learning Friend',
    'Invite a friend who completes at least 2 lessons.',
    'referral',
    100,
    'per_referral',
    'referral_friend_completed_lessons',
    '{"requiredFriendLessonCount":2}',
    'published',
    4
  ),
  (
    'mission-local-feedback',
    'Civic Feedback Proof',
    'Engage your local government chairman and submit proof.',
    'feedback',
    200,
    'campaign',
    'proof_upload',
    '{"requiredFields":["text","image"],"requiresManualReview":true}',
    'published',
    5
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  reward_xp = excluded.reward_xp,
  repeatability = excluded.repeatability,
  validation_type = excluded.validation_type,
  validation_config = excluded.validation_config,
  status = excluded.status,
  sort_order = excluded.sort_order;
