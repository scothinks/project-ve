# Current local verification, 2026-09-12

## Simplified sliding account panel

The user supplied the 21st.dev Auth Switch reference and rejected the busy
photo/marketing composition. The new preview removes that panel and repeated
account-switch prompts, retaining a short curved sliding invitation and one XP
line. Mobile has a compact switch strip. The first render does not animate from
the opposite mode; subsequent switches use transform/opacity and reduced-motion
users get an immediate change.

`lab/verify-auth.cjs` passes all four profiles on this revision. The focused
`lab/verify-switch.cjs` verifies both directions, retained email, keyboard/focus,
non-overlapping settled panels and no overflow. Current settled screenshots are
`lab/auth/*-switch-*.png`; earlier captures during transitions are not the
settled layout. Copy export now contains 251 strings, with existing product IDs
retained and deleted marketing text removed. No CI, app source, dependencies,
real authentication or XP implementation changed in this refinement.


## Full account preview and repeat welcome access

- `node .../lab/verify-auth.cjs`: four profiles passed (1440×1000 desktop,
  390×844 mobile, 360×640 compact, 390×844 reduced motion). Lesson → quiz → XP →
  signup → confirmation → login → reward preview is connected. Recovery retains
  XP; returning to welcome and repeating an answer does not duplicate XP.
  Organisation intent, validation, password visibility, resend and expired-link
  states pass. No external requests, page errors or horizontal overflow detected.
- Signup and login screenshots inspected at desktop and mobile sizes, alongside
  confirmation/success evidence under `lab/auth/`. No starting-point lesson block.
- `node .../lab/verify-review.cjs`: all 256 strings render, editing/filtering and
  downloading work, exported IDs and all entries remain present. Mobile has no
  horizontal overflow. Desktop/mobile review screenshots inspected.
- The same focused check visits the actual app on port 3000 with legacy
  `ve_welcome_seen_v1=true`: welcome renders, advancing works, and reload/revisit
  render welcome again. Useful welcome content is present in the first HTML.
  Initial harness selected the hidden responsive duplicate heading; corrected
  to use the visible accessible heading before the successful pass.
- Identity worktree: typecheck, targeted WelcomeCarousel ESLint and all 40
  guardrails pass. Initial guardrails used Node 22.14 without registerHooks;
  rerun with installed Node 22.17.1 passes. No full CI/E2E suite was run.
- This remains a local prototype. No real signup, OAuth, email, XP award or claim
  is performed. App change is limited to removing the once-only welcome gate.
  Copy approval and connected implementation remain pending; #91 stays Review.

Current evidence: `lab/auth/results.json`, `lab/auth/review-results.json` and PNGs.
Current scripts are manual design-review utilities, not required CI gates.
The two older scripts below target superseded dialogs and are historical only.

---

# Historical concept verification

## Learn-first refinement

The latest model is short lesson → quiz → XP → signup → rewards. Each of the
three samples now teaches a principle with a practical example and takeaway.
Selecting a topic scrolls to the lesson and focuses its heading. The quiz stays
hidden until Try the question; Read the lesson again returns without discarding
earned sample XP. The same reward and signup invitation follow a correct answer.

The updated `lab/verify-rewards.cjs` passes at desktop, mobile, compact mobile and
reduced motion. It now checks that teaching precedes the quiz, all three topic
lessons have distinct content, rereading retains XP, and the earlier reward and
handoff contracts still hold. Current evidence: `lab/learning-journey/results.json`
and the lesson/question/reward/signup screenshots in that folder. Earlier direct-
to-question evidence below is historical and does not describe current navigation.

## Accepted-direction refinement: question → XP → signup

The user accepted the visual direction and asked for automatic question reveal
and the missing reward journey. Selecting a topic now focuses and scrolls to
the question. Correct answers reveal illustrative XP, its rewards context and
Save my XP. The signup invitation retains the in-memory sample balance. Incorrect
answers give another try; revisiting or clicking a correct answer again never
awards duplicate sample points. Ten XP per topic is illustrative, not a live
earning-policy change. The existing app still owns actual signup and XP saving.

`node lab/verify-rewards.cjs` (from this build) checks desktop 1440×900, mobile
390×844, compact 360×640 and reduced-motion mobile. All pass: question visible
and focused, wrong answer awards zero, first correct answer awards 10, another
topic reaches 20, repeat stays 20, signup prompt retains the total, Escape
returns focus, org handoff remains `/org/create`, and no overflow or JS errors.
Evidence is in `lab/rewards/`. A first harness assertion raced the next-animation-
frame focus move; the corrected check waits for focus and the revealed result.
No repository CI or application E2E suite ran for this static-prototype change.

The prior whole-page evidence below is the baseline before this refinement;
the focused screenshots cover the new question/reward/signup states.

Date: 2026-09-12. Scope: static #91 proposal only. Issue remains Open / Review.

## Passed checks

- Scroll-craft doctor: Node, full FFmpeg, libwebp, Playwright, installed Chrome and
  workspace pass. Optional KIE key absent; built-in image generation was used.
- `node --check scrollcraft/builds/learning-in-motion/experience.js`: pass.
- `git diff --check`: pass. Both copied engine files match their skill originals.
- `node scrollcraft/builds/learning-in-motion/lab/verify.cjs`: five profiles pass:
  1440×900 desktop, 390×844 mobile, 360×640 compact, desktop reduced motion,
  mobile with JavaScript disabled. Results in `lab/final/interactions.json`.
- All three topics update their question and shared activity. Both answers give
  distinct feedback. Exactly one topic/answer is selected. No fake XP is awarded.
- Both handoffs target real `/login` routes; org keeps `/org/create`. Native dialog
  contains keyboard focus, Escape closes it and restores focus to the trigger.
- No horizontal document overflow; fully unfolded desktop papers do not overlap.
  Desktop-to-mobile resize changes the pinned scene into document flow.
- No JavaScript errors, failed asset requests or external requests in the focused
  checks. Hero image loads. No-JS answer disclosure and mission text are reachable.
- Scroll-craft harness sampled 18 desktop, 20 mobile and 19 reduced-motion frames.
  No dead scroll reported on the final pass. The custom desktop scene reports
  actual rendered paper positions; mobile/reduced motion use ordinary flow.
- Final contact sheets generated from those same frames using full FFmpeg and
  visually inspected: `lab/desktop-final`, `lab/mobile-final`, `lab/reduced-final`.
  Empty black cells in a contact sheet are unused grid slots, not captured pages.
- Page assets total approximately 912 KiB on disk, including the 141 KiB WebP,
  font, both engine files, page styles/script and HTML. Below the 1.5 MB target.

## Findings and corrections

- Initial desktop note covered a face; moved above the photographic subject.
  Removed a photo caption that the lesson selector obscured.
- First handoff draft used an unavailable `/signup` route. Replaced with the
  existing `/login`, with honest explanation that Sign up is offered there.
- First mobile view lost spaces at hidden line breaks. Added explicit whitespace.
- Initial mobile dead-scroll report came from an inappropriate static custom
  stage marker. Mobile has ordinary flow; removed the marker there. Final harness
  is clean. Initial evidence remains in `lab/mobile`.
- Switched shared reveal from an engine-pinned act to a page-local sticky scene
  so resizing and compact/reduced-motion fallback are coherent. Engine unchanged.
- Dimmed hidden sheet text until papers separate, avoiding exposed text fragments.
- Static colour checks found weak small-print and answer-outline contrast. Darkened
  footer/preview notes, feedback placeholder, group caption and answer borders.

## Limits and review

The browser checks use desktop Chrome with emulated viewports, not a physical
iPhone. No network throttling or production Core Web Vitals certification was
performed. The harness reports no moving-copy contrast results because this
concept has no engine cue text over media; stable colour-pair checks and visual
inspection were used instead. This is not a full WCAG certification.

Visual appraisal: opening now keeps faces and both routes readable; the question
creates a quieter beat; the retained lesson expands into shared practice at the
peak; the close restores two clear choices. This is an authored assessment, not
user research or approval. The full welcome/login/signup flow in #91 remains to
be implemented after design selection. No existing app screens were replaced.

## Reference transition correction, 2026-09-12

The user requested the exact Auth Switch transition style. The earlier 650ms
rounded-rectangle approximation is superseded. Motion values were read from the
supplied component's published bundle:
https://cdn.21st.dev/appvibed01/auth-switch/default/bundle.1761344359842.html

Desktop uses the reference's 2000px circle, top -10%, right 48% → 52%, 1.8s
ease-in-out sweep. Equivalent transforms avoid animating positional properties.
Forms travel over 1s after 700ms and crossfade over 200ms after 700ms. Separate
left/right invitations travel 800px over 900ms after 600ms. Mobile uses the
1500px circle and 2s vertical sweep, 1s/800ms form travel, 900ms/800ms invitation
travel, and the same crossfade. Card height accommodates the additional labels,
XP context and validation; geometric anchors remain proportional. Reduced
motion changes state immediately. Inactive invitation controls and temporary
outgoing form snapshots are inert, with focus restored after the transition.

The reference's overlapping form layout is preserved by measuring both form
heights; this prevents a vertical jump before the delayed travel. Validation
can expand the stage without clipping errors. The first visit does not animate.

`lab/verify-motion.cjs` checks durations/delays against the source and captures
0/600/800/1200/1800ms states; intermediate frames were visually inspected.
`lab/verify-switch.cjs` passes both directions, retained email, keyboard/focus,
settled layout and overflow checks on desktop/mobile/reduced motion. Evidence:
`lab/auth/motion/` and `lab/auth/switch-results.json`. No copy, dependency,
production auth, real XP, commit or deployment change.

Final transition revision: the full simulated auth journey also passes all four
profiles in lab/verify-auth.cjs, including confirmation, recovery, validation
and XP continuity.

## Supplied copy revision, 12 September 2026

Applied `project-ve-welcome-auth-copy-2026-09-12.txt` as a revised draft for
approval, preserving all 251 IDs, their order, variables and answer notes.
Updated static/no-JavaScript content, three topic dictionaries, shared XP copy,
all account states, metadata, accessibility labels and the copy review editor.
The image description matches the displayed group around a table. The hero's
“Try a lesson” now opens and focuses the sample lesson. Auth motion is unchanged.

Validation: copy bindings and all three lesson/question/feedback sequences pass
at 1440, 390 and 360px; the auth dictionary matches every supplied AUTH entry.
The no-JavaScript lesson fallback matches. `lab/verify-auth.cjs` passes four
profiles including confirmation, recovery, validation, organisation context,
XP continuity and no external requests. `lab/verify-switch.cjs` passes desktop,
mobile and reduced-motion focus/geometry checks. Desktop and mobile screenshots
were inspected in `lab/copy/` and `lab/auth/`. Syntax checks and `git diff --check`
pass. These are local prototype checks, with no repository CI or hosted rollout.

Visual review also caught the skip link becoming visible under the existing
reduced-motion transform reset. Its hidden position now uses `top`, keeping it
available on keyboard focus without overlaying lesson content. Draft status is
retained; the connected product has not gained guest XP or authentication from
this preview. No commits or deployment.
