import {
  AdminCard,
  AdminNoticeBanner,
  AdminPageHeader,
} from "@/components/admin/AdminPrimitives";
import {
  getAdminXpSettings,
  getAdminPlatformXpAccount,
  PLATFORM_CATALOG_WORKSPACE_ID,
  requireAdmin,
} from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";
import {
  fallbackAdminManualGrantDailyLimit,
  fallbackDailyQuizXpLimit,
} from "@/lib/xp-settings";
import {
  adjustPlatformXpAccount,
  savePlatformXpControls,
  savePlatformXpPresentation,
  saveXpSettings,
} from "@/app/admin/xp-settings/actions";

type AdminXpSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

export default async function AdminXpSettingsPage({
  searchParams,
}: AdminXpSettingsPageProps) {
  const [{ supabase, workspace }, resolvedParams] = await Promise.all([
    requireAdmin(),
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);
  const organizationId = workspace.type === "organization"
    && workspace.id !== PLATFORM_CATALOG_WORKSPACE_ID
    ? workspace.id
    : null;
  const [settings, platformAccount] = await Promise.all([
    getAdminXpSettings(supabase, organizationId),
    organizationId === null && workspace.id === PLATFORM_CATALOG_WORKSPACE_ID
      ? getAdminPlatformXpAccount(supabase)
      : Promise.resolve(null),
  ]);
  const currentLimit = settings.defaultDailyQuizXpLimit ?? fallbackDailyQuizXpLimit;
  const currentManualGrantLimit = settings.adminManualGrantDailyLimit
    ?? fallbackAdminManualGrantDailyLimit;
  const saved = typeof resolvedParams.saved === "string"
    ? resolvedParams.saved
    : Array.isArray(resolvedParams.saved)
      ? resolvedParams.saved[0]
      : undefined;
  const error = typeof resolvedParams.error === "string"
    ? resolvedParams.error
    : Array.isArray(resolvedParams.error)
      ? resolvedParams.error[0]
      : undefined;
  const isPlatformDefault = settings.scope === "platform_catalog";
  const workspaceLabel = workspace.organizationIdentity?.name ?? "this organisation";

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Quiz XP"
        title="XP settings"
        subtitle={isPlatformDefault
          ? "Set the Platform Catalog defaults inherited by organisations that do not have their own override."
          : `Set the learner quiz cap and daily manual-grant safety limit for ${workspaceLabel}.`}
      />
      <AdminCard className="max-w-3xl">
        {saved ? (
          <AdminNoticeBanner>
            {saved === "presentation"
              ? "Platform Points presentation saved."
              : saved === "controls"
                ? "Platform Points controls saved."
                : saved === "adjustment"
                  ? "Platform Points adjustment saved."
                  : "XP settings saved."}
          </AdminNoticeBanner>
        ) : null}
        {error ? <AdminNoticeBanner tone="danger">{error}</AdminNoticeBanner> : null}
        {!settings.canManage ? (
          <AdminNoticeBanner tone="info">
            You can view these settings, but only workspace owners and administrators can change them.
          </AdminNoticeBanner>
        ) : null}
        <form action={saveXpSettings} className="space-y-5">
          <div>
            <span className={labelClasses()}>Default daily quiz XP limit</span>
            <input
              className={fieldClasses()}
              defaultValue={currentLimit}
              min={0}
              name="defaultDailyQuizXpLimit"
              readOnly={!settings.canManage}
              required
              type="number"
            />
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              {settings.dailyQuizSource === "workspace_override"
                ? "Custom for this workspace. Quiz issuance uses this cap for the organisation's XP accounts."
                : isPlatformDefault
                  ? "Platform default. Catalog-owned quizzes and organisations without an override use this cap."
                  : "Platform default. Save to create a custom value for this workspace."}
            </p>
          </div>
          <div>
            <span className={labelClasses()}>Admin manual grant daily limit</span>
            <input
              className={fieldClasses()}
              defaultValue={currentManualGrantLimit}
              min={0}
              name="adminManualGrantDailyLimit"
              readOnly={!settings.canManage}
              required
              type="number"
            />
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              {settings.manualGrantSource === "workspace_override"
                ? "Custom for this workspace. This caps one administrator's grants across its learners in one Lagos day."
                : isPlatformDefault
                  ? "Platform default. This remains the fallback for workspaces without a custom limit."
                  : "Platform default. Save to create a custom value for this workspace."}
            </p>
          </div>
          <div className="rounded-[16px] bg-[var(--ve-panel)] px-4 py-3 text-xs font-semibold text-[var(--ve-muted-strong)]">
            <p>Current effective default: {currentLimit} XP</p>
            <p className="mt-1">Current admin manual grant cap: {currentManualGrantLimit} XP</p>
            <p className="mt-1">
              {settings.updatedAt
                ? `Last updated ${formatRewardDate(settings.updatedAt)}`
                : "No workspace override is saved. The platform default is active."}
            </p>
          </div>
          {settings.canManage ? (
            <button className="rounded-[14px] bg-[var(--ve-green)] px-5 py-3 text-sm font-black text-white" type="submit">
              Save settings
            </button>
          ) : null}
        </form>
      </AdminCard>
      {isPlatformDefault && platformAccount && settings.canManage ? (
        <div className="mt-6 grid max-w-5xl gap-6 xl:grid-cols-2">
          <AdminCard>
            <h2 className="text-lg font-black">Platform Points presentation</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">
              Labels and formatting used for the public Platform Catalog economy.
            </p>
            <form action={savePlatformXpPresentation} className="mt-5 space-y-4">
              <input name="xpAccountId" type="hidden" value={platformAccount.id} />
              <label className="block"><span className={labelClasses()}>Singular name</span><input className={fieldClasses()} name="displayName" required defaultValue={platformAccount.name} /></label>
              <label className="block"><span className={labelClasses()}>Plural name</span><input className={fieldClasses()} name="displayNamePlural" required defaultValue={platformAccount.plural_name} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className={labelClasses()}>Short label</span><input className={fieldClasses()} name="shortLabel" required defaultValue={platformAccount.short_label} /></label>
                <label><span className={labelClasses()}>Icon</span><input className={fieldClasses()} name="icon" defaultValue={platformAccount.icon ?? "coins"} /></label>
                <label><span className={labelClasses()}>Display format</span><select className={fieldClasses()} name="displayFormat" defaultValue={platformAccount.display_format}><option value="amount_short_label">Amount + short label</option><option value="amount_name">Amount + name</option></select></label>
                <label><span className={labelClasses()}>Status</span><select className={fieldClasses()} name="status" defaultValue={platformAccount.status}><option value="active">Active</option><option value="paused">Paused</option></select></label>
              </div>
              <button className="rounded-[14px] bg-[var(--ve-green)] px-5 py-3 text-sm font-black text-white" type="submit">Save presentation</button>
            </form>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-black">Issuance and exposure controls</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">
              Economic guardrails for the platform-owned Points account.
            </p>
            <form action={savePlatformXpControls} className="mt-5 space-y-4">
              <input name="xpAccountId" type="hidden" value={platformAccount.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className={labelClasses()}>Accounting currency</span><input className={fieldClasses()} maxLength={3} name="accountingCurrency" defaultValue={platformAccount.accounting_currency ?? ""} placeholder="Optional ISO code" /></label>
                <label><span className={labelClasses()}>Value per Point</span><input className={fieldClasses()} min={0} name="accountingValuePerUnit" step="0.0001" type="number" defaultValue={platformAccount.accounting_value_per_unit} /></label>
                <label><span className={labelClasses()}>Issuance period days</span><input className={fieldClasses()} min={1} max={366} name="issuancePeriodDays" type="number" defaultValue={platformAccount.issuance_period_days} /></label>
                <label><span className={labelClasses()}>Period cap</span><input className={fieldClasses()} min={0} name="issuanceCapPerPeriod" type="number" defaultValue={platformAccount.issuance_cap_per_period} /></label>
                <label><span className={labelClasses()}>Per-user cap</span><input className={fieldClasses()} min={0} name="issuanceCapPerUser" type="number" defaultValue={platformAccount.issuance_cap_per_user} /></label>
                <label><span className={labelClasses()}>Funded reward budget</span><input className={fieldClasses()} min={0} name="fundedRewardBudget" step="0.01" type="number" defaultValue={platformAccount.funded_reward_budget ?? ""} /></label>
                <label><span className={labelClasses()}>Exposure warning</span><input className={fieldClasses()} min={0} name="exposureWarningThreshold" step="0.01" type="number" defaultValue={platformAccount.exposure_warning_threshold ?? ""} /></label>
                <label><span className={labelClasses()}>Exposure hard stop</span><input className={fieldClasses()} min={0} name="exposureHardThreshold" step="0.01" type="number" defaultValue={platformAccount.exposure_hard_threshold ?? ""} /></label>
              </div>
              <button className="rounded-[14px] bg-[var(--ve-green)] px-5 py-3 text-sm font-black text-white" type="submit">Save controls</button>
            </form>
          </AdminCard>

          <AdminCard className="xl:col-span-2">
            <h2 className="text-lg font-black">Manual Platform Points adjustment</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--ve-muted)]">
              Enter the learner profile UUID. Every adjustment is audited and earn adjustments use the configured Lagos-day cap.
            </p>
            <form action={adjustPlatformXpAccount} className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_8rem_9rem_1fr_auto] lg:items-end">
              <input name="xpAccountId" type="hidden" value={platformAccount.id} />
              <label><span className={labelClasses()}>Learner UUID</span><input className={fieldClasses()} name="targetUserId" required /></label>
              <label><span className={labelClasses()}>Amount</span><input className={fieldClasses()} min={1} name="amount" required type="number" /></label>
              <label><span className={labelClasses()}>Direction</span><select className={fieldClasses()} name="direction"><option value="earn">Grant</option><option value="spend">Deduct</option></select></label>
              <label><span className={labelClasses()}>Reason</span><input className={fieldClasses()} name="reason" /></label>
              <button className="h-[46px] rounded-[14px] bg-[var(--ve-green)] px-5 text-sm font-black text-white" type="submit">Apply</button>
            </form>
          </AdminCard>
        </div>
      ) : null}
    </>
  );
}
