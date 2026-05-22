# Project VE

Project VE is a civic learning platform built with Next.js and Supabase. It combines short-form lessons, quizzes, XP, missions, referrals, reward redemptions, and an admin console for content and operations.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase auth, database, and server-side RPCs
- Render deployment via `render.yaml`

## Product Surface

Learner-facing:

- Course library and course detail pages
- Lesson and quiz flows
- XP dashboard and profile
- Missions, proof submission, and referrals
- XP Store and redemption history
- Static support, FAQ, privacy, and terms pages

Admin-facing:

- Courses and lesson content management
- Missions and proof review
- Rewards, redemptions, inventory, and perk bundles
- Campaigns and recommendation sections
- XP ledger and XP settings
- User review tools

## Key Directories

- [app](/Users/scoteritemu/Nu-Project-VE/app) - routes, server actions, API endpoints
- [components](/Users/scoteritemu/Nu-Project-VE/components) - learner and admin UI
- [lib](/Users/scoteritemu/Nu-Project-VE/lib) - Supabase integrations, domain logic, seed/demo data
- [supabase/migrations](/Users/scoteritemu/Nu-Project-VE/supabase/migrations) - database schema and RPC history
- [render.yaml](/Users/scoteritemu/Nu-Project-VE/render.yaml) - Render Blueprint config

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env config:

```bash
cp .env.example .env.local
```

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## Environment Variables

Defined in [.env.example](/Users/scoteritemu/Nu-Project-VE/.env.example):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `FRAUD_HASH_SALT`

## Supabase

This project now depends on Supabase for authenticated writes and admin operations.

- Read-only browsing can still fall back to seeded/demo content in some places.
- Write routes do not use demo fallbacks anymore.
- Mission proof review, reward redemption, referrals, quiz attempts, and lesson progress all expect a live Supabase backend.

Apply the SQL migrations in order from [supabase/migrations](/Users/scoteritemu/Nu-Project-VE/supabase/migrations). The consolidated schema snapshot is available at [supabase/schema.sql](/Users/scoteritemu/Nu-Project-VE/supabase/schema.sql), but the migration history is the source of truth.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Deployment

The repo includes [render.yaml](/Users/scoteritemu/Nu-Project-VE/render.yaml) for Render deployment.

Expected build/start flow:

```bash
npm install
npm run build
npm run start
```
