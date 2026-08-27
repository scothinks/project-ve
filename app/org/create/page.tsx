import Link from "next/link";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { Card } from "@/components/ui/Card";
import { createLoginHref } from "@/lib/auth-redirect";
import { isLiveMode } from "@/lib/app-mode";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { createSelfServiceOrganization } from "./actions";

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function fieldClasses() {
  return "mt-2 w-full rounded-[16px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

export default async function CreateOrganizationPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const { user } = await getCurrentUserProfile();

  if (isLiveMode && !user) {
    return (
      <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
        <AppHeader title="Create organisation" backHref="/org" showMenu={false} />
        <section className="px-5 py-8">
          <Card className="p-5" variant="quiet">
            <p className="text-sm font-bold leading-6 text-[var(--ve-muted-strong)]">
              Sign in to create a private Starter organisation workspace.
            </p>
            <Link
              className="mt-4 inline-flex h-11 items-center justify-center rounded-[30px] bg-[var(--ve-green)] px-5 text-sm font-black !text-white"
              href={createLoginHref("/org/create")}
            >
              Sign in
            </Link>
          </Card>
        </section>
        <BottomNav active="Orgs" />
      </main>
    );
  }

  const error = firstSearchValue((await searchParams)?.error);

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)]">
      <AppHeader title="Create organisation" backHref="/org" showMenu={false} />
      <section className="px-5 py-6 lg:px-[clamp(2rem,4vw,4.5rem)]">
        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_20rem]">
          <Card className="p-5 sm:p-6" variant="quiet">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
                Starter workspace
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--foreground)]">
                Create a private organisation
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                The creator becomes organisation owner. Starter limits and unverified status are applied automatically.
              </p>
            </div>

            {error ? (
              <div className="mt-5 rounded-[16px] border border-[#f3b2a1] bg-[#fff2ee] px-4 py-3 text-sm font-bold text-[#a13b20]">
                {error}
              </div>
            ) : null}

            <form action={createSelfServiceOrganization} className="mt-6 space-y-5">
              <label className="block">
                <span className={labelClasses()}>Organisation name</span>
                <input
                  autoComplete="organization"
                  className={fieldClasses()}
                  maxLength={160}
                  name="name"
                  required
                />
              </label>

              <label className="block">
                <span className={labelClasses()}>Web address</span>
                <input
                  className={fieldClasses()}
                  maxLength={80}
                  name="slug"
                  pattern="[a-z0-9][a-z0-9-]{1,78}[a-z0-9]"
                  placeholder="generated from name"
                />
              </label>

              <label className="block">
                <span className={labelClasses()}>Short name</span>
                <input className={fieldClasses()} maxLength={80} name="shortName" />
              </label>

              <label className="block">
                <span className={labelClasses()}>Description</span>
                <textarea className={`${fieldClasses()} min-h-28 resize-y`} maxLength={2000} name="description" />
              </label>

              <label className="block">
                <span className={labelClasses()}>Support email</span>
                <input autoComplete="email" className={fieldClasses()} maxLength={254} name="supportEmail" type="email" />
              </label>

              <label className="flex items-start gap-3 rounded-[16px] border border-[var(--ve-line-soft)] bg-[var(--ve-card-muted)] p-4">
                <input className="mt-1 size-4 accent-[var(--ve-green)]" name="termsAccepted" type="checkbox" required />
                <span className="text-sm font-semibold leading-6 text-[var(--ve-muted-strong)]">
                  I confirm I can create this organisation workspace and will manage members, content, points and rewards responsibly.
                </span>
              </label>

              <PendingSubmitButton
                className="h-12 w-full rounded-[30px] bg-[var(--ve-green)] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(8,127,91,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
                label="Create organisation"
                pendingLabel="Creating organisation..."
                type="submit"
              />
            </form>
          </Card>

          <aside className="space-y-4">
            <Card className="p-5" variant="lesson">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]">
                Included
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-[var(--ve-muted-strong)]">Plan</dt>
                  <dd className="font-black text-[var(--foreground)]">Starter</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-[var(--ve-muted-strong)]">Visibility</dt>
                  <dd className="font-black text-[var(--foreground)]">Private</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-[var(--ve-muted-strong)]">Role</dt>
                  <dd className="font-black text-[var(--foreground)]">Owner</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-semibold text-[var(--ve-muted-strong)]">Verification</dt>
                  <dd className="font-black text-[var(--foreground)]">Unverified</dd>
                </div>
              </dl>
            </Card>

            <Card className="p-5" variant="quiet">
              <p className="text-sm font-bold leading-6 text-[var(--ve-muted-strong)]">
                After creation, setup continues in the organisation management workspace.
              </p>
            </Card>
          </aside>
        </div>
      </section>
      <BottomNav active="Orgs" />
    </main>
  );
}
