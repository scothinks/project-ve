"use client";
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { AdminConfirmDialog } from '@/components/admin/AdminDialog';
import { creditLabel, type AuthoringResult } from '@/features/ai-generation/authoring/contracts';
import type { CourseBrief, CourseOutline, CourseResult } from '@/features/ai-generation/authoring/course-contracts';
import { authoringRequest, AuthoringRequestError, useAuthoringResult } from './useAuthoringResult';
import { AiCourseOutlineEditor, courseField } from './AiCourseOutlineEditor';
import { AiCoursePreview } from './AiCoursePreview';
import { aiButton, aiPrimary } from './AiPageResult';
import { useAuthoringDelay } from './useAuthoringDelay';
export function AiCourseAuthoring({ enabled, initialId }: { enabled: boolean; initialId?: string }) {
  const [id,setId]=useState(initialId);const [result,setResult]=useState<CourseResult|null>(null);
  const [brief,setBrief]=useState<CourseBrief>({need:'',audience:'',tone:'Conversational',lessonCount:3});
  const [outline,setOutline]=useState<CourseOutline|null>(null);const [questions,setQuestions]=useState(0);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [refinement,setRefinement]=useState('');
  const [checking,setChecking]=useState(false);const loaded=useRef<string | undefined>(undefined);const editRevision=useRef(0);
  const progressRef=useRef<HTMLDivElement>(null);
  const receive=useCallback((raw: AuthoringResult)=>{
    const r=raw as unknown as CourseResult;
    setResult(r);setId(r.id);
    if(loaded.current!==r.id){loaded.current=r.id;editRevision.current=r.outlineRevision;setOutline(r.outline);setBrief(r.brief);setQuestions(r.questionsPerLesson);}
    else setOutline(current=>{if(current)return current;editRevision.current=r.outlineRevision;return r.outline;});
    if(r.receipt||r.applicationState==='not_saved')setChecking(false);
  },[]);
  const reconnecting=useAuthoringResult(id,!!id,receive);
  const accept=(r:CourseResult)=>{receive(r as unknown as AuthoringResult);window.history.replaceState(null,'',`?aiResult=${encodeURIComponent(r.id)}`);};
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'This action could not be completed.');
    // A conflict must offer recovery even when the progress stream is delayed.
    // receive preserves local edits and their base revision while refreshing saved state.
    if(e instanceof AuthoringRequestError&&e.status===409&&id)await read().catch(()=>{});
  }finally{setBusy(false);}};
  const read=async()=>{const response=await fetch(`/api/admin/ai/authoring?id=${id}`,{cache:'no-store'});if(!response.ok)throw new Error('We could not check this result. Your saved work is retained.');receive(await response.json());};
  const request=async(body:Record<string,unknown>)=>accept(await authoringRequest<CourseResult>(body));
  const refineOutline=async()=>{
    if(!result)return;
    if(result.kind==='course_outline'&&result.stage==='ready'&&outline){
      const saved=await authoringRequest<CourseResult>({action:'saveOutline',id:result.id,revision:editRevision.current,outline});
      editRevision.current=saved.outlineRevision;receive(saved as unknown as AuthoringResult);
    }
    await request({action:'quote',kind:'course_outline',parentId:result.id,refinement});
  };
  const refreshQuote=async()=>{
    if(!result)return;
    if(result.kind==='course_outline')await request({action:'quote',kind:result.kind,brief:result.brief,parentId:result.parentId??undefined,refinement:result.refinement});
    else if(result.parentId){
      const response=await fetch(`/api/admin/ai/authoring?id=${result.parentId}`,{cache:'no-store'});
      if(!response.ok)throw new Error('Reopen the earlier outline to check its cost.');
      const parent=await response.json() as CourseResult;
      await request({action:'quote',kind:result.kind,parentId:parent.id,revision:parent.outlineRevision,questionsPerLesson:result.questionsPerLesson,retry:parent.kind==='course_draft'});
    }
  };
  const quoteDraft=async()=>{
    if(!result||!outline)return;
    const saved=await authoringRequest<CourseResult>({action:'saveOutline',id:result.id,revision:editRevision.current,outline});
    editRevision.current=saved.outlineRevision;receive(saved as unknown as AuthoringResult);
    await request({action:'quote',kind:'course_draft',parentId:saved.id,revision:saved.outlineRevision,questionsPerLesson:questions});
  };
  const apply=async()=>{if(!result)return;setChecking(true);try{const receipt=await authoringRequest<CourseResult['receipt']>({action:'apply',id:result.id});setResult({...result,receipt,applicationState:'saved'});setChecking(false);}catch(e){if(e instanceof AuthoringRequestError&&e.status<500)setChecking(false);throw e;}};
  const active=result?.stage==='starting'||result?.stage==='writing';
  const terminal=result&&['ready','failed','stopped'].includes(result.stage);
  const delayed=useAuthoringDelay(active,result?.updatedAt,60_000);
  return <div data-outline-revision={result?.outlineRevision} className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:py-12">
    <nav className="flex flex-wrap gap-4 text-sm font-bold"><Link href="/admin/courses/choose">Courses</Link><Link href="/admin/courses/ai-results">AI results</Link>{result?.parentId&&<Link href={`?aiResult=${result.parentId}`} onClick={()=>{loaded.current=undefined;setId(result.parentId!);setResult(null);setOutline(null);}}>Earlier version / outline</Link>}</nav>
    <header><p className="text-sm font-bold text-[var(--admin-primary)]">Create with AI</p><h1 className="mt-2 text-3xl font-black">{result?.kind==='course_draft'?'Your course draft':result?'Your course outline':'What do you want to teach?'}</h1><p className="mt-3 text-sm leading-6">Plan one outline, shape its lessons, then review the cost to draft it. Your results stay in AI results when you leave.</p></header>
    {!enabled&&<p role="status">New generation is not enabled. Saved results are still available.</p>}
    {error&&<p role="alert" className="rounded-xl border border-[var(--admin-error)] p-4 text-sm">{error}</p>}
    {reconnecting&&<p role="status">Reconnecting to your saved progress…</p>}
    {!result&&!id&&<form className="space-y-5" onSubmit={e=>{e.preventDefault();void run(()=>request({action:'quote',kind:'course_outline',brief}));}}>
      <label className="block text-sm font-bold">The learning need<textarea required maxLength={2000} className={courseField} value={brief.need} onChange={e=>setBrief({...brief,need:e.target.value})}/></label>
      <label className="block text-sm font-bold">Who is it for?<input required maxLength={500} className={courseField} value={brief.audience} onChange={e=>setBrief({...brief,audience:e.target.value})}/></label>
      <label className="block text-sm font-bold">Tone<select className={courseField} value={brief.tone} onChange={e=>setBrief({...brief,tone:e.target.value})}>{['Conversational','Formal','Inspirational','Direct'].map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="block text-sm font-bold">Number of lessons<input className={courseField} type="number" min={1} max={6} value={brief.lessonCount} onChange={e=>setBrief({...brief,lessonCount:Number(e.target.value)})}/></label>
      <button className={aiPrimary} disabled={busy||!enabled}>Check outline cost</button>
    </form>}
    {!result&&id&&<p role="status">Loading your saved result…</p>}
    {result?.deleted?<p>This result was deleted. Any saved course remains in Courses.</p>:result&&<>
      {result.stage==='quote'?<section className="space-y-4 rounded-2xl bg-[var(--admin-surface-container-low)] p-5" aria-label="Generation cost">
        <h2 className="text-xl font-bold">{result.estimatedUnits} credits · {result.kind==='course_outline'?'One editable outline':`${result.totalCount-result.completedCount} lessons to draft`}</h2>
        <p className="text-sm">{result.kind==='course_outline'?`${result.brief.lessonCount} planned lessons`:`${result.questionsPerLesson} questions per lesson · ${result.completedCount} completed lessons retained`}. Text generation only; images are optional placeholders.</p>
        {!result.metered&&<p className="text-sm">Platform catalogue · No organisation credits used</p>}
        <p className="text-sm">{result.kind==='course_draft'?'Cost includes a 100-credit request base, 35 per unfinished lesson and 6 per selected question. Started calls count even if their outcome is uncertain; allocation for work that never starts is released.':'This is a separate 57-credit outline request. Draft generation has its own estimate.'}</p>
        {result.kind==='course_draft'&&<ol className="list-inside list-decimal text-sm">{result.outline?.lessons.map((l,i)=><li key={i}>{l.title}</li>)}</ol>}
        <button className={aiPrimary} disabled={busy||!enabled} onClick={()=>void run(()=>request({action:'start',id:result.id}))}>{busy?'Starting…':result.kind==='course_outline'?'Generate outline':'Generate course draft'}</button><button className={aiButton} disabled={busy||!enabled} onClick={()=>void run(refreshQuote)}>Refresh estimate</button>
        {result.kind==='course_outline'&&!result.parentId&&<button className={aiButton} disabled={busy} onClick={()=>{setResult(null);setId(undefined);loaded.current=undefined;window.history.replaceState(null,'',window.location.pathname);}}>Edit brief</button>}
      </section>:<p className="text-sm">{creditLabel(result as unknown as AuthoringResult)}</p>}
      {(active||result.stage==='stopped')&&<div ref={progressRef} tabIndex={-1} role="status" aria-live="polite" className="rounded-2xl bg-[var(--admin-surface-container-low)] p-5"><strong>{result.stage==='stopped'?'Generation stopped':result.stopRequested?'Stopping…':result.kind==='course_outline'?'Planning your course':`${result.completedCount} of ${result.totalCount} lessons ready`}</strong><p className="mt-2 text-sm">{result.stage==='stopped'?(result.completedCount>0?'Completed lessons remain available below.':'You can return to this request from AI results.'):delayed?'This is taking longer than expected. Your saved checkpoints remain available.':result.stage==='starting'?'Your request was accepted. Waiting for the writer to start.':'Each finished lesson appears after it has been checked and saved.'}</p></div>}
      {result.failure&&<p role="status" className="text-sm">{result.failure}</p>}
      {result.kind==='course_outline'&&result.stage==='ready'&&outline&&<>
        {result.outlineRevision!==editRevision.current&&<div className="space-y-3" role="status"><p>Another edit was saved. Your unsaved text stays here until you choose to reload.</p><AdminConfirmDialog title="Reload the saved outline?" description="This replaces the unsaved outline edits shown here with the latest saved version." confirmLabel="Reload outline" onConfirm={()=>{setOutline(result.outline);editRevision.current=result.outlineRevision;setError('');}} trigger={<button className={aiButton} disabled={busy}>Reload saved outline</button>}/></div>}
        <AiCourseOutlineEditor key={result.id+':'+editRevision.current} value={outline} onChange={setOutline} disabled={busy}/>
        <label className="block text-sm font-bold">Quiz scope<select className={courseField} value={questions} onChange={e=>setQuestions(Number(e.target.value))}><option value={0}>No quizzes</option>{[1,2,3].map(n=><option key={n} value={n}>{n} question{n>1?'s':''} per lesson</option>)}</select></label>
        <div className="flex flex-wrap gap-3"><button className={aiButton} disabled={busy} onClick={()=>void run(async()=>{const saved=await authoringRequest<CourseResult>({action:'saveOutline',id:result.id,revision:editRevision.current,outline});editRevision.current=saved.outlineRevision;receive(saved as unknown as AuthoringResult);})}>Save outline</button>
        <button className={aiPrimary} disabled={busy||!enabled} onClick={()=>void run(quoteDraft)}>Save outline and check draft cost</button></div>
      </>}
      {result.kind==='course_draft'&&<><p role="status" className="font-bold">{result.completedCount} of {result.totalCount} lessons ready</p><AiCoursePreview result={result}/></>}
      {(checking||result.applicationState==='checking')&&!result.receipt&&<div role="status" className="space-y-3"><p>Checking save… Reconcile this outcome before trying again.</p><button className={aiButton} disabled={busy} onClick={()=>void run(read)}>Check save</button><button className={aiButton} disabled={busy} onClick={()=>void run(apply)}>Recover this save</button></div>}
      {result.receipt?<Link className={aiPrimary} href={`/admin/courses/${result.receipt.courseId}`}>Open saved course</Link>:terminal&&result.kind==='course_draft'&&result.completedCount>0&&!checking&&result.applicationState!=='checking'&&<button className={aiPrimary} disabled={busy} onClick={()=>void run(apply)}>{result.completedCount===result.totalCount?'Save course draft':`Save only ${result.completedCount} completed lesson${result.completedCount>1?'s':''}`}</button>}
      {terminal&&!result.receipt&&result.kind==='course_draft'&&result.completedCount<result.totalCount&&<button className={aiButton} disabled={busy||!enabled||checking||result.applicationState==='checking'} onClick={()=>void run(()=>request({action:'quote',kind:'course_draft',parentId:result.id,revision:result.outlineRevision,retry:true}))}>Check cost to retry unfinished lessons</button>}
      {terminal&&<details className="space-y-3"><summary className="cursor-pointer font-bold">Refine the outline in a new version</summary><textarea aria-label="Refinement direction" className={courseField} maxLength={1000} value={refinement} onChange={e=>setRefinement(e.target.value)}/><p className="text-sm">Your earlier outline and completed drafts stay available.</p><button className={aiButton} disabled={busy||!enabled} onClick={()=>void run(refineOutline)}>Check refinement cost</button></details>}
      <div className="flex flex-wrap gap-3">{active&&<button className={aiButton} disabled={busy||result.stopRequested} onClick={()=>void run(async()=>{await request({action:'stop',id:result.id});progressRef.current?.focus();})}>Stop remaining work</button>}
      {!active&&<AdminConfirmDialog title="Delete this result?" description="Completed draft content in this result will be deleted. Saved courses stay in place. Generation credits are not refunded." confirmLabel="Delete result" onConfirm={()=>run(async()=>{await authoringRequest({action:'delete',id:result.id});await read();})} trigger={<button className={aiButton} disabled={busy||checking||result.applicationState==='checking'}>Delete result</button>}/>}</div>
    </>}
  </div>;
}
