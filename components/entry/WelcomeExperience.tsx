"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BrandSignature } from "@/components/brand/BrandSignature";
import { entryCopy as C } from "@/features/entry/copy";
import { welcomeTopics, type WelcomeTopic } from "@/features/entry/topics";
import { SampleLesson } from "./SampleLesson";
import { WelcomeSharedScene } from "./WelcomeSharedScene";
import "./welcome.css";
const Arrow = () => <span aria-hidden="true">↗</span>;
export function WelcomeExperience({ signedIn, completed }: { signedIn: boolean; completed: WelcomeTopic[] }) {
  const [topic, setTopic] = useState<WelcomeTopic>("listen");
  const [lessonBusy, setLessonBusy] = useState(false);
  const [lessonVisit, setLessonVisit] = useState(0);
  const scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scene.current;
    if (!node) return;
    const query = matchMedia('(min-width:761px) and (prefers-reduced-motion:no-preference) and (pointer:fine)');
    const planes = ['.scene-backplane','.photo-plane','.hero-photo','.practice-note','.topic-console'].map(selector => node.querySelector<HTMLElement>(selector));
    let frame = 0;
    const reset = () => planes.forEach(plane => { if (plane) plane.style.transform = ''; });
    const move = (event: PointerEvent) => {
      if (!query.matches) return;
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const transforms = [`translate(${-9*x}px,${-7*y}px) rotate(7deg)`,`translate(${8*x}px,${6*y}px) rotate(-3deg) rotateY(${3*x}deg)`,`scale(1.055) translate(${-5*x}px,${-4*y}px)`,`translate(${17*x}px,${10*y}px) rotate(5deg)`,`translate(${3*x}px,${2*y}px)`];
        planes.forEach((plane, i) => { if (plane) plane.style.transform = transforms[i]; });
      });
    };
    node.addEventListener('pointermove', move); node.addEventListener('pointerleave', reset); query.addEventListener('change', reset);
    return () => {cancelAnimationFrame(frame); reset(); node.removeEventListener('pointermove', move); node.removeEventListener('pointerleave', reset); query.removeEventListener('change', reset);};
  }, []);
  const signup = signedIn ? "/dashboard" : "/login?mode=signup";
  const org = signedIn ? "/org/create" : "/login?mode=signup&next=%2Forg%2Fcreate";
  function choose(key = topic) { if (lessonBusy) return; setTopic(key); setLessonVisit(v => v + 1); }
  return <div className="entry-welcome">
    <a className="skip-link" href="#try">{C['WELCOME.extra.skip']}</a>
    <header className="site-header"><a className="brand" href="#home" aria-label="Project VE home"><BrandSignature markSize={32} /></a><nav aria-label="Main navigation"><a href="#try" onClick={e => { e.preventDefault(); choose(); }}>{C['WELCOME.002']}</a><a href="#together">{C['WELCOME.003']}</a></nav><a className="sign-in" href={signedIn ? '/dashboard' : '/login'}>{signedIn ? 'Continue learning' : C['WELCOME.004']} <Arrow /></a></header>
    <main>
      <section className="hero" id="home"><div className="hero-light" aria-hidden="true"/><div className="hero-copy"><p className="eyebrow">{C['WELCOME.005']}</p><h1>Live what<br/><span className="headline-last">you learn.</span></h1><p className="hero-description">{C['WELCOME.007']}</p><div className="entry-actions"><a className="button button-light" href="#try" onClick={e=>{e.preventDefault();choose();}}>{C['WELCOME.008']} <Arrow/></a><a className="button button-light" href={org}>{C['WELCOME.009']} <Arrow/></a></div><p className="hero-footnote">{C['WELCOME.015']}</p></div>
      <div ref={scene} className="learning-scene" aria-label={C['ACCESS.welcome.3']}><div className="scene-backplane" aria-hidden="true"/><div className="photo-plane"><Image className="hero-photo" src="/entry/learning-scene.webp" width="1536" height="1024" priority unoptimized alt={C['ACCESS.welcome.4']}/></div><div className="practice-note" aria-hidden="true"><span className="note-icon">↗</span><div>New perspectives.<br/><strong>Everyday possibilities.</strong></div></div>
      <div className="topic-console"><div className="console-top"><span>{C['WELCOME.010']}</span><span aria-hidden="true">✳</span></div><div className="topics" role="group" aria-label={C['ACCESS.welcome.5']}>{(Object.keys(welcomeTopics) as WelcomeTopic[]).map(key=><button className="topic" key={key} data-topic={key} disabled={lessonBusy} aria-pressed={key===topic} onClick={()=>choose(key)}><span className="topic-dot" aria-hidden="true"/><span>{welcomeTopics[key].title}</span><span className="topic-arrow" aria-hidden="true">↗</span></button>)}</div><a className="console-cta" href="#try" onClick={e=>{e.preventDefault();choose();}}>{C['WELCOME.014']} <Arrow/></a></div></div>
      <div className="hero-baseline"><span>{C['WELCOME.016']}</span><span className="baseline-line"/><span>{C['WELCOME.017']}</span><span className="baseline-line"/><span>{C['WELCOME.018']}</span></div></section>
      <section className="try-section section-wrap" id="try"><div className="try-intro"><h2>One useful idea<br/><span className="muted-heading">can change your next move.</span></h2><p>{C['WELCOME.020']}</p><p className="small-caption">{C['WELCOME.021']}</p></div><div><SampleLesson topic={topic} visit={lessonVisit} signedIn={signedIn} initialCompleted={completed} onBusy={setLessonBusy}/></div></section>
      <section className="together-section" id="together"><div className="together-stage"><div className="together-layout section-wrap"><div className="together-copy"><p className="eyebrow">{C['WELCOME.032']}</p><h2>Your people.<br/><span>Your purpose.</span></h2><p>{C['WELCOME.034']}</p><a className="text-link" href={org}>{C['WELCOME.009']} <Arrow/></a><p className="small-caption">{C['WELCOME.035']}</p></div><WelcomeSharedScene topic={topic}/></div></div></section>
      <section className="closing section-wrap" id="begin"><h2>Choose your<br/><span className="closing-reveal">next step.</span></h2><div className="closing-paths"><a className="closing-path" href={signup}><span className="path-audience">FOR YOU</span><h3>Keep learning <Arrow/></h3><p>{C['WELCOME.046'].replace('FOR YOU Keep learning ','')}</p></a><a className="closing-path" href={org}><span className="path-audience">FOR YOUR PEOPLE</span><h3>{C['WELCOME.009']} <Arrow/></h3><p>{C['WELCOME.047'].replace('FOR YOUR PEOPLE Create an organisation ','')}</p></a></div><footer><a className="brand" href="#home"><BrandSignature/></a><span>{C['WELCOME.050']}</span><a href={signedIn?'/dashboard':'/login'}>{signedIn?'Continue learning':C['WELCOME.048']} <Arrow/></a></footer></section>
    </main>
  </div>;
}
