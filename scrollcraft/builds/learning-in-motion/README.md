# Learning in motion

Local interactive design proposal for Project VE issue #91, prepared with the
scroll-craft skill. Preview at http://127.0.0.1:3341/ while the local server runs.

```sh
python3 -m http.server 3341 --bind 127.0.0.1 --directory scrollcraft/builds/learning-in-motion
```

Choose a topic, read a short lesson, try its question and earn illustrative XP.
Save my XP opens the new account preview, with no starting-point lesson block.
Signup, email confirmation, login, Google handoff, password recovery and success
states are interactive. Sample XP survives navigation and reload in this tab;
repeat correct answers do not award it again. Organisation entry retains its
intent through authentication and leads to the setup handoff.

- Welcome: http://127.0.0.1:3341/
- Signup: http://127.0.0.1:3341/auth.html?mode=signup
- Login: http://127.0.0.1:3341/auth.html?mode=login
- Editable copy review: http://127.0.0.1:3341/copy-review.html
- Approved source strings (251): `COPY-REVIEW.md` and `copy-review.json`.

Use made-up details in these local forms. Nothing is sent; no account, real XP,
reward claim or organisation is created. Only sample topic IDs and preview-claim
state enter session storage; credentials are not persisted. The connected application now lives in app/page.tsx, app/login and components/entry; this retained prototype remains isolated. See docs/evidence/theme-adoption/entry-integration.md for qualification and release status.

The connected root welcome also remains available on repeat visits; it does not use a seen-once storage flag.

## Files and provenance

- `BRIEF.md`: creative decisions, scope, layer contract and interaction score.
- `index.html`, `experience.css`, `experience.js`: original semantic prototype.
- `rewards-preview.js`, `preview-session.js`: isolated sample XP and tab-local state.
- `auth.html`, `auth.css`, `auth.js`, `auth-copy.js`: interactive account preview.
- `copy-review.*`, `COPY-REVIEW.md`: editable copy inventory and export.
- `scrollcraft.js` and `scrollcraft.css`: unchanged copies of the installed skill
  engine. The short unfolding scene is page-local CSS sticky positioning and JS.
- `assets/mark.svg`: exact Project VE aperture A2 from the identity worktree.
- `assets/SourceSans3.ttf`: accepted brand font; licence alongside it.
- `assets/learning-scene.webp`: AI-generated concept photograph of Nigerian peers
  discussing an idea, created with the built-in image tool. It does not depict
  actual Project VE users. Original: `exec-514948be-07a8-4e56-8f87-de1d7770a27d.png`
  in this task's generated image directory; encoded to WebP at quality 86.
- User-supplied 21st.dev MusicHero code informed tactile layering and the separate
  mobile composition. Its source, audio, footage and global scroll lock were not
  copied into this build.

## Verification

See `VERIFICATION.md`. Current manual checks use `lab/verify-auth.cjs` and
`lab/verify-review.cjs` with local Chrome and both servers running. They are
prototype review tools, not CI gates. The older `verify.cjs` and
`verify-rewards.cjs` preserve historical handoff evidence and target superseded
screens; do not use them against the current full account preview.

The account preview now follows the supplied Auth Switch reference: a curved
plum panel slides between login and signup; mobile uses the reference’s vertical circle sweep. `lab/verify-switch.cjs` covers switching, retained email, keyboard focus,
settled panel geometry and reduced-motion/mobile layouts. Current copy review
omits the removed marketing panel. No new dependencies were installed.

The exact timing correction is recorded in VERIFICATION.md. `auth-motion.js`
owns the delayed form crossfade; `lab/verify-motion.cjs` verifies intermediate
frames and timing. This supersedes the first rounded-panel approximation.

Copy revision, 12 September 2026: the supplied 251-string draft is applied to
welcome, all samples and account states. “Live what you learn.” is the opening;
“Save my progress” continues to signup. `copy-review.json` retains stable IDs;
`lab/export-copy.cjs` exports that inventory without rediscovering/renumbering
strings from the DOM. The user approved this copy and authorised connected app implementation on 12 September. The hero’s “Try a lesson” opens the lesson with focus and scroll.
