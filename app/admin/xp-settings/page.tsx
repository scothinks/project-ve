import { AdminCard, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { getAdminXpSettings, requireAdmin } from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";
import {
  fallbackAdminManualGrantDailyLimit,
  fallbackDailyQuizXpLimit,
} from "@/lib/xp-settings";
import { saveXpSettings } from "@/app/admin/xp-settings/actions";

type AdminXpSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function fieldClasses() {
  return "mt-2 w-full rounded-[14px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-bold outline-none transition focus:border-[#087f5b] focus:ring-4 focus:ring-[#087f5b]/10";
}

function labelClasses() {
  return "text-[11px] font-black uppercase tracking-[0.14em] text-[var(--ve-muted)]";
}

export default async function AdminXpSettingsPage({
  searchParams,
}: AdminXpSettingsPageProps) {
  const [{ supabase }, resolvedParams] = await Promise.all([
    requireAdmin(),
    (searchParams ?? Promise.resolve({})) as Promise<Record<string, string | string[] | undefined>>,
  ]);
  const settings = await getAdminXpSettings(supabase);
  const currentLimit = settings?.default_daily_quiz_xp_limit ?? fallbackDailyQuizXpLimit;
  const currentManualGrantLimit =
    settings?.admin_manual_grant_daily_limit ?? fallbackAdminManualGrantDailyLimit;
  const saved =
    typeof resolvedParams.saved === "string"
      ? resolvedParams.saved === "1"
      : Array.isArray(resolvedParams.saved)
        ? resolvedParams.saved[0] === "1"
        : false;

  return (
    <>
      <AdminPageHeader
        backHref="/admin"
        backLabel="Admin overview"
        eyebrow="Quiz XP"
        title="XP settings"
        subtitle="Set the default learner quiz cap and the daily admin manual-grant safety limit. Per-user overrides can still be added separately later."
      />
      <AdminCard className="max-w-2xl">
        <form action={saveXpSettings} className="space-y-5">
          <div>
            <span className={labelClasses()}>Default daily quiz XP limit</span>
            <input
              className={fieldClasses()}
              defaultValue={currentLimit}
              min={0}
              name="defaultDailyQuizXpLimit"
              required
              type="number"
            />
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              This is the main daily cap used by quizzes. If no CMS setting is saved, the app falls back to {fallbackDailyQuizXpLimit} XP.
            </p>
          </div>
          <div>
            <span className={labelClasses()}>Admin manual grant daily limit</span>
            <input
              className={fieldClasses()}
              defaultValue={currentManualGrantLimit}
              min={0}
              name="adminManualGrantDailyLimit"
              required
              type="number"
            />
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted)]">
              This caps how much free XP one admin can grant across all users in one Lagos day. If no CMS setting is saved, the app falls back to {fallbackAdminManualGrantDailyLimit} XP.
            </p>
          </div>
          <div className="rounded-[16px] bg-[var(--ve-panel)] px-4 py-3 text-xs font-semibold text-[#5f5f5a]">
            <p>Current effective default: {currentLimit} XP</p>
            <p className="mt-1">Current admin manual grant cap: {currentManualGrantLimit} XP</p>
            <p className="mt-1">
              {settings?.updated_at
                ? `Last updated ${formatRewardDate(settings.updated_at)}`
                : "No saved CMS value yet. The fallback is active."}
            </p>
          </div>
          {saved ? (
            <div className="rounded-[16px] bg-[#e4f4ed] px-4 py-3 text-sm font-bold text-[#087f5b]">
              XP settings saved.
            </div>
          ) : null}
          <button className="rounded-[14px] bg-[#087f5b] px-5 py-3 text-sm font-black text-white" type="submit">
            Save settings
          </button>
        </form>
      </AdminCard>
    </>
  );
}
