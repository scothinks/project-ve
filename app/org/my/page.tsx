import { redirect } from "next/navigation";
import { acceptOrganizationInvitation, declineOrganizationInvitation } from "@/app/org/my/actions";
import { BottomNav } from "@/components/navigation/BottomNav";
import { LearnerTopChrome } from "@/components/navigation/LearnerTopChrome";
import { LearnerWorkspaceSwitcher } from "@/components/navigation/LearnerWorkspaceSwitcher";
import { ClockIcon, MailIcon, SchoolIcon, SeedlingIcon, StarIcon } from "@/components/organizations/OrgIcons";
import { Button } from "@/components/ui/Button";
import { ChevronRightIcon } from "@/components/ui/Icons";
import {
  getMyOrganizationState,
  type MyOrganizationInvitation,
  type MyOrganizationSummary,
} from "@/features/organizations/application/my-orgs";
import { createLoginHref } from "@/lib/auth-redirect";
import { isLiveMode } from "@/lib/app-mode";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function roleLabel(role: string) {
  if (role === "learner") return "Learner";

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function organizationName(organization: { name: string; short_name: string | null }) {
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

function displayName(profileName: string | null | undefined) {
  return profileName && !profileName.includes("@") ? profileName : "Learner";
}

function targetLabel(targetType: string) {
  if (targetType === "programme") return "Programme";
  if (targetType === "cohort") return "Cohort";
  return "Organisation";
}

function OrganizationLogo({ organization }: { organization: MyOrganizationSummary["organization"] }) {
  const name = organizationName(organization);
  if (organization.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className="org-card__logo object-cover" src={organization.logo_url} />
    );
  }

  return <div className="org-card__logo">{initials(name)}</div>;
}

function ActiveOrganizationCard({ item, justJoined = false }: { item: MyOrganizationSummary; justJoined?: boolean }) {
  const name = organizationName(item.organization);
  const labels = [
    ...item.programmes.map((programme) => programme.title),
    ...item.cohorts.map((cohort) => cohort.title),
  ];

  return (
    <article className="org-card org-card--active">
      <div className="flex items-start gap-3">
        <OrganizationLogo organization={item.organization} />
        <div className="min-w-0 flex-1">
          <h3 className="org-card__title">{name}</h3>
          {justJoined ? (
            <span className="mt-1 inline-flex rounded-full bg-[#eef8f1] px-2.5 py-1 text-[11px] font-black text-[var(--learner-green)]">
              Just joined
            </span>
          ) : (
            <p className="org-card__meta mt-1">{item.accessLabel}</p>
          )}
          {labels.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {labels.slice(0, 3).map((label) => (
                <span className="org-chip" key={label}>{label}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {item.pointsLabel !== "Not available yet" ? (
        <div className="mt-4 flex items-center gap-2 rounded-[8px] border border-[rgba(210,185,150,0.42)] bg-[#f8f3ea] px-3 py-2 text-sm font-black text-[#765a05]">
          <StarIcon className="size-4 shrink-0" />
          {item.pointsLabel}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        <Button
          className="h-10 w-full rounded-[8px] text-xs font-black"
          href={`/o/${encodeURIComponent(item.organization.slug)}`}
        >
          Open Workspace
          <ChevronRightIcon className="ml-2 h-4 w-4" />
        </Button>
        {item.canManage ? (
          <Button className="h-9 w-full rounded-[8px] text-xs font-black" href="/admin" variant="outline">
            Manage Organisation
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function InvitationCard({ invitation }: { invitation: MyOrganizationInvitation }) {
  const orgName = organizationName(invitation.organization);

  return (
    <article className="org-card org-card--invitation">
      <div className="org-card__summary">
        <div className="org-card__logo org-card__logo--invite">
          <span className="text-xl font-black">+</span>
        </div>
        <div className="min-w-0">
          <p className="orgs-section-label">{targetLabel(invitation.targetType)} Invitation</p>
          <h3 className="mt-2 org-card__title">{orgName}</h3>
          <p className="org-card__meta mt-2">{invitation.targetLabel}</p>
        </div>
      </div>
      <dl className="org-invitation-facts">
        <div>
          <dt>Assigned Role</dt>
          <dd>{roleLabel(invitation.role)}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{formatDate(invitation.expiresAt)}</dd>
        </div>
      </dl>
      <div className="org-invitation-actions org-invitation-actions--mobile">
        <form action={acceptOrganizationInvitation}>
          <input name="invitationId" type="hidden" value={invitation.id} />
          <input name="organizationSlug" type="hidden" value={invitation.organization.slug} />
          <Button className="h-11 w-full rounded-[8px] text-sm font-black" type="submit">
            Accept Invitation
          </Button>
        </form>
        <form action={declineOrganizationInvitation}>
          <input name="invitationId" type="hidden" value={invitation.id} />
          <Button className="h-11 w-full rounded-[8px] text-sm font-black" type="submit" variant="outline">
            Decline
          </Button>
        </form>
      </div>
      <Button
        className="org-invitation-view h-10 w-full rounded-[8px] text-xs font-black"
        href={`/org/my?invitation=${encodeURIComponent(invitation.id)}`}
        variant="outline"
      >
        View Invitation
      </Button>
      <details className="org-invitation-detail">
        <summary>View Invitation</summary>
        <div className="org-invitation-detail__panel">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-[14px] border border-[var(--learner-border)] bg-[#f8f3ea] text-[var(--learner-green)]">
            <span className="text-xl font-black">+</span>
          </div>
          <div className="text-center">
            <p className="orgs-section-label">Organisation Invitation</p>
            <h3 className="mt-2 org-card__title">{orgName}</h3>
            <p className="org-card__meta mt-2">
              You have been invited to join this organisation learning environment.
            </p>
          </div>
          <dl className="org-invitation-detail__facts">
            <div>
              <dt>Target type</dt>
              <dd>{targetLabel(invitation.targetType)}</dd>
            </div>
            <div>
              <dt>Assigned role</dt>
              <dd>{roleLabel(invitation.role)}</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{formatDate(invitation.expiresAt)}</dd>
            </div>
          </dl>
          <div className="org-invitation-actions">
            <form action={declineOrganizationInvitation}>
              <input name="invitationId" type="hidden" value={invitation.id} />
              <Button className="h-10 w-full rounded-[8px] text-xs font-black" type="submit" variant="outline">
                Decline
              </Button>
            </form>
            <form action={acceptOrganizationInvitation}>
              <input name="invitationId" type="hidden" value={invitation.id} />
              <input name="organizationSlug" type="hidden" value={invitation.organization.slug} />
              <Button className="h-10 w-full rounded-[8px] text-xs font-black" type="submit">
                Accept Invitation
              </Button>
            </form>
          </div>
        </div>
      </details>
    </article>
  );
}

function InvitationFocusPanel({ invitation }: { invitation: MyOrganizationInvitation }) {
  const orgName = organizationName(invitation.organization);

  return (
    <section className="org-invitation-focus">
      <div className="org-invitation-focus__card">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-[16px] border border-[var(--learner-border)] bg-[#fffdfa] text-[var(--learner-green)]">
          <span className="text-2xl font-black">+</span>
        </div>
        <div className="text-center">
          <p className="orgs-section-label">Organisation Invitation</p>
          <h2 className="mt-3 org-card__title">{orgName}</h2>
          <p className="org-card__meta mt-2">
            You have been invited to join this organisation learning environment.
          </p>
        </div>
        <dl className="org-invitation-detail__facts">
          <div>
            <dt>Target type</dt>
            <dd>{targetLabel(invitation.targetType)}</dd>
          </div>
          <div>
            <dt>Assigned role</dt>
            <dd>{roleLabel(invitation.role)}</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>{formatDate(invitation.expiresAt)}</dd>
          </div>
        </dl>
        <div className="org-invitation-actions">
          <form action={declineOrganizationInvitation}>
            <input name="invitationId" type="hidden" value={invitation.id} />
            <Button className="h-10 w-full rounded-[8px] text-xs font-black" type="submit" variant="outline">
              Decline
            </Button>
          </form>
          <form action={acceptOrganizationInvitation}>
            <input name="invitationId" type="hidden" value={invitation.id} />
            <input name="organizationSlug" type="hidden" value={invitation.organization.slug} />
            <Button className="h-10 w-full rounded-[8px] text-xs font-black" type="submit">
              Accept Invitation
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

function MobileInvitationCard({ invitation }: { invitation: MyOrganizationInvitation }) {
  return (
    <article className="org-card org-card--mobile-invitation">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-[14px] border border-[var(--learner-border)] bg-[#f8f3ea] text-[var(--learner-green)]">
        <MailIcon className="size-6" />
      </div>
      <div className="text-center">
        <p className="orgs-section-label">{targetLabel(invitation.targetType)} Invitation</p>
        <h3 className="mt-2 org-card__title">{organizationName(invitation.organization)}</h3>
        <p className="org-card__meta mt-2">{invitation.targetLabel}</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-[rgba(110,122,115,0.14)] py-4">
        <div>
          <dt className="org-card__meta flex items-center gap-1 uppercase tracking-[0.1em]">
            <SchoolIcon className="size-3.5 shrink-0" />
            Assigned Role
          </dt>
          <dd className="mt-1 text-sm font-black text-[var(--learner-text)]">{roleLabel(invitation.role)}</dd>
        </div>
        <div>
          <dt className="org-card__meta flex items-center gap-1 uppercase tracking-[0.1em]">
            <ClockIcon className="size-3.5 shrink-0" />
            Expires
          </dt>
          <dd className="mt-1 text-sm font-black text-[var(--learner-text)]">{formatDate(invitation.expiresAt)}</dd>
        </div>
      </dl>
      <div className="org-invitation-actions org-invitation-actions--legacy">
        <form action={acceptOrganizationInvitation}>
          <input name="invitationId" type="hidden" value={invitation.id} />
          <input name="organizationSlug" type="hidden" value={invitation.organization.slug} />
          <Button className="h-11 w-full rounded-[8px] text-sm font-black" type="submit">
            Accept Invitation
          </Button>
        </form>
        <form action={declineOrganizationInvitation}>
          <input name="invitationId" type="hidden" value={invitation.id} />
          <Button className="h-11 w-full rounded-[8px] text-sm font-black" type="submit" variant="outline">
            Decline
          </Button>
        </form>
      </div>
    </article>
  );
}

function EmptyOrgsState() {
  return (
    <section className="grid min-h-[calc(100dvh-12rem)] content-center text-center">
      <div className="org-empty-visual">
        <div className="org-empty-visual__plant">
          <SeedlingIcon className="size-8" />
        </div>
      </div>
      <h2 className="mt-8 text-xl font-black tracking-[-0.03em] text-[var(--learner-text)]">
        No organisations yet.
      </h2>
      <p className="mx-auto mt-4 max-w-[17rem] text-sm font-semibold leading-6 text-[var(--learner-text-muted)]">
        Ask your organisation administrator to send you an invitation, or create your own organisation.
      </p>
      <div className="mt-6">
        <Button className="h-11 px-6 text-sm font-black" href="/org/create">
          Create Org
        </Button>
      </div>
    </section>
  );
}

export default async function MyOrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string | string[];
    invitation?: string | string[];
    joinedOrg?: string | string[];
    notice?: string | string[];
  }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  if (isLiveMode && !user) {
    redirect(createLoginHref("/org/my"));
  }

  const state = supabase && user
    ? await getMyOrganizationState(supabase, user.id)
    : { invitations: [], organizations: [] };
  const resolvedSearchParams = await searchParams;
  const notice = firstSearchValue(resolvedSearchParams?.notice);
  const errorNotice = firstSearchValue(resolvedSearchParams?.error);
  const justJoinedSlug = firstSearchValue(resolvedSearchParams?.joinedOrg);
  const selectedInvitationId = firstSearchValue(resolvedSearchParams?.invitation);
  const selectedInvitation = state.invitations.find((invitation) => invitation.id === selectedInvitationId);
  const hasAnyOrgState = state.invitations.length > 0 || state.organizations.length > 0;
  const name = displayName(profile?.display_name);

  return (
    <main className="learner-system orgs-learner min-h-screen">
      <LearnerTopChrome
        active="Orgs"
        avatarUrl={profile?.avatar_url}
        displayName={name}
        email={user?.email}
        leading={<LearnerWorkspaceSwitcher organizations={state.organizations} />}
        workspaceSwitcher={<LearnerWorkspaceSwitcher organizations={state.organizations} />}
      />

      <section className="learner-page learner-page--standard">
        {notice ? (
          <div className="mb-4 rounded-[8px] border border-[rgba(8,127,91,0.2)] bg-[#eef8f1] px-4 py-3 text-sm font-black text-[var(--learner-green)]">
            {notice}
          </div>
        ) : null}
        {errorNotice ? (
          <div className="mb-4 rounded-[8px] border border-[var(--learner-attention-soft)] bg-[color:color-mix(in_srgb,var(--learner-attention-soft)_55%,white)] px-4 py-3 text-sm font-black text-[var(--learner-attention)]">
            {errorNotice}
          </div>
        ) : null}

        {hasAnyOrgState ? (
          <div className="orgs-state-layout">
            <header>
              <h1 className="orgs-page-title">My Orgs</h1>
              <p className="orgs-page-copy">
                Open your organisation workspaces and respond to invitations.
              </p>
            </header>

            <section className="orgs-active-section">
              <h2 className="orgs-section-heading">Active Memberships</h2>
              <div className="mt-4 grid gap-4">
                {state.organizations.length > 0 ? (
                  state.organizations.map((item) => (
                    <ActiveOrganizationCard
                      item={item}
                      justJoined={item.organization.slug === justJoinedSlug}
                      key={item.organization.id}
                    />
                  ))
                ) : (
                  <p className="org-card__meta">No active memberships yet.</p>
                )}
              </div>
            </section>

            {state.invitations.length > 0 ? (
              <section className="orgs-pending-section">
                <h2 className="orgs-section-heading">Pending Invitations</h2>
                <div className="mt-4 grid gap-4">
                  {state.invitations.map((invitation) => (
                    <div key={invitation.id}>
                      <InvitationCard invitation={invitation} />
                      <MobileInvitationCard invitation={invitation} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {selectedInvitation ? (
              <InvitationFocusPanel invitation={selectedInvitation} />
            ) : null}
          </div>
        ) : (
          <EmptyOrgsState />
        )}
      </section>

      <BottomNav active="Orgs" />
    </main>
  );
}
