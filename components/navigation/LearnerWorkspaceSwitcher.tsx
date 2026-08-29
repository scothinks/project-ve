import Link from "next/link";
import type { MyOrganizationSummary } from "@/features/organizations/application/my-orgs";
import { cn } from "@/lib/utils";

type LearnerWorkspaceSwitcherProps = {
  currentOrganizationSlug?: string | null;
  organizations: MyOrganizationSummary[];
};

function organizationName(organization: MyOrganizationSummary["organization"]) {
  return organization.short_name || organization.name;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "PV";
}

function GridIcon() {
  return (
    <svg aria-hidden="true" className="size-[18px]" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 5h5v5H5V5Zm9 0h5v5h-5V5ZM5 14h5v5H5v-5Zm9 0h5v5h-5v-5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path d="m6 12 4 4 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  );
}

function WorkspaceLogo({
  className,
  organization,
}: {
  className?: string;
  organization?: MyOrganizationSummary["organization"];
}) {
  if (!organization) {
    return (
      <span className={cn("workspace-switcher__logo workspace-switcher__logo--project", className)}>
        <GridIcon />
      </span>
    );
  }

  const name = organizationName(organization);
  if (organization.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className={cn("workspace-switcher__logo object-cover", className)} src={organization.logo_url} />
    );
  }

  return <span className={cn("workspace-switcher__logo", className)}>{initials(name)}</span>;
}

export function LearnerWorkspaceSwitcher({
  currentOrganizationSlug = null,
  organizations,
}: LearnerWorkspaceSwitcherProps) {
  const isProjectVeActive = !currentOrganizationSlug;

  return (
    <details className="workspace-switcher">
      <summary className="workspace-switcher__trigger" aria-label="Switch workspace">
        <GridIcon />
      </summary>
      <div className="workspace-switcher__backdrop" />
      <div className="workspace-switcher__sheet">
        <div className="workspace-switcher__handle" />

        <section className="workspace-switcher__section" aria-label="Project Ve workspace">
          <p className="workspace-switcher__eyebrow">Project Ve</p>
          <Link className="workspace-switcher__row" href="/dashboard">
            <WorkspaceLogo />
            <span className="min-w-0">
              <span className="workspace-switcher__name">Project Ve</span>
            </span>
            {isProjectVeActive ? (
              <span className="workspace-switcher__check">
                <CheckIcon />
              </span>
            ) : null}
          </Link>
        </section>

        <section className="workspace-switcher__section" aria-label="Organisation workspaces">
          <p className="workspace-switcher__eyebrow">My Orgs</p>
          <div className="workspace-switcher__list">
            {organizations.map((item) => {
              const name = organizationName(item.organization);
              const isActive = item.organization.slug === currentOrganizationSlug;
              return (
                <Link
                  className={cn("workspace-switcher__row workspace-switcher__row--flat", isActive && "is-active")}
                  href={`/o/${encodeURIComponent(item.organization.slug)}`}
                  key={item.organization.id}
                >
                  <WorkspaceLogo organization={item.organization} />
                  <span className="min-w-0">
                    <span className="workspace-switcher__name">{name}</span>
                  </span>
                  {isActive ? (
                    <span className="workspace-switcher__check">
                      <CheckIcon />
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>

        <Link className="workspace-switcher__manage" href="/org/my">
          <GridIcon />
          My Orgs
        </Link>
      </div>
    </details>
  );
}
