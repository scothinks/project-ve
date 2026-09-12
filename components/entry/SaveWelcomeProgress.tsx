"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { entryCopy as C } from "@/features/entry/copy";
import { BrandSignature } from "@/components/brand/BrandSignature";
import './auth.css';
export function SaveWelcomeProgress({next,hasProgress}:{next:string;hasProgress:boolean}) {
  const [error,setError]=useState('');const [saved,setSaved]=useState<number|null>(hasProgress?null:0);const [attempt,setAttempt]=useState(0);
  const claim = useRef<{attempt: number; promise: Promise<number>} | null>(null);
  useEffect(() => {
    if (!hasProgress) return;
    let active = true;
    setError('');
    if (!claim.current || claim.current.attempt !== attempt) {
      claim.current = {attempt, promise: fetch('/api/welcome/progress', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'claim'}),
      }).then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data.savedXp as number;
      })};
    }
    claim.current.promise.then(xp => {if (active) setSaved(xp);}).catch(error => {
      if (active) setError(error instanceof Error ? error.message : C['AUTH.connectionError']);
    });
    return () => {active = false;};
  }, [hasProgress, attempt]);

  return <main className="entry-auth"><header className="auth-header"><Link href="/"><BrandSignature/></Link></header><div className="auth-layout"><section className="auth-main"><div className="auth-form-wrap" data-mode="state"><div className="auth-form-panel"><h1>{saved===null?'Saving your progress…':saved?C['AUTH.successXpTitle']:C['AUTH.successTitle']}</h1>{error?<><p className="auth-message is-error" role="alert">{error}</p><button className="button button-plum" onClick={()=>setAttempt(v=>v+1)}>Try saving again</button><a className="auth-back" href={next}>Continue without saving now</a></>:saved!==null?<><p className="auth-description">{C[saved?'AUTH.successXpBody':'AUTH.successBody']}</p>{saved>0&&<div className="saved-balance"><span>{C['AUTH.savedXpLabel']}</span><strong>{saved} XP</strong></div>}<div className="state-actions"><a className="button button-plum" href={next}>{next==='/xp-store'?C['AUTH.successRewards']:next.startsWith('/org')?C['AUTH.orgSuccessAction']:'Continue'}</a>{next!=='/xp-store'&&<a className="button button-quiet" href="/xp-store">{C['AUTH.successRewards']}</a>}</div></>:<p role="status">Please wait while we save your lesson XP.</p>}</div></div></section></div></main>;
}
