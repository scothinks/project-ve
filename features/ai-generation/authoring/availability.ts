import "server-only";

// Disabling starts does not hide retained results or interrupt accepted work.
export function pageAuthoringEnabled() {
  return process.env.AI_AUTHORING_PAGE_PILOT_ENABLED === "true";
}
