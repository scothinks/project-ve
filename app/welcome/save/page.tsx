import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { getSafeAuthNextPath, createLoginHref } from "@/lib/auth-redirect";
import { readWelcomeReceipt } from "@/features/entry/progress-server";
import { SaveWelcomeProgress } from "@/components/entry/SaveWelcomeProgress";
export default async function SaveProgressPage({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const [{user},receipt,params]=await Promise.all([getCurrentUserProfile(),readWelcomeReceipt(),searchParams]);
  const path=getSafeAuthNextPath(params.next,'/xp-store');const next=path.startsWith('/welcome/save')?'/xp-store':path;
  if(!user)redirect(createLoginHref(`/welcome/save?next=${encodeURIComponent(next)}`));
  // Render is read-only; the explicit account handoff performs a separate POST.
  return <SaveWelcomeProgress next={next} hasProgress={Boolean(receipt?.completed.length)}/>;
}
