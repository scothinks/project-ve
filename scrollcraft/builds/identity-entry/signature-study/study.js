/* All vectors and identity values are read from the fixed preceding study. */
const fixed=JSON.parse(document.getElementById('fixed-data').textContent);
const mark=(size=48)=>`<svg width="${size}" height="${size}" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><path fill="currentColor" d="${fixed.path}"/></svg>`;
const words=kind=>kind==='current'?'<span aria-hidden="true">Project VE</span>':'<span class="brand-words" aria-hidden="true"><span>project</span><span class="ve">v<span class="slash">/</span>e</span></span>';
const brand=(kind='open',size=52,compact=false)=>`<span class="brand-signature ${kind} ${compact?'compact':''}" role="img" aria-label="Project VE" style="font-size:${size}px">${mark()}${kind==='current'&&compact?'<span class="brand-words" aria-hidden="true"><span>Project</span><span>VE</span></span>':words(kind)}</span>`;
document.querySelectorAll('[data-trial]').forEach(node=>node.innerHTML=brand(node.dataset.trial));
document.querySelectorAll('[data-compact]').forEach(node=>node.innerHTML=brand(node.dataset.compact,32,true));
document.getElementById('sizes').innerHTML=[14,16,20,24,32].map(size=>`<div class="size-row"><small>${size}px<br><span class="size-label">${size===14?'Stress test':size===16?'Proposed minimum':'Text size'}</span></small><div>${brand('current',size)}</div><div>${brand('open',size)}</div></div>`).join('');
const items='<div class="learning-item current" data-item="listening"><div><strong>Active listening</strong><small>Practise a better conversation</small></div><span class="current-label">Current</span></div><div class="learning-item " data-item="decisions"><div><strong>Clear decisions</strong><small>Turn perspective into action</small></div></div>';
for(const kind of ['learner','organisation','tenant']){
 for(const variant of ['current','open']){
  const host=document.getElementById(`${kind}-${variant}`);
  host.append(document.getElementById(`${kind}-template`).content.cloneNode(true));
  host.querySelectorAll('[id]').forEach(node=>{node.dataset.originalId=node.id;node.removeAttribute('id');});
  host.querySelectorAll('.learning-list').forEach(node=>node.innerHTML=items);
  host.querySelectorAll('[data-signature-mark]').forEach(node=>{
   node.setAttribute('role','img');node.setAttribute('aria-label','Project VE');
   node.innerHTML=mark(24)+words(variant);
  });
 }
}
const env=document.getElementById('environment');const tenantSelect=document.getElementById('tenant-choice');
function render(){
 const area=document.getElementById('contexts');
 Object.entries(fixed.themes[env.value]).forEach(([key,value])=>area.style.setProperty('--'+key,value));
 area.dataset.mode=env.value;
 const tenant=fixed.tenants[tenantSelect.value];
 area.style.setProperty('--tenant-bg',tenant.bg);area.style.setProperty('--tenant-ink',tenant.ink);
 area.querySelectorAll('[data-original-id="tenant-name"]').forEach(node=>{node.textContent=tenant.name;node.style.fontFamily=tenant.font;});
 area.querySelectorAll('.tenant-monogram').forEach(node=>node.textContent=tenant.monogram);
}
env.addEventListener('change',render);tenantSelect.addEventListener('change',render);render();
document.fonts.ready.then(()=>{
 const row=document.querySelectorAll('.size-row')[2];const current=row.querySelector('.current').getBoundingClientRect();const proposed=row.querySelector('.open').getBoundingClientRect();
 document.getElementById('measurements').textContent=`At 20px text, including the unchanged 24px mark and 7px gap: current ${Math.round(current.width)}px wide; proposed ${Math.round(proposed.width)}px wide. Measured in this browser.`;
});
