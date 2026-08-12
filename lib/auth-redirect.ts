export const defaultAuthNextPath = "/dashboard";

export function getSafeAuthNextPath(
  value: string | string[] | null | undefined,
  fallback = defaultAuthNextPath,
) {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

export function createLoginHref(nextPath: string) {
  const safeNextPath = getSafeAuthNextPath(nextPath);
  return `/login?next=${encodeURIComponent(safeNextPath)}`;
}

export function isOrganizationAuthNextPath(nextPath: string): boolean {
  const safeNextPath = getSafeAuthNextPath(nextPath);
  const nextUrl = new URL(safeNextPath, "https://project-ve.local");

  if (nextUrl.pathname === "/org" || nextUrl.pathname.startsWith("/org/")) {
    return true;
  }

  if (nextUrl.pathname === "/o" || nextUrl.pathname.startsWith("/o/")) {
    return true;
  }

  if (nextUrl.pathname === "/login") {
    const confirmedNext = nextUrl.searchParams.get("next");
    return confirmedNext ? isOrganizationAuthNextPath(confirmedNext) : false;
  }

  return false;
}

export function shouldRouteAuthNextToPublicAssessment(nextPath: string) {
  const safeNextPath = getSafeAuthNextPath(nextPath);
  const nextUrl = new URL(safeNextPath, "https://project-ve.local");

  return nextUrl.pathname !== "/onboarding/assessment" && !isOrganizationAuthNextPath(safeNextPath);
}
