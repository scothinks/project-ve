# Project VE

Project VE is a learning platform built with Next.js and Supabase. It combines short lessons, scored quizzes, XP, missions, referrals, rewards, notifications, onboarding assessment, and an admin console for content and operations.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase auth, database, RLS, and RPCs
- Vercel deployment with Vercel Cron

## Current Product Shape

Learner-facing:

- Welcome flow with post-signup `Values Starter Check`
- Personalized dashboard recommendations for lessons, courses, and missions
- Course library and course detail pages
- Lesson and quiz flows
- XP balance, profile, and notification settings
- Missions, proof submission, and referrals
- XP store, rewards, and redemption history
- Support, FAQ, privacy, and terms pages

Admin-facing:

- Course, lesson, page, block, and quiz management
- AI-assisted course and media workflow
- Mission creation and proof review
- Reward, redemption, inventory, and perk management
- Recommendation curation and content value tagging
- XP settings, XP review, and user operations

## Major Systems

### Values Starter Check

First-time learners are routed through a short onboarding assessment before the dashboard.

- Assessment schema and seed data live in [supabase/migrations](supabase/migrations)
- App flow starts at [app/onboarding/assessment/page.tsx](app/onboarding/assessment/page.tsx)
- Completion is handled by [app/onboarding/assessment/actions.ts](app/onboarding/assessment/actions.ts)
- Shared helpers live in [lib/values-assessment.ts](lib/values-assessment.ts)

### Personalized Recommendations

The dashboard now blends:

- editorial/global recommendation sections
- learner value profile
- content-to-dimension tags

The current recommendation helper lives in [lib/personalized-recommendations.ts](lib/personalized-recommendations.ts). Content tags are managed through the admin UI and stored in `content_value_tags`.

### Notifications

Notifications use an inbox-first model with optional web push.

- inbox, preferences, subscriptions, and push delivery tables are defined in Supabase migrations
- in-app inbox and settings live in the app UI
- web push dispatch runs through [app/api/notifications/dispatch/route.ts](app/api/notifications/dispatch/route.ts)
- device subscription capture runs through [app/api/notifications/push-subscription/route.ts](app/api/notifications/push-subscription/route.ts)

### Learning and XP

- learner XP from lessons is derived from quiz question XP
- course XP is the sum of lesson quiz XP
- lesson and quiz publish state must stay aligned for learner-facing XP to surface correctly

### AI Course Workflow

The repo includes an AI-assisted course generation and media workflow for admins. That flow is already implemented and should be preserved when making adjacent product changes.

## Key Directories

- [app](app) - routes, server actions, and API endpoints
- [components](components) - learner and admin UI
- [lib](lib) - Supabase integrations, domain logic, mapping helpers, and seed/demo data
- [supabase/migrations](supabase/migrations) - migration history and RPC definitions
- [vercel.json](vercel.json) - Vercel Cron config

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env config:

```bash
cp .env.example .env.local
```

3. Start/reset Supabase from migrations, or apply migrations to your linked project.

See [docs/database.md](docs/database.md) for
the local reset, type generation, and DB test workflow.

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Environment Variables

Defined in [.env.example](.env.example):

- `APP_MODE`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `FRAUD_HASH_SALT`
- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL`
- `OPENAI_TEXT_MODEL`
- `OPENAI_REVIEW_MODEL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`
- `CRON_SECRET`
- `AI_GENERATION_WORKER_SECRET`
- `NOTIFICATION_DISPATCH_SECRET`
- `NOTIFICATION_DISPATCH_LIMIT`

## Supabase Notes

This app depends on Supabase for authenticated learner progress, admin operations, notifications, assessment, referrals, rewards, and quiz XP.

- `APP_MODE=live` uses Supabase-backed repositories and does not silently serve demo learner XP or progress
- `APP_MODE=demo` uses explicit demo repositories for local product exploration without Supabase
- authenticated write flows do not rely on demo fallbacks
- migration history in [supabase/migrations](supabase/migrations) is the source of truth
- do not use or recreate a hand-maintained `supabase/schema.sql`

If learner-facing data looks inconsistent with admin totals, check publication state first. A common example is published lesson content with a quiz that is still in draft, which suppresses learner XP until the quiz is also published.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Deployment

The app is currently shaped for Vercel deployment.

- cron config lives in [vercel.json](vercel.json)
- the current cron calls `/api/notifications/dispatch` and `/api/admin/ai/jobs/process`
- on Vercel Hobby, the schedule must remain daily-compatible

Typical build flow:

```bash
npm install
npm run build
npm run start
```
