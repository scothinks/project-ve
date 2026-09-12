import { AdminSelect } from "@/components/admin/AdminSelect";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import type { ContentValueTag, ValueDimension } from "@/lib/values-assessment";
import {
  deleteContentValueTag,
  saveContentValueTag,
  updateContentValueTag,
} from "@/app/admin/content-value-tags/actions";

const fieldLabelClasses = "text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--ui-text-muted)]";

const fieldClasses =
  "mt-1.5 w-full rounded-[10px] border border-[var(--ui-control-border)] bg-[var(--ui-surface-inset)] px-2.5 py-2 text-sm font-bold text-[var(--ui-text)] outline-none focus:border-[var(--ui-focus)]";

const levelOptions = [
  { label: "Any level", value: "" },
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];

const outcomeOptions = [
  { label: "None", value: "" },
  { label: "Awareness", value: "awareness" },
  { label: "Reflection", value: "reflection" },
  { label: "Practice", value: "practice" },
  { label: "Action", value: "action" },
  { label: "Assessment", value: "assessment" },
];

type ContentValueTagEditorProps = {
  contentId: string;
  contentType: "course" | "lesson" | "mission";
  dimensions: ValueDimension[];
  redirectTo: string;
  tags: ContentValueTag[];
};

export function ContentValueTagEditor({
  contentId,
  contentType,
  dimensions,
  redirectTo,
  tags,
}: ContentValueTagEditorProps) {
  const dimensionsById = new Map(dimensions.map((dimension) => [dimension.id, dimension]));
  const unusedDimensions = dimensions.filter(
    (dimension) =>
      dimension.status === "active" && !tags.some((tag) => tag.dimensionId === dimension.id),
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ui-text)]">
          Value tags
        </p>
        <p className="mt-1.5 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
          Connect this {contentType} to the value dimensions it supports so learner dashboards can
          suggest it more intelligently.
        </p>
      </div>

      <div className="space-y-3">
        {tags.length > 0 ? (
          tags.map((tag) => {
            const dimension = dimensionsById.get(tag.dimensionId);
            return (
              <div
                className="rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-3.5"
                key={tag.id}
              >
                <form action={updateContentValueTag} className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))_auto] lg:items-end">
                  <input name="tagId" type="hidden" value={tag.id} />
                  <input name="contentType" type="hidden" value={contentType} />
                  <input name="contentId" type="hidden" value={contentId} />
                  <input name="redirectTo" type="hidden" value={redirectTo} />

                  <div>
                    <p className={fieldLabelClasses}>Dimension</p>
                    <p className="mt-1.5 text-sm font-extrabold text-[var(--ui-text)]">
                      {dimension?.label ?? tag.dimensionId}
                    </p>
                  </div>

                  <label className="block">
                    <span className={fieldLabelClasses}>Weight</span>
                    <input
                      className={fieldClasses}
                      defaultValue={tag.weight}
                      max="1"
                      min="0.1"
                      name="weight"
                      step="0.1"
                      type="number"
                    />
                  </label>

                  <label className="block">
                    <span className={fieldLabelClasses}>Recommended level</span>
                    <AdminSelect
                      className="mt-1.5"
                      defaultValue={tag.recommendedLevel ?? ""}
                      name="recommendedLevel"
                      options={levelOptions}
                      size="compact"
                    />
                  </label>

                  <label className="block">
                    <span className={fieldLabelClasses}>Outcome type</span>
                    <AdminSelect
                      className="mt-1.5"
                      defaultValue={tag.outcomeType ?? ""}
                      name="outcomeType"
                      options={outcomeOptions}
                      size="compact"
                    />
                  </label>

                  <PendingSubmitButton
                    className="rounded-full bg-[var(--ui-action)] px-4 py-2 text-xs font-extrabold text-[var(--ui-on-action)]"
                    label="Update"
                    pendingLabel="Updating…"
                    type="submit"
                  />
                </form>

                <form action={deleteContentValueTag} className="mt-2 flex justify-end">
                  <input name="tagId" type="hidden" value={tag.id} />
                  <input name="contentType" type="hidden" value={contentType} />
                  <input name="contentId" type="hidden" value={contentId} />
                  <input name="redirectTo" type="hidden" value={redirectTo} />
                  <PendingSubmitButton
                    className="rounded-full px-3 py-1.5 text-[11px] font-extrabold text-[var(--ui-danger)]"
                    label="Remove tag"
                    pendingLabel="Removing…"
                    type="submit"
                  />
                </form>
              </div>
            );
          })
        ) : (
          <p className="rounded-[14px] border border-dashed border-[var(--ui-border-subtle)] p-4 text-center text-sm font-semibold text-[var(--ui-text-muted)]">
            No value tags yet. Add a few to power personalized learner recommendations.
          </p>
        )}
      </div>

      <div className="rounded-[14px] border border-dashed border-[var(--ui-border-subtle)] p-3.5">
        <p className="text-xs font-extrabold text-[var(--ui-text)]">Add value tag</p>
        {unusedDimensions.length > 0 ? (
          <form action={saveContentValueTag} className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_auto] lg:items-end">
            <input name="contentType" type="hidden" value={contentType} />
            <input name="contentId" type="hidden" value={contentId} />
            <input name="redirectTo" type="hidden" value={redirectTo} />

            <label className="block">
              <span className={fieldLabelClasses}>Dimension</span>
              <AdminSelect
                className="mt-1.5"
                defaultValue={unusedDimensions[0]?.id ?? ""}
                name="dimensionId"
                options={unusedDimensions.map((dimension) => ({ label: dimension.label, value: dimension.id }))}
                size="compact"
              />
            </label>

            <label className="block">
              <span className={fieldLabelClasses}>Weight</span>
              <input
                className={fieldClasses}
                defaultValue="0.8"
                max="1"
                min="0.1"
                name="weight"
                step="0.1"
                type="number"
              />
            </label>

            <label className="block">
              <span className={fieldLabelClasses}>Recommended level</span>
              <AdminSelect className="mt-1.5" defaultValue="" name="recommendedLevel" options={levelOptions} size="compact" />
            </label>

            <label className="block">
              <span className={fieldLabelClasses}>Outcome type</span>
              <AdminSelect className="mt-1.5" defaultValue="" name="outcomeType" options={outcomeOptions} size="compact" />
            </label>

            <PendingSubmitButton
              className="rounded-full bg-[var(--ui-action)] px-4 py-2 text-xs font-extrabold text-[var(--ui-on-action)]"
              label="Add tag"
              pendingLabel="Adding…"
              type="submit"
            />
          </form>
        ) : (
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ui-text-muted)]">
            All active value dimensions are already tagged on this {contentType}. Remove one before adding another.
          </p>
        )}
      </div>
    </div>
  );
}
