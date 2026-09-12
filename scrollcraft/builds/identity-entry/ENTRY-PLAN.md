# Entry experience design plan

Concept and planning scope for #91. Production development follows territory
selection and agreement on budgets/fallbacks. Read with BRIEF.md and index.html.

## Route inventory and intended journeys

| Entry | Current evidence | Intended experience |
|---|---|---|
| Platform welcome | app/page.tsx sends signed-in users to /dashboard and signed-out users to /login via WelcomeCarousel. | Equal Start learning and Create an organisation routes; Sign in immediately reachable. Both visible without scrolling. |
| Personal signup | app/login/LoginForm.tsx shares login/signup modes; /api/auth/signup handles signup. | Choose Start learning, create account, confirm email when required, continue under the existing onboarding policy. Signup must be directly addressable in the future implementation. |
| Returning login | /login?next=…; lib/auth-redirect.ts. | Form first, remembered safe destination, no mandatory marketing interlude. |
| Organisation creation | /org → /login?next=/org/create → /org/create. | Self-service after authentication; preserve /org/create through email/OAuth/recovery. Creator becomes owner under existing policy. |
| Existing organisations | /org/my, authenticated pending invitations and memberships. | Show legitimate choices after authentication. Don't infer membership from an audience selection. |
| Organisation deep link | /o/[organizationSlug]/… protected by route auth policy. | Preserve full local destination and query. Pre-auth visual organisation context only from an existing authorized public resolver; otherwise a neutral shell. |
| Public referral | /invite/[code], ReferralCodeCapture, referral APIs. | Explain referral, capture via existing logic, retain through signup and confirmation; never imply signup itself earns reward. |
| Contextual referral | resolve_referral_invite and accept_contextual_referral. | Show only approved presentation fields. Separate granted, pending approval, unavailable and denied outcomes. |
| Membership invitation | get_my_pending_organization_invitations in features/organizations/application/my-orgs.ts. | Authenticate before private invite details; accept/reject through existing supported actions. This is distinct from a public referral link. |
| Email confirmation / OAuth | app/auth/callback/route.ts; lib/auth-confirmation.ts. | Preserve referral proof, safe destination and existing signup checks. Make retry/resend and callback failures clear. |
| Password recovery | LoginForm resetPasswordForEmail → callback → /login?reset=1. | Request, email sent, valid recovery, save, return to intended context. Current reset callback loses original next; treat destination preservation as a focused implementation fix with tests, not an existing guarantee. |
| Onboarding | /onboarding/assessment; shouldRouteAuthNextToPublicAssessment. | Keep public assessment policy and organisation bypass. Returning organisation users retain their workspace route. |
| Demo/live | lib/app-mode.ts; explicit LoginForm demo handling. | Clearly labelled demo behaviour; no fake backend success in live mode. |

Read-only source audit. No route, RPC, security or rendering change was made.

## State coverage

| Screen family | Desktop | Mobile | Required states and recovery |
|---|---|---|---|
| Welcome | Split spatial stage with a stable copy/action plane | Copy and both actions first; compact separate scene below | Fresh, signed in, slow assets, motion off, offline informational shell |
| Login / signup | Form alongside a smaller static or restrained identity scene | Single-column form; identity/header kept compact | Empty, focus, validation, submitting, duplicate account, invalid credentials, rate limit, offline, expired CAPTCHA, unavailable backend; retain safe input except passwords after success |
| Confirmation | Stable message panel with destination context | Same reading order, no illustration above essential instructions | Sent, resend pending, resent, expired link, callback failed; retry and change address |
| Recovery | Compact form with explicit stage title | Same stages and generous touch targets | Request, sent, expired/invalid link, new password, saving, rejected, saved; preserve next |
| OAuth | Provider action beside supported auth methods | Full-width action | Preparing proof, redirecting, cancelled, callback failed, proof rejected; return to usable login |
| Referral / invitation | Context panel next to entry form or acceptance actions | Context above form with collapsible nonessential explanation | Valid, unavailable, expired, already used, wrong account, pending approval, granted, denied; never show a success state before server confirmation |
| Organisation selection | Search/selection only after legitimate data is available | Vertical list with clear organisation names and roles | One/many/none, invitation pending, inaccessible destination, suspended/archived; choose another legitimate destination |

Each production screen uses semantic fields, real labels, visible focus,
password-manager autocomplete, announced errors and a recoverable retry path.
Consent and Turnstile remain in the signup sequence. The concept board contains
disabled illustrative fields, no submissions, and no real organisation records.

## Context contract

- Platform brand remains the stable frame. Organisation name/logo occupies a
  clearly subordinate context slot, with one controlled accent region.
- Use verification status only when returned by an authorized source. A logo
  must never manufacture a verified badge. Do not trust name/logo/next passed
  in arbitrary URL fields as organization identity.
- Public invitation presentation and private membership data are separate.
  A raw slug does not justify fetching private tenant metadata before auth.
- Carry safe destination as data through login, signup, email, OAuth and
  recovery. Use one focused request-scoped context loader if required; no new
  per-card requests, shared identity cache or render-time mutation.
- Keep destination validation, tenant authorization, referral acceptance, XP
  and membership grants below the visual layer. Do not implement a branding
  resolver using service-role access as a convenience.
- Existing accent tokens may need a later migration to map a selected palette.
  Concept colours are not silently written into persisted organisation enums.

## Scroll-craft proposal

Proposed grammar: **Open threshold**, a short natural-flow sequence with two
equally visible exits. Navigation is a simple brand anchor and Sign in, followed
by an in-flow audience switch for the illustrative example. It ends in a stable
two-route decision. No forced pinning, hidden forms, magnetic buttons, counters,
continuous flight or automatic audience selection. Distinct scenes are deliberate.

Why the eight stock grammars were not adopted wholesale: filmic one-shot forbids
multiple entry points; chaptered editorial weakens the immediate spatial opening;
live surface would need an actual operable product demo; continuous world adds
unneeded travel; typographic poster makes reading the spectacle; gallery/catalog
privileges an object collection; split stage ends with one side winning, contrary
to equal audience priority; rhythmic cutlist adds too much urgency. The selected
concept will revisit the exact grammar before build.

### Layer contract

| Plane | Content | Behaviour |
|---|---|---|
| Far | Territory ground and structural field | Almost stationary; complete without effects |
| Mid | Outer frames/path/modules/letterforms | Small relative translation reveals scale |
| Focal | One highlighted place or unit | Keeps a fixed logical identity as individual becomes collective |
| Near | Foreground structural edge | Largest restrained displacement; never crosses form/CTA text |
| Copy and controls | Semantic HTML | Stable, unoccluded, no parallax on inputs |

The concept board's depth slider studies the relative planes, not the complete
scroll experience. No photographic people or scenes are fabricated.

### Proposed score after the feeling curve

| Beat | Device family | Approximate natural height | Purpose |
|---|---|---|---|
| Shared promise | Layered parallax | 0.9 viewport | Establish a place and both audiences |
| Learning into practice | Flow with modest entrance | 0.6 viewport | Quiet, concrete explanation |
| Your place in the whole | Bespoke structural reveal | 1.4 viewports | Peak: same place within a larger shared structure |
| Trusted context | Static split comparison | 0.7 viewport | Make personal/org context understandable |
| Choose and enter | Direct interaction | 0.6 viewport | Hold both actions and resolve |

About 4.2 viewports is a planning budget, not a quota. Mobile may be shorter.
No blank authored silence, video scrub, required WebGL or scroll hijack.
The initial registry is empty. Fingerprint is provisional, not a shipped row.

## Proposed performance and fallback budgets

These are design targets for agreement, not measurements or approved gates.

- LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at mobile p75 after rollout; lab measurements
  are provisional proxies until sufficient field data exists.
- Entry enhancement JS ≤40 KiB gzip incremental over the existing auth route;
  no new 3D library on the critical path. Initial decorative media ≤180 KiB
  on mobile and ≤350 KiB on desktop. Fonts ≤100 KiB total, with metric-aware
  fallbacks and no invisible text. Instrument baseline before final budgeting.
- Auth form and copy in first useful HTML. Essential controls never await
  scene assets. Lazy-load optional depth after useful content; reserve sizes.
- Reduced motion: complete static composition, no extra scroll span or hidden
  reveals. Non-WebGL: same vector/CSS composition. Non-JS: readable copy and
  links; auth may explicitly require JavaScript, but no accidental GET form
  submission that leaks credentials. Assess a server fallback separately.
- Slow/low-bandwidth: deliver the base composition, skip optional assets. Respect
  Save-Data where supported; do not pretend it detects every slow connection.
- Low power: no universal reliable detector. Offer a motion-off control, pause
  on hidden/offscreen, cap work and keep essential functionality independent.
- Touch: no hover dependence, at least 44px targets, no horizontal overflow;
  test virtual keyboard at 360×640 and 390×844. Desktop retains a stable form
  width and scene separation at 1280px and wider.

## Implementation acceptance, to define before development

Follow docs/codex/skills/project-ve-guardrails/SKILL.md testing cadence.

1. Focused unit tests extend auth-redirect, auth-confirmation and route-auth-policy
   for audience destinations, recovery return paths, malformed next values and
   organisation assessment bypass. Test outcomes, not markup literals.
2. Component checks cover mode switching, retained fields, context labels,
   accessible errors, pending actions and motion preference controls.
3. Production-browser checks cover password login, both signup destinations,
   email confirmation, recovery, Google cancellation/failure, CAPTCHA expiration,
   public/contextual referral outcomes, private membership invitation, org A/B
   isolation, wrong account, and direct protected links. Use isolated local users.
4. Pixel inspection covers desktop/mobile opening, intermediate depth, resolved
   scene, all auth panels, focus, errors and keyboard-open layouts. Capture
   reduced motion and missing-assets cases; measure contrast over actual frames.
5. Run typecheck, lint, build, guardrails and affected E2E contracts. Add pgTAP
   only if DB/RPC access changes; those changes require forward migrations and
   privilege tests. No auth change is validated by this concept board.
6. A selected build must pass scroll-craft's visual/functional gate, with actual
   phone verification reported separately. Never claim lab runs prove phone
   video decoding, field performance or hosted rollout.

## Next decision

Select one of the four #90 territories. Then refine its geometry/type, agree
the budget/fallback plan above, and produce the connected #91 prototype. Create
the separate identity asset/theme implementation issue after selection, as #90
requires. Keep #91 open until its broader acceptance checks are satisfied.
