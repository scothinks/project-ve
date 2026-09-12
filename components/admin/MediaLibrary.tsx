"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { LibraryAsset } from "@/features/media/domain/media-reference";
import Image from "@/components/media/MediaImage";
export function MediaLibrary({ mediaType, onPick, courseId }: { courseId?: string | null; mediaType: string; onPick: (asset: LibraryAsset) => void }) {
  const [thisCourse, setThisCourse] = useState(false);
  const [source, setSource] = useState("organization");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null | undefined>(undefined);
  const [canManage, setCanManage] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError(""); setAssets([]);
    const params = new URLSearchParams({ source, search: query, type: mediaType, offset: String(offset) });
    if (thisCourse && courseId) params.set("courseId", courseId);
    void fetch(`/api/admin/media/library?${params}`, { signal: abort.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json(); if (!response.ok) throw new Error(body.error || "Library unavailable.");
        if (abort.signal.aborted) return;
        setAssets(body.assets.slice(0, 30)); setHasMore(body.assets.length > 30);
        setCanManage(body.canManage); setOrganizationId(body.organizationId);
      }).catch((reason) => { if (!abort.signal.aborted) setError(reason.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [source, query, mediaType, offset, thisCourse, courseId]);
  return <div className="space-y-4">
    {<div className="flex flex-wrap gap-2" aria-label="Media source">
      {[["organization", "Workspace media"], ...(organizationId !== null ? [["platform", "Platform media"]] : []), ["generated", "Generated"], ["unused", "Unused"]].map(([value, label]) => <button key={value} type="button" aria-pressed={source === value} className="rounded-lg border px-3 py-2 text-sm aria-pressed:bg-[var(--ui-success-bg)]" onClick={() => { setSource(value); setOffset(0); }}>{label}</button>)}
    </div>}
    <div className="flex gap-2">
      <input aria-label="Search media" className="min-w-0 flex-1 rounded-lg border p-2" placeholder="Search media" value={search} onChange={(event) => setSearch(event.target.value)} />
      <button className="rounded-lg border px-3" type="button" onClick={() => { setQuery(search); setOffset(0); }}>Search</button>
    </div>
    {courseId && <label className="flex gap-2 text-sm"><input type="checkbox" checked={thisCourse} onChange={e => { setThisCourse(e.target.checked); setOffset(0); }} />Used in this course</label>}
    {loading && <p role="status">Loading media…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && assets.length === 0 && <p className="rounded-lg border border-dashed p-5">No matching media is available.</p>}
    <div className="grid grid-cols-2 gap-3">
      {assets.map((asset) => <button key={asset.id} type="button" className="overflow-hidden rounded-xl border text-left" onClick={() => onPick(asset)}>
        <div className="relative h-24 bg-[var(--ui-surface-muted)]">{asset.asset_type === "image" ? <Image src={asset.url} alt={asset.alt_text} fill className="object-cover" /> : <span className="block p-4">{asset.asset_type === "audio" ? "Audio" : "Video"}</span>}</div>
        <span className="block p-3 text-sm font-semibold">{asset.title}<span className="block text-xs font-normal">{asset.organization_id ? "Organisation media" : "Platform media"}</span></span>
      </button>)}
    </div>
    <div className="flex items-center justify-between">
      <button type="button" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 30))} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
      <button type="button" disabled={!hasMore || loading} onClick={() => setOffset(offset + 30)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
    </div>
    {canManage && <Link className="text-sm underline" href="/admin/media">Manage media library</Link>}
  </div>;
}
