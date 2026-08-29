import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { logAppError, toDependencyUnavailableError } from "@/lib/app-errors";
import { measureAsync } from "@/lib/performance";
import {
  VERIFIED_AUTH_REQUEST_HEADER,
  VERIFIED_AUTH_USER_EMAIL_HEADER,
  VERIFIED_AUTH_USER_ID_HEADER,
} from "@/lib/route-auth-policy";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes sessions.
        }
      },
    },
  });
}

export type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  referral_code: string | null;
  xp_balance_cached: number;
  role: "learner" | "admin";
};

export type CurrentUser = Pick<User, "email" | "id">;

function isAuthSessionMissingError(error: unknown) {
  return error instanceof Error && error.name === "AuthSessionMissingError";
}

type MiddlewareAuthState =
  | { checked: false; user: null }
  | { checked: true; user: CurrentUser | null };

async function getMiddlewareAuthState(): Promise<MiddlewareAuthState> {
  const requestHeaders = await headers();
  const authState = requestHeaders.get(VERIFIED_AUTH_REQUEST_HEADER);

  if (authState === "0") {
    return { checked: true, user: null };
  }

  if (authState !== "1") {
    return { checked: false, user: null };
  }

  const id = requestHeaders.get(VERIFIED_AUTH_USER_ID_HEADER);
  if (!id) {
    return { checked: false, user: null };
  }

  return {
    checked: true,
    user: {
      email: requestHeaders.get(VERIFIED_AUTH_USER_EMAIL_HEADER) ?? undefined,
      id,
    },
  };
}

export async function hasSupabaseAuthCookies() {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

async function loadCurrentUserProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  if (!supabase) {
    return { user: null, profile: null };
  }

  const middlewareAuth = await getMiddlewareAuthState();
  let user: CurrentUser | null = middlewareAuth.user;
  let userError: unknown = null;

  if (!middlewareAuth.checked) {
    const { data, error } = await measureAsync("auth.current_user", () =>
      supabase.auth.getUser(),
    );
    user = data.user;
    userError = error;
  }

  if (userError && !isAuthSessionMissingError(userError)) {
    const appError = toDependencyUnavailableError(userError, "Authentication state is temporarily unavailable.");
    logAppError(appError, {
      operation: "auth.current_user.load",
    });
    throw appError;
  }

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile, error: profileError } = await measureAsync("auth.current_profile", () =>
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, referral_code, xp_balance_cached, role")
      .eq("id", user.id)
      .maybeSingle(),
  );

  if (profileError) {
    const appError = toDependencyUnavailableError(profileError, "Profile is temporarily unavailable.");
    logAppError(appError, {
      operation: "profile.current_user.load",
      userId: user.id,
    });
    throw appError;
  }

  return { user, profile: profile as UserProfile | null };
}

const getCachedCurrentUserContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await loadCurrentUserProfile(supabase);

  return { profile, supabase, user };
});

export async function getCurrentUserContext() {
  return getCachedCurrentUserContext();
}

export async function getCurrentUserProfile(
  existingSupabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  if (existingSupabase !== undefined) {
    return loadCurrentUserProfile(existingSupabase);
  }

  const { user, profile } = await getCachedCurrentUserContext();
  return { user, profile };
}
