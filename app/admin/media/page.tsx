import { requireAdmin } from "@/lib/admin";
import { MediaManager } from "@/components/admin/MediaManager";
export default async function MediaPage() {
  const { workspace } = await requireAdmin();
  return <main className="space-y-6 p-6"><h1 className="text-2xl font-bold">Media library</h1><p>Manage owned media and review assets that need replacement. Existing placements stay pinned to their version.</p><MediaManager key={workspace.id} /></main>;
}
