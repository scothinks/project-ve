import { AdminCard, EmptyAdminState } from "@/components/admin/AdminPrimitives";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import type { ContentValueTag, ValueDimension } from "@/lib/values-assessment";
import {
  deleteContentValueTag,
  saveContentValueTag,
  updateContentValueTag,
} from "@/app/admin/content-value-tags/actions";

const inputClasses =
  "w-full rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]";

const labelClasses = "text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]";

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
    <AdminCard className="mb-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
            Value tags
          </p>
          <h2 className="mt-2 text-lg font-black">Personalized recommendation tags</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Connect this {contentType} to the value dimensions it supports so learner dashboards can
            suggest it more intelligently.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {tags.length > 0 ? (
          tags.map((tag) => {
            const dimension = dimensionsById.get(tag.dimensionId);
            return (
              <div
                className="rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-4"
                key={tag.id}
              >
                <form action={updateContentValueTag} className="grid gap-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))_auto]">
                  <input name="tagId" type="hidden" value={tag.id} />
                  <input name="contentType" type="hidden" value={contentType} />
                  <input name="contentId" type="hidden" value={contentId} />
                  <input name="redirectTo" type="hidden" value={redirectTo} />

                  <div>
                    <p className={labelClasses}>Dimension</p>
                    <p className="mt-2 text-sm font-black text-[var(--foreground)]">
                      {dimension?.label ?? tag.dimensionId}
                    </p>
                    {dimension?.description ? (
                      <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
                        {dimension.description}
                      </p>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className={labelClasses}>Weight</span>
                    <input
                      className={`${inputClasses} mt-2`}
                      defaultValue={tag.weight}
                      max="1"
                      min="0.1"
                      name="weight"
                      step="0.1"
                      type="number"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClasses}>Recommended level</span>
                    <select
                      className={`${inputClasses} mt-2`}
                      defaultValue={tag.recommendedLevel ?? ""}
                      name="recommendedLevel"
                    >
                      <option value="">Any level</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClasses}>Outcome type</span>
                    <select
                      className={`${inputClasses} mt-2`}
                      defaultValue={tag.outcomeType ?? ""}
                      name="outcomeType"
                    >
                      <option value="">None</option>
                      <option value="awareness">Awareness</option>
                      <option value="reflection">Reflection</option>
                      <option value="practice">Practice</option>
                      <option value="action">Action</option>
                      <option value="assessment">Assessment</option>
                    </select>
                  </label>

                  <div className="flex items-end gap-2">
                    <PendingSubmitButton
                      className="rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white"
                      label="Update"
                      pendingLabel="Updating..."
                      type="submit"
                    />
                  </div>
                </form>

                <form action={deleteContentValueTag} className="mt-3 flex justify-end">
                  <input name="tagId" type="hidden" value={tag.id} />
                  <input name="contentType" type="hidden" value={contentType} />
                  <input name="contentId" type="hidden" value={contentId} />
                  <input name="redirectTo" type="hidden" value={redirectTo} />
                  <PendingSubmitButton
                    className="rounded-[12px] bg-[color:color-mix(in_srgb,var(--ve-danger-soft)_74%,var(--ve-card))] px-4 py-2 text-xs font-black text-[var(--ve-danger)]"
                    label="Remove tag"
                    pendingLabel="Removing..."
                    type="submit"
                  />
                </form>
              </div>
            );
          })
        ) : (
          <EmptyAdminState>No value tags yet. Add a few to power personalized learner recommendations.</EmptyAdminState>
        )}
      </div>

      <div className="mt-5 rounded-[16px] border border-dashed border-[var(--ve-line-soft)] p-4">
        <h3 className="text-sm font-black">Add value tag</h3>
        {unusedDimensions.length > 0 ? (
          <form action={saveContentValueTag} className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_auto]">
            <input name="contentType" type="hidden" value={contentType} />
            <input name="contentId" type="hidden" value={contentId} />
            <input name="redirectTo" type="hidden" value={redirectTo} />

            <label className="block">
              <span className={labelClasses}>Dimension</span>
              <select className={`${inputClasses} mt-2`} defaultValue={unusedDimensions[0]?.id ?? ""} name="dimensionId">
                {unusedDimensions.map((dimension) => (
                  <option key={dimension.id} value={dimension.id}>
                    {dimension.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClasses}>Weight</span>
              <input
                className={`${inputClasses} mt-2`}
                defaultValue="0.8"
                max="1"
                min="0.1"
                name="weight"
                step="0.1"
                type="number"
              />
            </label>

            <label className="block">
              <span className={labelClasses}>Recommended level</span>
              <select className={`${inputClasses} mt-2`} defaultValue="" name="recommendedLevel">
                <option value="">Any level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <label className="block">
              <span className={labelClasses}>Outcome type</span>
              <select className={`${inputClasses} mt-2`} defaultValue="" name="outcomeType">
                <option value="">None</option>
                <option value="awareness">Awareness</option>
                <option value="reflection">Reflection</option>
                <option value="practice">Practice</option>
                <option value="action">Action</option>
                <option value="assessment">Assessment</option>
              </select>
            </label>

            <div className="flex items-end">
              <PendingSubmitButton
                className="w-full rounded-[12px] bg-[var(--ve-green)] px-4 py-3 text-sm font-black text-white"
                label="Add tag"
                pendingLabel="Adding..."
                type="submit"
              />
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            All active value dimensions are already tagged on this {contentType}. Remove one before adding another.
          </p>
        )}
      </div>
    </AdminCard>
  );
}
