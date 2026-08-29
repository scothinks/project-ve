/**
 * Pseudo-workspace id representing Project VE's own platform-owned catalog
 * (courses/missions/rewards/etc. with `organization_id IS NULL`). Distinct
 * from the "platform" oversight workspace, which sees every organisation's
 * content unfiltered — this one scopes to *only* catalog-owned content, so a
 * platform admin can author it with the same org-shaped CMS UI.
 *
 * Lives in a client-safe module (no `server-only`) because nav components
 * that filter on workspace role/id are client components — see
 * `feedback_client-server-only-imports` for why this split exists.
 */
export const PLATFORM_CATALOG_WORKSPACE_ID = "platform-catalog";

export type AdminWorkspaceLike = {
  type: "platform" | "organization";
  roles: string[];
};

/**
 * True if `workspace` should be granted access to something gated by
 * `roles` — either because it's the platform oversight workspace, because
 * the session belongs to a true platform admin (who can act as any
 * organisation, including the platform-catalog pseudo-workspace), or
 * because the workspace's own roles intersect the required list.
 */
export function workspaceHasAnyRole(workspace: AdminWorkspaceLike, roles: string[]) {
  return workspace.type === "platform"
    || workspace.roles.includes("platform_admin")
    || roles.some((role) => workspace.roles.includes(role));
}
