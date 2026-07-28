# Learner Responsive Layout Plan

## Objective

Make learner-facing screens work as a polished responsive web experience without losing the intentional mobile-app feel on phones.

The current learner UI is constrained by `.mobile-shell`, which caps every learner page at 430px. That is acceptable for a mobile prototype, but it makes desktop and tablet feel like a phone emulator instead of a serious education product.

## Product Principles

- Preserve the existing mobile experience materially unchanged.
- Treat desktop as a first-class learner surface, not a stretched mobile layout.
- Keep navigation predictable: bottom tabs on mobile, compact side navigation on desktop.
- Keep learning content readable with controlled line lengths.
- Use extra desktop space for hierarchy, secondary actions, progress, rewards, missions, and sponsor inventory rather than visual filler.
- Avoid route-by-route hacks; shared primitives should carry most of the responsive behavior.

## Phase 1 — Layout Foundation

- Replace fixed mobile-only shell behavior with responsive shell behavior:
  - Mobile: full-width up to 430px, centered, app-like shadow.
  - Tablet: centered, wider content canvas.
  - Desktop: full learner canvas with a reserved side-navigation rail.
- Add reusable responsive utility classes for:
  - Page body padding and bottom spacing.
  - Main content grids.
  - Card grids.
  - Readable lesson content width.
  - Desktop rail/sidebar patterns.

## Phase 2 — Navigation

- Keep `BottomNav` as bottom tabs on mobile.
- Transform the same navigation into a fixed compact side rail on desktop.
- Avoid duplicating navigation markup or route state.
- Keep active-state styling and existing labels/hrefs intact.
- Adjust `AppHeader` so desktop headers feel like page headers rather than mobile chrome.

## Phase 3 — Learner Routes

Apply responsive classes systematically to:

- Dashboard
- Course library
- Course detail
- Lesson pages
- Missions
- XP Store
- Profile, notifications, quiz/results, support/legal pages where they use the learner shell

Route-level goals:

- Dashboard: two-column desktop hierarchy with primary learning content and secondary reward/mission inventory.
- Course library: multi-column course cards on wider screens and a stable desktop filter/search area.
- Course detail: hero/course summary plus lesson list in a desktop-friendly composition.
- Lesson pages: readable content column, not an over-wide card; navigation remains clear.
- Missions and XP Store: use desktop grids instead of long single-column mobile scrolling.
- Login/auth: use a dedicated desktop auth layout rather than a centered phone-shell.

## Phase 4 — Component Responsiveness

- Update shared learner cards to respond gracefully inside multi-column grids.
- Keep images optimized with `next/image` and correct `sizes`.
- Ensure ads remain clearly labeled and render in appropriate responsive slots.
- Avoid dropping mission/reward/progress/ad functionality while changing layout.

## Phase 5 — Validation

- Run `npm run typecheck`.
- Run `npm run build`.
- Audit source for remaining learner-only `mobile-shell` usage that would still force phone-only layout.
- Confirm responsive behavior at:
  - 390px
  - 768px
  - 1024px
  - 1280px
  - 1440px

## Acceptance Criteria

- Phones still look and behave like the current mobile app.
- Desktop no longer shows learner screens as a 430px phone emulator.
- Desktop navigation is usable without requiring bottom-of-page tab behavior.
- Core learner functionality remains present:
  - Progress
  - Lessons
  - Quizzes
  - Missions
  - Rewards
  - Ads and fallback ads
  - Profile and notifications
- Build and typecheck pass.
- Final audit identifies and closes implementation gaps before completion.

## Implementation Audit

### Completed

- Added responsive shell behavior in `app/globals.css`.
- Added reusable responsive layout utilities:
  - `learner-page`
  - `learner-content-grid`
  - `learner-card-grid`
  - `learner-card-grid--dense`
  - `learner-readable`
  - `learner-compact-shell`
- Converted learner bottom navigation into mobile bottom tabs and desktop fixed side rail using the existing nav items.
- Adjusted app headers so desktop routes read as page headers rather than mobile chrome.
- Updated dashboard, course library, course detail, lesson, missions, XP Store, profile, notifications, quiz/result, support/legal, and advertise pages to use responsive layout primitives.
- Replaced the desktop login phone-shell with a dedicated split auth layout while keeping mobile compact.
- Preserved compact mobile-only treatment for onboarding, invite, and welcome flows.
- Preserved mobile ad placement on course detail while moving the desktop version into the side rail.
- Refined the desktop dashboard after visual review:
  - Added a primary learning column and secondary right rail.
  - Moved XP balance, home-feed ad, missions, and featured rewards into the desktop rail.
  - Preserved mobile ordering by keeping those surfaces inline on small screens.
  - Tightened desktop card density for course, lesson, mission, reward, and continue-learning cards.
  - Reduced the desktop canvas from 1280px to 1180px and aligned the side nav to that canvas.
- Refined the dashboard desktop composition after screenshot audit:
  - Preserved the XP balance overlap because it is now an intentional design treatment.
  - Rebalanced the primary learning column against a narrower secondary rail.
  - Reduced desktop side padding so the rail navigation and content feel connected.
  - Tightened compact mission/reward rail cards without changing mobile cards.
  - Removed the duplicate fallback hierarchy where starter-pack content appeared under an extra generic recommendation header.
- Added opt-in desktop-horizontal course and lesson card variants for dashboard learning sections:
  - Mobile cards remain stacked.
  - Course library and course-detail lesson grids keep their existing stacked card behavior.
  - Dashboard recommendation cards use image-left/content-right composition on desktop to reduce vertical drag.
- Closed screenshot gap in horizontal dashboard cards:
  - Dashboard learning lists now render as one-column lists, not two-column grids, when using horizontal cards.
  - Course cards move category, title, and XP metadata into the content side in desktop-horizontal mode.
  - The image side remains visual-only on desktop to avoid clipped overlay text.
- Added desktop width hierarchy on the dashboard:
  - Continue-learning remains the widest primary card.
  - Secondary learning recommendation lists are slightly narrower on desktop to preserve visual priority.
  - Mobile widths remain full because stacked mobile cards need the available space.
- Extended desktop horizontal learning card treatment:
  - Course library cards now use image-left/content-right layout on desktop.
  - Course library remains stacked on mobile.
  - Course detail summary image is taller on desktop to give the course hero more presence.
- Closed course-detail lesson card alignment gap:
  - Stacked lesson cards now stretch to equal row height in the course detail grid.
  - Footer timing/XP rows stay pinned to the bottom of each card.
  - The lesson metadata line beneath each card now aligns across the row.
- Added course-detail lesson pagination:
  - Course detail now paginates lessons client-side using the shared pagination controls.
  - The lessons section shows the current visible lesson range and total lesson count.
  - Desktop and mobile use the same pagination behavior; only the card layout differs by breakpoint.
- Increased lesson page cover-image prominence:
  - Mobile lesson page images are slightly taller to improve visual presence without crowding the text.
  - Desktop lesson page images are substantially taller, with `primer` and `concept` pages now using `lg:h-[16.25rem]` to match the requested 65-unit target, so the cover art reads as a proper page hero instead of a banner strip.
  - The change is applied through the shared `LessonPageLayout` page-type config for consistent behavior across lesson page variants.
- Confirmed `npm run typecheck` and `npm run build` pass.

### Breakpoint Audit

Measured in the in-app browser against local production server at `next start`.

| Width | Route | Result |
| ---: | --- | --- |
| 390px | `/courses` | Shell 390px, bottom nav sticky, one-column cards, no horizontal overflow |
| 768px | `/courses` | Shell 720px, two-column cards, bottom nav sticky, no horizontal overflow |
| 1024px | `/courses` | Shell 1024px, side nav fixed, two-column cards, no horizontal overflow |
| 1280px | `/courses` | Shell capped at 1180px, side nav fixed, three-column dense course grid |
| 1440px | `/courses` | Shell capped at 1180px and centered, side nav fixed |
| 1280px | Course detail | Main/rail grid rendered as `685px / 352px`, desktop ad rail visible, no horizontal overflow |
| 390px | Course detail | Desktop rail hidden, mobile inline ad visible, no horizontal overflow |
| 1280px | Lesson page | Readable content width capped at 768px, no horizontal overflow |
| 390px | `/login` | Compact single-column mobile auth layout |
| 1024–1440px | `/login` | Dedicated desktop split auth layout with `Learn, Earn, Spend.` brand/value panel and centered form |
| 1280px+ | `/dashboard` | Primary learning column plus desktop rail for XP, ads, missions, and rewards |

### Remaining Gaps

- No gaps found against the documented plan.
- Browser audit covered representative learner route families and login; future visual polish can still tune individual card composition after design review.
