import { isDemoMode } from "@/lib/app-mode";
import { LoginPageClient } from "./LoginPageClient";

export default function LoginPage() {
  return <LoginPageClient isDemoMode={isDemoMode} />;
}
