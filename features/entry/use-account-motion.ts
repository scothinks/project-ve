"use client";
import { useEffect, useRef, useState } from "react";
export function useAccountMotion(mode: string) {
  const wrap = useRef<HTMLDivElement>(null); const view = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLElement|null>(null); const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const [moving,setMoving]=useState(false);const [ready,setReady]=useState(false);
  useEffect(()=>{setReady(true);return()=>{if(timer.current)clearTimeout(timer.current);ghost.current?.remove();};},[]);
  useEffect(()=>{const node=wrap.current;const content=view.current;if(!node||!content)return;
    const fit=()=>{if(mode==='state'){node.style.height='auto';return;}const height=content.scrollHeight+(node.querySelector('.auth-xp-carry')?.getBoundingClientRect().height??0);const mobile=matchMedia('(max-width:870px)').matches;node.style.height=`${Math.ceil(mobile?Math.max(960,(height+80)/.6):Math.max(720,height+90))}px`;};
    const observer=new ResizeObserver(fit);observer.observe(content);addEventListener('resize',fit);fit();return()=>{observer.disconnect();removeEventListener('resize',fit);};
  },[mode]);
  function transition(change:()=>void){if(moving)return;const node=view.current?.querySelector<HTMLElement>('.auth-view-content');const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(node&&!reduced){const clone=node.cloneNode(true) as HTMLElement;clone.className='auth-view-ghost';clone.inert=true;clone.setAttribute('aria-hidden','true');clone.querySelectorAll('[id],[name],[for]').forEach(el=>{el.removeAttribute('id');el.removeAttribute('name');el.removeAttribute('for');});clone.querySelectorAll<HTMLInputElement>('input[type=password]').forEach(el=>el.value='');ghost.current=clone;view.current?.append(clone);clone.animate([{opacity:1},{opacity:0}],{duration:200,delay:700,easing:'ease',fill:'forwards'});setMoving(true);}
    change();requestAnimationFrame(()=>{if(!reduced)view.current?.querySelector('.auth-view-content')?.animate([{opacity:0},{opacity:1}],{duration:200,delay:700,easing:'ease',fill:'backwards'});timer.current=setTimeout(()=>{ghost.current?.remove();ghost.current=null;setMoving(false);requestAnimationFrame(()=>view.current?.querySelector<HTMLElement>('#auth-title')?.focus({preventScroll:true}));},reduced?0:matchMedia('(max-width:870px)').matches?2000:1800);});
  }
  return {wrap,view,ready,moving,transition};
}
