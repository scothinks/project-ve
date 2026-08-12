# Project Ve CMS and LMS Product Remediation Plan

## Purpose

Project Ve’s engineering remediation is complete.

The next phase is a product remediation of the administration experience and a staged evolution toward a hybrid institutional LMS.

This plan addresses:

1. the current crude course and lesson CMS;
2. fragmented AI, media, review and publishing workflows;
3. missing programme, organisation and learner-assignment capabilities;
4. the long-term hybrid model combining:

   * Project Ve’s public values-learning catalogue;
   * shared Project Ve content used by institutions;
   * organisation-private content and programmes;
   * institution-specific missions, rewards, cohorts and reporting.

This is **not** a request to build a generic Moodle replacement.

Project Ve’s differentiating product thesis is:

> A values-formation and behaviour-change platform combining assessment, personalised learning, practical missions, reinforcement, institutional programmes and measurable outcomes.

## Current governing addenda

The Phase 1.5 scope now lives in:

```text
docs/project-ve-cms-lms-phase-1-5-org-mode-institutional-pilot-readiness.md
```

That addendum is the authoritative product reference for Org Mode and institutional pilot readiness. It inserts Phase 1.5 between the completed P1 Hybrid LMS foundation and P2 Enterprise and institutional expansion.

Do not begin P2 work until the required Phase 1.5 batches have been implemented, tested, accepted and closed.

---

# 0. EXECUTION INSTRUCTION

### Mandatory CMS component foundation

For the P0 CMS remediation, use the following standard component stack:

```text
shadcn/ui with Radix primitives
dnd-kit
Tiptap
TanStack Table
```

Do not introduce a competing component library, rich-text editor, drag-and-drop library or data-grid framework without explicit approval.

Do not recreate components already supplied by the approved libraries unless Project Ve requires a genuinely product-specific interaction.

Existing custom Project Ve components may remain where they are already suitable. New CMS interactions should use the approved foundation consistently.

---

## Implement P0 only

Codex must implement only the tickets marked:

```text
P0
```

After P0 implementation:

1. run the complete existing engineering validation suite;
2. add and run relevant CMS tests;
3. produce a completion report;
4. stop;
5. return the updated repository for product review.

Do **not** begin P1 or P2 work until the P0 implementation has been reviewed and explicitly approved.

P1 and P2 are included to ensure the P0 architecture does not block the future LMS direction.

They are not authorised for implementation yet.

---

# 1. PRODUCT CONTEXT

## 1.1 Current state

Project Ve currently includes:

* courses;
* lessons;
* lesson pages;
* structured content blocks;
* quizzes and grading;
* page and lesson progress;
* AI-assisted course and lesson generation;
* media generation and approval;
* editorial review states;
* missions;
* XP;
* rewards;
* public learning recommendations;
* admin operations.

The backend capability is significantly stronger than the CMS interface.

The current administration experience is organised around technical entities and internal workflow states rather than editorial tasks.

Examples include:

```text
Courses
Media registries
AI text states
AI media states
Lesson statuses
Quiz statuses
Campaigns
Inventory
XP
Proof reviews
```

The target experience must instead be organised around user goals:

```text
Create learning
Structure a curriculum
Author lessons
Build assessments
Review content
Publish
Assemble programmes
Assign audiences
Measure outcomes
```

---

## 1.2 Hybrid product direction

Project Ve will ultimately support:

### Public Project Ve learning

* global public values catalogue;
* public assessments;
* personalised learning;
* public missions and rewards;
* public campaigns.

### Institutional workspaces

Potential institutional users include:

* police;
* civil defence;
* military;
* churches;
* schools;
* NGOs;
* public agencies;
* employers.

Institutions may eventually:

* use shared Project Ve courses;
* adapt Project Ve courses;
* create private courses;
* create programmes;
* add cohorts;
* assign learners;
* create missions;
* fund rewards;
* review progress;
* measure outcomes.

### Content scopes

Future architecture must allow:

```text
PLATFORM
ORGANISATION_PRIVATE
ADAPTED_FROM_PLATFORM
```

P0 does not need to implement tenant ownership, but the CMS structure must not assume every course will forever be a globally public Project Ve course.

---

# 2. PRODUCT PRINCIPLES

Apply these principles throughout the work.

## 2.1 Design around workflows, not tables

Do not expose every internal database state as a peer UI control.

An editor should understand:

```text
Draft
Needs attention
In review
Approved
Published
```

without needing to interpret all internal AI, media and persistence statuses.

---

## 2.2 Preserve structured content

Keep the current model:

```text
course
→ lesson
→ page
→ structured content block
```

Do not replace the lesson model with one large rich-text document.

Rich text may be introduced inside appropriate text blocks.

---

## 2.3 One editorial lifecycle

Manual and AI-generated content should use one editorial lifecycle:

```text
Draft
→ In review
→ Changes requested
→ Approved
→ Published
→ Archived
```

AI provenance and generation status may remain visible as secondary metadata.

AI-generated content must not live in a separate editorial universe.

---

## 2.4 AI is an assistant, not the CMS architecture

AI actions should help an editor:

* plan;
* draft;
* rewrite;
* expand;
* generate assessment questions;
* generate media briefs;
* apply review feedback.

AI status should not dominate the course workspace.

---

## 2.5 Publishing must be understandable

There must be one authoritative course-readiness view.

Do not scatter publishing responsibility across:

* lesson status;
* quiz status;
* AI text approval;
* AI media approval;
* asset review;
* course status;
* isolated publish buttons.

---

## 2.6 Do not build decorative abstractions

Do not introduce large generic editor frameworks merely to satisfy this plan.

Implement the simplest maintainable architecture that produces a coherent CMS.

---

# 3. REQUIRED UI FOUNDATION

The libraries in this section are **required**, not optional recommendations.

Codex must install, configure and use them during the P0 CMS remediation where their respective capabilities apply.

Do not substitute equivalent libraries without explicit approval.

---

## 3.1 Component primitives: shadcn/ui and Radix

Use:

```text
shadcn/ui
Radix primitives
```

as the standard CMS component foundation.

Use these primitives for new or remediated CMS interactions including:

* tabs;
* dialogs;
* alert dialogs;
* sheets and drawers;
* dropdown menus;
* context menus;
* tooltips;
* popovers;
* command menus;
* toasts;
* form controls;
* checkboxes;
* switches;
* select controls;
* collapsible sections;
* accessible menus;
* loading and empty states where applicable.

Requirements:

* preserve Project Ve’s visual identity;
* style components through the existing Tailwind design system;
* do not make the CMS look like an unmodified shadcn demo;
* use Radix accessibility and focus-management behaviour rather than recreating it manually;
* replace native `window.alert()` and `window.confirm()` in P0 CMS workflows;
* avoid introducing parallel custom dialog, toast, tab or dropdown systems.

Existing custom primitives may remain where they already meet the required accessibility and workflow standard.

Do not rebuild standard primitives merely because Codex enjoys making buttons from first principles.

---

## 3.2 Sorting and drag-and-drop: dnd-kit

Use:

```text
dnd-kit
```

for sortable CMS interactions.

Required P0 uses include:

* curriculum lesson ordering;
* page ordering;
* content-block ordering;
* assessment-question ordering.

Requirements:

* support pointer interaction;
* support keyboard reordering;
* provide visible drag handles;
* provide clear drop indicators;
* persist ordering through existing authorised application actions;
* handle failed persistence without silently leaving the interface in a false state;
* preserve existing up/down controls only as an accessibility fallback where useful, not as the primary interaction.

Do not create separate custom drag-and-drop implementations for each editor.

Create shared sortable primitives where the interaction is genuinely reusable.

---

## 3.3 Rich-text editing: Tiptap

Use:

```text
Tiptap
```

for rich-text editing inside supported text-oriented content blocks.

Do not replace Project Ve’s structured content model with one unrestricted rich-text document.

The content model remains:

```text
course
→ lesson
→ page
→ structured block
```

Tiptap should provide editing within relevant blocks, such as:

* body text;
* callout text;
* explanatory content;
* scenario content;
* other text-capable blocks.

Initial supported formatting should include:

* paragraphs;
* bold;
* italic;
* links;
* bullet lists;
* numbered lists;
* headings permitted by the block type;
* undo and redo within the editor.

Requirements:

* sanitise persisted output;
* preserve existing learner rendering;
* preserve compatibility with AI-generated content;
* preserve accessibility;
* avoid arbitrary unsupported HTML;
* provide a clear migration or compatibility path for existing plain-text block content.

Do not introduce Lexical, Slate, Quill or another rich-text engine alongside Tiptap.

---

## 3.4 Advanced tables and content grids: TanStack Table

Use:

```text
TanStack Table
```

for CMS lists that require advanced interaction.

Required or expected use cases include:

* course index;
* future learner and cohort indexes;
* media library where table presentation is appropriate;
* review queues;
* other administrative grids requiring controlled state.

Use TanStack Table where the screen needs:

* sorting;
* filtering;
* pagination;
* row selection;
* bulk actions;
* controlled column state;
* consistent empty and loading states.

Do not force every simple list into a table abstraction.

For curriculum outlines, page trees and other hierarchical content, use purpose-built interfaces instead.

Project Ve should control the rendered markup and visual design. TanStack Table supplies state and behaviour, not the product’s appearance.

---

## 3.5 Shared CMS design system

Create or extend a shared CMS component layer around the approved libraries.

Recommended location:

```text
components/admin/ui/
```

or another clearly documented equivalent.

The shared layer should provide Project Ve-specific wrappers and patterns for:

```text
CmsTabs
CmsDialog
CmsAlertDialog
CmsSheet
CmsToast
CmsDropdownMenu
CmsFormField
CmsStatusBadge
CmsSaveIndicator
CmsEmptyState
CmsSortableList
CmsDataTable
CmsRichTextEditor
```

Names may vary, but responsibilities should remain clear.

Do not create wrappers that merely rename every library component without adding meaningful Project Ve behaviour or styling.

Shared components should encode:

* Project Ve visual styling;
* accessibility defaults;
* loading behaviour;
* error behaviour;
* consistent spacing;
* status presentation;
* destructive-action handling;
* editor save-state conventions.

---

## 3.6 Dependency acceptance criteria

P0 is not complete unless:

* shadcn/ui and Radix primitives are installed and used in the redesigned CMS;
* dnd-kit powers the required sortable interactions;
* Tiptap powers supported rich-text block editing;
* TanStack Table powers the redesigned course index or another justified advanced CMS grid;
* no competing libraries are introduced without explicit approval;
* native alerts and confirms are removed from P0 CMS workflows;
* shared Project Ve CMS primitives are documented;
* keyboard accessibility is preserved;
* existing learner-facing rendering remains compatible;
* the production build and all CMS tests pass.

---

# 4. TARGET ADMIN INFORMATION ARCHITECTURE

The long-term admin navigation should be prepared for:

```text
Home

Learning
├── Courses
├── Templates
├── Assessments
└── Media library

Programmes
├── Programmes
├── Cohorts
├── Assignments
└── Certificates

Engagement
├── Missions
├── Rewards
└── Campaigns

People & Insights
├── Learners
├── Reports
├── Proof reviews
└── XP activity

Administration
├── Members and roles
├── Organisation settings
└── Platform settings
```

P0 should implement only the currently relevant grouping and placeholders needed to support the future structure.

Do not implement non-functional LMS menu items merely to display them.

---

# P0: CMS PRODUCT REMEDIATION

The P0 objective is:

> Make the existing Project Ve course-authoring and publishing system coherent, efficient and usable as a professional editorial CMS.

P0 must not implement full multi-tenancy, programmes, cohorts or institutional reporting.

---

# CMS-IA-001

## Redesign the admin information architecture

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* grouped the admin shell into Home, Learning, Engagement, Operations and Settings;
* preserved all previously exposed admin sidebar destinations;
* added Radix Collapsible navigation sections for desktop and mobile;
* added active-route state with `aria-current`;
* added route-derived breadcrumbs, including course workspace and lesson editor breadcrumbs;
* added a stable platform workspace context area without implementing organisations;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`;
* local Playwright screenshot smoke test reached the login redirect, so authenticated admin-shell visual QA still requires an admin session.

### Current problem

The admin navigation is a flat list mixing:

* learning content;
* engagement tools;
* rewards and inventory;
* moderation;
* system settings;
* reporting.

Primary affected area:

```text
components/admin/AdminShell.tsx
```

The current navigation reflects implementation domains rather than administrator workflows.

### Required changes

Group existing destinations into clear sections.

Recommended P0 structure:

```text
Home

Learning
├── Courses
├── Recommendations
└── Content / media where applicable

Engagement
├── Missions
├── Campaigns
├── Rewards
├── Perks
└── Inventory

Operations
├── Redemptions
├── Proof reviews
├── Users
└── XP activity

Settings
├── XP settings
└── other existing platform settings
```

Requirements:

* preserve existing route access;
* preserve role-based access;
* use collapsible or clearly separated navigation groups;
* add clear active-route state;
* provide useful breadcrumbs inside course and lesson workspaces;
* include a stable area for future organisation context without implementing organisations yet;
* ensure mobile and smaller-screen admin navigation remains usable.

### Acceptance criteria

* administrators can distinguish learning, engagement, operations and settings;
* existing admin routes remain reachable;
* active route is always obvious;
* course and lesson screens include meaningful breadcrumbs;
* navigation works on desktop and mobile;
* no non-functional future LMS links are displayed.

---

# CMS-LIST-001

## Upgrade the course index into a content workspace

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* replaced the flat course table with a TanStack Table-powered course workspace;
* added URL-preserved search, status, category, level and sort controls;
* added pagination that preserves active filters;
* changed the primary row action to `Open workspace`;
* moved enable/disable into a secondary Radix Dropdown Menu;
* added draft course-shell duplication through the existing admin course RPC;
* added course scope placement showing current `Project VE` platform ownership;
* added lesson count, last updated, editorial status and lightweight readiness issues;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`;
* deep curriculum duplication is intentionally deferred to curriculum authoring work.

### Current problem

Affected:

```text
app/admin/courses/page.tsx
```

The current course page behaves primarily as an administrative table.

It lacks sufficient support for:

* search;
* filters;
* ownership/scope readiness;
* editorial status;
* content readiness;
* duplicate/template actions;
* identifying courses requiring attention.

### Required changes

Introduce:

* search by course title and relevant metadata;
* filter by course status;
* filter by category;
* filter by level;
* sort by last updated;
* sort by title;
* pagination that preserves filters;
* clear course readiness/status;
* direct Edit/Open Workspace action;
* duplicate-course action;
* archive or enable/disable action placed in a secondary menu;
* clear Create Course primary action.

Each course row/card should show, where available:

```text
Title
Category
Level
Editorial status
Lesson count
Readiness/issues
Last updated
```

Prepare a visual location for future ownership scope:

```text
Project Ve
Organisation
Adapted
```

Do not add the underlying tenant model in P0.

### Acceptance criteria

* editors can find a course by title;
* editors can filter by status/category/level;
* disabling a course is no longer the dominant action;
* editors can open, duplicate and archive/disable through clear actions;
* filters survive pagination;
* course readiness can be understood without opening every course.

---

# CMS-COURSE-001

## Replace the long course page with a tabbed course workspace

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* replaced the long stacked course detail page with URL-addressable Radix Tabs: Overview, Curriculum, Media and Review & Publish;
* added a persistent course header with editorial state, publish readiness, platform scope, save timestamp, Preview, Review, Publish and More actions;
* moved course metadata, pacing, ownership scope, provenance and value tags into Overview;
* moved expansion planning and the full lesson sequence into Curriculum;
* disabled lesson pagination inside the course curriculum workspace so the complete lesson sequence is visible;
* moved course shell media and the advanced media registry into Media;
* moved readiness issues, learner preview and existing AI review/publish controls into Review & Publish;
* preserved existing course, media, AI, lesson and publish actions;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`.

### Current problem

Primary affected area:

```text
app/admin/courses/[id]/page.tsx
```

Related components include course detail sections, AI panels, media panels and lesson review sections.

The current course detail screen stacks:

* course statistics;
* value tags;
* AI approval states;
* media registry;
* expansion planning;
* metadata forms;
* lesson controls;
* publishing actions.

The course identity and curriculum are buried beneath operational systems.

### Required architecture

Create one course workspace with:

```text
Overview
Curriculum
Media
Review & Publish
```

Use URL-addressable tabs where practical.

Example:

```text
/admin/courses/[id]?tab=curriculum
```

or nested routes if justified.

### Course header

The persistent course header should show:

```text
Course title
Editorial state
Save state where relevant
Preview
Send for review / Review
Publish
More actions
```

Do not place every possible action in the header.

### Overview tab

Include:

* title;
* description/course promise;
* intended audience;
* learning outcomes;
* category;
* level;
* duration;
* thumbnail;
* cover image;
* value dimensions/tags;
* future-ready ownership/scope display;
* provenance if created with AI or adapted.

### Curriculum tab

Render the complete curriculum outline.

Do not paginate lessons belonging to one course.

Link directly to lesson workspaces.

### Media tab

Display course and lesson media assets in one usable view.

Advanced registry metadata should be secondary.

### Review & Publish tab

Provide:

* readiness checklist;
* unresolved issues;
* review state;
* AI-generated content provenance/status;
* learner preview;
* publish controls;
* review feedback.

### Acceptance criteria

* the course page no longer renders as one long collection of unrelated cards;
* course identity is the first visible concern;
* curriculum is available in one dedicated workspace;
* media operations are separated from editorial overview;
* one review/publishing area provides the authoritative readiness state;
* all existing legitimate course operations remain accessible;
* existing routes/actions continue to work or are intentionally migrated.

---

# CMS-CURRICULUM-001

## Build a coherent curriculum outline editor

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* added a dedicated `CurriculumOutlineEditor` using `dnd-kit` sortable primitives for pointer and keyboard lesson reordering;
* replaced the old curriculum lesson review stack with one visible lesson sequence in the course Curriculum tab;
* surfaced compact readiness labels and warnings for draft/archive state, missing pages, quiz absence/incomplete quizzes, media review and AI change-request states;
* added create, duplicate, edit and archive operations from the outline, with Radix Dropdown Menu and Alert Dialog for secondary actions and safe archive confirmation;
* added `admin_reorder_course_lessons` as an admin-only security-definer RPC that validates the course, requires the submitted order to include every lesson exactly once and records an audit event before persisting `sort_order`;
* kept the structured course -> lesson -> page -> block model intact; curriculum sections/modules are deferred to P1 because they require schema work;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`.

### Current problem

Related existing areas include:

```text
course-detail-lesson-review-section.tsx
app/admin/courses/[id]/page.tsx
lesson ordering/actions
```

Current curriculum management relies on expanding lesson panels, separate review controls and lesson pagination.

Editors cannot easily understand or manipulate the course as one sequence.

### Required changes

Create a curriculum outline supporting:

* all lessons visible in sequence;
* drag-and-drop lesson ordering;
* clear lesson status/readiness;
* lesson page count;
* quiz presence;
* missing-content warnings;
* create lesson;
* duplicate lesson;
* edit lesson;
* delete/archive lesson with safe confirmation;
* lesson context menu;
* bulk publication/review operations only if safe and useful.

Add optional curriculum sections/modules if they can be introduced without destabilising the current course model.

If introducing sections would require significant schema redesign, defer actual sections to P1 and structure the UI so they can be added later.

### Lesson readiness indicators

Examples:

```text
Ready
Draft
Missing pages
Quiz incomplete
Media needs review
Changes requested
```

Avoid exposing all raw internal statuses simultaneously.

### Acceptance criteria

* the complete lesson sequence is visible without pagination;
* lessons can be reordered using accessible drag-and-drop;
* editors can create, duplicate and open lessons;
* readiness issues are visible from the outline;
* order persists correctly;
* keyboard and screen-reader alternatives exist for reordering;
* curriculum operations do not bypass existing review/security rules.

---

# CMS-LESSON-001

## Upgrade the lesson editor into an authoring workspace

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* upgraded the existing lesson builder into a page tree, content canvas and inspector workspace while preserving autosave, manual save, local recovery and learner preview;
* added `dnd-kit` sortable page and block ordering with retained move buttons as keyboard fallback;
* added contextual block insertion before, between and after blocks so editors choose the insertion position;
* added duplicate page and duplicate block actions using local draft copies that persist through the existing builder save endpoint;
* replaced native lesson-authoring `window.alert()` and `window.confirm()` usage with Radix Alert Dialog and Radix Toast feedback;
* added unambiguous save states for local unsaved changes, saving, saved, save failure and recovered local drafts;
* added route/close protection for unsaved builder changes through an internal-link guard plus `beforeunload`;
* moved page settings and selected-block metadata/actions into the inspector, with direct links back to course curriculum and learner preview;
* made learner preview optional from the inspector so it no longer permanently dominates the workspace;
* added Tiptap rich-text editing for text block bodies, server-side DOMPurify sanitization and sanitized learner rendering for supported rich text;
* preserved the structured course -> lesson -> page -> block model and the existing builder API/RPC security boundaries;
* deferred undo/redo beyond P0 because the builder's autosave/recovery model needs an explicit history layer to avoid corrupting recovered local drafts;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`.

### Current foundation

Primary affected component:

```text
components/admin/LessonPageBuilder.tsx
```

The existing editor already supports:

* page list;
* content blocks;
* learner preview;
* draft state;
* local recovery;
* autosave;
* manual save;
* page and block ordering.

Preserve this functionality.

### Current problems

The editor remains form-centric:

* up/down buttons are the primary ordering control;
* page settings are hidden in generic details panels;
* block insertion is detached from insertion position;
* native browser alerts/confirms are used;
* preview permanently consumes space;
* no block duplication;
* no undo/redo;
* unclear local-draft versus server-saved state;
* limited contextual editing;
* weak inspector/settings model.

### Required workspace

Preferred desktop layout:

```text
Curriculum/Page Tree
Content Canvas
Inspector
```

Preview may be:

* a toggle;
* a resizable panel;
* a drawer;
* a dedicated preview mode.

It should not permanently dominate the screen at all viewport sizes.

### Required interactions

Implement:

* drag-and-drop page ordering;
* drag-and-drop block ordering;
* keyboard reorder fallback;
* contextual Add Block controls between blocks;
* duplicate page;
* duplicate block;
* safe delete dialogs;
* proper toast feedback;
* clear save states:

```text
Unsaved locally
Saving
Saved
Save failed
Recovered local draft
```

* inspector panel for selected page or block;
* clearer page settings;
* navigation back to course curriculum;
* direct learner preview;
* route-change/close warning when unsaved changes remain.

### Undo/redo

Implement undo/redo if safely achievable within the editor’s draft-state model.

If not implemented in P0, structure state management to permit it later and document the limitation.

### Rich text

Introduce a rich-text editor only inside text-capable blocks if it can be done without breaking existing block rendering.

At minimum support:

* paragraphs;
* bold;
* italic;
* links;
* headings allowed by block type;
* bullet and numbered lists where appropriate.

Sanitise persisted output.

### Acceptance criteria

* page and block ordering works through drag-and-drop and keyboard controls;
* editors can add a block at the desired position;
* editors can duplicate pages and blocks;
* no native `window.alert` or `window.confirm` remains in the lesson authoring workflow;
* save state is unambiguous;
* local recovery is clearly distinguished from server persistence;
* editor warns before losing unsaved work;
* learner preview remains accurate;
* existing block types continue to render correctly;
* editing remains usable on common laptop resolutions.

---

# CMS-QUIZ-001

## Replace the fixed quiz form with an assessment builder

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* replaced the separate quiz settings, add-question and question edit forms on the lesson page with a unified `AssessmentBuilder`;
* added quiz title/status controls, question list, per-question editing, question preview and full quiz preview in one workflow;
* added `dnd-kit` question ordering with an admin-only `admin_reorder_quiz_questions` RPC that validates quiz ownership, requires every question exactly once and records an audit event;
* added duplicate question and safe delete actions; deletion uses `admin_delete_quiz_question` and refuses to delete questions referenced by learner attempt history;
* replaced the fixed four-option form with editable 2-4 option sets, including add/remove option controls within the existing backend limit;
* added single-choice, multiple-choice and true/false validation, including exact-answer-count checks and true/false option consistency;
* separated question editing into Content, Correct answer, Feedback, Scoring and Reward behaviour areas;
* made XP visually secondary inside Scoring/Reward behaviour while preserving the existing learner grading and daily-cap behavior;
* displayed the real lesson completion gate and retry policy from the current lesson model instead of inventing unsupported passing-score settings;
* added publish readiness validation so incomplete assessments cannot be marked published through the admin action;
* preserved existing learner quiz attempt/grading behavior and admin RPC security boundaries;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`.

### Current problem

Current quiz authoring supports several question types, but remains rigid:

* four fixed options;
* limited ordering controls;
* XP shown as a primary question field;
* no assessment-level completion settings;
* no question duplication;
* weak preview and validation.

### Required changes

Create an assessment-builder workflow supporting:

* quiz title;
* description/instructions;
* editorial status;
* question list;
* drag-and-drop question ordering;
* duplicate question;
* delete with safe confirmation;
* variable option count;
* add/remove option;
* single choice;
* multiple choice;
* true/false;
* explanation/feedback;
* question preview;
* quiz preview.

Separate question editing into logical areas:

```text
Content
Correct answer
Scoring
Feedback
Reward behaviour
```

### Completion and scoring

Introduce UI support for:

* passing score where compatible with current model;
* whether passing is required for lesson/course completion;
* attempts/retry policy display;
* XP/reward settings as an advanced section.

Do not invent unsupported database behaviour.

Where the model does not yet support a requested setting, either:

1. implement the minimum safe supporting schema; or
2. display the existing real behaviour without pretending it is configurable.

### Validation

Prevent publishing incomplete assessments, including:

* no questions;
* question with insufficient options;
* no correct answer;
* invalid multiple-choice state;
* invalid XP amount;
* inconsistent true/false options.

### Acceptance criteria

* questions can be reordered accessibly;
* options can be added and removed;
* questions can be duplicated;
* quiz and question preview are available;
* invalid quiz configuration is clearly reported;
* XP is visually secondary to instructional scoring;
* existing learner grading behaviour remains correct;
* assessment edits remain protected by existing admin/security rules.

---

# CMS-MEDIA-001

## Create a unified media picker and library experience

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* added reusable `MediaPicker` with Radix Tabs for Choose from library, Generate with AI, External URL and Upload status;
* reused the picker for course thumbnail, lesson cover, course shell media, course media registry, lesson media assets, page cover settings and image content blocks;
* library selection supports search, asset-type filtering, preview cards, approval/generation status, missing-alt indicators and replacement selection;
* external URL remains available in the picker with alt text, caption/attribution where applicable, image fit and focal-point controls;
* contextual AI generation uses the existing seeded `learning_media_assets` actions and preserves approval/generation metadata paths;
* Course Media now starts with a grouped media library overview covering course-level assets, lesson usage, missing alt text, failed generation and assets needing placement or preview;
* the advanced media registry remains available below the overview for platform-style asset detail work;
* existing approved media references are preserved through the current media action and metadata flows;
* direct upload remains disabled because no storage upload endpoint or signed upload policy exists yet; the picker exposes this honestly instead of bypassing storage/security boundaries;
* no database schema changes were required;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`.

### Current problem

Media is currently managed through several disconnected mechanisms:

* URL fields;
* AI-generated media;
* manual media registry;
* lesson media workflows;
* approval panels;
* shell media controls;
* library selection.

Editors are exposed to implementation-level media machinery.

### Required changes

Create one reusable media-picker experience:

```text
Upload
Choose from library
Generate with AI
External URL
```

Use it for:

* course thumbnail;
* course cover;
* lesson cover;
* image content blocks;
* other existing supported media fields.

### Picker capabilities

Where applicable:

* search existing assets;
* filter by asset type;
* preview;
* choose;
* replace;
* upload;
* provide external URL;
* AI generation action;
* alt text;
* attribution;
* focal point/crop settings if currently supported;
* asset usage information;
* approval status.

### Media library

Within the Course Media tab:

* group assets by course/lesson usage;
* show unused assets;
* show missing alt text;
* show generation/approval failures;
* allow opening asset detail;
* allow replacing asset while preserving usages where safe.

The advanced media registry may remain available to privileged media/platform administrators.

It should not be the default editor workflow.

### Acceptance criteria

* routine course/lesson media selection does not require pasting raw URLs;
* external URLs remain available as an advanced option;
* the same picker is reused across course and lesson authoring;
* alt text is supported and visibly required where appropriate;
* AI media generation is accessible contextually;
* existing approved media and references are preserved.

---

# CMS-REVIEW-001

## Consolidate editorial review and publishing

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* added a shared course readiness engine derived from real course, lesson, page, block, quiz, quiz option and media asset state;
* Review & Publish now shows one lifecycle surface for Draft, In review, Changes requested, Approved, Published and Archived;
* readiness checks cover overview, thumbnail/cover, active lessons, lesson pages and blocks, assessment validity, required media approval, missing alt text, AI text review and AI media review;
* each failing check links to the relevant course overview, curriculum, lesson or media surface;
* added review actions for send for review, request changes with reviewer feedback, approve, publish, unpublish and archive;
* manual and AI-assisted courses share the same lifecycle fields while retaining AI-specific text and media gates;
* generic course publishing and AI final publishing now call the same readiness assertion, preventing publish bypass through status forms or legacy AI publish controls;
* existing AI text/media approval, revision and generation paths remain available in the Review & Publish tab;
* no database schema changes were required;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`.

### Current problem

Publishing readiness is distributed across:

* course status;
* lesson status;
* quiz status;
* AI text status;
* AI media status;
* media approval;
* separate publish actions;
* assorted review panels.

There is no single authoritative answer to:

> Is this course ready to publish?

### Required changes

Create a course readiness engine or aggregation layer returning clear checks.

Example:

```text
Course readiness

✓ Course overview complete
✓ Thumbnail and cover present
✓ Five lessons
✓ Required lesson pages complete
! Lesson 3 assessment is incomplete
! Two images are missing alt text
✓ AI-generated text reviewed
! One media asset awaiting approval
```

Checks must be derived from real system state.

Do not hard-code decorative checklist results.

### Editorial lifecycle

Present one understandable lifecycle:

```text
Draft
In review
Changes requested
Approved
Published
Archived
```

Map existing internal states into this lifecycle without losing necessary detail.

### Review workflow

Support:

* Send for review;
* reviewer feedback;
* changes requested;
* approve;
* learner preview;
* publish;
* unpublish/archive where allowed.

Scheduling is optional in P0 unless existing schema already supports it cleanly.

### Publish protection

Publishing must be blocked when mandatory readiness checks fail.

Warnings may remain non-blocking only when explicitly classified as warnings.

### Acceptance criteria

* one Review & Publish tab shows authoritative readiness;
* missing requirements link directly to the affected lesson/quiz/media;
* manual and AI-generated content share one review lifecycle;
* publication cannot bypass mandatory readiness rules;
* existing legitimate admin publishing remains possible;
* published learner content remains unchanged unless edited.

---

# CMS-AI-001

## Integrate AI assistance into the editorial workflow

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* course index now presents the three supported creation paths: Start blank, Use a template by duplicating an existing course, and Create with AI;
* Create with AI planner is reframed around the six-step flow: learning need, intended audience, learning outcomes, proposed curriculum, draft scope and course creation;
* the existing planner-generated curriculum proposal review remains mandatory before creating course setup or full drafts;
* primary UI copy no longer exposes course shell/draft workflow terminology where editor-facing setup and draft language is clearer;
* added a shared AI Activity panel backed by `ai_generation_jobs` and active `ai_course_plans`, showing queued, running, needs review, failed and completed work;
* AI Activity appears on the course index, Create with AI planner, course workspace and lesson workspace;
* contextual course actions now expose supported AI operations through editorial labels: propose curriculum, draft lesson, generate media, request/apply reviewer feedback and regenerate media with feedback;
* lesson workspaces retain supported text/media review and generation actions while sharing the course-scoped AI activity view;
* existing durable AI job backend, planner records, generation actions, text/media review gates and publish readiness enforcement are preserved;
* AI revisions continue to return content to editorial review before publication, and published learner content remains protected by the existing published-course revision guard;
* no database schema changes were required;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`.

### Current problem

AI capabilities are fragmented across:

* planner pages;
* course generation;
* shell generation;
* lesson expansion;
* text approval;
* media generation;
* revision requests;
* job-status interfaces.

Editors must understand internal workflow distinctions such as shell versus draft versus expansion.

### Required changes

Retain the existing AI backend and durable job system.

Redesign the UI around three creation paths:

```text
Start blank
Use a template
Create with AI
```

### Create with AI flow

Provide a guided sequence:

```text
1. Learning need
2. Intended audience
3. Learning outcomes
4. Proposed curriculum
5. Draft-generation scope
6. Create course
```

The editor must review the proposed curriculum before final course generation.

### Contextual AI actions

Within course and lesson workspaces, expose relevant actions such as:

* suggest learning outcomes;
* propose curriculum;
* draft lesson;
* add scenario;
* rewrite selected text;
* simplify reading level;
* generate quiz questions;
* generate media brief;
* apply reviewer feedback.

Only expose actions supported by the existing AI system or safely implemented during P0.

### AI activity

Provide one AI activity drawer/panel showing:

```text
Queued
Running
Needs review
Failed
Completed
```

Use existing durable AI job data.

### Review before apply

Where AI proposes changes to existing content, the editor should review the proposal before overwriting content.

At minimum show:

* affected content;
* proposed replacement;
* Accept;
* Reject;
* Regenerate where supported.

### Acceptance criteria

* manual, template and AI creation paths are understandable;
* existing AI planner capability is preserved;
* technical “shell vs draft” language is removed from the primary workflow where unnecessary;
* AI jobs are visible through one activity surface;
* AI-generated changes require editorial review;
* AI failures provide useful recovery actions;
* AI controls no longer dominate the basic course overview.

---

# CMS-UX-001

## Replace crude interaction feedback with professional CMS patterns

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* scanned P0 CMS admin surfaces and confirmed no native `alert()`, `confirm()` or `prompt()` calls remain in course authoring workflows;
* added shared `adminButtonClasses()` primitives for consistent primary, secondary, success and destructive action styling, disabled states and visible focus rings;
* standardized course index and course workspace header actions on the shared admin button treatment;
* replaced direct course enable/disable submits from the course index with a Radix `AlertDialog` confirmation flow, explicit consequence copy and pending submit labels;
* retained non-destructive duplication as a direct action while adding pending feedback for duplicate and template-submit flows;
* strengthened workspace tab keyboard/focus feedback with visible focus rings and pending navigation state;
* preserved existing Radix alert dialogs/toasts, inline validation, empty states, save indicators and dnd-kit keyboard reordering already introduced across curriculum, lesson builder, quiz builder, media and review workflows;
* no database schema changes were required;
* validated with `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check`.

### Required changes

Across the P0 CMS workflow:

Replace native browser:

```text
alert()
confirm()
```

with:

* toast notifications;
* accessible alert dialogs;
* inline validation;
* recoverable error states.

Standardise:

* primary/secondary/destructive buttons;
* loading states;
* disabled states;
* empty states;
* save indicators;
* skeletons where useful;
* destructive-action confirmation;
* error messages.

### Accessibility

At minimum:

* keyboard navigation;
* visible focus states;
* accessible labels;
* semantic headings;
* dialog focus management;
* drag-and-drop keyboard alternative;
* colour-independent status indicators;
* meaningful error association.

### Acceptance criteria

* no native browser alerts/confirms remain in P0 authoring workflows;
* destructive actions require clear confirmation;
* loading and save states are visible;
* key CMS workflows are keyboard-operable;
* accessibility regressions are covered by available automated checks where practical.

---

# CMS-TEST-001

## Add CMS product regression coverage

**Priority:** P0

**Status:** Implemented on 2026-08-01.

Implementation notes:

* added CMS product unit regression coverage in `tests/unit/cms-product-regressions.test.mjs` for readiness aggregation, editorial lifecycle mapping, quiz validation, lesson/page/block ordering, insert-position behavior, media picker value mapping and deterministic AI planner transformations;
* made course readiness and media picker mapping importable by Node's unit runner without adding a new test framework or competing library;
* updated existing admin course validation tests to compare validation issue sets deterministically after remediation-era validation ordering changed;
* extended the Playwright remediation suite in `tests/e2e/remediation-flows.spec.ts` for the new CMS course index/status UX, blank-course creation, overview edit persistence, workspace tab navigation, template duplication and deterministic AI planner entry without live model calls;
* E2E tests remain wired into the existing GitHub remediation job through `npm run test:remediation:local`; the workflow starts local Supabase, installs Chromium and runs `npm run test:e2e`;
* no database schema changes or new dependencies were required;
* validated locally with `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run ci` and `git diff --check`;
* earlier local `npm run test:e2e` attempts were blocked by Supabase CLI availability in the sandbox; database scripts now use the repo-local Supabase CLI wrapper instead of `npx`.

### Required tests

Extend the existing test and CI suite.

At minimum add Playwright coverage for:

## Course workspace

* create a blank course;
* edit course overview;
* verify save/persistence;
* navigate between workspace tabs;
* duplicate a course where supported.

## Curriculum

* create lessons;
* reorder lessons;
* duplicate a lesson;
* open lesson editor;
* verify persisted ordering.

## Lesson authoring

* create page;
* add content block;
* insert block at a selected position;
* reorder pages;
* reorder blocks;
* duplicate page/block;
* save;
* refresh and verify persistence;
* verify preview.

## Quiz authoring

* create quiz;
* add questions;
* add/remove options;
* set correct answer;
* reorder questions;
* verify invalid state blocks review/publish;
* preview assessment.

## Media

* open unified media picker;
* select existing asset;
* verify asset appears in content;
* verify alt text workflow.

## Review and publish

* readiness checklist detects incomplete content;
* resolve blocking issue;
* send for review;
* approve;
* publish;
* verify learner-facing content.

## AI

At least one AI-assisted creation or generation workflow should be tested using an appropriate deterministic test strategy.

Do not require live external model calls in CI.

### Unit/integration tests

Add tests for:

* readiness aggregation;
* editorial-state mapping;
* curriculum ordering;
* editor draft-state transitions;
* media-picker value mapping;
* quiz validation.

### Acceptance criteria

* CMS tests run in the existing merge-blocking remediation/CI gate;
* tests do not rely on live production services;
* critical authoring flows are covered;
* existing engineering security tests continue to pass.

---

# 5. P0 TARGET EXPERIENCE

After P0, the editor should be able to perform this complete workflow:

```text
Open Learning → Courses
↓
Search or create course
↓
Choose blank, template or AI-assisted creation
↓
Complete course overview
↓
Build curriculum in one outline
↓
Open lesson editor
↓
Create and reorder pages and blocks
↓
Create quiz
↓
Manage media through one picker
↓
Return to course readiness
↓
Resolve issues
↓
Send for review
↓
Approve and publish
```

At every step the editor must understand:

```text
Where am I?
What am I editing?
Has it been saved?
What remains incomplete?
What happens next?
```

---

# 6. P0 COMPLETION REPORT

**Status:** Submitted on 2026-08-01.

## Ticket Status

| Ticket | Status |
| --- | --- |
| CMS-IA-001 | Implemented |
| CMS-LIST-001 | Implemented |
| CMS-COURSE-001 | Implemented |
| CMS-CURRICULUM-001 | Implemented |
| CMS-LESSON-001 | Implemented |
| CMS-QUIZ-001 | Implemented |
| CMS-MEDIA-001 | Implemented |
| CMS-REVIEW-001 | Implemented |
| CMS-AI-001 | Implemented |
| CMS-UX-001 | Implemented |
| CMS-TEST-001 | Implemented |

## P0 Closure Addendum

**Status:** Implemented on 2026-08-02 for review. Revised P0 closure gaps were resolved on 2026-08-02.

| Ticket | Status |
| --- | --- |
| CMS-TEMPLATE-002 | Implemented |
| CMS-MEDIA-002 | Implemented |
| CMS-TEST-002 | Implemented |

Closure scope remained limited to full course-template duplication, secure direct CMS media upload and expanded CMS authoring regression coverage. P1 LMS work, organisations, programmes, cohorts and tenancy were not implemented.

Closure implementation added:

* canonical `courses.intended_audience` and `courses.learning_outcomes` fields wired through the manual course form, AI planner course creation, readiness checks, learner reads and generated database types;
* transactional `admin_duplicate_course_template` RPC that copies the course authoring tree into an independent draft course;
* direct admin media upload through the existing unified `MediaPicker`;
* server-side image validation, safe generated storage paths and media-library row creation with storage cleanup on persistence failure;
* pgTAP coverage for template copy completeness, draft-state reset, source isolation, rollback and learner denial;
* Playwright coverage for template content copy, copied-content isolation, direct upload, invalid upload rejection and unauthorized upload denial;
* a browser-level CMS authoring-to-publishing journey covering blank course creation, overview persistence, lesson creation/duplication/reordering, page and block authoring/reordering, Tiptap persistence, quiz building/reordering/validation, media upload/selection, readiness blocking, review, approval, publishing and learner-facing rendering.

## Files Changed

Primary CMS implementation files:

* `app/admin/courses/page.tsx`
* `app/admin/courses/new/page.tsx`
* `app/admin/courses/[id]/page.tsx`
* `app/admin/courses/lessons/[id]/page.tsx`
* `app/admin/courses/actions.ts`
* `app/admin/courses/detail-page-actions.ts`
* `app/admin/courses/ai-actions.ts`
* `app/admin/courses/ai/planner/page.tsx`
* `app/admin/courses/review-actions.ts`
* `app/api/admin/learning/builder/route.ts`
* `app/api/admin/learning/lessons/route.ts`
* `app/api/admin/learning/lessons/duplicate/route.ts`
* `components/admin/AdminPrimitives.tsx`
* `components/admin/AdminShell.tsx`
* `components/admin/LearningForms.tsx`
* `components/admin/LessonPageBuilder.tsx`
* `components/admin/CourseIndexWorkspace.tsx`
* `components/admin/CourseWorkspaceTabs.tsx`
* `components/admin/CurriculumOutlineEditor.tsx`
* `components/admin/AssessmentBuilder.tsx`
* `components/admin/MediaPicker.tsx`
* `components/admin/media-picker-domain.ts`
* `components/admin/RichTextBlockEditor.tsx`
* `components/lesson/LessonContent.tsx`
* `features/learning/admin/data.ts`
* `features/learning/admin/course-detail-data.ts`
* `features/learning/admin/course-detail-expansion-section.tsx`
* `features/learning/admin/course-detail-lesson-review-section.tsx`
* `features/learning/admin/course-detail-media-registry-section.tsx`
* `features/learning/admin/course-detail-shell-media-section.tsx`
* `features/learning/admin/course-detail-workflow-section.tsx`
* `features/learning/admin/course-media-library-overview.tsx`
* `features/learning/admin/course-readiness.ts`
* `features/learning/admin/course-readiness-data.ts`
* `features/learning/admin/course-review-publish-section.tsx`
* `features/learning/admin/lesson-detail-ai-media-section.tsx`
* `features/learning/admin/lesson-page-builder-domain.ts`
* `features/learning/admin/lesson-page-builder-ui.tsx`
* `features/learning/admin/assessment-builder-domain.ts`
* `features/learning/admin/ai-activity.ts`
* `features/learning/admin/ai-activity-panel.tsx`
* `features/learning/admin/planner-commands.ts`
* `lib/admin-course-validation.ts`
* `lib/rich-text.ts`
* `tests/e2e/remediation-flows.spec.ts`
* `tests/unit/admin-course-validation.test.mjs`
* `tests/unit/cms-product-regressions.test.mjs`
* `supabase/migrations/20260802110000_canonical_course_audience_outcomes.sql`
* `supabase/tests/database/cms_template_duplication.sql`
* `types/database.ts`
* `package.json`
* `package-lock.json`
* `docs/project-ve-cms-lms-product-remediation-plan.md`

Standing-agent documentation was also updated:

* `AGENTS.md`
* `docs/codex/skills/project-ve-guardrails/SKILL.md`

## Schema Changes

Two admin CMS migrations were added and pushed to the remote database by the operator on 2026-08-01:

* `supabase/migrations/20260801190000_admin_reorder_course_lessons.sql`
* `supabase/migrations/20260801193000_admin_manage_quiz_questions.sql`

No schema changes were added for CMS-MEDIA-001, CMS-REVIEW-001, CMS-AI-001 or CMS-UX-001.

Additional P0 closure migrations:

* `supabase/migrations/20260802090000_classify_admin_cms_rpcs.sql`
* `supabase/migrations/20260802100000_admin_template_duplication_and_media_upload.sql`
* `supabase/migrations/20260802110000_canonical_course_audience_outcomes.sql`

## New Dependencies

Mandatory CMS component foundation dependencies added:

* `@dnd-kit/accessibility`
* `@dnd-kit/core`
* `@dnd-kit/sortable`
* `@dnd-kit/utilities`
* Radix primitives: `@radix-ui/react-alert-dialog`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-tooltip`
* `@tanstack/react-table`
* Tiptap: `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/react`, `@tiptap/starter-kit`
* supporting utilities: `class-variance-authority`, `clsx`, `tailwind-merge`, `dompurify`, `isomorphic-dompurify`

No competing component, editor, drag-and-drop or data-grid libraries were introduced.

## Components Introduced

* `CourseIndexWorkspace`
* `CourseWorkspaceTabs`
* `CurriculumOutlineEditor`
* `LessonPageBuilder`
* `AssessmentBuilder`
* `MediaPicker`
* `RichTextBlockEditor`
* `CourseMediaLibraryOverview`
* `CourseReviewPublishSection`
* `AiActivityPanel`
* shared admin button primitive through `adminButtonClasses()`

## Tests Added

* Added `tests/unit/cms-product-regressions.test.mjs`.
* Extended `tests/unit/admin-course-validation.test.mjs` for deterministic validation issue comparison.
* Extended `tests/e2e/remediation-flows.spec.ts` to cover the new CMS course index/status UX, blank course creation, overview persistence, lesson/page/block authoring, Tiptap persistence, curriculum ordering, quiz building and validation, direct media upload/selection, readiness, review, approval, publishing, learner rendering, template duplication and deterministic AI planner entry.
* The new unit tests are included in `npm run test:unit` and therefore in `npm run ci`.
* The new Playwright coverage remains included in `npm run test:e2e`, which is run by the existing GitHub remediation job through `npm run test:remediation:local`.

## Commands Executed

Successful validation:

* `npm run typecheck`
* `npm run lint`
* `npm run build`
* `npm test`
* `npm run test:db`
* `npm run test:integration`
* `npm run test:e2e`
* `npm run db:types:local:check`
* `npm run test:remediation:local`

## Test Results

Passing:

* `npm run typecheck`: passed.
* `npm run lint`: passed.
* `npm run build`: production build completed successfully.
* `npm test`: 125/125 unit tests passed and 166/166 database tests passed.
* `npm run test:db`: 166/166 database tests passed.
* `npm run test:integration`: database, repository-contract and quiz XP concurrency checks passed.
* `npm run test:e2e`: 6/6 Playwright tests passed.
* `npm run db:types:local:check`: committed local database types matched generated local schema.
* `npm run test:remediation:local`: full local remediation acceptance gate passed, including DB reset, DB types, DB tests, repositories, concurrency, economic integrity and E2E.

Notes:

* CI type drift checking now replays local migrations and runs `db:types:local:check`; `db:types:check:ci` remains available for explicit linked-project drift checks when `SUPABASE_PROJECT_REF` is configured.
* Supabase CLI execution is now routed through the repo-local `supabase` dev dependency and `scripts/supabase-cli.mjs`, avoiding repeated `npx` registry lookups during local validation.

CI coverage:

* `.github/workflows/ci.yml` runs the database type job against a local migration replay and still runs the remediation job by installing Chromium, starting local Supabase with `npm run db:start`, running `npm run test:remediation:local`, and stopping Supabase through `scripts/supabase-cli.mjs`.

## Visual Evidence

The browser proof is captured by the local Playwright gate rather than static screenshots. `npm run test:e2e` exercises authenticated admin and learner surfaces against local Supabase and passed during closure validation.

## Known Limitations

* Undo/redo history for the lesson builder remains deferred because the autosave/recovery model needs an explicit history layer to avoid corrupting local drafts.
* True curriculum sections/modules remain a later structural enhancement; P0 keeps a lesson outline that can support sections later.
* AI generation tests use deterministic planner/domain paths and do not call live external models.

## Deferred P1.5/P2 Work

* P1.5 Org Mode and institutional pilot readiness, as defined in `docs/project-ve-cms-lms-phase-1-5-org-mode-institutional-pilot-readiness.md`.
* P2 enterprise and institutional expansion.

Do not begin P2 until Phase 1.5 has been reviewed, accepted and closed.

---

# P1: HYBRID LMS FOUNDATION

**Do not implement until P0 is reviewed and approved.**

P1 converts the improved CMS into a hybrid programme-based LMS.

---

# LMS-ORG-001

## Organisations and contextual memberships

**Priority:** P1

Introduce:

```text
organizations
organization_memberships
organization_roles
```

Support one user holding different roles in different organisations.

Separate platform roles from organisation roles.

Initial organisation roles:

```text
organisation_owner
organisation_admin
programme_manager
content_editor
reviewer
instructor
report_viewer
learner
```

Provide an organisation-context switcher.

Every tenant-owned object must have enforceable ownership and RLS boundaries.

## Implementation Status

**Status:** Implemented on 2026-08-02 for review.

Implemented:

* `organizations`;
* `organization_roles`;
* `organization_memberships`;
* contextual organisation roles using the required P1 role set;
* platform-role separation: `profiles.role` remains the platform role boundary, while organisation memberships hold contextual LMS roles;
* admin-only RPCs for organisation and membership management;
* authenticated helper RPCs for checking the current user's organisation role/context;
* RLS policies that allow platform admins to read all organisation records and active members/managers to read only their permitted organisation context;
* admin-shell organisation context switcher backed by the signed-in user's active memberships;
* pgTAP coverage for tenant visibility, contextual role separation, suspended membership behavior, admin RPC denial and RPC security classification.

Forward migration:

* `supabase/migrations/20260802120000_lms_organizations_memberships.sql`

Tests:

* `supabase/tests/database/lms_organizations_memberships.sql`

Validation run:

* `npm run db:reset`
* `npm run db:types:local`
* `npm run test:db`
* `npm run typecheck`
* `npm run lint`
* `npm run db:types:local:check`

---

# LMS-CATALOG-001

## Platform, private and adapted content

**Priority:** P1

Support:

```text
platform-owned course
organisation-private course
adapted platform course
```

Adapted content must retain provenance:

```text
source course
source version
copied at
local changes
available upstream update
```

An organisation must not modify the canonical platform course.

## Implementation Status

**Status:** Implemented on 2026-08-02 for review.

Implemented:

* `course_catalog_scope` with platform, organisation-private and adapted-platform scope values;
* course ownership/provenance columns for organisation owner, source course, source version, copied timestamp, local changes, upstream update availability and catalog version;
* catalog constraints that keep platform courses canonical, organisation-private courses tenant-owned, and adapted courses tied to canonical platform sources;
* catalog-aware RLS helpers for course read/edit decisions without exposing raw quiz answer data to learners;
* organisation content editor creation of private draft courses through an authenticated RPC;
* organisation content editor adaptation of canonical platform courses through an authenticated RPC that copies the independent authoring tree and resets copied content to draft/editorial-safe states;
* triggers for catalog-version increments, adapted-course provenance normalization, local-change tracking and upstream-update flags;
* admin course index and course workspace metadata showing catalog scope, ownership and adapted-source provenance;
* pgTAP coverage for platform visibility, organisation-private isolation, contextual editor access, unauthorized adaptation denial, canonical platform immutability, adapted tree copying, local changes, upstream updates and RPC classification.

Forward migration:

* `supabase/migrations/20260802130000_lms_course_catalog_model.sql`

Tests:

* `supabase/tests/database/lms_course_catalog_model.sql`

Validation run:

* `npm run db:reset`
* `npm run db:types:local`
* `npm run test:db`
* `npm run typecheck`
* `npm run lint`
* `npm run db:types:local:check`
* `npm run build`
* `npm test`

---

# LMS-PROGRAMME-001

## Programme builder

**Priority:** P1

Introduce a programme as the operating container for:

```text
Audience
Courses
Missions
Rewards
Assessment
Schedule
Completion
Reporting
```

A programme is not a course.

Courses must remain reusable across programmes.

Programme builder should support:

* title;
* objective;
* intended audience;
* course sequence;
* missions;
* rewards;
* schedule;
* completion rules;
* status.

## Implementation Status

**Status:** Implemented on 2026-08-02 for review.

Implemented:

* `programmes` as organisation-owned LMS operating containers separate from courses;
* programme fields for title, slug, objective, intended audience, status, schedule window, completion rules and reporting config;
* reusable course sequencing through `programme_courses`;
* mission, reward and assessment attachments through `programme_missions`, `programme_rewards` and `programme_assessments`;
* course reuse across programmes without changing course ownership;
* enforcement that organisation-private/adapted courses can only be attached to programmes in the same organisation while platform courses remain reusable;
* contextual programme management helpers for platform admins and organisation owner/admin/programme-manager roles;
* programme RLS for organisation visibility and manager-only writes;
* authenticated RPCs for transactional programme upsert and lifecycle status changes;
* admin programme index, create page and edit builder at `/admin/programmes`;
* admin-shell navigation and breadcrumbs for Programmes;
* pgTAP coverage for programme creation, course ordering, reusable courses, linked missions/rewards/assessments, cross-organisation course rejection, publish readiness, contextual role denial, published programme visibility and RPC classification.

Forward migration:

* `supabase/migrations/20260802140000_lms_programme_builder.sql`

Tests:

* `supabase/tests/database/lms_programme_builder.sql`

Validation run:

* `npm run db:reset`
* `npm run db:types:local`
* `npm run test:db`
* `npm run typecheck`
* `npm run lint`
* `npm run db:types:local:check`
* `npm run build`
* `npm test`

---

# LMS-COHORT-001

## Cohorts and audience assignment

**Priority:** P1

Introduce:

```text
cohorts
cohort_members
course_assignments
programme_assignments
enrolments
```

Support:

* bulk learner import;
* manual learner assignment;
* cohort assignment;
* due dates;
* active/completed/withdrawn states;
* assignment source;
* programme intake dates.

## Implementation Status

**Status:** Implemented on 2026-08-02 for review.

Implemented:

* `cohorts` and `cohort_members` for organisation-scoped audience groups and active/completed/withdrawn roster state;
* `course_assignments`, `programme_assignments` and `enrolments` for canonical learner assignment records;
* due-date support for course and programme assignment flows;
* programme intake dates recorded on programme assignments and generated enrolment metadata;
* assignment-source tracking for manual, cohort and programme-derived enrolments;
* contextual audience-management helpers for platform admins and organisation owner/admin/programme-manager/instructor roles;
* RLS policies that let audience managers read/manage assigned cohorts while learners can read only their own cohort/enrolment surfaces;
* trigger enforcement that blocks organisation-private course, programme and cohort assignment drift across organisation boundaries even outside RPCs;
* authenticated RPCs for cohort upsert, bulk roster replacement, course assignment, programme assignment and enrolment status updates;
* admin cohort index, create page and cohort workspace at `/admin/cohorts`;
* cohort workspace controls for bulk learner UUID import, member checkbox replacement, direct learner assignment, cohort assignment, due dates, intake dates and enrolment status updates;
* admin-shell navigation and breadcrumbs for Cohorts;
* pgTAP coverage for cohort creation, roster replacement, withdrawn member history, manual assignment, cohort assignment, programme assignment fan-out, learner visibility, unauthorized denial, trigger enforcement and RPC classification.

Forward migration:

* `supabase/migrations/20260802150000_lms_cohorts_assignments.sql`

Tests:

* `supabase/tests/database/lms_cohorts_assignments.sql`

Validation run:

* `npm run db:reset`
* `npm run db:types:local`
* `npm run test:db`
* `npm run typecheck`
* `npm run lint`
* `npm run db:types:local:check`
* `npm run build`
* `npm test`
* `git diff --check`

---

# LMS-COMPLETION-001

## Configurable completion and transcripts

**Priority:** P1

Introduce explicit completion rules:

* required lessons;
* required quizzes;
* passing score;
* required missions;
* required final assessment;
* minimum completion threshold.

Create canonical course/programme completion records.

Add learner transcript view.

Certificates may be deferred to P2 if necessary.

## Implementation Status

**Status:** Implemented on 2026-08-03 for review.

Implemented:

* canonical `course_completion_rules` and `programme_completion_rules` configuration tables;
* canonical `course_completions` and `programme_completions` transcript records;
* completion status enum for in-progress and completed records;
* self-service learner evaluation RPCs for assigned course and programme completion;
* learner transcript RPC that refreshes enrolment-linked records for `auth.uid()`;
* admin RPCs for course and programme completion rule configuration;
* rule validation for course lessons, quizzes, missions, programme courses, programme missions and final assessments;
* transactional completion evaluation that derives progress from lesson progress, quiz attempts, mission awards and assessment attempts;
* RLS policies that let learners read only their own completion rows and organisation audience staff read contextual rows;
* direct API-role table writes revoked for completion records so state changes go through RPC boundaries;
* programme editor completion-rule persistence through the canonical programme completion rule RPC;
* course workspace completion-rule panel for required lessons, quizzes, missions, quiz score, threshold and final assessment;
* learner transcript page at `/profile/transcript` linked from Profile;
* RPC security classifications for public self-service, admin configuration and internal helper functions;
* pgTAP coverage for rule configuration, invalid rule rejection, learner self evaluation, transcript output, RLS visibility, direct-write denial and helper execute denial.

Forward migration:

* `supabase/migrations/20260803090000_lms_completion_transcripts.sql`

Tests:

* `supabase/tests/database/lms_completion_transcripts.sql`

Validation run:

* `npm run db:reset`
* `npm run db:types:local`
* `npm run test:db`
* `npm run typecheck`
* `npm run lint`
* `npm run db:types:local:check`
* `npm run build`
* `npm test`
* `git diff --check`

Deferred:

* certificates;
* programme-scoped missions/rewards;
* reporting dashboards;
* reminders and interventions.

---

# LMS-ENGAGEMENT-001

## Programme-scoped missions and rewards

**Priority:** P1

Missions and rewards should normally be connected to programmes.

Support reward ownership:

```text
platform-owned
organisation-owned
programme-sponsored
```

Protect inventory, funding and reporting by tenant.

Shared Project Ve rewards may be explicitly enabled for selected programmes.

## Implementation status

Status: Implemented.

Implemented:

* reward ownership scopes for platform-owned, organisation-owned and programme-sponsored rewards;
* explicit platform reward sharing with programmes;
* programme reward and reward-granting mission enforcement at the database boundary;
* admin reward ownership controls in the existing rewards CMS;
* programme builder validation for tenant-safe mission and reward attachment;
* RPC security classifications for the new admin RPC, helper and triggers.

Validation:

* `npm run test:db`
* `npm run db:types:local:check`
* `npm run typecheck`
* `npm run lint`
* `npm run build`
* `npm test`

---

# LMS-REPORTING-001

## Programme, cohort and learner reporting

**Priority:** P1

Provide reporting for:

* assigned learners;
* started;
* in progress;
* completed;
* overdue;
* quiz scores;
* mission completion;
* reward usage;
* cohort comparison;
* learner detail;
* exports.

Reports must respect organisation boundaries and role permissions.

## Implementation status

Status: Implemented.

Implemented:

* read-only LMS reporting RPC for programme, cohort and learner reporting;
* organisation, programme and cohort filters with database-side boundary validation;
* assigned, started, in-progress, completed and overdue learner summary metrics;
* learner detail rows with cohort, progress, quiz, mission and reward usage signals;
* cohort comparison, quiz score, mission completion and reward usage report sections;
* CSV export for the scoped learner report;
* admin Reporting navigation and dashboard page;
* pgTAP coverage for report viewer access, cross-organisation denial, anon denial and RPC classification.

Validation:

* `npm run db:reset`
* `npm run test:db`
* `npm run db:types:local`
* `npm run db:types:local:check`
* `npm run typecheck`
* `npm run lint`
* `npm run build`

# LMS-NOTIF-001

## Programme reminders and interventions

**Priority:** P1

Support:

* assignment notification;
* upcoming due date;
* overdue reminder;
* inactivity reminder;
* completion notification;
* programme-manager intervention queue.

Use the existing secured notification architecture.

## Implementation status

Status: Implemented.

Implemented:

* programme assignment notifications from canonical programme enrolment inserts;
* completion notifications from canonical programme completion records;
* service-role-only LMS programme notification generator for assignment catch-up, upcoming due dates, overdue reminders and inactivity reminders;
* deduplicated learner notifications through the existing secured notification primitive;
* programme-manager intervention queue backed by scoped LMS intervention records;
* contextual intervention queue read/update RPCs with organisation boundary checks;
* admin Interventions navigation and queue page with organisation, programme and status filters;
* notification dispatch route integration and push delivery priority support for LMS programme events;
* pgTAP coverage for notification creation, dedupe, service-role ACLs, contextual queue access, intervention mutation denial and RPC classification.

Validation:

* `npm run db:reset`
* `npm run test:db`
* `npm run db:types:local`
* `npm run db:types:local:check`
* `npm run typecheck`
* `npm run lint`
* `npm run build`

---

# LMS-TEST-001

## Multi-tenant and programme regression coverage

**Priority:** P1

Test:

* tenant isolation;
* contextual roles;
* shared catalogue access;
* private course isolation;
* adapted content provenance;
* cohort assignment;
* programme completion;
* tenant reward isolation;
* reporting access controls.

## Implementation status

Status: Implemented.

Implemented:

* cross-feature P1 pgTAP release gate covering organisation-scoped roles and tenant isolation;
* shared platform catalogue access and organisation-private course isolation assertions;
* adapted-platform course provenance and copied instructional-tree assertions;
* cohort-based programme assignment fan-out to programme and course enrolments;
* learner programme completion evaluation through the public completion RPC;
* tenant reward isolation through the programme reward attachment boundary;
* scoped reporting result assertions and cross-organisation/anonymous reporting denial checks;
* the gate is included in the existing `npm run test:db` suite and therefore in `npm run db:verify:local`.

Tests:

* `supabase/tests/database/lms_p1_release_gate.sql`

Validation:

* `npm run test:db`

## P1 closure update

Status: Focused closure implemented on 2026-08-04 for review.

Implemented:

* server-recognised admin workspace context backed by the `project-ve-admin-workspace` cookie;
* organisation staff access to `/admin` through contextual memberships while organisation learners remain outside the admin product;
* role-filtered admin navigation for organisation workspaces;
* platform-admin organisation operations page for creating organisations and adding/updating/suspending/removing contextual memberships through the existing secured RPCs;
* workspace-scoped course, programme, cohort, reward and reporting data queries;
* cohort learner pickers scoped to active learner memberships for the selected organisation;
* enrolment-based learner access for assigned organisation-private/adapted courses and programmes;
* completion-threshold semantics where selected work contributes to the configured percentage and selected final assessments remain mandatory;
* tenant-aware reward visibility and redemption eligibility for platform-owned, organisation-owned and programme-sponsored rewards;
* programme-filtered reporting attribution for mission awards and reward redemptions;
* role-level route and server-action guards for programme, cohort and reward management surfaces;
* contextual organisation profile visibility for active organisation members, limited to audience staff who can read that organisation audience;
* expanded P1 release gate assertions for assignment access, withdrawal, transcript usability, threshold behavior, reward isolation, inventory ownership and programme reporting attribution;
* browser-level institutional Playwright journey covering organisation creation, contextual memberships, private course seeding, programme creation, cohort roster creation, programme assignment, learner completion/transcript, report-viewer reporting access, management-route denial and outsider private content/reward denial.

Forward migrations:

* `supabase/migrations/20260804100000_lms_p1_closure.sql`
* `supabase/migrations/20260804103000_lms_organization_profile_visibility.sql`

Tests:

* `supabase/tests/database/lms_p1_release_gate.sql`
* `tests/e2e/remediation-flows.spec.ts`

Validation:

* `npm run db:reset`
* `npm run test:db`
* `npm run db:types:local`
* `npm run db:types:local:check`
* `npm run typecheck`
* `npm run lint`
* `npm run build`
* `npm test`
* `npm run test:e2e`

Known remaining review item:

* None for the authorised P1 Hybrid LMS foundation closure scope.

---

# P1.5: ORG MODE AND INSTITUTIONAL PILOT READINESS

**Governing document:** `docs/project-ve-cms-lms-phase-1-5-org-mode-institutional-pilot-readiness.md`

P1.5 inserts an ordered stop-and-review phase between the completed P1 Hybrid LMS foundation and P2 enterprise expansion.

Implement only one authorised P1.5 batch at a time:

```text
P1.5A  Org Mode, plans and self-service organisations
P1.5B  Organisation-configurable missions
P1.5C  Scoped and white-labelled XP
P1.5D  Contextual assessments and recommendations
P1.5E  Institutional supervision and operations
P1.5F  Final Phase 1 UI cleanup
```

The first authorised implementation pass was P1.5A. P1.5A received a focused closure pass on 2026-08-08 after acceptance review found gaps in self-service organisation management, organisation CMS authoring/media and learner lesson/quiz context preservation. The final contextual learner browser journey amendment passed on 2026-08-09, so P1.5A is formally closed. Current closure details and validation evidence live in the P1.5 addendum. P1.5B implementation was explicitly requested and kicked off on 2026-08-09 with the mission registry, organisation mission catalogue, programme delivery context, contextual referral and mission outcome context foundation; follow-up P1.5B passes added the first organisation mission create/adapt/edit admin workflow, contextual mission status authorization, programme mission delivery controls, learner-facing contextual invite routing, trusted programme mission award/proof execution for delivery dates and point overrides, and contextual referral qualification tied to scoped programme mission awards. The full local remediation/E2E gate passed on 2026-08-10. Later P1.5B acceptance reviews required focused closure before P1.5C: closure migrations and app changes now add distinct programme mission delivery identities, programme-scoped learner/referral progress, contextual referral programme entry outcomes, org-aware proof review authorization, tenant-bound mission content validation, conservative XP-only reward-mode entitlements, programme-workspace manual referral approval, mission-CMS organisation-wide delivery controls, shared contextual confirmation callback preservation for resend-confirmation, and browser proof of learner proof submission through organisation proof queue approval to learner success state. Final narrow closure validation passed on 2026-08-12 with typecheck, lint, unit tests, build, the 23-file/509-test pgTAP suite and 9/9 Playwright E2E flows. P1.5B is formally closed; P1.5C is authorized. P1.5C then received its authorized focused closure review: `P15-XP-001`, `P15-XP-002`, `P15-XP-003`, `P15-XP-004`, `P15-XP-005`, `P15-XP-006` and `P15-RWD-001` were stopped for review on 2026-08-12 after the application and legacy-RPC gaps were remediated within `P15C-CLOSE-01` through `P15C-CLOSE-05`. A follow-up P1.5C closure pass on 2026-08-12 resolved exact Org Mode delivery context, contextual lesson completion enforcement and refund-neutral issuance accounting; validation details live in the P1.5 addendum. P1.5D was not started; P1.5C is stopped for acceptance review.

Where the P1.5 addendum conflicts with earlier assumptions in this product plan, the P1.5 addendum takes precedence.

---

# P2: ENTERPRISE AND INSTITUTIONAL EXPANSION

**Do not implement until P1.5 is separately reviewed, accepted and closed.**

---

# LMS-HIERARCHY-001

## Organisational units and hierarchy

Support structures such as:

```text
Command
Formation
Department
Branch
Parish
Diocese
Region
School
Campus
```

Allow assignment and reporting by organisational unit.

---

# LMS-INSTRUCTOR-001

## Instructor and supervisor operations

Support:

* facilitator assignment;
* learner oversight;
* mission verification;
* supervisor comments;
* intervention tracking;
* cohort announcements;
* manual completion approval where appropriate.

---

# LMS-CERT-001

## Certificates and credentials

Support:

* certificate templates;
* organisation branding;
* completion verification;
* downloadable certificates;
* revocation;
* credential identifier;
* certificate reporting.

---

# LMS-VERSION-001

## Content versioning and update management

Support:

* revision history;
* compare versions;
* restore;
* draft version separate from published version;
* upstream platform-course updates;
* organisation adaptation conflict handling.

---

# LMS-COLLAB-001

## Collaborative editorial workflow

Support:

* comments;
* mentions;
* assigned review issues;
* activity history;
* simultaneous editing where justified;
* granular reviewer permissions.

---

# LMS-BRAND-001

## Organisation branding

Support configurable:

* logo;
* colours;
* learner portal branding;
* certificate branding;
* email branding;
* custom domain where commercially justified.

Do not permit branding changes to compromise accessibility.

---

# LMS-ENTERPRISE-001

## Identity and provisioning

When actual customers require it, support:

* SSO;
* SAML/OIDC;
* SCIM;
* directory sync;
* automated user lifecycle;
* institutional identity mapping.

---

# LMS-INTEROP-001

## Learning and HR interoperability

Implement only in response to validated customer requirements:

* SCORM;
* xAPI;
* LTI;
* HRIS integrations;
* webhooks;
* external reporting APIs.

Do not add standards merely for marketing checkbox theatre.

---

# LMS-OFFLINE-001

## Low-bandwidth and offline capability

For police, civil defence, military and distributed church deployments, evaluate:

* low-data lesson delivery;
* downloadable learning packs;
* resumable progress;
* offline completion sync;
* compressed media;
* SMS/USSD reminder support where appropriate.

---

# LMS-DEPLOY-001

## Dedicated and restricted deployments

Evaluate:

* shared SaaS tenancy;
* dedicated tenant deployment;
* private cloud;
* region-specific hosting;
* restricted content boundaries;
* institutional audit requirements.

Only implement when backed by a concrete commercial/security requirement.

---

# 7. PRODUCT GUARDRAILS

Do not turn Project Ve into a generic document-hosting LMS.

Prioritise features supporting:

```text
Values formation
Behaviour change
Institutional conduct
Practical application
Programme reinforcement
Measurable outcomes
```

Filter generic LMS requests through:

> Does this capability materially help an organisation build, reinforce or measure values, conduct or behaviour?

Courses are content.

Programmes are delivery and outcomes.

Keep those concepts separate.

---

# 8. FINAL IMPLEMENTATION ORDER

Authorised now:

```text
P1.5A Org Mode, plans and self-service organisations
↓
Stop
↓
Product review
```

```text
P1.5B Organisation-configurable missions
↓
Stop
↓
Product review
↓
P1.5C Scoped and white-labelled XP
↓
Stop
↓
Product review
↓
P1.5D Contextual assessments and recommendations
↓
Stop
↓
Product review
↓
P1.5E Institutional supervision and operations
↓
Stop
↓
Product review
↓
P1.5F Final Phase 1 UI cleanup
↓
Stop
↓
P2 Enterprise and institutional expansion
```

Do not collapse these phases.

P0 CMS remediation and P1 Hybrid LMS foundation are closed. Do not reopen or replace accepted P0/P1 architecture unless a Phase 1.5 ticket explicitly requires a narrow extension.

The immediate objective is product review of implemented P1.5A without beginning later P1.5 batches or P2.
