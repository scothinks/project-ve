import { WelcomeCarousel } from "@/components/welcome/WelcomeCarousel";
import { getCurrentUserProfile } from "@/lib/supabase-server";

export default async function WelcomePage() {
  const { user } = await getCurrentUserProfile();
  const destinationHref = user ? "/dashboard" : "/login";

  return <WelcomeCarousel destinationHref={destinationHref} />;
}
