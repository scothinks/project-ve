import { WelcomeProgressHint } from "@/components/entry/WelcomeProgressHint";
import { progressRevision } from "@/features/entry/progress-sync";
import type { Metadata } from "next";
import { isDemoMode } from "@/lib/app-mode";
import { getSafeAuthNextPath } from "@/lib/auth-redirect";
import { readWelcomeReceipt } from "@/features/entry/progress-server";
import { sampleXp } from "@/features/entry/topics";
import { LoginPageClient } from "./LoginPageClient";
export const metadata:Metadata={title:'Project VE · Your account'};
export default async function LoginPage({searchParams}:{searchParams?:Promise<{next?:string|string[];mode?:string;ref?:string}>}) {
  const [params,receipt]=await Promise.all([searchParams,readWelcomeReceipt()]);
  return <><WelcomeProgressHint revision={receipt ? progressRevision(receipt) : ""}/><LoginPageClient isDemoMode={isDemoMode} nextPath={getSafeAuthNextPath(params?.next)} initialMode={params?.mode==='signup'||Boolean(params?.ref)?'signup':'login'} xp={(receipt?.completed.length??0)*sampleXp}/></>;
}
