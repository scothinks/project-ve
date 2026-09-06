"use client";
import Link from 'next/link';
import { AdminConfirmDialog } from '@/components/admin/AdminDialog';
import { AiAssistancePreview } from './AiAssistancePreview';
import { aiButton, aiPrimary } from './AiPageResult';
import { assistanceDestination, type AssistanceResult } from '@/features/ai-generation/authoring/assistance-contracts';
export function AiAssistanceRecovery({ result, busy, onStop, onDelete }: { result: AssistanceResult; busy: boolean; onStop: () => void; onDelete: () => void }) {
  const active = result.stage === 'starting' || result.stage === 'writing';
  const saving = result.applicationState === 'checking';
  return <div className="space-y-5">
    <p role="status" className="text-sm">{result.receipt ? 'Added' : saving ? 'Checking save…' : result.stage === 'ready' ? 'Not added yet' : result.failure ?? (active ? 'Your request is running.' : 'Your result is saved.')}</p>
    <AiAssistancePreview result={result} selection={result.selection ?? []} setSelection={() => {}} disabled />
    {result.targetAvailable !== false ? <Link className={aiPrimary} href={assistanceDestination(result)}>Review {result.kind === 'quiz' ? 'in quiz' : 'in course'}</Link> : <p className="text-sm">The original destination is unavailable. Your result is retained.</p>}
    <div className="flex flex-wrap gap-3">
      {active && <button className={aiButton} type="button" disabled={busy || result.stopRequested} onClick={onStop}>{result.stopRequested ? 'Stopping…' : 'Stop generation'}</button>}
      {!active && <AdminConfirmDialog title="Delete this result?" description="Added content stays in place. Generation credits are not refunded." confirmLabel="Delete result" onConfirm={onDelete} trigger={<button className={aiButton} type="button" disabled={busy || saving}>Delete result</button>} />}
    </div>
  </div>;
}
