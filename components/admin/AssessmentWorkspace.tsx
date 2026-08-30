import Link from "next/link";
import type { ReactNode } from "react";
import {
  createAssessmentRevision,
  deleteAssessmentQuestion,
  publishAssessmentVersion,
  saveAssessmentQuestion,
  updateAssessmentOverview,
} from "@/app/admin/assessments/actions";
import {
  AdminCard,
  AdminStatusBadge,
  AdminTable,
  adminButtonClasses,
} from "@/components/admin/AdminPrimitives";
import type {
  AdminAssessmentQuestionRow,
  AdminAssessmentValueDimensionRow,
  AdminAssessmentVersionSummary,
  AdminAssessmentWorkspace,
} from "@/features/assessments/admin/data";
import type { OrganizationAssessmentCapability } from "@/features/organizations/entitlements";

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-60";
}

function compactFieldClasses() {
  return "w-full rounded-[10px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-2 py-1.5 text-xs font-black tabular-nums outline-none focus:border-[var(--ve-green)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-60";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function helperTextClasses() {
  return "mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]";
}

function statusTone(status: string): "good" | "warning" | "danger" {
  if (status === "published") return "good";
  if (status === "archived") return "danger";
  return "warning";
}

function capabilityLabel(capability: OrganizationAssessmentCapability) {
  if (capability === "assigned_only") return "Starter";
  if (capability === "template_use") return "Team";
  if (capability === "template_adaptation") return "Professional";
  return "Enterprise";
}

function assessmentOwnerLabel(assessment: { owner_scope: string; version_number: number }) {
  return assessment.owner_scope === "platform" ? "Project Ve template" : `Organisation v${assessment.version_number}`;
}

function defaultRevisionTitle(title: string) {
  return title.includes(" adaptation") ? title : `${title} adaptation`;
}

function defaultRevisionSlug(slug: string) {
  return `${slug}-adaptation-${Date.now().toString(36)}`;
}

function Section({
  children,
  id,
  subtitle,
  title,
}: {
  children: ReactNode;
  id: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="scroll-mt-6" id={id}>
      <AdminCard>
        <div className="mb-4">
          <h2 className="text-base font-black">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </AdminCard>
    </section>
  );
}

function safeJson(value: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2);
}

function getQuestionWeightTotals(question: AdminAssessmentQuestionRow) {
  return question.options.map((option) => ({
    id: option.id,
    total: Object.values(option.weights).reduce((sum, value) => sum + Number(value || 0), 0),
  }));
}

function getScoringIssues(questions: AdminAssessmentQuestionRow[]) {
  const issues: string[] = [];

  if (questions.length === 0) {
    issues.push("Add at least one question before publishing.");
  }

  for (const question of questions) {
    if (question.options.length < 2) {
      issues.push(`Question ${question.sort_order} needs at least two answer options.`);
    }

    const totals = getQuestionWeightTotals(question);
    if (totals.every((option) => option.total <= 0)) {
      issues.push(`Question ${question.sort_order} needs at least one weighted option.`);
    }
  }

  return issues;
}

function computePreview(
  questions: AdminAssessmentQuestionRow[],
  dimensions: AdminAssessmentValueDimensionRow[],
  selectedOptionIds: Record<string, string>,
) {
  return dimensions.map((dimension) => {
    let maxPossible = 0;
    let rawScore = 0;

    for (const question of questions) {
      maxPossible += Math.max(...question.options.map((option) => option.weights[dimension.id] ?? 0), 0);
      const selected = question.options.find((option) => option.id === selectedOptionIds[question.id]);
      rawScore += selected?.weights[dimension.id] ?? 0;
    }

    const score = maxPossible > 0 ? Math.min(1, Math.max(0, rawScore / maxPossible)) : 0;
    return {
      confidence: maxPossible > 0 ? 1 : 0.2,
      dimension,
      score,
    };
  });
}

function QuestionForm({
  canEdit,
  dimensions,
  nextSortOrder,
  question,
  versionId,
}: {
  canEdit: boolean;
  dimensions: AdminAssessmentValueDimensionRow[];
  nextSortOrder?: number;
  question?: AdminAssessmentQuestionRow;
  versionId: string;
}) {
  const options = question?.options ?? [];
  const slots = [0, 1, 2, 3].map((index) => options[index] ?? null);

  return (
    <form action={saveAssessmentQuestion} className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
      <input name="assessmentVersionId" type="hidden" value={versionId} />
      <input name="questionId" type="hidden" value={question?.id ?? ""} />
      {dimensions.map((dimension) => (
        <input key={dimension.id} name="dimensionIds" type="hidden" value={dimension.id} />
      ))}
      <div className="grid gap-4 md:grid-cols-[5rem_1fr]">
        <label>
          <span className={labelClasses()}>Order</span>
          <input
            className={fieldClasses()}
            disabled={!canEdit}
            min={1}
            name="sortOrder"
            type="number"
            defaultValue={question?.sort_order ?? nextSortOrder ?? 1}
          />
        </label>
        <label>
          <span className={labelClasses()}>Prompt</span>
          <input
            className={fieldClasses()}
            disabled={!canEdit}
            maxLength={1000}
            name="prompt"
            required
            defaultValue={question?.prompt ?? ""}
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className={labelClasses()}>Helper text</span>
        <textarea
          className={`${fieldClasses()} min-h-20 resize-none`}
          disabled={!canEdit}
          maxLength={1000}
          name="helperText"
          defaultValue={question?.helper_text ?? ""}
        />
      </label>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">
            <tr>
              <th className="w-12 px-2 py-2">Option</th>
              <th className="min-w-52 px-2 py-2">Label</th>
              <th className="min-w-52 px-2 py-2">Description</th>
              {dimensions.map((dimension) => (
                <th className="min-w-28 px-2 py-2" key={dimension.id}>{dimension.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ve-line-soft)]">
            {slots.map((option, index) => (
              <tr key={option?.id ?? `new-${index}`}>
                <td className="px-2 py-3 font-black">{String.fromCharCode(65 + index)}</td>
                <td className="px-2 py-3">
                  <input name={`optionId:${index + 1}`} type="hidden" value={option?.id ?? ""} />
                  <input name={`optionSortOrder:${index + 1}`} type="hidden" value={index + 1} />
                  <input
                    aria-label={`Option ${index + 1} label`}
                    className={compactFieldClasses()}
                    disabled={!canEdit}
                    maxLength={500}
                    name={`optionLabel:${index + 1}`}
                    defaultValue={option?.label ?? ""}
                    required={index < 2}
                  />
                </td>
                <td className="px-2 py-3">
                  <input
                    aria-label={`Option ${index + 1} description`}
                    className={compactFieldClasses()}
                    disabled={!canEdit}
                    maxLength={1000}
                    name={`optionDescription:${index + 1}`}
                    defaultValue={option?.description ?? ""}
                  />
                </td>
                {dimensions.map((dimension) => (
                  <td className="px-2 py-3" key={dimension.id}>
                    <input
                      aria-label={`Option ${index + 1} ${dimension.label} weight`}
                      className={compactFieldClasses()}
                      disabled={!canEdit}
                      min={0}
                      name={`optionWeight:${index + 1}:${dimension.id}`}
                      step="0.1"
                      type="number"
                      defaultValue={option?.weights[dimension.id] ?? 0}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {question ? (
            <button
              className={adminButtonClasses("danger")}
              formAction={deleteAssessmentQuestion}
              type="submit"
            >
              Delete question
            </button>
          ) : null}
          <button className={adminButtonClasses("primary")} type="submit">
            Save question
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function AssessmentIndex({
  assessmentCapability,
  assessments,
  isPlatformCatalog,
  selectedOrganizationId,
}: {
  assessmentCapability: OrganizationAssessmentCapability;
  assessments: AdminAssessmentVersionSummary[];
  isPlatformCatalog: boolean;
  selectedOrganizationId: string | null;
}) {
  const canAdapt = isPlatformCatalog || (
    Boolean(selectedOrganizationId)
    && (assessmentCapability === "template_adaptation" || assessmentCapability === "custom")
  );

  return (
    <div className="space-y-5">
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black">Assessment capability</h2>
            <p className={helperTextClasses()}>
              {isPlatformCatalog
                ? "Platform Catalog staff can maintain Project Ve assessment templates."
                : `${capabilityLabel(assessmentCapability)} workspace policy is resolved from organisation entitlements.`}
            </p>
          </div>
          <AdminStatusBadge tone={canAdapt ? "good" : assessmentCapability === "template_use" ? "warning" : "neutral"}>
            {assessmentCapability.replaceAll("_", " ")}
          </AdminStatusBadge>
        </div>
      </AdminCard>
      <AdminTable columns={["Assessment", "Owner", "Status", "Questions", "Usage", "Actions"]}>
        {assessments.map((assessment) => (
          <tr key={assessment.id}>
            <td className="px-4 py-3">
              <Link className="font-black hover:text-[var(--ve-green)]" href={`/admin/assessments/${assessment.id}`}>
                {assessment.title}
              </Link>
              <p className={helperTextClasses()}>{assessment.slug}</p>
            </td>
            <td className="px-4 py-3">
              <AdminStatusBadge tone={assessment.owner_scope === "platform" ? "neutral" : "store"}>
                {assessmentOwnerLabel(assessment)}
              </AdminStatusBadge>
            </td>
            <td className="px-4 py-3">
              <AdminStatusBadge tone={statusTone(assessment.status)}>{assessment.status}</AdminStatusBadge>
            </td>
            <td className="px-4 py-3 font-black tabular-nums">{assessment.question_count}</td>
            <td className="px-4 py-3 font-black tabular-nums">{assessment.usage_count}</td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Link className={adminButtonClasses("secondary", "px-3 text-xs")} href={`/admin/assessments/${assessment.id}`}>
                  Open
                </Link>
                {canAdapt && assessment.owner_scope === "platform" && assessment.status === "published" ? (
                  <form action={createAssessmentRevision}>
                    <input name="organizationId" type="hidden" value={selectedOrganizationId ?? ""} />
                    <input name="sourceAssessmentVersionId" type="hidden" value={assessment.id} />
                    <input name="title" type="hidden" value={defaultRevisionTitle(assessment.title)} />
                    <input name="slug" type="hidden" value={defaultRevisionSlug(assessment.slug)} />
                    <input name="description" type="hidden" value={assessment.description ?? ""} />
                    <input name="introductionCopy" type="hidden" value={assessment.introduction_copy} />
                    <input name="completionCopy" type="hidden" value={assessment.completion_copy} />
                    <button className={adminButtonClasses("primary", "px-3 text-xs")} type="submit">
                      {isPlatformCatalog ? "Create revision" : "Adapt"}
                    </button>
                  </form>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

export function AssessmentWorkspace({
  previewAnswers,
  workspace,
}: {
  previewAnswers: Record<string, string>;
  workspace: AdminAssessmentWorkspace;
}) {
  const {
    assessment,
    canAdapt,
    canEditDraft,
    questions,
    usage,
    valueDimensions,
    versionHistory,
  } = workspace;
  const scoringIssues = getScoringIssues(questions);
  const previewScores = computePreview(questions, valueDimensions, previewAnswers);
  const averageScore = previewScores.length
    ? previewScores.reduce((sum, item) => sum + item.score, 0) / previewScores.length
    : 0;
  const readinessLevel = averageScore < 0.45 ? "beginner" : averageScore < 0.7 ? "intermediate" : "advanced";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {["overview", "questions", "scoring", "preview", "history", "publish"].map((sectionId) => (
          <a className={adminButtonClasses("secondary", "px-3 text-xs")} href={`#${sectionId}`} key={sectionId}>
            {sectionId === "publish" ? "Review and Publish" : sectionId}
          </a>
        ))}
      </div>

      <Section id="overview" title="Overview" subtitle="Template identity and learner-facing copy.">
        <form action={updateAssessmentOverview}>
          <input name="assessmentVersionId" type="hidden" value={assessment.id} />
          <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
            <label>
              <span className={labelClasses()}>Title</span>
              <input className={fieldClasses()} disabled={!canEditDraft} name="title" required defaultValue={assessment.title} />
            </label>
            <label>
              <span className={labelClasses()}>Slug</span>
              <input className={fieldClasses()} disabled={!canEditDraft} name="slug" required defaultValue={assessment.slug} />
            </label>
          </div>
          <label className="mt-4 block">
            <span className={labelClasses()}>Description</span>
            <textarea className={`${fieldClasses()} min-h-24 resize-none`} disabled={!canEditDraft} name="description" defaultValue={assessment.description ?? ""} />
          </label>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label>
              <span className={labelClasses()}>Introduction copy</span>
              <textarea className={`${fieldClasses()} min-h-24 resize-none`} disabled={!canEditDraft} name="introductionCopy" defaultValue={assessment.introduction_copy} />
            </label>
            <label>
              <span className={labelClasses()}>Completion copy</span>
              <textarea className={`${fieldClasses()} min-h-24 resize-none`} disabled={!canEditDraft} name="completionCopy" defaultValue={assessment.completion_copy} />
            </label>
          </div>
          <label className="mt-4 block">
            <span className={labelClasses()}>Scoring config JSON</span>
            <textarea className={`${fieldClasses()} min-h-24 resize-y font-mono text-xs`} disabled={!canEditDraft} name="scoringConfig" defaultValue={safeJson(assessment.scoring_config)} />
          </label>
          {canEditDraft ? (
            <div className="mt-4 flex justify-end">
              <button className={adminButtonClasses("primary")} type="submit">Save overview</button>
            </div>
          ) : (
            <p className={helperTextClasses()}>
              {assessment.status === "published"
                ? "Published assessment versions are immutable. Create a new revision to edit."
                : "This workspace can view assessment templates but cannot edit them on the current plan."}
            </p>
          )}
        </form>
      </Section>

      <Section id="questions" title="Questions" subtitle="Edit accessible single-select options and scoring weights for draft organisation assessments.">
        <div className="space-y-4">
          {questions.map((question) => (
            <QuestionForm
              canEdit={canEditDraft}
              dimensions={valueDimensions}
              key={question.id}
              question={question}
              versionId={assessment.id}
            />
          ))}
          {canEditDraft ? (
            <QuestionForm
              canEdit
              dimensions={valueDimensions}
              nextSortOrder={questions.length + 1}
              versionId={assessment.id}
            />
          ) : null}
        </div>
      </Section>

      <Section id="scoring" title="Scoring" subtitle="Weighting validation against approved Project Ve value dimensions.">
        {scoringIssues.length > 0 ? (
          <ul className="space-y-2 text-sm font-bold text-[var(--ve-danger)]">
            {scoringIssues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        ) : (
          <div className="rounded-[14px] border border-[color:color-mix(in_srgb,var(--ve-green)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_80%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-green)]">
            Scoring weights are ready for preview and publication.
          </div>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {valueDimensions.map((dimension) => (
            <div className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4" key={dimension.id}>
              <p className="font-black">{dimension.label}</p>
              <p className={helperTextClasses()}>{dimension.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="preview" title="Preview" subtitle="Run a non-persistent scoring preview using selected answer options.">
        <form className="space-y-4" method="get">
          {questions.map((question) => (
            <fieldset className="rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4" key={question.id}>
              <legend className="font-black">{question.prompt}</legend>
              <div className="mt-3 grid gap-2">
                {question.options.map((option) => (
                  <label className="flex items-start gap-3 rounded-[12px] bg-[var(--ve-card)] px-3 py-2 text-sm font-bold" key={option.id}>
                    <input
                      defaultChecked={previewAnswers[question.id] === option.id}
                      name={`preview:${question.id}`}
                      type="radio"
                      value={option.id}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {questions.length > 0 ? (
            <button className={adminButtonClasses("secondary")} type="submit">Preview scoring</button>
          ) : null}
        </form>
        <div className="mt-5 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4">
          <p className={labelClasses()}>Preview readiness</p>
          <p className="mt-2 text-2xl font-black capitalize">{readinessLevel}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {previewScores.map((item) => (
              <div className="rounded-[12px] bg-[var(--ve-card)] p-3" key={item.dimension.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black">{item.dimension.label}</span>
                  <span className="text-sm font-black tabular-nums">{Math.round(item.score * 100)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--ve-panel)]">
                  <div className="h-full rounded-full bg-[var(--ve-green)]" style={{ width: `${Math.round(item.score * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="history" title="Version history" subtitle="Published versions remain available for historical attempts and programme use.">
        <div className="space-y-3">
          {versionHistory.map((version) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] p-4" key={version.id}>
              <div>
                <p className="font-black">{version.title}</p>
                <p className={helperTextClasses()}>{version.slug}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge tone={statusTone(version.status)}>{version.status}</AdminStatusBadge>
                <AdminStatusBadge tone="neutral">v{version.version_number}</AdminStatusBadge>
                <Link className={adminButtonClasses("secondary", "px-3 text-xs")} href={`/admin/assessments/${version.id}`}>Open</Link>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="publish" title="Review and Publish" subtitle="Publish only when copy, questions, options and weights are ready.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className={labelClasses()}>Programme usage</p>
            <div className="mt-3 space-y-2">
              {usage.length > 0 ? usage.map((item) => (
                <div className="rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-shell)] px-3 py-2 text-sm font-bold" key={`${item.programme_id}:${item.assessment_version_id}`}>
                  {item.programme?.title ?? item.programme_id}
                  <span className="ml-2 text-xs text-[var(--ve-muted)]">{item.is_required ? "required" : "optional"}</span>
                </div>
              )) : (
                <p className={helperTextClasses()}>No programmes are using this version yet.</p>
              )}
            </div>
          </div>
          <div>
            <p className={labelClasses()}>Publication gate</p>
            {assessment.status === "draft" && canEditDraft && scoringIssues.length === 0 ? (
              <form action={publishAssessmentVersion} className="mt-3">
                <input name="assessmentVersionId" type="hidden" value={assessment.id} />
                <button className={adminButtonClasses("success")} type="submit">Publish version</button>
              </form>
            ) : (
              <p className={helperTextClasses()}>
                {assessment.status === "published"
                  ? "This version is published and locked."
                  : canAdapt
                    ? "Resolve validation issues before publishing."
                    : "Publishing is only available on Professional or Enterprise assessment capability."}
              </p>
            )}
            {assessment.status === "published" && canAdapt ? (
              <form action={createAssessmentRevision} className="mt-3">
                <input name="organizationId" type="hidden" value={assessment.organization_id ?? ""} />
                <input name="sourceAssessmentVersionId" type="hidden" value={assessment.id} />
                <input name="title" type="hidden" value={`${assessment.title} v${assessment.version_number + 1}`} />
                <input name="slug" type="hidden" value={`${assessment.slug}-v${assessment.version_number + 1}`} />
                <input name="description" type="hidden" value={assessment.description ?? ""} />
                <input name="introductionCopy" type="hidden" value={assessment.introduction_copy} />
                <input name="completionCopy" type="hidden" value={assessment.completion_copy} />
                <button className={adminButtonClasses("primary")} type="submit">Create editable revision</button>
              </form>
            ) : null}
          </div>
        </div>
      </Section>
    </div>
  );
}
