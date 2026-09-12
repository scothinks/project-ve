import { progressRevision } from "@/features/entry/progress-sync";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { getSafeAuthNextPath, createLoginHref } from "@/lib/auth-redirect";
import { readWelcomeReceipt } from "@/features/entry/progress-server";
import { SaveWelcomeProgress } from "@/components/entry/SaveWelcomeProgress";
export default async function SaveProgressPage({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const [{user},receipt,params]=await Promise.all([getCurrentUserProfile(),readWelcomeReceipt(),searchParams]);
  const next=getSafeAuthNextPath(`/welcome/save?next=${encodeURIComponent(params.next??'/dashboard')}`);
  if(!user)redirect(createLoginHref(next));
  // Read-only compatibility redirect; root background sync owns the separate POST.
  return <SaveWelcomeProgress next={next} revision={receipt?progressRevision(receipt):""}/>;
}
