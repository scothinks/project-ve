'use client';
import Link from 'next/link';
import Image from '@/components/media/MediaImage';
import type { ImageResult } from '@/features/ai-generation/authoring/image-contracts';
import { creditLabel, type AuthoringResult } from '@/features/ai-generation/authoring/contracts';
import { aiButton, aiPrimary } from './AiPageResult';
import { useAuthoringDelay } from './useAuthoringDelay';
export function AiImageResult({ result, busy, reconnecting, onUse, onRefine, onStop, onCheck }: {
  result: ImageResult; busy?: boolean; reconnecting?: boolean; onUse?: () => void; onRefine?: () => void; onStop: () => void; onCheck?: () => void;
}) {
  const generating = ['starting','writing'].includes(result.stage);
  const delayed = useAuthoringDelay(generating, result.updatedAt, 45000);
  return <div className="space-y-4">
    <p role="status">{result.receipt ? 'Saved' : result.applicationState === 'checking' ? 'Checking save…' : generating ? result.stopRequested ? 'Stopping after the current image request…' : result.stage === 'starting' ? 'Request accepted. Preparing your image…' : 'Creating your image…' : result.stage === 'ready' ? 'Not added yet' : result.stage === 'stopped' ? 'Stopped' : 'Needs attention'}</p>
    {(delayed || reconnecting) && <p role="status">{reconnecting ? 'Reconnecting to your saved progress…' : 'This is taking longer. You can leave and return through AI results.'}</p>}
    {result.failure && <p role="alert">{result.failure}</p>}
    {result.applicationError && <p role="alert">Not saved. {result.applicationError}</p>}
    <p className="text-sm">{creditLabel(result as unknown as AuthoringResult)}</p>
    {result.candidate && <>
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-neutral-100"><Image fill className="object-contain" src={result.candidate.url} alt={result.candidate.altText}/></div>
      <p className="text-sm"><strong>Alt text:</strong> {result.candidate.altText}</p>
      {result.candidate.caption && <p className="text-sm">{result.candidate.caption}</p>}
      <p className="text-sm">This image stays in Generated media until explicitly deleted. Closing or creating another version keeps it.</p>
    </>}
    <div className="flex flex-wrap gap-3">
      {onUse && result.candidate && !result.receipt && result.applicationState !== 'checking' && <button className={aiPrimary} type="button" disabled={busy} onClick={onUse}>Use image</button>}
      {onCheck && result.applicationState === 'checking' && <button className={aiButton} type="button" disabled={busy} onClick={onCheck}>Check save</button>}
      {onRefine && !generating && result.applicationState !== 'checking' && <button className={aiButton} type="button" disabled={busy} onClick={onRefine}>Create another version</button>}
      {generating && !result.stopRequested && <button className={aiButton} type="button" disabled={busy} onClick={onStop}>Stop generation</button>}
      {!onUse && result.targetAvailable && <Link className={aiButton} href={result.lessonId ? `/admin/courses/lessons/${result.lessonId}` : `/admin/courses/${result.courseId}`}>Open editor</Link>}
      <Link className={aiButton} href="/admin/media">Open media library</Link>
    </div>
  </div>;
}
