# AI experience touchpoint inventory

Source audit: 5 September 2026. Scope: current application routes, rendered
components, their actions and the generation services they call. This inventory
makes no product changes and does not establish live provider/worker health.
“Connected” below means the UI calls an implemented action, not that a generation
was run during this audit.

## Authoring touchpoints

| Touchpoint | Location and editor interaction | Current behavior / audit notes |
| --- | --- | --- |
| Course creation entry | Courses → Create → “Create with AI” (`/admin/courses/choose`) | Shares the starting screen with manual creation and Remix. The AI tile is visible before the destination checks workspace entitlement. |
| Course brief | `/admin/courses/ai/brief`: learning need, audience, tone; “Generate a curriculum” | Connected to the planner. Region is fixed to Nigeria and level to beginner through hidden fields. Includes an AI credits link and a Generating state. |
| Suggested outline | `/admin/courses/ai/result?plan=…`: AI suggested badge, course description, lesson titles, “Use this outline”, “Try again” | Planner creates three options, but this screen displays only the first and submits option index zero. The visible outline cannot be edited here. Try again returns to the brief. |
| Full course drafting | “Use this outline” on the result screen | Queues course generation and returns to Courses with a job notice. This is a separate operation from generating the outline. |
| Suggest more lessons | Curriculum → “Suggest lessons with AI” → `/admin/courses/[id]/expand` | Notes plus an expansion goal. Includes gap filling, beginner/advanced content, practice, recap, progression and follow-up course goals. Requests three suggestions. Entitlement-aware entry. |
| Accept suggested lessons | `/admin/courses/[id]/expand-result?plan=…`: “Add” beside each suggestion | Queues lesson generation and returns to the curriculum. Copy promises a Needs review label; current curriculum rows show Published, Archived or Draft only. |
| Suggest a lesson page | Pages sidebar → “Suggest next page” disclosure | Page-type suggestion, optional focus and “Suggest page with AI”. Queues a background job; server reads saved lesson content. Entry is hidden when AI authoring is unavailable. |
| Generate a quiz question | Quiz step → “Generate with AI” beside Add question | Queues one question based on saved lesson content. No visible prompt/type controls. The button is always rendered in this component; the action enforces lesson entitlement. It uses a plain submit button rather than the shared pending button. |

Sources:
- `app/admin/courses/choose/page.tsx`, `ai/brief/page.tsx`, `ai/result/page.tsx`, `ai/brief-actions.ts`.
- `app/admin/courses/[id]/expand/page.tsx`, `[id]/expand-result/page.tsx`, `expand-actions.ts`, `planner-actions.ts`.
- `features/learning/admin/planner-commands.ts`, `components/admin/CurriculumOutlineEditor.tsx`.
- `features/learning/admin/lesson-page-builder-ui.tsx` (`AiSuggestPageForm`, `AiSuggestPageDisclosure`).
- `components/admin/AssessmentBuilder.tsx`, `app/admin/courses/ai-actions.ts`.

## Media touchpoints

| Touchpoint | Where it appears | Current behavior / audit notes |
| --- | --- | --- |
| Shared image-picker AI tab | Course creation/settings imagery, curriculum lesson thumbnails, lesson page covers, image blocks, Media library → Add media | `MediaPickerProvider` renders `MediaPickerScreen`. For images, it shows Generate with AI, a prompt, a rights checkbox, AI credits and Generate image. The button only displays a message that prompt-based generation is not wired up; no generation request is made. The tab uses media type but ignores the supplied `aiGenerationAvailable` flag. |
| Generation from an existing media brief | Course settings → media workspace → older embedded `MediaPicker` | A separate Generate with AI tab calls a real generation action for a pre-existing course/lesson media slot. It is gated by entitlement, supported type and provider availability. Images/infographics are supported; video/audio/GIF generation is not. Without a brief/action, it explains that generation needs a seeded brief. |
| Generate media for a course | Course settings media workspace, particularly its empty state | Generate Media queues course media generation. Missing required previews and failed assets are surfaced as blockers. |
| Regenerate an individual asset | Course settings → selected media slot | Regenerate; Refine/Regenerate Using Feedback; image continuity and review controls. These use existing generation actions. |
| Edit a media brief | Course settings → selected slot’s detail fields | Exposes asset type, placement key, review status, prompt, script and exclusion controls. This puts implementation-oriented wording into the editor’s workflow. |
| Review generated assets | Course settings media workspace and lesson Review | Asset approval, required/optional asset messages, missing/failed states and the lesson image-review action. Generation and approval are separate steps. |
| Provenance hints | Linked lesson image block; course settings Source field | “Linked to an AI media brief” guidance and “Created with AI assistance”/Manual course metadata. Audience helper copy also mentions AI generation guidance. |

Sources:
- `components/admin/MediaPickerProvider.tsx`, `MediaPickerScreen.tsx`, `MediaPicker.tsx`, `MediaManager.tsx`.
- Picker callers: `CreateCourseForm.tsx`, `LearningForms.tsx`, `CurriculumOutlineEditor.tsx`, `features/learning/admin/lesson-page-builder-ui.tsx`.
- `app/admin/courses/[id]/settings/page.tsx`, `features/learning/admin/course-media-workspace.tsx`.
- `components/admin/CourseAudienceField.tsx`, `components/admin/LessonReviewSummary.tsx`.

## Review, progress and account touchpoints

| Touchpoint | Location | Current behavior / audit notes |
| --- | --- | --- |
| Lesson text and image review | Lesson Review → Before you publish | Explicit confirmations and Mark text reviewed / Mark images reviewed. Image confirmation requires approved text and valid required assets. Missing images link to course settings. These controls are conditionally shown for AI-generated lessons. |
| Lesson/quiz publication gates | Lesson Publish / quiz publication | AI text/media approval is enforced by server actions/API, separately from draft saving. Lesson Publish routes an unready AI lesson into Review. |
| Course review and publishing | `/admin/courses/[id]/review` | AI-generated text reviewed and AI-generated media reviewed are readiness checks alongside general editorial checks. The text blocker links back to this same review route; the media blocker links to settings. The page itself only offers general editorial approval, not direct AI text approval. Resolution links need review so editors reach the actual unfinished lesson/content. |
| Cross-course pending work | `/admin/courses/pending-actions` | Separates general readiness work from “AI content awaiting review”, with Text/Media items. It uses readiness blockers, not generation-job progress. |
| Generation progress and return paths | Notices after course, lesson, page, quiz and media generation | Jobs are queued, then the editor is redirected to Courses, curriculum, page editing or quiz editing. Notices expose job IDs and wording such as “when the worker runs” and “materialize”. Page/quiz copy says results will appear, but these editor components have no generation-specific polling/completion subscription. The builder’s existing refresh is for another action. |
| Credits and usage | `/admin/courses/ai-credits`; linked from Courses, AI briefs, lesson expansion and image picker | Shows used/allocated credits, near-limit notice, monthly/temporary/top-up balances and recent activity. Activity exposes operation names and statuses from metering records. It is usage history, not a unified job monitor. Platform catalogue work is described as not metered against organisation credits. |
| Organisation AI controls | `/admin/organizations`, `/admin/organizations/[id]`; entitlement rejection notices | Platform controls include allocations, warning/hard limits, per-user daily rate and organisation concurrency. AI authoring availability is enforced in server guards. UI visibility is inconsistent across entry points. |

Sources:
- `components/admin/LessonReviewSummary.tsx`, `LessonPageBuilder.tsx`.
- `app/admin/courses/[id]/review/page.tsx`, `pending-actions/page.tsx`, `review-actions.ts`.
- `features/learning/admin/course-readiness.ts`.
- `app/admin/courses/ai-actions.ts`, `ai-credits/page.tsx`, `app/api/admin/learning/publish-lesson/route.ts`.
- `app/admin/organizations/page.tsx`, `[id]/page.tsx`.
- `features/organizations/admin/entitlement-guards.ts`, `features/ai-generation/application/organization-ai-metering.ts`.

## Implemented services without a current equivalent visible control

- The older `LessonDetailAiMediaSection` still exists but has no active consumer
  in the current application. It contains lesson media generation/regeneration,
  manual-media approval, feedback/change requests and detailed asset editing.
  Its controls must not be counted as currently reachable lesson UI.
- Course text approval, requesting text changes and revising course text with AI
  remain implemented in actions/application services. There is no current JSX
  caller for the corresponding course controls found in this audit.
- `/admin/courses/ai/new` redirects to the brief. The old AI planner page and
  activity panels have been removed in the current working tree.
- `/api/admin/ai/jobs/process` is a protected worker endpoint, not an editor
  control. Queue processing, retries and usage reservation/charging exist behind
  the UI; that does not provide the editor a visible progress/recovery journey.

## Adjacent experiences that are not AI generation

- Remix a course copies an existing course structure through
  `duplicateCourseShell`; it does not invoke a model.
- Values and personalised lesson recommendations use value metadata and scoring;
  they are not a generative AI interface.
- Lesson Review includes a local interactive quiz preview. Preview does not
  generate content, approve content or write learner progress/XP.
- No learner-facing AI chat/tutor or separate AI generation surface in missions,
  rewards or ads was found in the current routes/components. The provider clients
  found are the course planner, learning-content generator and media generator.

## Cleanup priorities emerging from this inventory

1. Resolve the two incompatible media-generation experiences, including the
   currently nonfunctional prompt-based Generate image control.
2. Make generation states consistent: input → generating → usable result →
   review, with clear completion/failure/retry paths and no worker/job terminology.
3. Align entitlement visibility across course creation, quiz generation and the
   shared media picker, while retaining server enforcement.
4. Make every review blocker lead to an actionable resolution. Align promised
   Needs review labels with the actual curriculum states.
5. Clarify the outline-to-full-course handoff and the fact that only one of three
   generated outlines is currently presented.
6. Standardise labels and visual treatment (Create, Suggest, Generate, Add,
   Refine, Regenerate; violet/sparkle treatments versus normal authoring controls).
7. Verify save-before-generation behavior: page/question generators use saved
   data while editors may have unsaved changes. This is an audit risk to test,
   not a reproduced data-loss finding.

This is an inventory and source review. No generation jobs, paid provider calls,
UI changes, entitlement changes or publishing actions were performed.
