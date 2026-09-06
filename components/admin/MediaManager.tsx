"use client";
import { useEffect, useState } from "react";
import type { LibraryAsset } from "@/features/media/domain/media-reference";
import { AdminConfirmDialog, AdminDrawer } from "@/components/admin/AdminDialog";
import { useMediaPicker } from "@/components/admin/MediaPickerProvider";
import Image from "@/components/media/MediaImage";
const button = "rounded-lg border px-3 py-2 text-sm disabled:opacity-50";
export function MediaManager() {
  const { requestMedia } = useMediaPicker();
  const [canManage, setCanManage] = useState(false);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [source, setSource] = useState("organization");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<LibraryAsset | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("none");
  const [organizations, setOrganizations] = useState<string[]>([]);
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [organizationOptions, setOrganizationOptions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!selected || selected.organization_id !== null) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: organizationSearch, selected: organizations.join(",") });
      void fetch(`/api/admin/media/organizations?${params}`, { signal: abort.signal }).then(r => r.json()).then(b => { if (!abort.signal.aborted) setOrganizationOptions(b.organizations ?? []); }).catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [selected, organizationSearch, organizations]);
  const [rights, setRights] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [issues, setIssues] = useState<{ courseId: string; lessonId: string | null; title: string }[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      fetch(`/api/admin/media/library?manage=true&type=&source=${source}&offset=${offset}`, { signal: abort.signal, cache: "no-store" }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b; }),
      fetch("/api/admin/media/issues", { signal: abort.signal, cache: "no-store" }).then(r => r.json()),
    ]).then(([library, impacts]) => { if (!abort.signal.aborted) { setAssets(library.assets); setCanManage(library.canManage); setIssues(impacts.issues ?? []); } })
      .catch(e => { if (!abort.signal.aborted) setMessage(e.message); });
    return () => abort.abort();
  }, [offset, revision, source]);
  function choose(asset: LibraryAsset) { setSelected(asset); setTitle(asset.title); setAudience(asset.audience); setOrganizations(asset.permitted_organizations ?? []); setRights(false); setEvidence(""); }
  async function action(value: string) {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/media/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: selected.id, action: value, title, audience, organizations }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setMessage(body.notice ?? "Media updated."); setSelected(null); setRevision(n => n + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); }
    finally { setBusy(false); }
  }
  async function replace(file: File) {
    if (!selected) return;
    setBusy(true);
    const form = new FormData(); form.set("file", file); form.set("assetId", selected.asset_id); form.set("altText", selected.alt_text || title);
    form.set("title", title); form.set("rightsConfirmed", String(rights)); form.set("rightsEvidence", evidence);
    try {
      const r = await fetch("/api/admin/learning/media/upload", { method: "POST", body: form }); const b = await r.json(); if (!r.ok) throw new Error(b.error);
      setMessage("New version created. Existing placements still use their previous version."); setSelected(null); setRevision(n => n + 1);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <button className={button} type="button" onClick={async () => { await requestMedia({ title: "Add library media", placementLabel: "Library image", mediaKind: "image" }); setRevision(n => n + 1); }}>Add media</button>
    <div className="flex flex-wrap gap-2" aria-label="Media filter">{[["organization", "All workspace media"], ["generated", "Generated"], ["unused", "Unused"]].map(([value, label]) => <button key={value} className={`${button} aria-pressed:bg-green-100`} type="button" aria-pressed={source === value} onClick={() => { setSource(value); setOffset(0); }}>{label}</button>)}</div>
    {message && <p role="status" className="rounded border p-3">{message}</p>}
    {issues.length > 0 && <section aria-label="Media requiring replacement"><h2 className="font-bold">Requires review</h2>{issues.map((issue, n) => <p key={n}><a className="underline" href={issue.lessonId ? `/admin/courses/lessons/${issue.lessonId}` : `/admin/courses/${issue.courseId}`}>{issue.title}: replace unavailable media</a></p>)}</section>}
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">{assets.slice(0, 30).map(a => <button className="overflow-hidden rounded-xl border text-left" key={a.id} type="button" onClick={() => { if (canManage) choose(a); }}><div className="relative h-32 bg-neutral-100">{a.asset_type === "image" && !a.revoked_at ? <Image src={a.url} alt={a.alt_text} fill className="object-cover" /> : <span className="block p-4">{a.revoked_at ? "Media unavailable" : a.asset_type}</span>}</div><span className="block p-3">{a.title}<small className="block">{a.revoked_at ? "Revoked" : a.withdrawn ? "Withdrawn" : a.audience === "none" ? "Workspace only" : "Permitted platform media"} · {a.usage_count ?? 0} placements</small></span></button>)}</div>
    <div className="flex gap-3"><button className={button} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 30))}>Previous</button><button className={button} disabled={assets.length <= 30} onClick={() => setOffset(offset + 30)}>Next</button></div>
    <AdminDrawer open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }} title="Manage media version">
      {selected && <div className="space-y-5">
        <p>{selected.usage_count ?? 0} saved placements use this version. Changes to the original require a new version.</p>
        {selected.impact?.map((impact, index) => <p key={index} className="text-sm">{impact.organization}: {impact.placements} placements across {impact.courses} courses.</p>)}
        <label className="block">Library title<input className="mt-1 w-full rounded border p-2" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <button disabled={busy} className={button} onClick={() => void action("describe")}>Save title</button>
        {selected.organization_id === null && <fieldset className="space-y-3 rounded border p-3"><legend>Organisation reuse</legend>
          <label className="block">Permitted audience<select className="ml-2 rounded border p-2" value={audience} onChange={e => setAudience(e.target.value)}><option value="none">Not shared</option><option value="all">All organisations</option><option value="selected">Selected organisations</option></select></label>
          {audience === "selected" && <div className="space-y-2"><input aria-label="Search organisations" className="w-full rounded border p-2" value={organizationSearch} onChange={e => setOrganizationSearch(e.target.value)} placeholder="Search organisations" /><div className="max-h-48 overflow-auto">{organizationOptions.map(org => <label className="flex gap-2 py-1" key={org.id}><input type="checkbox" checked={organizations.includes(org.id)} onChange={e => setOrganizations(e.target.checked ? [...organizations, org.id] : organizations.filter(id => id !== org.id))} />{org.name}</label>)}</div></div>}
          {selected.rights_profile !== "project_reuse" && <p>This imported version has unverified rights. Upload a reviewed version before sharing.</p>}
          <button className={button} disabled={busy || selected.rights_profile !== "project_reuse" || Boolean(selected.revoked_at)} onClick={() => void action("share")}>Save permission</button>
        </fieldset>}
        <fieldset className="space-y-3 rounded border p-3"><legend>Create new image version</legend>
          <label className="flex gap-2"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} />Rights permit in-project reuse, cropping and derivation without mandatory attribution.</label>
          <label className="block">Rights evidence<textarea className="w-full rounded border p-2" value={evidence} onChange={e => setEvidence(e.target.value)} /></label>
          <input aria-label="Upload replacement version" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !rights || !evidence.trim()} onChange={e => { const f = e.target.files?.[0]; if (f) void replace(f); }} />
        </fieldset>
        <button className={button} disabled={busy || selected.withdrawn} onClick={() => void action("withdraw")}>Withdraw from new use</button>
        <AdminConfirmDialog trigger={<button className={button} disabled={busy}>Revoke this version</button>} title="Revoke media delivery?" description={`This blocks media in ${selected.usage_count ?? 0} saved placements, flags affected content and notifies its managers. The rest of each lesson remains readable.`} confirmLabel="Revoke media" onConfirm={() => void action("revoke")} />
        <AdminConfirmDialog trigger={<button className={button} disabled={busy}>Revoke all existing versions</button>} title="Revoke every existing version?" description="This blocks delivery for every existing version of this asset, flags all affected content and notifies its managers. Other lesson content remains readable." confirmLabel="Revoke all versions" onConfirm={() => void action("revoke_asset")} />
        <AdminConfirmDialog trigger={<button className={button} disabled={busy || (selected.usage_count ?? 0) > 0}>Delete unused version</button>} title="Delete unused media?" description="Permanently remove this version's file. Referenced versions cannot be deleted. Deleting an image does not refund generation credits." confirmLabel="Delete version" onConfirm={() => void action("delete")} />
      </div>}
    </AdminDrawer>
  </div>;
}
