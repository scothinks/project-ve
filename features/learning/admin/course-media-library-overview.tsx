import {
  AdminCard,
  AdminStatusBadge,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import type { AdminCourseDetailPageData } from "./course-detail-data";

type CourseMediaLibraryOverviewProps = {
  mediaAssets: AdminCourseDetailPageData["mediaAssets"];
};

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function getMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  return metadata?.[key] === true;
}

function assetLabel(asset: CourseMediaLibraryOverviewProps["mediaAssets"][number]) {
  return [
    asset.lesson?.title,
    asset.placement,
    asset.asset_type,
  ].filter(Boolean).join(" · ");
}

function groupAssets(mediaAssets: CourseMediaLibraryOverviewProps["mediaAssets"]) {
  const courseAssets = mediaAssets.filter((asset) => !asset.lesson_id);
  const lessonGroups = new Map<string, CourseMediaLibraryOverviewProps["mediaAssets"]>();

  for (const asset of mediaAssets.filter((item) => item.lesson_id)) {
    const lessonTitle = asset.lesson?.title ?? "Unassigned lesson";
    const existing = lessonGroups.get(lessonTitle) ?? [];
    existing.push(asset);
    lessonGroups.set(lessonTitle, existing);
  }

  const unusedAssets = mediaAssets.filter((asset) =>
    !asset.url
    || getMetadataBoolean(asset.metadata, "excludeFromGeneration")
    || getMetadataString(asset.metadata, "targetKind") === "library_only",
  );

  return { courseAssets, lessonGroups, unusedAssets };
}

function MediaAssetTile({
  asset,
}: {
  asset: CourseMediaLibraryOverviewProps["mediaAssets"][number];
}) {
  const missingAlt = Boolean(asset.url?.trim()) && !asset.alt_text?.trim();
  const failed = asset.generation_status === "failed";

  return (
    <a
      className="block rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-3 transition hover:border-[var(--ve-green)]"
      href={`#media-asset-${asset.id}`}
    >
      <div className="h-28 overflow-hidden rounded-[12px] bg-[var(--ve-card-subtle)]">
        {asset.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={asset.alt_text ?? asset.placement} className="h-full w-full object-cover" src={asset.url} />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center text-xs font-bold text-[var(--ve-muted)]">
            No preview
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-xs font-black">{assetLabel(asset)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <AdminStatusBadge tone={asset.review_status === "approved" ? "good" : "warning"}>
          {asset.review_status.replaceAll("_", " ")}
        </AdminStatusBadge>
        <AdminStatusBadge tone={failed ? "danger" : asset.generation_status === "completed" ? "good" : "warning"}>
          {asset.generation_status.replaceAll("_", " ")}
        </AdminStatusBadge>
        {missingAlt ? <AdminStatusBadge tone="danger">missing alt</AdminStatusBadge> : null}
      </div>
    </a>
  );
}

export function CourseMediaLibraryOverview({
  mediaAssets,
}: CourseMediaLibraryOverviewProps) {
  const { courseAssets, lessonGroups, unusedAssets } = groupAssets(mediaAssets);
  const missingAltCount = mediaAssets.filter((asset) => asset.url?.trim() && !asset.alt_text?.trim()).length;
  const failedCount = mediaAssets.filter((asset) => asset.generation_status === "failed").length;

  return (
    <AdminCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
            Media library
          </p>
          <h2 className="mt-2 text-lg font-black">Usage and quality</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
            Use this overview for routine media review. Open an asset detail when you need replacement, approval, prompt or target controls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge tone="neutral">{mediaAssets.length} assets</AdminStatusBadge>
          <AdminStatusBadge tone={missingAltCount > 0 ? "danger" : "good"}>{missingAltCount} missing alt</AdminStatusBadge>
          <AdminStatusBadge tone={failedCount > 0 ? "danger" : "good"}>{failedCount} failed</AdminStatusBadge>
        </div>
      </div>

      {mediaAssets.length === 0 ? (
        <div className="mt-4">
          <EmptyAdminState>No media assets yet.</EmptyAdminState>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          <section>
            <h3 className="text-sm font-black">Course-level media</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {courseAssets.length > 0 ? (
                courseAssets.map((asset) => <MediaAssetTile asset={asset} key={asset.id} />)
              ) : (
                <div className="rounded-[14px] border border-dashed border-[var(--ve-line-soft)] bg-[var(--ve-panel)] px-4 py-5 text-sm font-semibold text-[var(--ve-muted)]">
                  No course-level media assets.
                </div>
              )}
            </div>
          </section>

          {Array.from(lessonGroups.entries()).map(([lessonTitle, assets]) => (
            <section key={lessonTitle}>
              <h3 className="text-sm font-black">{lessonTitle}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {assets.map((asset) => <MediaAssetTile asset={asset} key={asset.id} />)}
              </div>
            </section>
          ))}

          {unusedAssets.length > 0 ? (
            <section>
              <h3 className="text-sm font-black">Needs placement or preview</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {unusedAssets.map((asset) => <MediaAssetTile asset={asset} key={asset.id} />)}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AdminCard>
  );
}
