update public.courses
set
  slug = 'everyday-civic-values',
  title = 'Everyday Civic Values',
  description = 'Build simple habits for fairness, respect, honesty, and responsibility in daily life.',
  category = 'Values Education',
  thumbnail = '{"src":"https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80","alt":"A group of people sitting together in conversation"}',
  estimated_minutes = 35
where id = 'course-money-basics';

update public.courses
set
  slug = 'community-responsibility',
  title = 'Community Responsibility',
  description = 'Learn how truthful sharing, calm verification, and public-minded action protect trust.',
  category = 'Civic Responsibility',
  thumbnail = '{"src":"https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=900&q=80","alt":"Community volunteers standing together"}',
  estimated_minutes = 22
where id = 'course-digital-safety';

update public.lessons
set
  slug = 'fair-everyday-choices',
  title = 'Make Fair Everyday Choices',
  description = 'Use fairness to guide small decisions before they become big issues.',
  cover_image = '{"src":"https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80","alt":"People gathered around a table writing notes"}'
where id = 'lesson-starter-budget';

update public.lessons
set
  slug = 'respect-for-a-week',
  title = 'Practice Respect for a Week',
  description = 'Notice how respect shows up in speech, time, space, and disagreement.',
  cover_image = '{"src":"https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80","alt":"People learning together around a table"}'
where id = 'lesson-track-spending';

update public.lessons
set
  slug = 'check-rumors-before-sharing',
  title = 'Check Rumors Before Sharing',
  description = 'Pause, verify, and share responsibly when information affects others.',
  cover_image = '{"src":"https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=900&q=80","alt":"Newspapers and a phone on a table"}'
where id = 'lesson-avoid-scams';

update public.lesson_pages
set title = 'Start with fairness you can practice',
    subtitle = 'Small choices show respect before big moments test it.'
where id = 'page-budget-primer';

update public.lesson_pages
set title = 'Balance your needs with others',
    subtitle = 'Fairness considers your needs and the effect on people around you.'
where id = 'page-needs-wants';

update public.lesson_pages
set title = 'Pause, choose, explain',
    subtitle = null
where id = 'page-budget-summary';

update public.lesson_pages
set title = 'Notice respect in small moments',
    subtitle = 'Respect is easier to build when you can see it.'
where id = 'page-track-primer';

update public.lesson_pages
set title = 'Use a simple respect log',
    subtitle = 'Keep the habit small enough to repeat.'
where id = 'page-track-method';

update public.lesson_pages
set title = 'Look for respect patterns',
    subtitle = null
where id = 'page-track-summary';

update public.lesson_pages
set title = 'Pressure is a sharing warning sign',
    subtitle = 'Rumors often spread because people feel pushed to react quickly.'
where id = 'page-scam-pressure';

update public.lesson_pages
set title = 'Run a quick truth check',
    subtitle = 'Verify the source before you trust or share the message.',
    cover_image = '{"src":"https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=900&q=80","alt":"A laptop showing research and verification work"}'
where id = 'page-scam-checks';

update public.lesson_pages
set title = 'Pause, verify, then share',
    subtitle = null
where id = 'page-scam-summary';

update public.quizzes
set title = 'Fair Choices Quiz', version = version + 1
where id = 'quiz-starter-budget';

update public.quizzes
set title = 'Respect Practice Quiz', version = version + 1
where id = 'quiz-track-spending';

update public.quizzes
set title = 'Responsible Sharing Quiz', version = version + 1
where id = 'quiz-avoid-scams';

update public.quiz_questions
set
  prompt = 'What is the main purpose of practicing fairness in everyday choices?',
  explanation = 'Fairness asks you to consider how your choice affects other people.'
where id = 'q-budget-purpose';

update public.quiz_questions
set
  prompt = 'Which actions show fairness?',
  explanation = 'Fairness includes patience, listening, and respect for shared rules.'
where id = 'q-budget-needs';

update public.quiz_questions
set
  prompt = 'True or false: a fair choice can still consider your own needs.',
  explanation = 'Fairness balances your needs with the effect your action has on others.'
where id = 'q-budget-flex';

update public.quiz_questions
set
  prompt = 'What should you do first when a choice affects other people?',
  explanation = 'A short pause helps you choose with care instead of reacting selfishly.'
where id = 'q-budget-first-step';

update public.quiz_questions
set
  prompt = 'What is the first goal of keeping a respect log?',
  explanation = 'Awareness helps you notice patterns before choosing what to improve.'
where id = 'q-track-first-goal';

update public.quiz_questions
set
  prompt = 'Which details should you capture in a simple respect log?',
  explanation = 'A useful respect log tracks the situation, the action, and the lesson.'
where id = 'q-track-details';

update public.quiz_questions
set
  prompt = 'True or false: the first week of a respect log is mainly for judging yourself.',
  explanation = 'The first week is for awareness. You can choose one small improvement after you see the pattern.'
where id = 'q-track-judgement';

update public.quiz_questions
set
  prompt = 'What should you do when a public message pressures you to share immediately?',
  explanation = 'Urgency can be used to spread false or harmful information.'
where id = 'q-scam-pressure';

update public.quiz_questions
set
  prompt = 'Which checks should you make before sharing civic information?',
  explanation = 'Responsible sharing checks source, confirmation, and possible harm.'
where id = 'q-scam-private-info';

update public.quiz_questions
set
  prompt = 'What is the safest way to verify a rumor about a community issue?',
  explanation = 'Trusted sources are safer than popularity, pressure, or emotion.'
where id = 'q-scam-verify';

update public.quiz_questions
set
  prompt = 'True or false: urgent language can be a warning sign in public messages.',
  explanation = 'Urgency can stop people from checking carefully before sharing.'
where id = 'q-scam-urgency';

update public.quiz_options set label = 'To make choices that consider both you and others' where id = 'q-budget-purpose-a';
update public.quiz_options set label = 'To make sure you always get your way' where id = 'q-budget-purpose-b';
update public.quiz_options set label = 'To avoid explaining your actions' where id = 'q-budget-purpose-c';
update public.quiz_options set label = 'Waiting your turn' where id = 'q-budget-needs-a';
update public.quiz_options set label = 'Listening before judging' where id = 'q-budget-needs-b';
update public.quiz_options set label = 'Taking a shortcut that blocks others' where id = 'q-budget-needs-c';
update public.quiz_options set label = 'Pause and think about who is affected' where id = 'q-budget-first-step-a';
update public.quiz_options set label = 'Act quickly before anyone complains' where id = 'q-budget-first-step-b';
update public.quiz_options set label = 'Blame someone else if it goes wrong' where id = 'q-budget-first-step-c';
update public.quiz_options set label = 'The situation' where id = 'q-track-details-a';
update public.quiz_options set label = 'The respectful action' where id = 'q-track-details-b';
update public.quiz_options set label = 'What you learned' where id = 'q-track-details-c';
update public.quiz_options set label = 'Private gossip about the person' where id = 'q-track-details-d';
update public.quiz_options set label = 'Forward it before checking' where id = 'q-scam-pressure-b';
update public.quiz_options set label = 'Add an angry caption to make it spread faster' where id = 'q-scam-pressure-c';
update public.quiz_options set label = 'Check the source' where id = 'q-scam-private-info-a';
update public.quiz_options set label = 'Look for confirmation from another reliable source' where id = 'q-scam-private-info-b';
update public.quiz_options set label = 'Consider who could be harmed' where id = 'q-scam-private-info-c';
update public.quiz_options set label = 'Share it if it matches your anger' where id = 'q-scam-private-info-d';
update public.quiz_options set label = 'Check trusted sources or people directly connected to the issue' where id = 'q-scam-verify-a';
update public.quiz_options set label = 'Trust it because many people are sharing it' where id = 'q-scam-verify-b';
update public.quiz_options set label = 'Share first and correct it later if needed' where id = 'q-scam-verify-c';

update public.missions
set title = 'Finish Fair Choices',
    description = 'Complete the fair choices lesson and its quiz.'
where id = 'mission-complete-starter-budget';

update public.missions
set title = 'Complete Everyday Civic Values',
    description = 'Finish every lesson in the Everyday Civic Values course.'
where id = 'mission-complete-money-basics';
