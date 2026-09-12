# Learning in motion: entry concept for #91

Self-authored under explicit creative delegation. This is a design prototype,
not a replacement authentication system or evidence of production completion.

## Evidence and eight decisions

1. Vibe: user asks for something "engaging like this project from 21st.dev but
   tailored to our product's core". Their supplied MusicHero component uses a
   dimensional central object, a tactile selector and a separately composed
   mobile view. Authored direction: human, tactile, curious, purposeful.
2. Journey: earlier user decision, "both equally" and "Start learning or create
   an organisation directly." Authored sequence: invitation and topic selector;
   a real sample question; the idea applied with others; two clear entry paths.
3. Energy: authored expressive opening, quiet choice, expansive shared-learning
   peak, clear settled close. No mandatory waiting or scroll hijacking.
4. Feeling: see curve below. The user rejected static identity studies and old
   beige surfaces. This must feel like an experience, not a recoloured login.
5. Signature: authored "one choice, shared possibility". Choose a lesson topic,
   answer its situation and see the same selected idea become a group activity.
   Selection changes meaningful content, not just the colour of the scenery.
6. Aesthetic: authored editorial chapters with tactile product objects. Accepted
   aubergine #583c63, Source Sans 3 and exact aperture mark. Cool lilac light,
   deep plum shadows and real photography. No beige canvas or neon/glow text.
7. World: authored distinct scenes, connected by the selected lesson. No expensive
   unbroken camera flight. This uses the user's prior creative delegation.
8. Assets: canonical mark/fonts from identity worktree. Generate one photographic
   Nigerian learning scene with the built-in image tool. Label it as concept
   imagery in provenance. No synthetic testimonial, user count, or fake XP.

## Feeling curve, before the score

- Invitation: "This feels alive and relevant." Layered people-and-lesson object
  responds subtly to the pointer while every entry action stays stable.
- Agency: "I can try this." A short, untimed sample question accepts either
  answer and gives specific explanatory feedback, without demanding an account.
- Possibility (peak): "We could use this together." The selected lesson unfolds
  into a discussion and a real-world mission, retaining the visitor's topic.
- Confidence: "I know where to go." Equally prominent learner and organisation
  entry choices, with sign-in always available.

Tell-someone sentence: "It's the site where I tried a real-life choice and saw
how to turn that same lesson into something my group could do together."
The quiet question has no forced delay. There is no authored empty scroll.

## Grammar and score

Custom grammar: an interactive learning invitation. The earlier working label
"editorial chapters" was too broad: that grammar requires a paper title page
without first-screen media, which conflicts with this reference. Live surface
also excludes the photographic invitation. This hybrid has explicit constraints:
an unfixed brand/navigation row, a dimensional lesson selector in the first
screen, one operable untimed example before the organisational pitch, exactly
one short unfolding scene, and a two-path close retaining the selected topic.
Native page scroll, durable text and asymmetric layouts. No spotlight or magnet. The
reference's global wheel cancellation and autoplay clicks are intentionally not
part of this design; they would interfere with access to the product.

Four distinct device families, with no adjacent repetition:

| Act | Family | What changes |
| --- | --- | --- |
| Invitation | pointer tilt + independently offset planes | scene, foreground note and background plane have different depth |
| Try a choice | flow + entrance | the page settles around an operable sample lesson |
| Shared possibility | pin + reveal | one lesson unfolds into a shared discussion and mission during a short meaningful span |
| Entry | typographic reveal | large closing phrase resolves above two explicit next steps |

Hero layer contract: dark architectural aperture/background plane, photographic
subject inside a shaped window, foreground selected lesson strip and separate
practice note, atmospheric soft directional lilac light. Photo and planes move
independently, all text controls sit on stable readable surfaces. No floating
icons that imply invented activity. On mobile: copy, actions, compact photo
stage, then full-width topic list; no desktop orbit squeezed into portrait.

Difference from prior rejected aperture-convergence study: narrative changes
from identity explanation to trying a choice; opening changes from abstract mark
to people plus operable lesson; peak from mark convergence to selected lesson
becoming group practice; close from specimen review to two entry paths. Font and
brand palette deliberately remain continuous.

## Functional and fallback contract

- Topic buttons update the scene label, sample question and shared activity.
- Choices produce useful local feedback. Sample activity never awards real XP.
- Entry actions open the full account design preview with the selected role.
  Forms use made-up details locally; nothing is submitted or persisted as
  credentials. Confirmation, recovery and success states are reviewable.
- Native scroll, keyboard focus and reduced-motion support. Mobile and reduced
  motion flatten the short pinned composition into normal document flow.
- Without JS all copy and both entry paths remain visible, and the sample has a
  readable answer in a details disclosure. No WebGL dependency or video payload.
- No backend/API calls. Budget: no external runtime dependencies, one image,
  one font, engine plus page-local JS; target total assets below 1.5 MB after
  image optimisation, no layout shift from unsized media. Measure actual bytes.

## Review boundaries

Latest user correction: the complete journey is short lesson → quiz → XP →
signup → use points for rewards. The canvas now begins with actual teaching,
not a question. All three topics have a short principle, practical example and
takeaway. Topic selection scrolls/focuses the lesson. Try the question reveals
the quiz with a deliberate action; Read the lesson again preserves earned
sample XP. There is no forced reading timer. Without JavaScript the default
lesson precedes the question in document order. This supersedes the earlier
direct-to-question navigation below.

The user accepted the visual direction and requested two refinements: selecting
a topic must reveal its question, and a correct answer must lead through XP into
a signup invitation for saving points towards rewards. The revised prototype
uses a clearly labelled illustrative 10 XP per question, awarded once per topic
in tab-local session storage. Incorrect answers allow another try. The reward invitation carries
the total into the signup prompt; this is not a live XP balance or claim.
Production implementation must connect a server-validated, idempotent guest
award/claim to the existing XP system and preserve it through signup, rather
than trusting client-supplied points. The 10 XP amount is a design assumption,
not an approved live earning policy. Actual signup remains the existing app's
login/signup surface until connected implementation is approved.

Do not commit, deploy, replace the app's welcome page or mark #91 implemented.
Verify desktop, 390px mobile, compact 360px, reduced motion, no JS, keyboard,
topic selection, answers and handoffs. Preserve evidence from failed passes.

## Account preview and copy review, 2026-09-12

The user requested removing the selected starting-point lesson from signup and
finishing the account design for a complete preview. That block is removed.
The XP summary is retained across signup, confirmation, login and recovery.
The dark dimensional invitation becomes a calm two-column account composition;
mobile uses a compact brand/XP summary above the form. Back to welcome is always
available. No additional live auth provider, award or claim behaviour is added.

The user also removed the once-only welcome policy. A narrow change in the
identity worktree removes the legacy storage redirect and blank readiness gate.
The existing welcome design is not replaced by the static proposal yet.

All 256 draft strings are available for editing in copy-review.html and
COPY-REVIEW.md, with stable IDs. Copy approval and connected implementation
remain pending; keep #91 Open / Review.

## Simplified account switch, 2026-09-12

User feedback: “the login/signup screens are to busy”. Reference supplied:
https://21st.dev/@appvibed01/components/auth-switch/auth-switch
The reference was inspected in-browser in both modes: a curved colour panel
slides between sides while the form swaps. Its interaction is adapted locally
with Project VE plum, bounded form width, a short invitation, one switch action
and a single-line sample XP reminder. The previous photo, oversized marketing
headline and repeated account-switch prompts are removed. Mobile uses a compact
switch strip above full-width fields. Reduced motion disables travel; inactive
forms are removed from the accessibility tree. No reference global CSS, emoji
field icons, unsupported social providers or placeholder counter were imported.
Existing auth/XP preview behavior remains local. React, TypeScript, Tailwind and
Radix are already present in the identity worktree; component convention is
components/ui and global styles are app/globals.css. This iteration changes the
review prototype, not the connected production authentication implementation.

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
