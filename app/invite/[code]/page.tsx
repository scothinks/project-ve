import { ReferralCodeCapture } from "@/components/referrals/ReferralCodeCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getSafeAuthNextPath } from "@/lib/auth-redirect";
import { isJsonObject } from "@/lib/request-validation";
import { normalizeReferralInviteKind, normalizeReferralInviteToken } from "@/lib/referral-invites";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type InvitePageProps = {
  params: Promise<{ code: string }>;
};

type InviteResolution = {
  destination: string;
  kind: "public" | "contextual" | "unknown";
  organizationName: string | null;
  presentationConfig: Record<string, unknown>;
  status: "available" | "invalid";
  token: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function buildLoginHref({
  destination,
  kind,
  token,
}: {
  destination: string;
  kind: InviteResolution["kind"];
  token: string;
}) {
  const params = new URLSearchParams();
  params.set("next", getSafeAuthNextPath(destination));

  if (kind === "public" || kind === "contextual") {
    params.set("ref", token);
  }

  if (kind === "contextual") {
    params.set("refKind", "contextual");
  }

  return `/login?${params.toString()}`;
}

async function resolveInvite(code: string): Promise<InviteResolution> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const token = normalizeReferralInviteToken(code, "public");

    return {
      destination: "/dashboard",
      kind: token ? "public" : "unknown",
      organizationName: null,
      presentationConfig: {},
      status: token ? "available" : "invalid",
      token,
    };
  }

  const { data, error } = await supabase.rpc("resolve_referral_invite", {
    p_token: code,
  });

  if (error || !isJsonObject(data)) {
    return {
      destination: "/dashboard",
      kind: "unknown",
      organizationName: null,
      presentationConfig: {},
      status: "invalid",
      token: "",
    };
  }

  const kind = normalizeReferralInviteKind(asString(data.kind));
  const status = asString(data.status) === "available" ? "available" : "invalid";
  const presentationConfig = isJsonObject(data.presentationConfig)
    ? data.presentationConfig
    : {};
  const token = normalizeReferralInviteToken(asString(data.token), kind);

  return {
    destination: getSafeAuthNextPath(asString(data.destination)),
    kind: status === "available" ? kind : "unknown",
    organizationName: asString(data.organizationName) || null,
    presentationConfig,
    status,
    token,
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const invite = await resolveInvite(code);
  const isContextual = invite.kind === "contextual" && invite.status === "available";
  const title =
    asString(invite.presentationConfig.title)
    || (isContextual
      ? `Join ${invite.organizationName ?? "this organisation"} on Project VE`
      : "Complete your first lesson to activate the invite.");
  const subtitle =
    asString(invite.presentationConfig.shortDescription)
    || asString(invite.presentationConfig.subtitle)
    || (isContextual
      ? "Create your account to enter the assigned programme workspace and keep your progress in the right organisation context."
      : "Create your account to save your XP, keep your progress and continue to starter lessons.");
  const cardTitle =
    asString(invite.presentationConfig.cardTitle)
    || (isContextual ? invite.organizationName ?? "Organisation programme" : "Project VE starter lessons");
  const cardBody =
    asString(invite.presentationConfig.fullInstructions)
    || (isContextual
      ? "Your invite will be applied after signup, then you will continue to the programme destination."
      : "Your referral code will be saved for this browser, then you can continue to starter lessons after authentication.");
  const ctaLabel = asString(invite.presentationConfig.ctaLabel) || "Create account";
  const loginHref = buildLoginHref({
    destination: invite.destination,
    kind: invite.kind,
    token: invite.token,
  });
  const primaryHref = invite.status === "available" ? loginHref : "/login";

  return (
    <main className="mobile-shell learner-compact-shell min-h-screen bg-[var(--ve-card)] px-8 py-12">
      {invite.status === "available" && invite.token ? (
        <ReferralCodeCapture code={invite.token} kind={invite.kind === "contextual" ? "contextual" : "public"} />
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-lg font-black">Project VE</p>
        <Button className="h-9 px-4 text-xs" href={loginHref} variant="soft">
          Sign up
        </Button>
      </div>

      <section className="pt-14">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ve-green)]">
          {isContextual ? "Organisation invite" : "You are invited"}
        </p>
        <h1 className="mt-3 text-[30px] font-black leading-9">
          {invite.status === "available" ? title : "This invite link is not available."}
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
          {invite.status === "available"
            ? subtitle
            : "Ask your inviter for a fresh link, or create an account to continue with Project VE."}
        </p>
      </section>

      <Card className="mt-8 p-5">
        <div className="rounded-[20px] bg-[var(--ve-green-soft)] px-4 py-5 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ve-green)]">
            {isContextual ? "Programme destination" : "First lesson"}
          </p>
          <h2 className="mt-2 text-xl font-black text-[var(--foreground)]">
            {cardTitle}
          </h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
            {cardBody}
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          <Button href={invite.status === "available" ? primaryHref : "/login"}>{ctaLabel}</Button>
          <Button href={loginHref} variant="outline">
            Create Account
          </Button>
        </div>
      </Card>

      <p className="mt-6 text-center text-[11px] font-semibold leading-5 text-[var(--ve-muted)]">
        {isContextual
          ? "Invite token saved for this browser. Programme attribution is applied only after you create an account."
          : "Referral code saved for this browser. Your inviter earns XP only after you create an account and complete the required lessons."}
      </p>
    </main>
  );
}
