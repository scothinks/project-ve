# Direct Ads Integration Plan

## Objective

Build a first-party direct ads system for Project VE that increases sponsor yield without using external ad providers, ad networks, third-party scripts, third-party identity, or cross-site tracking.

The system should treat ad inventory as a native product surface. It should support direct sponsor relationships, page-level lesson inventory, first-party targeting, pacing, creative rotation, sequencing, reporting, and learner-friendly guardrails.

## Principles

- Direct placement only: no Google Ads, Meta Audience Network, programmatic exchanges, external pixels, header bidding, or third-party ad SDKs.
- First-party data only: targeting is based on Project VE learner profile, content context, progress, and first-party engagement.
- User-friendly by default: ads must not interrupt learning, quiz-taking, navigation, or accessibility.
- Yield-aware decisioning: ad serving should optimize delivery, freshness, sponsor goals, and learner fit instead of hardcoding one creative per slot.
- Auditable operations: admins must be able to see what ran, where it ran, why it was eligible, and how it performed.
- Privacy-preserving segmentation: use coarse derived segments and contextual signals, not raw sensitive attributes or individual-level manual targeting.

## Non-Goals

- No external ad provider integration.
- No real-time bidding or auction marketplace.
- No third-party tracking pixels.
- No behavioral tracking outside Project VE.
- No personalized ads based on sensitive attributes.
- No disruptive formats such as autoplay video, takeover modals, blocking interstitials, or ads inside quiz questions.

## Inventory Strategy

### Primary Placements

1. `home_feed_card`
   - Route: `app/dashboard/page.tsx`
   - Purpose: broad sponsor visibility on the learner home feed.
   - Recommended location: between major dashboard sections after core learner status.

2. `lesson_footer_card`
   - Route: `app/lessons/[id]/page.tsx`
   - Purpose: high-quality sequential inventory across lesson page navigation.
   - Recommended location: after lesson content and navigation, never before the learner can read the content.

3. `course_detail_card`
   - Route: `app/courses/[id]/page.tsx`
   - Purpose: contextual sponsorship by course topic/category.
   - Recommended location: after course hero or before lesson list.

4. `missions_card`
   - Route: `app/missions/page.tsx`
   - Purpose: action-oriented sponsors tied to community, campaign, or proof-based behavior.
   - Lower priority than lesson and dashboard placements.

5. `xp_store_card`
   - Route: `app/xp-store/page.tsx`
   - Purpose: reward/perk sponsors and conversion-oriented offers.
   - Must be clearly separated from earn/spend mechanics to avoid confusion.

### Lesson Footer Inventory

Lesson footer inventory should be modeled per lesson page, not per lesson.

Each eligible impression should include:

- `placement_key`
- `course_id`
- `lesson_id`
- `page_id`
- `page_number`
- `page_type`
- `content_value_tags`
- `user_id` or anonymous session key
- recent ad history

This allows:

- different creatives on page 1, page 2, page 3, etc.
- sponsor storytelling sequences across lesson pages
- better fatigue controls
- page-level reporting
- page-level targeting overrides
- higher-value direct sponsorship packages

## Creative Formats and Assets

### Default Format

The default ad format should be a native sponsor card.

This is the correct first format for Project VE because it fits lesson footer, dashboard, course detail, missions, and XP store surfaces without disrupting learning.

Required native sponsor card fields:

- sponsor name
- disclosure label, default `Sponsored`
- headline
- body
- CTA label
- CTA destination URL
- image asset
- image alt text

Optional native sponsor card fields:

- eyebrow
- sponsor logo
- short legal/disclaimer text
- theme/accent color
- sequence label

The first `DirectAdCard` component should render this native card format only. Additional formats should be added deliberately after reporting, asset validation, and placement compatibility are working.

### Supported Format Types

Use explicit creative formats. Do not treat `creative` as an unstructured blob.

Recommended initial enum:

- `native_card`
- `image_banner`
- `text_card`
- `video_card`

Recommended MVP scope:

- build `native_card`
- define `image_banner`, `text_card`, and `video_card` in the schema for future compatibility
- block publishing unsupported formats until their renderer and validation rules exist

### Format Requirements

#### `native_card`

Required:

- `headline`
- `body`
- `cta_label`
- `cta_url`
- `image_asset_id`
- `image_alt`
- `sponsor_label`
- `disclosure_label`

Optional:

- `eyebrow`
- `logo_url`
- `legal_text`
- `theme`

Primary placements:

- `lesson_footer_card`
- `home_feed_card`
- `course_detail_card`
- `missions_card`
- `xp_store_card`

#### `image_banner`

Required:

- `image_asset_id`
- `image_alt`
- `cta_url`
- `sponsor_label`
- `disclosure_label`

Optional:

- `headline`
- `cta_label`

Primary placements:

- future compact inventory only

Do not use `image_banner` for the first lesson footer implementation because it is less native and less accessible.

#### `text_card`

Required:

- `headline`
- `body`
- `cta_label`
- `cta_url`
- `sponsor_label`
- `disclosure_label`

Optional:

- `eyebrow`
- `legal_text`

Primary placements:

- low-bandwidth fallback
- accessibility fallback
- cases where sponsors do not have approved imagery

#### `video_card`

Required:

- `video_asset_id`
- `poster_asset_id`
- `poster_image_alt`
- `headline`
- `cta_label`
- `cta_url`
- `sponsor_label`
- `disclosure_label`

Optional:

- `body`
- `caption_url`
- `duration_seconds`

Video rules:

- no autoplay with sound
- no autoplay in lesson footer MVP
- no video inside quiz surfaces
- no blocking video interstitials
- require captions or transcript when meaningful audio is present
- require poster image
- count a video impression separately from video engagement events
- use video only after static native cards are stable

Recommended initial video placement policy:

- allow `video_card` only for future `home_feed_card` or dedicated sponsor surfaces
- disallow `video_card` for `lesson_footer_card` until UX and performance are proven

### Asset Specifications

Native card image:

- aspect ratio: `16:9` preferred
- minimum dimensions: `1200x675`
- maximum file size: `500KB` target, `1MB` hard limit
- supported types: `jpg`, `jpeg`, `png`, `webp`
- SVG: disallow for sponsor-uploaded raster placements unless sanitized and explicitly reviewed
- required alt text: 10-160 characters

Logo:

- aspect ratio: flexible, but render inside a constrained square/rounded container
- minimum dimensions: `256x256`
- maximum file size: `250KB`
- supported types: `png`, `webp`, reviewed `svg`
- required alt text if logo is meaningful; empty alt only if decorative

Video:

- supported type: `mp4` initially
- maximum duration: 15 seconds for card placements
- maximum file size: 5MB target, 10MB hard limit
- poster image required
- captions/transcript required when there is meaningful speech

CTA URL:

- must be `https://`
- must pass server-side validation
- should support optional partner/domain allowlist
- should always route through first-party click redirect

### Asset Storage

Creative assets should be stored in first-party storage, not only by external URL.

Recommended approach:

- create a Supabase Storage bucket such as `ad-creatives`
- keep bucket writes admin-only
- serve public read URLs only for approved assets, or use signed URLs if sponsor assets should not be public before launch
- store asset metadata in `ad_creative_assets`
- link creatives to immutable asset versions
- treat external asset URLs as fallback metadata, not the default storage path

External image/video URLs may be allowed only as an admin-reviewed fallback. They are operationally weaker because availability, file size, redirects, and content changes are outside Project VE control.

### Placement Compatibility

Each placement should declare valid formats.

Recommended mapping:

- `lesson_footer_card`: `native_card`, `text_card`
- `home_feed_card`: `native_card`, `text_card`, future `video_card`
- `course_detail_card`: `native_card`, `text_card`
- `missions_card`: `native_card`, `text_card`
- `xp_store_card`: `native_card`, `text_card`

The decision engine must filter out creatives whose format is incompatible with the requested placement.

Add placement fields:

- `allowed_creative_formats`
- `required_asset_aspect_ratio`
- `max_asset_weight_kb`
- `supports_video`
- `supports_sequence`

### Creative Versioning

Do not update live creative content in place when the visible ad changes materially.

Reporting integrity requires immutable creative versions. If a sponsor swaps an image, headline, body, CTA label, or destination URL mid-flight, create a new creative version.

Recommended model:

- `ad_creatives` stores the logical creative family.
- `ad_creative_versions` stores immutable renderable versions.
- `ad_flights` points to a specific `creative_version_id`, not just `creative_id`.
- `ad_events` records `creative_id` and `creative_version_id`.

Allowed in-place edits:

- admin notes
- internal name
- draft creative fields before first publication

Version-required edits:

- headline
- body
- image
- logo
- CTA label
- CTA URL
- disclosure label
- legal text
- video/poster/captions

When replacing a creative mid-flight, create the new version, update future flight delivery to point to it, and preserve historical event attribution to the old version.

## Targeting Dimensions

### Learner Profile Targeting

Use derived learner segments based on first-party profile data:

- values assessment dimensions
- onboarding completion
- dominant learner interests
- inferred content preferences
- broad learner lifecycle stage

Do not expose raw individual assessment answers as ad targeting controls.

Recommended segment examples:

- `values_civic_responsibility_high`
- `values_financial_wellbeing_high`
- `values_community_action_high`
- `new_learner`
- `returning_learner`
- `course_completer`

### Content Context Targeting

Use context from the current learning surface:

- course ID
- course category
- lesson ID
- lesson page ID
- page number
- page type
- content value tags
- estimated lesson/course depth

This is the safest and most valuable targeting layer because it is directly tied to learner intent.

### Progress Targeting

Use coarse progress state:

- first lesson started
- active in a course
- nearing course completion
- completed a course
- high lesson completion count
- quiz participation state
- mission participation state

### Engagement Targeting

Use broad engagement bands:

- XP balance band
- recent activity band
- mission participant
- reward-store visitor
- referral participant
- notification-enabled learner

Avoid targeting that feels punitive or exploitative, such as showing pressure-based ads to low-XP users.

### Ad History Targeting

Use ad exposure history to improve quality:

- creative frequency cap
- campaign frequency cap
- advertiser frequency cap
- placement frequency cap
- no same creative on consecutive lesson pages unless explicitly sequenced
- no same advertiser too frequently across one session

## Data Model

### `ad_partners`

Stores direct sponsor/advertiser accounts.

Suggested fields:

- `id`
- `name`
- `slug`
- `status`
- `contact_name`
- `contact_email`
- `website_url`
- `terms_accepted_at`
- `terms_accepted_by`
- `terms_version`
- `contract_reference`
- `notes`
- `created_at`
- `updated_at`

### `ad_campaigns`

Stores sponsor campaign contracts and delivery goals.

Suggested fields:

- `id`
- `partner_id`
- `name`
- `status`
- `campaign_type`: `guaranteed`, `priority`, `house`, `bonus`
- `starts_at`
- `ends_at`
- `timezone`
- `budget_label`
- `pricing_model`: `cpm`, `cpc`, `flat_fee`, `make_good`, `house`
- `rate_amount`
- `currency`
- `minor_unit`
- `rounding_mode`
- `gross_budget_amount`
- `billable_budget_amount`
- `spend_cap_amount`
- `allow_overspend`
- `overspend_tolerance_percent`
- `contracted_impressions`
- `contracted_clicks`
- `contracted_viewable_impressions`
- `included_content_tags`
- `excluded_content_tags`
- `included_course_categories`
- `excluded_course_categories`
- `included_course_ids`
- `excluded_course_ids`
- `included_lesson_ids`
- `excluded_lesson_ids`
- `excluded_page_types`
- `competitor_exclusion_keys`
- `priority`
- `pacing_mode`: `even`, `asap`, `manual`
- `make_good_policy`
- `notes`
- `created_at`
- `updated_at`

### `ad_creatives`

Stores the logical creative family. Material public-facing changes should create immutable versions instead of overwriting reporting history.

Suggested fields:

- `id`
- `campaign_id`
- `name`
- `status`
- `creative_format`: `native_card`, `image_banner`, `text_card`, `video_card`
- `current_version_id`
- `weight`
- `created_at`
- `updated_at`

### `ad_creative_versions`

Stores immutable renderable creative content.

Suggested fields:

- `id`
- `creative_id`
- `version_number`
- `status`: `draft`, `submitted`, `approved`, `rejected`, `paused`, `archived`
- `headline`
- `body`
- `eyebrow`
- `image_asset_id`
- `image_alt`
- `logo_asset_id`
- `video_asset_id`
- `poster_asset_id`
- `caption_asset_id`
- `cta_label`
- `cta_url`
- `sponsor_label`
- `disclosure_label`
- `legal_text`
- `theme`
- `created_by`
- `submitted_by`
- `submitted_at`
- `approved_by`
- `approved_at`
- `rejected_by`
- `rejected_at`
- `rejection_reason`
- `paused_by`
- `paused_at`
- `pause_reason`
- `created_at`

### `ad_creative_assets`

Stores first-party asset metadata for images, logos, videos, posters, and captions.

Suggested fields:

- `id`
- `partner_id`
- `storage_bucket`
- `storage_path`
- `public_url`
- `asset_type`: `image`, `logo`, `video`, `poster`, `caption`
- `mime_type`
- `file_size_bytes`
- `width`
- `height`
- `duration_seconds`
- `checksum`
- `alt_text`
- `status`
- `created_at`
- `updated_at`

### `ad_placements`

Defines stable product inventory slots.

Suggested fields:

- `key`
- `name`
- `route_pattern`
- `surface`
- `status`
- `allowed_creative_formats`
- `required_asset_aspect_ratio`
- `max_asset_weight_kb`
- `supports_video`
- `supports_sequence`
- `max_ads_per_view`
- `default_frequency_cap`
- `created_at`
- `updated_at`

### `ad_flights`

Connects campaigns, creatives, placements, targeting, and delivery rules.

Suggested fields:

- `id`
- `campaign_id`
- `creative_id`
- `creative_version_id`
- `placement_key`
- `status`
- `starts_at`
- `ends_at`
- `priority`
- `weight`
- `targeting_rules`
- `frequency_caps`
- `sequence_rules`
- `brand_safety_rules`
- `competitor_exclusion_keys`
- `delivery_goal_impressions`
- `delivery_goal_clicks`
- `created_at`
- `updated_at`

### `ad_events`

Stores first-party event telemetry.

Suggested fields:

- `id`
- `event_type`: `impression`, `click`, `viewable_impression`
- `partner_id`
- `campaign_id`
- `creative_id`
- `creative_version_id`
- `flight_id`
- `placement_key`
- `user_id`
- `session_key_hash`
- `route`
- `course_id`
- `lesson_id`
- `page_id`
- `page_number`
- `segment_keys`
- `metadata`
- `qualification_status`
- `billable_amount`
- `event_dedupe_key`
- `created_at`

### `ad_decisions`

Optional but recommended for auditability.

Suggested fields:

- `id`
- `request_key`
- `selected_flight_id`
- `selected_creative_id`
- `placement_key`
- `decision_context`
- `eligible_flight_count`
- `ineligible_reasons`
- `score_breakdown`
- `experiment_key`
- `variant_key`
- `created_at`

### `ad_audit_events`

Stores immutable operational history for ad admin actions.

Suggested fields:

- `id`
- `actor_user_id`
- `event_type`
- `entity_type`
- `entity_id`
- `before_state`
- `after_state`
- `reason`
- `created_at`

### `ad_frequency_counters`

Stores privacy-safe counters for enforcing frequency caps without repeatedly scanning raw events.

Suggested fields:

- `id`
- `scope_type`: `session`, `user`, `device`, `campaign`, `creative`, `partner`, `placement`
- `scope_key_hash`
- `window_type`: `rolling`, `calendar`
- `window_name`: `session`, `daily`, `weekly`, `custom`
- `timezone`
- `campaign_id`
- `creative_id`
- `creative_version_id`
- `partner_id`
- `placement_key`
- `window_start`
- `window_end`
- `impression_count`
- `viewable_impression_count`
- `click_count`
- `updated_at`

For authenticated users, user-level caps should use `user_id` or a salted user hash. For anonymous traffic, caps should fall back to hashed session/device identifiers with shorter retention.

Window mechanics:

- use rolling windows for enforcement-critical caps.
- use calendar windows for sponsor reporting and ad-ops summaries.
- campaign/creative/partner frequency caps should use rolling windows to avoid midnight-boundary bursts.
- daily reporting should use campaign timezone, not learner timezone.
- session density caps should use the active Project VE session window.
- store `window_type`, `window_name`, `window_start`, `window_end`, and `timezone` so behavior is auditable.

## Decision Engine

Create a first-party ad decision layer instead of a simple active-ad lookup.

Recommended API shape:

```ts
getAdDecision({
  supabase,
  userId,
  sessionKey,
  placementKey,
  route,
  courseId,
  lessonId,
  pageId,
  pageNumber,
  pageType,
  contentValueTags,
});
```

### Eligibility Filters

The decision engine should filter by:

- active placement
- campaign status
- creative status
- creative version status
- flight status
- start/end dates
- placement match
- creative format compatibility with placement
- required asset availability
- asset validation status
- targeting rules
- frequency caps
- cross-session user frequency caps
- session-level density caps
- brand safety exclusions
- content adjacency exclusions
- competitor exclusions
- sponsor/category exclusions
- safe CTA URL validation

### Scoring

Eligible flights should be scored with a transparent formula:

- campaign priority
- delivery under-pacing
- targeting match strength
- creative freshness
- advertiser freshness
- placement fit
- revenue or contract weight
- sequence fit
- fatigue penalty

The result should be deterministic enough for auditability but flexible enough to rotate creatives.

### Brand Safety and Content Adjacency

Targeting must support both inclusion and exclusion.

Campaigns and flights should be able to exclude:

- content value tags
- course categories
- specific courses
- specific lessons
- specific lesson pages
- page types
- sponsor categories
- competitor exclusion keys

Examples:

- a financial sponsor can avoid lessons tagged `financial_stress`.
- a youth program sponsor can appear only in civic/community lessons.
- two competing partners can be prevented from appearing in the same learner session.
- a sponsor can exclude sensitive reflection pages while still targeting the broader course.

The decision engine should apply exclusions before scoring. Exclusion failures should be recorded in `ad_decisions.ineligible_reasons` for admin preview/debugging.

### Latency Failure Mode

Ad decisioning should fail open to the learning experience and fail closed to paid delivery.

If ad decisioning exceeds the latency budget or errors:

- render no paid ad.
- optionally render cached house inventory if available.
- do not block lesson content.
- log the failure for admin diagnostics.
- do not create billable impressions.

### Sequencing

Support intentional creative journeys for multi-page lessons:

- page 1: sponsor awareness
- page 2: benefit or social proof
- page 3: call to action
- summary page: conversion-oriented CTA

Sequencing should be optional. If no sequence rule exists, normal rotation applies.

## Learner Segmentation

Create a helper that derives ad-safe segments from existing first-party systems.

Candidate source systems:

- values assessment
- personalized recommendations
- content value tags
- lesson progress
- quiz participation
- mission participation
- XP balance
- reward-store engagement

Recommended helper:

```ts
getLearnerAdSegments({
  supabase,
  userId,
  catalog,
  lessonProgress,
});
```

The helper should return stable segment keys, not raw profile answers.

Example output:

```ts
[
  "new_learner",
  "values_civic_responsibility_high",
  "active_course_learner",
  "mission_inactive",
]
```

## User Experience Guardrails

- Always label ads as `Sponsored` or equivalent.
- Keep cards visually native but clearly distinguishable.
- Never place ads inside quiz questions or answer review.
- Never block lesson progression.
- Never autoplay audio or video.
- Never use deceptive CTA language.
- Do not show the same creative on consecutive lesson pages unless a sequence explicitly requires it.
- Limit lesson footer inventory to one card per page.
- Add graceful empty states: if no ad is eligible, render nothing.
- Keep ads accessible with alt text, semantic links, and readable contrast.
- Cap total ad density per session independent of campaign or creative.
- Prefer house/product promos over blank space when paid inventory is unavailable and the placement shape would otherwise visibly collapse.

### Ad Disclosure and Native Labeling

Native ads must be visually and semantically disclosed as advertising.

`DirectAdCard` requirements:

- always render a visible disclosure label such as `Sponsored` or `Ad`.
- always render the sponsor name or approved sponsor logo.
- keep disclosure near the headline/brand area, not buried in footer text.
- expose disclosure to screen readers.
- never style the disclosure so faintly that it is effectively hidden.
- never make paid sponsor content look like lesson-authored educational content.
- make Project VE house cards visibly distinct from paid sponsor cards.

Creative requirements:

- `disclosure_label` is required for all paid formats.
- `sponsor_label` is required for all paid formats.
- partner logo is optional, but partner identity is not.

This is a compliance and trust requirement, not a design preference.

### Session-Level Ad Density

Frequency caps protect sponsors and creative fatigue. Session density caps protect learning outcomes.

Recommended initial caps:

- maximum one ad per lesson page.
- maximum three paid ads per lesson session.
- maximum five paid ads per learner session across all surfaces.
- maximum one paid ad from the same partner per session unless a sequence explicitly allows more.
- house ads can fill after paid caps only if they are low-pressure product promos.

The decision engine should check session-level density before campaign-level selection. If the user has reached the session cap, return no paid ad and optionally return eligible house inventory.

### Cross-Session Frequency Capping

Session caps are not enough. Paid campaigns also need privacy-safe user-level caps across sessions.

Recommended initial caps:

- campaign: max three billable impressions per authenticated user per day.
- creative version: max two billable impressions per authenticated user per day.
- partner: max five billable impressions per authenticated user per seven days.
- anonymous session: stricter caps using hashed session/device keys because identity is less stable.

Design decision:

- authenticated users get stable user-level counters.
- anonymous users get short-lived session/device counters.
- raw events remain subject to retention limits; counters can expire independently by window.
- enforcement caps use rolling windows by default.
- reporting summaries use calendar windows in the campaign timezone.

The decision engine must filter or down-rank campaigns when user/session counters exceed the configured cap.

Avoid fixed-midnight enforcement caps for user experience and fraud control. A `max three impressions per day` cap should mean no more than three impressions in any rolling 24-hour period unless a campaign explicitly opts into calendar-window behavior.

### Fallback Inventory

Unfilled inventory should be deliberate.

Fallback options:

1. render nothing
   - best when preserving learning flow matters more than layout consistency.

2. house ad/product promo
   - promote Project VE missions, XP store, referrals, notification opt-in, app install, or new courses.
   - should be clearly non-sponsored or labeled as Project VE.

3. sponsor make-good inventory
   - only if the flight is approved, compatible, and still subject to density/frequency caps.

For the lesson footer MVP, default fallback should be a Project VE house card or no render. Do not show low-quality paid filler just to fill space.

## Admin Experience

Add an `Ads` section to the admin shell.

V1 should be 100% admin-mediated. Sponsors should not have self-serve login, direct publishing, direct asset replacement, direct targeting changes, or direct reporting exports.

If sponsor-facing submission is added later, it must use a separate sponsor role and permission model:

- sponsors can submit assets/copy but cannot approve or publish.
- sponsors can view only their own aggregate campaign reports.
- sponsors cannot see learner-level data, raw event logs, targeting internals, or other sponsors.
- internal admins remain the final approval and launch authority.

Required admin capabilities:

- manage partners
- create campaigns
- add creatives
- upload and validate creative assets
- create immutable creative versions
- configure flights
- select placements
- define targeting rules
- configure page-level lesson targeting
- set frequency caps
- configure creative sequencing
- preview an ad decision for a route/user segment
- view impressions, clicks, CTR, delivery pacing, and fatigue
- pause partner, campaign, flight, creative, or creative version globally
- review and approve creative versions before publication
- define competitor exclusions and prohibited categories
- inspect audit logs for operational changes

### Admin Preview

The preview tool should answer:

- which ad would render for this placement?
- why was it selected?
- which flights were excluded?
- which targeting rules matched?
- which creative version and asset set rendered?
- what frequency caps applied?

This prevents opaque ad behavior and makes direct sales operations easier.

### Kill Switch and Incident Response

A direct ad system needs immediate platform-wide pause controls before launch.

Required kill switches:

- pause partner
- pause campaign
- pause flight
- pause creative
- pause creative version
- disable placement
- disable all paid ads globally

Kill switch behavior:

- takes effect immediately in the decision engine.
- does not delete records or historical reporting.
- logs actor, timestamp, target, reason, and previous state.
- revalidates affected learner-facing routes where practical.
- falls back to house ads or no render.

Incident reasons:

- offensive or inaccurate creative
- broken CTA redirect
- sponsor complaint
- legal/compliance request
- brand safety issue
- asset outage
- suspected fraud spike
- campaign budget exhausted unexpectedly

### Creative Governance

Creatives should have a review workflow before they can become billable.

Creative lifecycle:

- `draft`
- `submitted`
- `approved`
- `rejected`
- `paused`
- `archived`

Governance requirements:

- validate asset dimensions, file size, MIME type, and format compatibility.
- require alt text for meaningful images.
- require accessible text contrast in rendered cards.
- require captions/transcripts for meaningful video audio.
- validate CTA URL and partner/domain allowlist.
- prohibit deceptive CTAs.
- support prohibited categories.
- support competitor exclusions by sponsor/category.
- record reviewer, approval time, and rejection reason.

Recommended prohibited categories for launch:

- gambling
- adult content
- predatory lending
- political persuasion unless explicitly approved
- misleading health/financial claims
- counterfeit goods
- malware/download prompts
- tobacco/vaping

### Partner Terms and Agreements

Every direct sponsor should have a recorded agreement before any campaign can go live.

Agreement record should cover:

- platform advertising terms.
- content standards and prohibited categories.
- payment terms.
- data-use and reporting limitations.
- creative review and rejection rights.
- make-good and reconciliation policy.
- privacy and no-third-party-tracking restrictions.

`ad_partners` should record `terms_accepted_at`, `terms_accepted_by`, `terms_version`, and an optional `contract_reference`. The decision engine or admin publish RPC should block paid campaigns for partners without accepted terms.

### Admin Audit Log

Add an immutable audit trail for ad operations.

Track:

- partner created/edited/paused
- campaign created/edited/paused
- creative version submitted/approved/rejected/paused
- flight created/edited/paused
- placement enabled/disabled
- targeting rules changed
- budget/economic terms changed
- kill switch activated/deactivated

Suggested table:

- `ad_audit_events`

Suggested fields:

- `id`
- `actor_user_id`
- `event_type`
- `entity_type`
- `entity_id`
- `before_state`
- `after_state`
- `reason`
- `created_at`

## Tracking and Reporting

### Invalid Traffic and Fraud Controls

Existing Project VE fraud controls should be reused, but they are not sufficient by themselves.

The app already has signup and account-risk protections:

- Turnstile verification during signup when configured.
- hashed IP and device identifiers through `lib/auth-risk.ts`.
- signup attempt limits by IP/device.
- disposable email blocking.
- `user_risk_events` and admin-visible account risk state.

Those controls help reduce low-quality accounts, but ad billing needs its own invalid traffic layer because bots and click fraud can still occur after signup or on anonymous/session-based traffic.

Ad events should move through a qualification pipeline:

1. `raw`
   - Event was received and stored.
   - Not billable.

2. `filtered`
   - Event failed IVT checks.
   - Excluded from sponsor reporting and billing.

3. `qualified`
   - Event passed baseline checks.
   - Eligible for internal reporting.

4. `billable`
   - Event passed stricter billing rules.
   - Counted toward contractual delivery.

Add fields to `ad_events`:

- `qualification_status`: `raw`, `filtered`, `qualified`, `billable`
- `ivt_reason`
- `risk_score`
- `ip_hash`
- `device_hash`
- `user_agent_hash`
- `decision_id`
- `event_dedupe_key`
- `client_event_time`
- `server_received_at`

Add an `ad_traffic_quality_events` table for audit logs when traffic is filtered or downgraded.

Suggested fields:

- `id`
- `ad_event_id`
- `user_id`
- `session_key_hash`
- `ip_hash`
- `device_hash`
- `rule_key`
- `severity`
- `reason`
- `metadata`
- `created_at`

### IVT Rules

Baseline event filters:

- missing or invalid `decision_id`
- event does not match the selected creative/flight/placement
- event does not match selected creative version
- duplicate `event_dedupe_key`
- impression emitted too soon after ad decision
- click emitted before impression
- click emitted impossibly fast after impression
- repeated clicks from the same session/user/device/IP
- repeated impressions from the same session without page navigation
- excessive event velocity by session, user, device hash, or IP hash
- expired campaign/flight at decision time
- hidden or non-rendered placement
- invalid CTA URL
- known blocked account/risk state

Recommended initial thresholds:

- filter clicks under 750ms after impression as likely accidental/bot traffic.
- filter duplicate clicks for the same `decision_id`.
- downgrade repeated clicks on the same creative from the same session within 10 minutes.
- cap billable impressions per placement/session/day.
- cap billable clicks per campaign/session/day.
- flag sessions with abnormal click-through rate across multiple ads.

Thresholds should be configurable in code first, then moved into admin settings if needed.

### Billing and Reporting Treatment

Sponsor-facing reporting should separate:

- gross impressions
- qualified impressions
- billable impressions
- filtered impressions
- gross clicks
- qualified clicks
- billable clicks
- filtered clicks
- IVT rate

Contract delivery should use billable events only.

Internal analytics may show raw and filtered events for debugging, but sponsor exports should aggregate filtered traffic by reason and never expose learner-level identifiers.

### Event Capture Hardening

Impression tracking should not count on server render alone. The client should emit an impression only after the ad card is actually mounted and eligible for display. If viewability tracking is implemented, count `viewable_impression` only after minimum exposure rules such as 50% visible for 1 second.

Click tracking should use a first-party redirect endpoint:

- validate the `decision_id`
- validate the selected CTA URL
- record the click as `raw`
- run synchronous fast IVT checks
- redirect to the CTA URL
- let asynchronous jobs or reporting queries finalize qualification

Do not let client-submitted event fields decide billability. Client fields are hints; server-side decision records and server timestamps are authoritative.

### Account Risk Reuse

Ad IVT should use existing account-risk data as one input:

- read profile fraud/risk state when available.
- reuse hashed IP/device helpers from `lib/auth-risk.ts`.
- write severe ad fraud patterns into `user_risk_events`.
- expose ad traffic-quality warnings in admin user review when relevant.

However, account risk should not automatically suppress all ads unless the account is clearly blocked or abusive. A watch-state user can still receive ads, but their ad events may be downgraded from billable until behavior normalizes.

### Event Capture

Use first-party API routes only:

- `POST /api/ads/impression`
- `POST /api/ads/click`

Click URLs should route through a first-party redirect endpoint:

- `GET /api/ads/click/[decisionId]`

This records the click and redirects to the sponsor CTA URL after validation.

### Viewability

A rendered ad is not automatically a viewable impression.

Use three event levels:

- `impression`
  - the ad was selected and mounted.
  - useful for fill and render diagnostics.

- `viewable_impression`
  - the creative met the platform viewability standard.
  - primary event for viewability reporting.

- `billable_viewable_impression`
  - the viewable impression also passed IVT and billing qualification.
  - primary event for CPM billing when viewability is part of the contract.

Recommended initial standard:

- native/static card: at least 50% of pixels in viewport for at least 1 continuous second.
- video card, when supported: at least 50% of pixels in viewport for at least 2 continuous seconds.
- do not count background tabs.
- do not count hidden or zero-size placements.
- emit only one viewable impression per `decision_id`.

Implementation:

- use client-side `IntersectionObserver`.
- pair client viewability signal with server-side `decision_id`.
- server validates decision, placement, timing, dedupe key, and IVT state.
- store both `client_event_time` and `server_received_at`.
- use server qualification status for reporting and billing.

CTR should be reported in two ways:

- click-through rate on gross impressions, for diagnostics.
- click-through rate on qualified or billable viewable impressions, for sponsor reporting.

### Revenue and Billing

Direct-sales campaigns need economic terms in the data model and policy rules for spend behavior.

Add campaign/flight economic fields:

- `pricing_model`: `cpm`, `cpc`, `flat_fee`, `make_good`, `house`
- `rate_amount`
- `currency`
- `minor_unit`
- `rounding_mode`
- `gross_budget_amount`
- `billable_budget_amount`
- `contracted_impressions`
- `contracted_clicks`
- `contracted_viewable_impressions`
- `spend_cap_amount`
- `allow_overspend`
- `overspend_tolerance_percent`
- `timezone`
- `make_good_policy`

Billing basis:

- CPM should use billable impressions or billable viewable impressions, depending on contract.
- CPC should use billable clicks only.
- Flat-fee campaigns should still track delivery progress and IVT, even if billing is not event-based.
- House campaigns should never count as revenue.

Timezone conventions:

- store all timestamps as `timestamptz`.
- each campaign has an explicit `timezone`.
- campaign start/end, daily pacing, billing snapshots, and sponsor-facing calendar reports use campaign timezone.
- learner session density uses the active session window, not calendar day.
- authenticated user frequency caps use rolling windows by default, not campaign calendar days.

Currency and rounding:

- store money in integer minor units where possible.
- store `currency` as ISO 4217 code.
- do not aggregate spend across currencies unless explicitly converted outside the ad system.
- CPM spend should be calculated as `(billable_events * rate_minor_units) / 1000`, rounded only at snapshot/invoice boundaries.
- CPC spend should be calculated per billable click in minor units.
- default rounding mode should be half-up at invoice/snapshot time; event-level spend can keep fractional internal precision if needed.

Budget exhaustion behavior:

- default: stop paid delivery immediately when the flight reaches its spend cap.
- allow small overspend only when `allow_overspend` is true and within configured tolerance.
- if the cap is reached mid-session, do not revoke already-rendered ads, but stop future decisions.
- if a click arrives after a valid pre-cap impression but after cap exhaustion, mark it qualified but not necessarily billable depending on contract policy.

Pacing policy:

- guaranteed campaigns should pace evenly unless configured as `asap`.
- under-pacing should raise admin warnings before the end date.
- over-pacing should reduce score or pause automatically near cap.
- house ads should fill only after paid eligibility and density checks.

Reconciliation:

- under-delivery should create a make-good recommendation, not silently extend campaigns.
- over-delivery beyond tolerance should be reported as non-billable bonus delivery.
- sponsor-facing reports should separate contracted, delivered, billable, filtered, bonus, and make-good delivery.

Suggested tables:

- `ad_billing_snapshots`
- `ad_make_goods`

`ad_billing_snapshots` suggested fields:

- `id`
- `campaign_id`
- `flight_id`
- `period_start`
- `period_end`
- `pricing_model`
- `billable_impressions`
- `billable_viewable_impressions`
- `billable_clicks`
- `gross_spend`
- `billable_spend`
- `filtered_event_count`
- `created_at`

`ad_make_goods` suggested fields:

- `id`
- `campaign_id`
- `reason`
- `owed_impressions`
- `owed_clicks`
- `owed_value_amount`
- `status`
- `notes`
- `created_at`
- `updated_at`

### Reporting Dimensions

Report by:

- partner
- campaign
- creative
- creative version
- flight
- placement
- route
- course
- lesson
- page
- page type
- segment key
- day

### Core Metrics

- impressions
- qualified impressions
- billable impressions
- filtered impressions
- viewable impressions, if implemented
- billable viewable impressions
- clicks
- qualified clicks
- billable clicks
- filtered clicks
- CTR
- billable CTR
- IVT rate
- delivery progress
- spend progress
- budget remaining
- under/over-pacing
- frequency by user/session
- creative fatigue
- placement fill rate
- viewability rate
- ads per session

## Privacy and Compliance

- Store only first-party ad events.
- Hash anonymous session keys.
- Avoid storing raw user-agent unless needed for abuse prevention.
- Do not export individual-level learner ad histories for sponsor reporting.
- Report sponsors aggregate performance only.
- Do not include sensitive profile data in targeting controls.
- Keep targeting explanations in internal admin tools, not public sponsor-facing exports.

### Data Retention

Set explicit retention windows before launch.

Recommended initial policy:

- raw ad events: retain for 90 days.
- traffic-quality audit events: retain for 180 days.
- decision records: retain for 90 days, or 180 days for disputed campaigns.
- billing snapshots: retain indefinitely.
- daily aggregate reporting: retain indefinitely.
- asset files and creative versions: retain while campaign records exist, then archive according to business/legal needs.

Retention jobs should aggregate before deletion so sponsor reporting remains available without keeping unnecessary event-level data.

## Performance and Experimentation

### Decisioning Latency Budget

Ad decisioning must not make lesson pages feel slower.

Recommended latency targets:

- server decision helper: p95 under 100ms after Supabase connection is available.
- total ad-related page overhead: p95 under 150ms.
- event endpoints: respond quickly and do heavier qualification asynchronously when possible.

Implementation guidance:

- prefetch all eligible flights for a placement in one query.
- avoid N+1 lookups for creative versions/assets.
- cache placement config.
- fail closed to no paid ad if decisioning errors.
- never block lesson content rendering on ad reporting calls.

### A/B Testing Hooks

Add experiment hooks without launching a full experimentation platform.

Decision context should support:

- `experiment_key`
- `variant_key`
- deterministic assignment by user/session hash
- holdout groups
- creative variant comparisons
- placement position tests

Guardrails:

- experiments must respect targeting, frequency caps, density caps, IVT, and kill switches.
- experiments must record variant on `ad_decisions` and `ad_events`.
- sponsor billing should not depend on experiment labels unless contractually agreed.

## Implementation Roadmap

### Phase 1: Foundation

- Add ads database tables.
- Add required indexes for serving, reporting, IVT, and admin lists.
- Add Row-Level Security policies for learner reads, admin writes, event inserts, and sponsor-safe reporting.
- Add admin RPCs for partner, campaign, creative, creative version, flight, placement, and kill-switch operations.
- Add placement seed rows.
- Add Supabase Storage bucket and metadata table for ad creative assets.
- Add TypeScript types for partners, campaigns, creatives, creative versions, creative assets, flights, decisions, and events.
- Add creative format validation utilities.
- Add partner terms/agreement fields and publish blocking.
- Add `lib/ads.ts` with decisioning primitives.
- Add `DirectAdCard` component for `native_card` with mandatory visible disclosure and sponsor identity.
- Add creative review statuses, approval fields, and rejection reason fields.
- Add kill switch checks to the decision engine.
- Add ad admin audit log.
- Add explicit raw event retention policy and cleanup/aggregation job design.
- Add admin navigation entry.

### Phase 2: Lesson Footer Inventory

- Wire `lesson_footer_card` into `app/lessons/[id]/page.tsx`.
- Pass full lesson page context into the decision engine.
- Support per-page `native_card` creative version rotation.
- Add no-consecutive-creative fatigue logic.
- Add session-level ad density caps.
- Add authenticated user-level daily/weekly frequency caps.
- Use rolling windows for enforcement caps and campaign-timezone calendar windows for reporting.
- Add decision timeout behavior: no paid ad if decisioning exceeds latency budget.
- Add empty-render fallback.
- Add house ad/product promo fallback support.

### Phase 3: Targeting

- Add ad-safe learner segment derivation.
- Integrate values assessment and content value tags.
- Add campaign/flight targeting rules.
- Add contextual targeting by course, lesson, page, page type, and value tag.
- Add inclusion and exclusion rules for brand safety/content adjacency.
- Add competitor exclusion keys.
- Add admin UI for targeting configuration.
- Add admin UI for creative submission, approval, rejection, and pause states.

### Phase 4: Tracking

- Add impression and click endpoints.
- Add viewable impression endpoint and `IntersectionObserver` client.
- Add first-party click redirect.
- Add event deduplication keys.
- Add IVT qualification status to ad events.
- Add velocity, duplicate, impossible-click, and risky-account filters.
- Add billable-vs-gross reporting.
- Add gross-vs-viewable-vs-billable reporting.
- Add reporting aggregates.
- Add raw-event retention job.
- Add admin metrics cards and tables.

### Phase 5: Yield Optimization

- Add pacing logic for guaranteed campaigns.
- Add pricing model, spend tracking, budget caps, and budget-exhaustion behavior.
- Add campaign timezone, integer minor-unit currency storage, and billing rounding rules.
- Add scoring breakdowns.
- Add creative sequencing rules.
- Add fill-rate reporting.
- Add sponsor fatigue reporting.
- Add preview/debug tooling for ad decisions.
- Add A/B testing assignment hooks.

### Phase 6: Additional Placements

- Add `home_feed_card`.
- Add `course_detail_card`.
- Add `missions_card` if sponsor quality fits the surface.
- Add `xp_store_card` only after reward/sponsor separation is clear.

## Recommended Initial MVP Scope

The first useful build should include:

- `lesson_footer_card`
- partners
- campaigns
- creatives
- flights
- contextual targeting
- basic learner segments
- frequency caps
- impression/click tracking
- admin reporting

Do not start with every placement. Lesson footer inventory is the highest-leverage surface because the product naturally creates multiple page-level ad opportunities during one learning session.

## Success Metrics

Product quality:

- lesson completion rate does not decline
- quiz starts do not decline
- learner session length remains stable or improves
- no increase in support complaints about ads

Yield:

- placement fill rate
- impressions per learning session
- click-through rate by placement
- campaign delivery progress
- creative fatigue rate
- sponsor renewal potential

Operations:

- admin can create and launch a campaign without engineering
- admin can explain why an ad showed
- admin can pause any partner/campaign/flight/creative immediately
- admin can audit who changed billing, targeting, or creative state
- sponsor report can be generated from first-party data
- no external ad dependency exists

## Key Risks

- Over-targeting can feel invasive even if data is first-party.
- Too much lesson footer repetition can reduce trust.
- Sponsor CTA quality can hurt learner experience.
- Admin complexity can outpace direct-sales maturity.
- Reporting expectations can expand quickly once sponsors see performance data.

Mitigation:

- start with coarse segments and contextual targeting
- keep frequency caps conservative
- require creative review before publishing
- keep reporting aggregate and explainable
- ship one placement deeply before adding more surfaces
