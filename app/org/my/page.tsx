import { redirect } from "next/navigation";
import Link from "next/link";
import { acceptOrganizationInvitation, declineOrganizationInvitation } from "@/app/org/my/actions";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getMyOrganizationState } from "@/features/organizations/application/my-orgs";
import { createLoginHref } from "@/lib/auth-redirect";
import { isLiveMode } from "@/lib/app-mode";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabase-server";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function organizationName(organization: { name: string; short_name: string | null }) {
  return organization.short_name || organization.name;
}

function targetLabel(targetType: string) {
  if (targetType === "programme") return "Programme";
  if (targetType === "cohort") return "Cohort";
  return "Organisation";
}

export default async function MyOrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[] }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getCurrentUserProfile(supabase);

  if (isLiveMode && !user) {
    redirect(createLoginHref("/org/my"));
  }

  const state = supabase && user
    ? await getMyOrganizationState(supabase, user.id)
    : { invitations: [], organizations: [] };
  const notice = firstSearchValue((await searchParams)?.notice);

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-shell)]">
      <AppHeader title="My Orgs" backHref="/org" showMenu={false} />

      <section className="px-5 py-6 lg:px-[clamp(2rem,4vw,4.5rem)]">
        <div className="mx-auto max-w-6xl space-y-5">
          {notice ? (
            <div className="rounded-[18px] border border-[color:color-mix(in_srgb,var(--ve-green)_24%,var(--ve-line-soft))] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_64%,var(--ve-card))] px-4 py-3 text-sm font-black text-[var(--ve-green)]">
              {notice}
            </div>
          ) : null}

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
              Orgs
            </p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3.75rem)] font-black leading-none tracking-[-0.05em] text-[var(--foreground)]">
              My Orgs
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
              Review invitations and open organisation learning spaces connected to your Project Ve identity.
            </p>
          </div>

          {state.invitations.length > 0 ? (
            <section>
              <h2 className="text-lg font-black tracking-[-0.02em] text-[var(--foreground)]">
                Pending invitations
              </h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {state.invitations.map((invitation) => (
                  <Card className="p-5" key={invitation.id} variant="lesson">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-green)]">
                          {targetLabel(invitation.targetType)}
                        </p>
                        <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[var(--foreground)]">
                          {organizationName(invitation.organization)}
                        </h3>
                        <p className="mt-2 text-sm font-bold text-[var(--ve-muted-strong)]">
                          {invitation.targetLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--ve-card-muted)] px-3 py-1 text-[11px] font-black text-[var(--ve-muted)]">
                        {roleLabel(invitation.role)}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                      Expires {formatDate(invitation.expiresAt)}
                    </p>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <form action={declineOrganizationInvitation}>
                        <input name="invitationId" type="hidden" value={invitation.id} />
                        <Button className="h-10 w-full px-4 text-sm sm:w-auto" type="submit" variant="outline">
                          Decline
                        </Button>
                      </form>
                      <form action={acceptOrganizationInvitation}>
                        <input name="invitationId" type="hidden" value={invitation.id} />
                        <Button className="h-10 w-full px-4 text-sm sm:w-auto" type="submit">
                          Accept
                        </Button>
                      </form>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {state.organizations.length > 0 ? (
            <section>
              <h2 className="text-lg font-black tracking-[-0.02em] text-[var(--foreground)]">
                Active organisations
              </h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {state.organizations.map((item) => (
                  <Card className="p-5" key={item.organization.id}>
                    <div className="flex items-start gap-3">
                      {item.organization.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="h-12 w-12 rounded-[10px] border border-[var(--ve-line-soft)] object-cover"
                          src={item.organization.logo_url}
                        />
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-[var(--ve-green-soft)] text-sm font-black text-[var(--ve-green)]">
                          {organizationName(item.organization).slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-xl font-black tracking-[-0.03em] text-[var(--foreground)]">
                          {organizationName(item.organization)}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">
                          {item.accessLabel}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-[16px] bg-[var(--ve-card-muted)] p-4">
                        <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                          Programmes
                        </dt>
                        <dd className="mt-2 font-black text-[var(--foreground)]">
                          {item.programmes.length || "None active"}
                        </dd>
                      </div>
                      <div className="rounded-[16px] bg-[var(--ve-card-muted)] p-4">
                        <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                          Organisation points
                        </dt>
                        <dd className="mt-2 font-black text-[var(--foreground)]">{item.pointsLabel}</dd>
                      </div>
                    </dl>

                    {item.programmes.length > 0 || item.cohorts.length > 0 ? (
                      <div className="mt-4 space-y-2 text-sm font-semibold text-[var(--ve-muted-strong)]">
                        {item.programmes.map((programme) => (
                          <p key={programme.id}>Programme: {programme.title}</p>
                        ))}
                        {item.cohorts.map((cohort) => (
                          <p key={cohort.id}>Cohort: {cohort.title}</p>
                        ))}
                      </div>
                    ) : null}

                    {item.roles.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.roles.map((role) => (
                          <span
                            className="rounded-full bg-[var(--ve-card-muted)] px-3 py-1 text-[11px] font-black text-[var(--ve-muted)]"
                            key={role.key}
                          >
                            {role.label}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        className="h-10 px-4 text-sm"
                        href={`/o/${encodeURIComponent(item.organization.slug)}`}
                        variant="soft"
                      >
                        Open learning workspace
                      </Button>
                      {item.canManage ? (
                        <Button className="h-10 px-4 text-sm" href="/admin" variant="outline">
                          Manage organisation
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {state.invitations.length === 0 && state.organizations.length === 0 ? (
            <Card className="p-6" variant="quiet">
              <h2 className="text-xl font-black tracking-[-0.03em] text-[var(--foreground)]">
                You do not belong to an organisation yet.
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                Ask your organisation administrator to send you an invitation.
              </p>
              <div className="mt-5">
                <Button href="/org/create">Create an Organisation</Button>
              </div>
            </Card>
          ) : null}

          <div className="rounded-[18px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] p-4 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
            Orgs are invitation-first. There is no public organisation directory and no organisation code entry.
            <Link className="ml-1 font-black text-[var(--ve-green)]" href="/org">
              Learn more
            </Link>
          </div>
        </div>
      </section>

      <BottomNav active="Orgs" />
    </main>
  );
}
