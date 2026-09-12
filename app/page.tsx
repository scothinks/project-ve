import type { Metadata } from "next";
import { WelcomeExperience } from "@/components/entry/WelcomeExperience";
import { getCurrentUserProfile } from "@/lib/supabase-server";
import { readWelcomeReceipt } from "@/features/entry/progress-server";
import { entryCopy } from "@/features/entry/copy";
export const metadata: Metadata = { title: entryCopy['WELCOME.extra.title'], description: entryCopy['WELCOME.extra.description'] };
export default async function WelcomePage() {
  const [{user}, receipt] = await Promise.all([getCurrentUserProfile(),readWelcomeReceipt()]);
  return <WelcomeExperience signedIn={Boolean(user)} completed={receipt?.completed??[]}/>;
}
