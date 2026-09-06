export const MEDIA_REFERENCE_PATTERN = /^\/api\/media\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
export function mediaVersionId(value: string): string | null {
  return MEDIA_REFERENCE_PATTERN.exec(value)?.[1] ?? null;
}
export function mediaUrl(versionId: string) {
  const value = `/api/media/${versionId}`;
  if (!mediaVersionId(value)) throw new Error("Invalid media version.");
  return value;
}
export type LibraryAsset = {
  id: string;
  asset_id: string;
  asset_type: "image" | "audio" | "video";
  title: string;
  alt_text: string;
  url: string;
  organization_id: string | null;
  audience: "none" | "all" | "selected";
  withdrawn: boolean;
  revoked_at: string | null;
  rights_profile: string;
  permitted_organizations?: string[];
  usage_count?: number;
  impact?: { organization: string; courses: number; placements: number }[];
};
