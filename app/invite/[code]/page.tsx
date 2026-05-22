import { ReferralCodeCapture } from "@/components/referrals/ReferralCodeCapture";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getLearningCatalog } from "@/lib/supabase-learning";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type InvitePageProps = {
  params: Promise<{ code: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const catalog = await getLearningCatalog(supabase);
  const starterLesson = catalog[0]?.lessons[0];

  return (
    <main className="mobile-shell min-h-screen bg-[var(--ve-card)] px-8 py-12">
      <ReferralCodeCapture code={code} />

      <div className="flex items-center justify-between">
        <p className="text-lg font-black">Project VE</p>
        <Button className="h-9 px-4 text-xs" href={`/login?ref=${code}`} variant="soft">
          Sign up
        </Button>
      </div>

      <section className="pt-14">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008751]">
          You are invited
        </p>
        <h1 className="mt-3 text-[30px] font-black leading-9">
          Learn a practical skill before you sign up.
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-[var(--ve-muted)]">
          Start with a short lesson, take the quiz, then create an account to save
          your XP and keep your progress.
        </p>
      </section>

      <Card className="mt-8 p-5">
        <div className="rounded-[20px] bg-[#dff2e9] px-4 py-5 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#008751]">
            First lesson
          </p>
          <h2 className="mt-2 text-xl font-black">{starterLesson?.title ?? "Start learning"}</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--ve-muted-strong)]">
            Read the lesson first. XP is saved when you create an account.
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          <Button href={starterLesson ? `/lessons/${starterLesson.id}` : "/courses"}>Start Lesson</Button>
          <Button href={`/login?ref=${code}`} variant="outline">
            Create Account
          </Button>
        </div>
      </Card>

      <p className="mt-6 text-center text-[11px] font-semibold leading-5 text-[var(--ve-muted)]">
        Referral code saved for this browser. Your inviter earns XP only after
        you create an account and complete the required lessons.
      </p>
    </main>
  );
}
