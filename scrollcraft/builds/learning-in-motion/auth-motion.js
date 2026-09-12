/* Keep the reference's delayed form crossfade independent of account state. */
window.AuthMotion = (() => {
  const wrap = document.querySelector('.auth-form-wrap');
  const view = document.getElementById('auth-view');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pending;
  const focusTitle = () => document.getElementById('auth-title')?.focus({preventScroll:true});
  function measure(markups) {
    if (!markups) {view.style.height='';return;}
    // Like the reference's overlapping grid forms, reserve the taller form.
    const heights=markups.map(markup=>{
      const probe=document.createElement('div');probe.innerHTML=markup;probe.inert=true;
      probe.style.cssText='position:absolute;width:100%;visibility:hidden;pointer-events:none';
      probe.querySelectorAll('[id],[name],[for]').forEach(node=>{node.removeAttribute('id');node.removeAttribute('name');node.removeAttribute('for');});
      view.append(probe);const height=probe.getBoundingClientRect().height;probe.remove();return height;
    });
    view.style.height=`${Math.ceil(Math.max(...heights))}px`;
    fit();
  }
  function fit() {
    if (wrap.dataset.mode === 'state') return;
    const height=Math.max(view.getBoundingClientRect().height,view.querySelector('.auth-view-content')?.getBoundingClientRect().height||0);
    view.style.height=`${Math.ceil(height)}px`;
    const xp=document.getElementById('auth-xp-carry');
    const content=height+(xp.hidden?0:xp.getBoundingClientRect().height+18);
    const mobile=matchMedia('(max-width:870px)').matches;
    wrap.style.setProperty('--stage-height',`${Math.ceil(mobile?Math.max(960,(content+48)/.6):Math.max(720,content+70))}px`);
  }
  function capture(previous, next) {
    clearTimeout(pending);
    wrap.inert = false;
    wrap.removeAttribute('aria-busy');
    if (previous === next || !['login','signup'].includes(previous) || !['login','signup'].includes(next) || reduced.matches || !wrap.classList.contains('is-ready')) return null;
    const ghost = view.querySelector('.auth-view-content')?.cloneNode(true);
    if (!ghost) return null;
    ghost.className = 'auth-view-ghost'; ghost.inert = true; ghost.setAttribute('aria-hidden','true');
    ghost.querySelectorAll('[id],[name],[for]').forEach(node => {node.removeAttribute('id');node.removeAttribute('name');node.removeAttribute('for');});
    // Keep both forms aligned while their opacity crosses beneath the circle.
    return {ghost};
  }
  function reveal(transition, focus) {
    if (!transition) {if(focus)focusTitle();return;}
    const incoming = view.querySelector('.auth-view-content');
    view.append(transition.ghost);
    wrap.inert = true; wrap.setAttribute('aria-busy','true');
    incoming.animate([{opacity:0},{opacity:1}],{duration:200,delay:700,easing:'ease',fill:'backwards'});
    const outgoing = transition.ghost.animate([{opacity:1},{opacity:0}],{duration:200,delay:700,easing:'ease',fill:'forwards'});
    outgoing.finished.then(()=>transition.ghost.remove()).catch(()=>{});
    pending=setTimeout(()=>{
      wrap.inert=false;wrap.removeAttribute('aria-busy');
      if(focus)focusTitle();
    },matchMedia('(max-width:870px)').matches?2000:1800);
  }
  return {capture,reveal,measure,fit};
})();
