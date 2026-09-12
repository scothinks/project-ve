"use client";
import { progressSavedEvent, progressWakeEvent } from "@/features/entry/progress-sync";
import { useEffect, useRef, useState } from "react";
import { entryCopy as C } from "@/features/entry/copy";
import { sampleXp, welcomeTopics, type WelcomeTopic } from "@/features/entry/topics";
type Result = { correct: boolean; alreadyEarned: boolean; alreadySaved: boolean; xp: number; heading: string; body: string };
export function SampleLesson({ topic, visit, signedIn, onBusy }: { topic: WelcomeTopic; visit: number; signedIn: boolean; initialCompleted: WelcomeTopic[]; onBusy: (busy: boolean) => void }) {
  const lesson = welcomeTopics[topic];
  useEffect(() => {
    function saved(event: Event) {
      if ((event as CustomEvent<{completed?: string[]}>).detail.completed?.includes(topic)) {
        setResult(value => value?.correct ? {...value, alreadySaved: true} : value);
      }
    }
    window.addEventListener(progressSavedEvent, saved);
    return () => window.removeEventListener(progressSavedEvent, saved);
  }, [topic]);
  const [stage,setStage]=useState<'lesson'|'quiz'>('lesson');
  const [result,setResult]=useState<Result|null>(null);
  const [selected,setSelected]=useState<number|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  useEffect(() => { onBusy(busy); return () => onBusy(false); }, [busy, onBusy]);
  const article=useRef<HTMLElement>(null); const request=useRef<AbortController|null>(null);
  const [focusTarget, setFocusTarget] = useState<{id: string} | null>(null);
  function focus(id: string) { setFocusTarget({id}); }
  useEffect(() => {
    if (!focusTarget) return;
    // Wait for the result DOM to commit. A background acknowledgement does not
    // change this target, so it never moves focus away from the learner.
    const frame = requestAnimationFrame(() => {
      const target = article.current?.querySelector<HTMLElement>('#'+focusTarget.id);
      target?.focus({preventScroll:true});
      (focusTarget.id==='xp-heading'?target?.closest('section'):article.current)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget]);
  useEffect(()=>{ request.current?.abort();setBusy(false);setError('');setStage('lesson');setResult(null);setSelected(null);if(visit)focus('lesson-heading');return()=>request.current?.abort(); },[topic,visit]);
  async function send(action:'learn'|'answer', answer?:number) {
    request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    try {const response=await fetch('/api/welcome/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,topic,answer}),signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error);
      if(action==='learn'){setStage('quiz');setResult(null);focus('question-heading');}else{setSelected(answer??null);setResult(data);focus(data.correct?'xp-heading':'feedback');if(data.correct)window.dispatchEvent(new Event(progressWakeEvent));}
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Please try again.');}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <article className="lesson-sheet" ref={article} aria-labelledby={stage==='lesson'?'lesson-heading':'question-heading'} aria-busy={busy}><div className="sheet-top"><span>{C['WELCOME.030']}</span><span className="sheet-topic">{lesson.category}</span></div><ol className="learning-steps" aria-label={C['ACCESS.welcome.6']}><li aria-current={stage==='lesson'?'step':undefined}>Learn</li><li aria-current={stage==='quiz'&&!result?.correct?'step':undefined}>Try a question</li><li aria-current={result?.correct?'step':undefined}>Earn XP</li></ol>
    {stage==='lesson'?<section id="lesson-content"><h3 id="lesson-heading" tabIndex={-1}>{lesson.lessonTitle}</h3><p className="lesson-paragraph">{lesson.lessonBody}</p><p className="lesson-paragraph">{lesson.lessonExample}</p><div className="lesson-takeaway"><span>{C['LESSON.takeawayLabel']}</span><p>{lesson.takeaway}</p></div><button className="button button-plum" id="start-quiz" disabled={busy} onClick={()=>void send('learn')}>{busy?'Opening question…':C['WELCOME.025']} <span aria-hidden="true">→</span></button><p className="lesson-next">{C['LESSON.next']}</p></section>:<section id="quiz-content"><button className="back-to-lesson" disabled={busy} onClick={()=>{setStage('lesson');focus('lesson-heading');}}>← {C['WELCOME.026']}</button><div className="question-icon" aria-hidden="true">“</div><h3 id="question-heading" tabIndex={-1}>{lesson.question}</h3><p className="question-context">{lesson.context}</p><div className="answers" role="group" aria-label={C['ACCESS.welcome.7']}>{lesson.answers.map((answer,index)=><button className="answer" key={index} data-answer={index} aria-pressed={index===selected} disabled={busy} onClick={()=>void send('answer',index)}><span className="answer-letter" aria-hidden="true">{index?'B':'A'}</span><span className="answer-text">{answer}</span><span className="answer-state" aria-hidden="true">{result?.correct&&selected===index?'✓':'↗'}</span></button>)}</div><div className="feedback" id="feedback" tabIndex={-1} aria-live="polite">{result?<><strong>{result.heading}</strong><p>{result.body}</p></>:<p className="feedback-placeholder">{C['QUIZ.pause']}</p>}</div>
    {result?.correct&&<section className="xp-result" aria-labelledby="xp-heading">
      <h4 id="xp-heading" tabIndex={-1}>{C[result.alreadyEarned?'XP.repeatHeading':'XP.firstHeading']}</h4>
      <span id="xp-award" className="xp-earned-chip">{result.alreadyEarned?C['XP.alreadyEarned']:C['XP.award'].replace('{awardXp}',String(sampleXp))}</span>
      <p className="xp-explanation">{C['XP.explanation']}</p>
      <a className="button button-plum" id="save-xp" href={result.alreadySaved?'/xp-store':signedIn?'/dashboard':'/login?mode=signup'}>{result.alreadySaved?'Explore rewards':signedIn?'Continue learning':C['XP.saveAction']} <span aria-hidden="true">↗</span></a>
      <p className="xp-disclaimer">Save within 30 days in this browser. Each sample lesson earns XP once per account.</p>
    </section>}</section>}
    {error&&<p role="alert" className="entry-error">{error}</p>}
    <noscript><p>Sign in or create an account to continue learning. Interactive questions require JavaScript.</p><details><summary>{C['NOJS.answerSummary']}</summary><p>{C['NOJS.answer']}</p></details></noscript>
  </article>;
}
