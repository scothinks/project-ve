"use client";
import { useEffect, useRef } from "react";
import { welcomeTopics, type WelcomeTopic } from "@/features/entry/topics";
import { entryCopy as C } from "@/features/entry/copy";
export function WelcomeSharedScene({topic}:{topic:WelcomeTopic}) {
  const scene=useRef<HTMLDivElement>(null);const lesson=welcomeTopics[topic];
  useEffect(()=>{const el=scene.current;const section=el?.closest<HTMLElement>('#together');if(!el||!section)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');const mobile=matchMedia('(max-width:760px)');let raf=0;
    function update(){if(!el||!section)return;const flat=reduced.matches||mobile.matches;const travel=Math.max(1,section.offsetHeight-innerHeight);const t=Math.max(0,Math.min(1,-section.getBoundingClientRect().top/travel/.87));el.dataset.motion=flat?"flat":"active";el.dataset.expanded=String(flat||t===1);el.querySelectorAll<HTMLElement>('.shared-paper').forEach((card,i)=>{card.style.transform=flat?'none':`translateY(${i===0?-190*t:i===1?16-16*t:32+158*t}px) rotate(${(1-t)*(i===0?-5:i===1?3:9)}deg)`;card.style.opacity='1';});}
    const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(update);};addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);reduced.addEventListener('change',schedule);mobile.addEventListener('change',schedule);update();return()=>{cancelAnimationFrame(raf);removeEventListener('scroll',schedule);removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule);mobile.removeEventListener('change',schedule);};
  },[]);
  return <div className="shared-scene" ref={scene}><article className="shared-paper paper-learn"><div className="paper-label"><span>{C['WELCOME.042']}</span><span aria-hidden="true">↗</span></div><h3>{lesson.title}</h3><p>{lesson.idea}</p></article><article className="shared-paper paper-discuss"><div className="paper-label"><span>{C['WELCOME.043']}</span><span aria-hidden="true">“</span></div><h3>{C['WELCOME.037']}</h3><p>{lesson.discussion}</p></article><article className="shared-paper paper-mission"><div className="paper-label"><span>{C['WELCOME.044']}</span><span aria-hidden="true">↗</span></div><h3>{C['WELCOME.039']}</h3><p>{lesson.mission}</p></article><p className="shared-caption">{C['WELCOME.041']}</p></div>;
}
