"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminDrawer } from "@/components/admin/AdminDialog";
import Link from "next/link";
import { AiImageResult } from "./AiImageResult";
import type { ImageResult } from "@/features/ai-generation/authoring/image-contracts";
import { AiAssistanceRecovery } from "./AiAssistanceRecovery";
import type { AssistanceResult } from "@/features/ai-generation/authoring/assistance-contracts";
import { AiPageResult, aiButton, aiField, aiPrimary } from "./AiPageResult";
import { AuthoringRequestError, authoringRequest, useAuthoringResult } from "./useAuthoringResult";
import { resultLabel, type ApplicationReceipt, type AuthoringResult, type AuthoringResults } from "@/features/ai-generation/authoring/contracts";

type Props = {
  lessonId?: string; courseId?: string; enabled?: boolean; pageCount?: number; initialResultId?: string; initiallyOpen?: boolean;
  beforeAction?: () => Promise<number>;
  onApplied?: (result: AuthoringResult, receipt: ApplicationReceipt) => void;
};

export function AiPageAuthoring({ lessonId, courseId, enabled = false, initialResultId, initiallyOpen = false, beforeAction, onApplied }: Props) {
  const [open, setOpen] = useState(initiallyOpen || Boolean(initialResultId));
  const [mode, setMode] = useState<"setup" | "result" | "list">(initialResultId ? "result" : "list");
  const [result, setResult] = useState<AuthoringResult | null>(null);
  const [selectedId, setSelectedId] = useState(initialResultId);
  const [results, setResults] = useState<AuthoringResults>({ items: [], unusedCount: 0 });
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [offset, setOffset] = useState(0);
  const [focus, setFocus] = useState("");
  const [refinement, setRefinement] = useState("");
  const [parent, setParent] = useState<AuthoringResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef<AuthoringResult | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const receive = useCallback((r: AuthoringResult) => {
    setResult(r);
    setApplying(r.applicationState === "checking" || Boolean(applyingRef.current?.id === r.id && !r.receipt && r.applicationState !== "not_saved"));
    if (r.applicationState === "not_saved" && applyingRef.current?.id === r.id) applyingRef.current = null;
    if (r.receipt && applyingRef.current?.id === r.id) {
      applyingRef.current = null;
      setApplying(false);
      setError("");
      onApplied?.(r, r.receipt);
    }
  }, [onApplied]);
  const reconnecting = useAuthoringResult(selectedId, open && mode === "result", receive);

  const loadList = useCallback(async () => {
    setListState("loading");
    const params = new URLSearchParams({ offset: String(offset) });
    if (lessonId) params.set("lessonId", lessonId);
    if (courseId) params.set("courseId", courseId);
    try {
      const response = await fetch(`/api/admin/ai/authoring?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Your saved results could not be loaded. Try again.");
      setResults(await response.json());
      setListState("ready");
    } catch { setListState("error"); }
  }, [lessonId, courseId, offset]);
  useEffect(() => { void loadList(); }, [loadList, open]);

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Your work is still here."); }
    finally { setBusy(false); }
  };

  const quote = (previous = parent, direction = focus, changes = refinement) => run(async () => {
    const revision = await beforeAction!();
    const r = await authoringRequest<AuthoringResult>({ action: "quote", lessonId, revision, focus: direction,
      parentId: previous?.candidate ? previous.id : undefined, refinement: changes });
    setResult(r); setSelectedId(r.id);
  });

  const start = () => run(async () => {
    if (!result) return;
    const revision = await beforeAction!();
    if (revision !== result.sourceRevision) { setResult(null); throw new Error("Your lesson changed. Check the cost again using your latest changes."); }
    // Keep this quote identity if the acknowledgement is lost: retrying it
    // cannot create another operation or reservation.
    const r = await authoringRequest<AuthoringResult>({ action: "start", id: result.id });
    receive(r); setMode("result");
  });

  const apply = () => run(async () => {
    if (!result) return;
    const revision = await beforeAction!();
    if (revision !== result.sourceRevision) throw new Error("Your lesson changed since this page was generated. Create another version using the latest lesson before adding it.");
    applyingRef.current = result; setApplying(true);
    try {
      const receipt = await authoringRequest<ApplicationReceipt>({ action: "apply", id: result.id });
      receive({ ...result, receipt, applicationState: "saved" });
    } catch (e) {
      if (e instanceof AuthoringRequestError && e.status < 500) { applyingRef.current = null; setApplying(false); }
      throw e instanceof AuthoringRequestError && e.status < 500 ? new Error(`Not saved. ${e.message}`)
        : new Error("We’re checking whether your page saved. You can close this panel and return to this result.");
    }
  });

  const check = () => run(async () => {
    if (!result) return;
    // Same identity: replay safely resolves a lost acknowledgement or request.
    try {
      const receipt = await authoringRequest<ApplicationReceipt>({ action: "apply", id: result.id });
      receive({ ...result, receipt, applicationState: "saved" });
    } catch (e) {
      if (e instanceof AuthoringRequestError && e.status < 500) { applyingRef.current = null; setApplying(false); }
      throw e;
    }
  });

  function setup(previous?: AuthoringResult) {
    if (!open && document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;
    setParent(previous ?? null); setSelectedId(undefined); setResult(null); setRefinement("");
    setFocus(previous?.focus ?? "");
    setMode("setup"); setError(""); setOpen(true);
    void quote(previous ?? null, previous?.focus ?? "", "");
  }

  return <>
    <div className="flex flex-wrap gap-2 py-2">
      {enabled && lessonId && <button className={aiButton} type="button" disabled={busy} onClick={() => setup()}>Suggest next page</button>}
      <button className={aiButton} type="button" onClick={(event) => { openerRef.current = event.currentTarget; setMode("list"); setOpen(true); setError(""); }}>AI results{results.unusedCount ? ` (${results.unusedCount})` : ""}</button>
    </div>
    <AdminDrawer open={open} onOpenChange={setOpen} title={mode === "setup" ? parent ? "Create another version" : "Suggest next page" : mode === "list" ? "AI results" : result?.assistant ? "Your suggestion" : "Your page"}
      onCloseAutoFocus={(event) => { if (openerRef.current?.isConnected) { event.preventDefault(); openerRef.current.focus(); } }}
      description={mode === "setup" ? parent ? "I’ll refine your draft." : "I’ll suggest what your lesson needs next." : "Saved in AI results."} widthClassName="w-full max-w-[720px]">
      <div className="space-y-6">
        {error && <p role="alert" className="rounded-xl border border-[var(--admin-error)] p-4 text-sm">{error}</p>}
        {mode === "result" && <button className="text-sm font-bold underline" onClick={() => { setMode("list"); void run(loadList); }} type="button">All results</button>}
        {mode === "setup" && <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void quote(); }}>
          {!parent && <details className="rounded-xl border border-[var(--admin-border-warm)] p-4">
            <summary className="cursor-pointer text-sm font-bold">Add direction (optional)</summary>
            <label className="mt-4 block text-sm font-bold">Anything to keep in mind?<textarea className={aiField} disabled={busy} maxLength={1000} rows={3} placeholder="For example, use an everyday situation." value={focus} onChange={(e) => { setFocus(e.target.value); setResult(null); }} /></label>
          </details>}
          {parent?.candidate && <label className="block text-sm font-bold">What would you like to change?<textarea className={aiField} disabled={busy} maxLength={1000} rows={3} value={refinement} onChange={(e) => { setRefinement(e.target.value); setResult(null); }} /></label>}
          {result ? <div className="space-y-4 rounded-2xl bg-[var(--admin-surface-container-low)] p-5">
            <div className="space-y-1">
              <p className="font-extrabold">{result.metered ? `${result.estimatedUnits} credits` : "No organisation credits used"}</p>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">{result.metered ? "Covers the review, even if no page is needed." : "Provider charges apply."}</p>
            </div>
            <details className="text-sm text-[var(--admin-on-surface-variant)]">
              <summary className="cursor-pointer font-semibold">Cost details</summary>
              <div className="mt-3 space-y-2 leading-6">
                <p>Includes the recommendation and any page draft. Images are added separately.</p>
                <p>Estimate valid for 10 minutes.{result.metered && " Credits are reserved when you start."}</p>
              </div>
            </details>
            <button className={aiPrimary} disabled={busy} type="button" onClick={() => { void start(); }}>{busy ? "Starting…" : parent ? "Create another version" : "Suggest next page"}</button>
          </div> : <button className={aiPrimary} disabled={busy} type="submit">{busy ? "Saving and checking cost…" : "Check cost"}</button>}
        </form>}
        {mode === "list" && <>
          <p className="text-sm leading-6">Return to a suggestion or draft, or continue work you left running.</p>
          {listState === "error" && <p role="alert" className="rounded-xl border border-[var(--admin-error)] p-4 text-sm">Your saved results could not be loaded. Try refreshing the list.</p>}
          {listState === "loading" && <p role="status" className="text-sm">Loading your saved results…</p>}
          {listState === "ready" && !results.items.length && <p className="rounded-2xl bg-[var(--admin-surface-container-low)] p-6 text-sm">No results yet. Suggestions and drafts will appear here.</p>}
          <ul className="space-y-3">{results.items.map((r) => <li key={r.id}><button data-result-id={r.id} className="w-full rounded-2xl border border-[var(--admin-border-warm)] p-4 text-left hover:border-[var(--admin-primary)]" onClick={() => { setResult(r); setSelectedId(r.id); setMode("result"); }} type="button">
            <p className="font-bold">{r.title}</p><p className="mt-2 text-sm">{r.kind === "image" ? "Image" : r.kind === "course_outline" ? "Course outline" : r.kind === "course_draft" ? "Course draft" : r.kind === "quiz" ? "Quiz" : r.kind === "lesson_plan" ? "Lesson suggestion" : r.kind === "lesson_draft" ? "Lesson draft" : "Page"} · {resultLabel(r)} · {new Date(r.createdAt).toLocaleDateString()}</p>
          </button></li>)}</ul>
          <div className="flex gap-3"><button className={aiButton} disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))} type="button">Previous</button><button className={aiButton} disabled={results.items.length < 20} onClick={() => setOffset(offset + 20)} type="button">Next</button><button className={aiButton} onClick={() => { void run(loadList); }} type="button">Refresh results</button></div>
        </>}
        {mode === "result" && (result ? result.kind === "image" ? <AiImageResult result={result as unknown as ImageResult} busy={busy} reconnecting={reconnecting} onStop={() => { void run(async () => receive(await authoringRequest({ action: "stop", id: result.id }))); }} /> : result.kind === "course_outline" || result.kind === "course_draft" ? <div className="space-y-4"><h3 className="font-bold">{result.title}</h3><p>{resultLabel(result)}</p><Link className={aiPrimary} href={`/admin/courses/ai/brief?aiResult=${result.id}`}>Open course result</Link></div> : result.kind && result.kind !== "page" ? <AiAssistanceRecovery result={result as unknown as AssistanceResult} busy={busy}
          onStop={() => { void run(async () => receive(await authoringRequest({ action: "stop", id: result.id }))); }}
          onDelete={() => { void run(async () => { await authoringRequest({ action: "delete", id: result.id }); setMode("list"); await loadList(); }); }} /> : <AiPageResult result={result} busy={busy} reconnecting={reconnecting} applying={applying} enabled={enabled} currentLessonId={lessonId}
          onApply={() => { void apply(); }} onCheck={() => { void check(); }} onRefine={() => setup(result)}
          onStop={() => { void run(async () => receive(await authoringRequest({ action: "stop", id: result.id }))); }}
          onDelete={() => { void run(async () => { await authoringRequest({ action: "delete", id: result.id }); setMode("list"); await loadList(); }); }} /> : <p role="status">Loading your saved result…</p>)}
      </div>
    </AdminDrawer>
  </>;
}
