'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaPickerRequestConfig, PickedMedia } from '../MediaPickerProvider';
import type { ImageResult, ImageSetup, ImageTarget } from '@/features/ai-generation/authoring/image-contracts';
import { IMAGE_STYLES, type ImageStyle } from '@/features/ai-generation/authoring/image-style';
import type { ApplicationReceipt, AuthoringResult } from '@/features/ai-generation/authoring/contracts';
import { authoringRequest, useAuthoringResult, AuthoringRequestError } from './useAuthoringResult';
import { ImageStyleSample } from './ImageStyleSample';
import { AiImageResult } from './AiImageResult';
import { aiButton, aiField, aiPrimary } from './AiPageResult';
import { pricedAction } from '@/features/ai-generation/authoring/pricing-labels';
export function AiImageAuthoring({ request, onPick }: { request: MediaPickerRequestConfig; onPick: (value: PickedMedia) => void }) {
  const target: ImageTarget | undefined = request.imageTarget ?? (request.uploadContext?.courseId && ['course_thumbnail','course_cover'].includes(request.uploadContext.placement)
    ? { target: request.uploadContext.placement as ImageTarget['target'], targetId: request.uploadContext.courseId } : request.uploadContext?.lessonId && request.uploadContext.placement === 'lesson_thumbnail' ? { target: 'lesson_thumbnail', targetId: request.uploadContext.lessonId } : undefined);
  const [resolvedTarget, setResolvedTarget] = useState<ImageTarget>();
  const [setup, setSetup] = useState<ImageSetup | null>(null);
  const [brief, setBrief] = useState(request.initialGenerationBrief ?? '');
  const [style, setStyle] = useState<ImageStyle | 'inherit'>('inherit');
  const [altText, setAlt] = useState(request.initialAltText ?? '');
  const [caption, setCaption] = useState(request.caption ?? '');
  const [result, setResult] = useState<ImageResult | null>(null);
  const [parent, setParent] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const styleEdited = useRef(false);
  const notified = useRef<string | null>(null);
  const receive = useCallback((value: AuthoringResult) => { setResult(value as unknown as ImageResult); }, []);
  const reconnecting = useAuthoringResult(result?.id, Boolean(result && result.stage !== 'quote'), receive);
  const run = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'This action could not be completed.'); } finally { setBusy(false); } };
  const targetKind = target?.target; const targetId = target?.targetId;
  useEffect(() => {
    if (!targetKind || !targetId) return;
    let active = true;
    void (async () => {
      await request.imageDraft?.beforeAction();
      const savedTarget = request.imageDraft?.resolveTarget?.({ target: targetKind, targetId }) ?? { target: targetKind, targetId };
      if (active) setResolvedTarget(savedTarget);
      return authoringRequest<ImageSetup>({ action: 'imageSetup', ...savedTarget });
    })().then(async s => {
      if (!active) return;
      setSetup(s); setBrief(current => current || s.brief); if (!styleEdited.current) setStyle(s.style);
      const latest = (s as ImageSetup & { latestResult?: ImageResult }).latestResult;
      if (latest) setResult(latest);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
    // The request captures the editor at open; avoid restarting setup on polling renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKind, targetId]);
  useEffect(() => {
    if (!result?.receipt || notified.current === result.id) return;
    // Recovery only reconciles this editor after it explicitly initiated application.
    if (notified.current === `pending:${result.id}`) {
      request.imageDraft?.onApplied(result.receipt);
      notified.current = result.id;
    }
  }, [result, request]);
  const flush = async () => request.imageDraft ? request.imageDraft.beforeAction() : setup?.revision ?? 0;
  const apply = () => run(async () => {
    if (!result) return;
    if (result.applicationState !== 'checking') await flush();
    notified.current = `pending:${result.id}`;
    setResult({ ...result, applicationState: 'checking' });
    try {
      const receipt = await authoringRequest<ApplicationReceipt>({ action: 'apply', id: result.id });
      request.imageDraft?.onApplied(receipt); notified.current = result.id;
      setResult({ ...result, receipt, applicationState: 'saved' });
      // Application has already saved; avoid sending the URL back through an older form snapshot.
      onPick({ url: result.candidate!.url, assetVersionId: result.candidate!.versionId, altText: result.candidate!.altText, caption: result.candidate!.caption, fit: 'cover', positionX: 50, positionY: 50, alreadyApplied: true });
    } catch (e) {
      if (e instanceof AuthoringRequestError && e.status < 500) setResult({ ...result, applicationState: 'not_saved' });
      throw e;
    }
  });
  const changeStyle = (s: ImageStyle | 'inherit') => { styleEdited.current = true; setStyle(s); request.onGenerationStyleChange?.(s); setResult(null); };
  if (!target) return <p>Save this image destination before generating. Library and upload remain available.</p>;
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl border p-3">{error}</p>}
    {result && result.stage !== 'quote' ? <AiImageResult result={result} busy={busy} reconnecting={reconnecting} onUse={apply} onCheck={apply}
      onStop={() => void run(async () => receive(await authoringRequest({ action: 'stop', id: result.id })))}
      onRefine={() => { setParent(result.id); setBrief(result.image.brief); setStyle(result.image.style); setAlt(result.image.altText); setCaption(result.image.caption); setResult(null); }}/>
    : <>
      {!setup && <p role="status">Preparing your saved image brief…</p>}
      <p className="text-sm">Adjust the brief and choose a style to continue.</p>
      <label className="block text-sm font-bold">Image brief<textarea className={aiField} maxLength={6000} rows={5} value={brief} onChange={e => { setBrief(e.target.value); request.onGenerationBriefChange?.(e.target.value); setResult(null); }}/></label>
      <fieldset disabled={busy || !setup} className="space-y-3"><legend className="font-bold">Image style</legend>
        <div className="grid grid-cols-2 gap-2">
          <button className={aiButton} type="button" aria-pressed={style === 'inherit'} onClick={() => changeStyle('inherit')}>Course default{setup?.courseStyle ? `: ${IMAGE_STYLES.find(s => s.id === setup.courseStyle?.preset)?.label}` : ' (choose a style first)'}</button>
          {IMAGE_STYLES.map(s => <button className={`${aiButton} text-left aria-pressed:ring-2`} type="button" aria-pressed={style !== 'inherit' && style.preset === s.id} key={s.id} onClick={() => changeStyle({ preset: s.id, palette: style === 'inherit' ? '' : style.palette, direction: style === 'inherit' ? '' : style.direction })}>
            <ImageStyleSample preset={s.id} />{s.label}
          </button>)}
        </div>
        {style !== 'inherit' && <>
          <label className="block text-sm">Palette (optional)<input className={aiField} maxLength={200} value={style.palette} onChange={e => changeStyle({ ...style, palette: e.target.value })}/></label>
          <label className="block text-sm">Look and feel{style.preset === 'custom' ? ' (required)' : ' (optional)'}<textarea className={aiField} maxLength={1000} rows={2} value={style.direction} onChange={e => changeStyle({ ...style, direction: e.target.value })}/></label>
          <button className={aiButton} type="button" disabled={busy || !setup} onClick={() => void run(async () => { await authoringRequest({ action: 'imageStyle', courseId: setup!.courseId, style }); setSetup({ ...setup!, courseStyle: style }); })}>Save as course default</button>
        </>}
      </fieldset>
      <p className="text-sm">Shape: {setup?.aspectRatio ?? 'from your saved block'}. Style choices are free; existing images stay unchanged.</p>
      <label className="block text-sm font-bold">Alt text<input className={aiField} maxLength={240} value={altText} onChange={e => { setAlt(e.target.value); setResult(null); }}/></label>
      <label className="block text-sm">Caption (optional)<input className={aiField} maxLength={500} value={caption} onChange={e => { setCaption(e.target.value); setResult(null); }}/></label>
      {result ? <div className="space-y-3 rounded-xl border p-4"><p className="text-sm">One image. Price valid for 10 minutes.</p>
        <button className={aiPrimary} type="button" disabled={busy || request.aiGenerationAvailable === false} onClick={() => void run(async () => { await flush(); receive(await authoringRequest({ action: 'start', id: result.id })); })}>{pricedAction('Generate', result)}</button>
      </div> : <button className={aiPrimary} type="button" disabled={busy || !setup || request.aiGenerationAvailable === false} onClick={() => void run(async () => { const revision = await flush(); const r = await authoringRequest<ImageResult>({ action: 'quote', kind: 'image', ...(resolvedTarget ?? target), revision, brief, style, altText, caption, parentId: parent }); setResult(r); })}>{busy ? 'Preparing…' : 'Continue'}</button>}
      {request.aiGenerationAvailable === false && <p>AI generation is unavailable for this workspace. Choose from the library or upload an image.</p>}
    </>}
  </div>;
}
