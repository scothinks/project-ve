import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdminCard,
  AdminPagination,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTable,
  EmptyAdminState,
} from "@/components/admin/AdminPrimitives";
import {
  getAdminOrganizationActivity,
  getAdminOrganizations,
  requireAdmin,
  type AdminOrganizationActivityChanges,
} from "@/lib/admin";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import { formatRewardDate } from "@/lib/rewards";

type AdminActivityPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dateBoundary(value: string, boundary: "start" | "end") {
  if (!value) return null;
  return `${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`;
}

function formatChangeValue(value: unknown) {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "[redacted structured value]";
}

function changeRows(changes: AdminOrganizationActivityChanges) {
  const keys = Array.from(new Set([
    ...Object.keys(changes.before),
    ...Object.keys(changes.after),
  ])).sort();

  return keys.map((key) => ({
    key,
    before: formatChangeValue(changes.before[key]),
    after: formatChangeValue(changes.after[key]),
  }));
}

export default async function AdminActivityPage({
  searchParams,
}: AdminActivityPageProps) {
  const [{ supabase, workspace }, resolvedParams] = await Promise.all([
    requireAdmin(),
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);

  const isPlatformAdmin =
    workspace.type === "platform" || workspace.roles.includes("platform_admin");
  const canReadOrganizationActivity =
    isPlatformAdmin ||
    workspace.roles.includes("organisation_owner") ||
    workspace.roles.includes("organisation_admin");

  if (!canReadOrganizationActivity) {
    redirect("/admin");
  }

  const organizationParam = valueOf(resolvedParams.organizationId);
  const actorParam = valueOf(resolvedParams.actor);
  const eventTypeParam = valueOf(resolvedParams.action);
  const entityTypeParam = valueOf(resolvedParams.object);
  const dateFrom = valueOf(resolvedParams.dateFrom);
  const dateTo = valueOf(resolvedParams.dateTo);
  const page = parsePageParam(valueOf(resolvedParams.page));
  const organizations = await getAdminOrganizations(supabase);
  const selectedOrganizationId = isPlatformAdmin
    ? organizationParam && organizationParam !== "all" ? organizationParam : null
    : workspace.id;

  const activity = await getAdminOrganizationActivity(supabase, {
    actorUserId: actorParam || null,
    dateFrom: dateBoundary(dateFrom, "start"),
    dateTo: dateBoundary(dateTo, "end"),
    entityType: entityTypeParam || null,
    eventType: eventTypeParam || null,
    limit: 500,
    organizationId: selectedOrganizationId,
  });
  const paginatedEvents = paginateItems(activity.events, page, 25);
  const hasFilters = Boolean(
    selectedOrganizationId || actorParam || eventTypeParam || entityTypeParam || dateFrom || dateTo,
  );

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Operations"
        title="Organisation activity"
        subtitle="Review organisation activity with scoped access, redacted values, and readable summaries for audit-sensitive operations."
      />

      <AdminCard className="mb-6">
        <form action="/admin/activity" className="space-y-4" method="get">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label>
              <span className={labelClasses()}>Organisation</span>
              {isPlatformAdmin ? (
                <select className={fieldClasses()} defaultValue={selectedOrganizationId ?? "all"} name="organizationId">
                  <option value="all">All organisations</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input name="organizationId" type="hidden" value={workspace.id} />
                  <input
                    className={fieldClasses()}
                    disabled
                    readOnly
                    value={workspace.organizationIdentity?.name ?? "Current organisation"}
                  />
                </>
              )}
            </label>
            <label>
              <span className={labelClasses()}>Actor</span>
              <select className={fieldClasses()} defaultValue={actorParam} name="actor">
                <option value="">All actors</option>
                {activity.filters.actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Action</span>
              <select className={fieldClasses()} defaultValue={eventTypeParam} name="action">
                <option value="">All actions</option>
                {activity.filters.eventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {titleCase(eventType)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>Object type</span>
              <select className={fieldClasses()} defaultValue={entityTypeParam} name="object">
                <option value="">All objects</option>
                {activity.filters.entityTypes.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {titleCase(entityType)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClasses()}>From</span>
              <input className={fieldClasses()} defaultValue={dateFrom} name="dateFrom" type="date" />
            </label>
            <label>
              <span className={labelClasses()}>To</span>
              <input className={fieldClasses()} defaultValue={dateTo} name="dateTo" type="date" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-[14px] bg-[var(--ve-green)] px-5 py-3 text-sm font-black text-white" type="submit">
              Apply filters
            </button>
            <Link
              className="rounded-[14px] bg-[color:color-mix(in_srgb,var(--ve-store-soft)_82%,var(--ve-card))] px-5 py-3 text-sm font-black text-[color:color-mix(in_srgb,var(--ve-store)_62%,var(--foreground))]"
              href="/admin/activity"
            >
              Reset
            </Link>
            <p className="text-xs font-semibold text-[var(--ve-muted)]">
              Showing {paginatedEvents.startItem}-{paginatedEvents.endItem} of {paginatedEvents.totalItems} matching events{hasFilters ? " for the current filter set" : ""}.
            </p>
          </div>
        </form>
      </AdminCard>

      {activity.events.length === 0 ? (
        <EmptyAdminState>No organisation activity matches the current filters.</EmptyAdminState>
      ) : (
        <>
          <AdminTable columns={["When", "Organisation", "Actor", "Action", "Object", "Summary"]}>
            {paginatedEvents.items.map((event) => {
              const changes = changeRows(event.changes);

              return (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-4 align-top">
                    {formatRewardDate(event.createdAt)}
                  </td>
                  <td className="min-w-[180px] px-4 py-4 align-top">
                    <p className="font-black">{event.organizationName ?? "Unknown organisation"}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      {event.organizationId?.slice(0, 8) ?? "No organisation"}
                    </p>
                  </td>
                  <td className="min-w-[160px] px-4 py-4 align-top">
                    <p className="font-black">{event.actorName}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      {event.actorUserId?.slice(0, 8) ?? "System"}
                    </p>
                  </td>
                  <td className="min-w-[180px] px-4 py-4 align-top">
                    <AdminStatusBadge tone={event.eventType.includes("refunded") || event.eventType.includes("rejected") ? "warning" : "neutral"}>
                      {event.actionLabel}
                    </AdminStatusBadge>
                  </td>
                  <td className="min-w-[190px] px-4 py-4 align-top">
                    {event.objectHref ? (
                      <Link className="font-black text-[var(--ve-green)] hover:underline" href={event.objectHref}>
                        {event.objectLabel}
                      </Link>
                    ) : (
                      <p className="font-black">{event.objectLabel}</p>
                    )}
                    <p className="mt-1 text-xs font-semibold text-[var(--ve-muted)]">
                      {titleCase(event.entityType)}
                    </p>
                  </td>
                  <td className="min-w-[360px] px-4 py-4 align-top">
                    <p className="font-semibold text-[var(--ve-muted-strong)]">{event.summary}</p>
                    {event.details.length ? (
                      <dl className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                        {event.details.slice(0, 6).map((detail) => (
                          <div key={`${event.id}-${detail.label}`}>
                            <dt className="font-black uppercase tracking-[0.12em] text-[var(--ve-muted)]">{detail.label}</dt>
                            <dd className="mt-0.5 font-semibold text-[var(--ve-muted-strong)]">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {event.hasChanges && changes.length ? (
                      <div className="mt-3 rounded-[12px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                          Before / after
                        </p>
                        <dl className="mt-2 grid gap-2 text-xs">
                          {changes.slice(0, 6).map((change) => (
                            <div className="grid gap-1 sm:grid-cols-[120px_1fr_1fr]" key={`${event.id}-${change.key}`}>
                              <dt className="font-black text-[var(--ve-muted-strong)]">{titleCase(change.key)}</dt>
                              <dd className="font-semibold text-[var(--ve-muted)]">{change.before}</dd>
                              <dd className="font-semibold text-[var(--ve-muted-strong)]">{change.after}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </AdminTable>
          <AdminPagination
            basePath="/admin/activity"
            currentPage={paginatedEvents.currentPage}
            searchParams={{
              action: eventTypeParam || undefined,
              actor: actorParam || undefined,
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
              object: entityTypeParam || undefined,
              organizationId: selectedOrganizationId || undefined,
            }}
            summary={`Showing ${paginatedEvents.startItem}-${paginatedEvents.endItem} of ${paginatedEvents.totalItems} activity events`}
            totalPages={paginatedEvents.totalPages}
          />
        </>
      )}
    </>
  );
}
