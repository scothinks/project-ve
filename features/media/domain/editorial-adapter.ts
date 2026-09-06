import type { AdminLearningMediaAssetRow } from "../../learning/admin/data";
import type { LibraryAsset } from "./media-reference";
/** Compatibility projection for existing editorial controls; file identity is
 * the immutable version ID and URL, not a newly owned generation row. */
export function libraryAssetToEditorialRow(asset: LibraryAsset): AdminLearningMediaAssetRow {
  return {
    id: asset.id, course_id: null, lesson_id: null, asset_type: asset.asset_type,
    placement: asset.title, source: "library", prompt: null, script: null,
    url: asset.url, storage_path: null, provider: null, model: null,
    alt_text: asset.alt_text, caption: null, metadata: {}, review_status: "approved",
    generation_status: "completed", generation_error: null, sort_order: 0,
    created_at: "", updated_at: "",
  };
}
