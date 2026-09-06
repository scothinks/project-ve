import { requireAdmin } from "@/lib/admin";
import { AiPageAuthoring } from "@/components/admin/ai/AiPageAuthoring";
import Link from "next/link";

export default async function AiResultsPage() {
  await requireAdmin();
  return <div className="space-y-6"><Link href="/admin/courses">Back to courses</Link>
    <h1 className="text-3xl font-black">AI results</h1>
    <p>Return to suggestions, drafts and work in progress.</p><AiPageAuthoring initiallyOpen /></div>;
}
