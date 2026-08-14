// Public routes may render signed-out entry shells; protected learner routes
// must redirect through the safe auth-return flow before page code executes.
const learnerProtectedExactPaths = new Set([
  "/dashboard",
  "/courses",
  "/missions",
  "/notifications",
  "/onboarding/assessment",
  "/org/create",
  "/org/my",
  "/profile",
  "/profile/transcript",
  "/xp-store",
]);

const learnerProtectedPrefixes = [
  "/courses/",
  "/lessons/",
  "/missions/",
  "/notifications/",
  "/o/",
  "/onboarding/",
  "/org/create/",
  "/org/my/",
  "/profile/",
  "/quiz/",
  "/results/",
  "/xp-store/",
];

const publicExactPaths = new Set([
  "/",
  "/advertise",
  "/advertise/inquiry",
  "/auth/callback",
  "/faq",
  "/login",
  "/org",
  "/privacy",
  "/support",
  "/terms",
]);

const publicPrefixes = [
  "/api/",
  "/auth/",
  "/invite/",
];

export function isPublicRoutePath(pathname: string) {
  if (publicExactPaths.has(pathname)) {
    return true;
  }

  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function isProtectedLearnerRoutePath(pathname: string) {
  if (isPublicRoutePath(pathname)) {
    return false;
  }

  if (learnerProtectedExactPaths.has(pathname)) {
    return true;
  }

  return learnerProtectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}
