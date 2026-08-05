import { isDemoMode } from "@/lib/app-mode";
import { getSafeAuthNextPath } from "@/lib/auth-redirect";
import { LoginPageClient } from "./LoginPageClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const nextPath = getSafeAuthNextPath((await searchParams)?.next);

  return <LoginPageClient isDemoMode={isDemoMode} nextPath={nextPath} />;
}
