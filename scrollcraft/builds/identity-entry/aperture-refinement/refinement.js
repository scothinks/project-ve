const geometries = [
 {id:'offset',letter:'A',name:'Offset',
  path:'M49 6L83 29L67 43L48 30L27 48L49 70L72 48L87 60L49 92L5 48Z',
  tiny:'M8 1L14 5L11 7L8 5L5 8L8 11L12 8L15 10L8 15L1 8Z',
  medium:'M12 2L21 7L17 11L12 8L7 12L12 17L18 12L22 15L12 23L1 12Z',
  premise:'An offset core opens through a rising edge. The negative space is a place within a structure, with continuity beyond it. No literal V or E is required.',
  risk:'First-read risk: chevron, bracket or interlocking link. The absence of a base-to-roof axis lowers the doorway reading but does not establish ownability.',
  consequence:'Lead hypothesis. A protected content area with one open corner gives the geometry a functional role in selection and grouping.',
  construction:'96-unit field · asymmetric lozenge · offset core · one rising release'},
 {id:'counterform',letter:'B',name:'Counterform',
  path:'M10 12H86V29H47L10 60ZM86 84H10V67H49L86 36Z',
  tiny:'M1 2H15V5H8L1 10ZM15 14H1V11H8L15 6Z',
  medium:'M2 3H22V7H12L2 15ZM22 21H2V17H12L22 9Z',
  premise:'Two opposing masses define a shared diagonal interval. The space belongs to both sides; progression is carried by the counterform rather than an arrow.',
  risk:'First-read risk: transfer icon, folded ribbon or divided square. Too much symmetry would make the symbol feel generic.',
  consequence:'Strong counterproposal. Opposing cuts can distinguish personal focus from surrounding organisation context, but should not break every surface into competing parts.',
  construction:'96-unit field · two masses · shared diagonal interval · open opposing edges'},
 {id:'orbit',letter:'C',name:'Orbit',
  path:'M80 20A40 40 0 1 0 85 72L65 58A20 20 0 1 1 62 36Z',
  tiny:'M13 3A7 7 0 1 0 14 12L10 10A3 3 0 1 1 10 6Z',
  medium:'M20 5A10 10 0 1 0 21 18L16 14A5 5 0 1 1 15 9Z',
  premise:'A broad circular enclosure supports a displaced open core. Softer continuity tests whether the idea can feel less infrastructural and more personal.',
  risk:'First-read risk: camera aperture, refresh, loading or the letter C. A familiar category reading may overwhelm the intended idea.',
  consequence:'Useful rejection test. Rounded open regions are approachable, but the shape currently contributes less distinctive structure to the full system.',
  construction:'96-unit field · circular support · displaced core · upper-right interruption'},
 {id:'release',letter:'D',name:'Release',
  path:'M12 18L39 14L38 35L32 37V54L47 66L64 50V29L53 32L58 11L84 8V59L48 90L12 66Z',
  tiny:'M2 3L7 2L6 6H5V9L8 11L11 8V5L9 6L10 2L14 1V10L8 15L2 11Z',
  medium:'M3 5L10 4L9 9L8 10V14L12 17L16 13V7L13 8L15 3L21 2V15L12 23L3 17Z',
  premise:'The inner space narrows and then releases through a sloped upper edge. A V-like relationship exists in the void, without spelling VE.',
  risk:'First-read risk: shield, badge or downward direction. Protection currently reads more strongly than possibility.',
  consequence:'Do not polish yet. A strong lower point can make the platform feel defensive; the lower silhouette needs rethinking before this becomes a serious lead.',
  construction:'96-unit field · sloped enclosure · V-adjacent void · open upper edge'}
];
const el = id => document.getElementById(id);
const mark = (geometry,size=96,optical=false) => {
 const box=optical&&size===16?16:optical&&size===24?24:96;
 const path=box===16?geometry.tiny:box===24?geometry.medium:geometry.path;
 return `<svg width="${size}" height="${size}" viewBox="0 0 ${box} ${box}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${path}"/></svg>`;
};
let geometry=geometries[0];
let focus='listening';
const items=[{id:'listening',title:'Active listening',detail:'Lesson · Practise a better conversation'},{id:'decisions',title:'Clear decisions',detail:'Lesson · Turn perspective into action'}];

el('naked-grid').innerHTML=geometries.map(g=>`<article class="naked-tile" aria-label="Unlabelled geometry ${g.letter}"><span class="tile-label">${g.letter}</span><div class="naked-symbol">${mark(g)}</div><div class="naked-tiny">${mark(g,16,true)}<span>16px / optical study</span></div></article>`).join('');
el('old-mark').innerHTML='<svg viewBox="0 0 96 96" aria-hidden="true"><path fill="currentColor" d="M10 8h76v80H58V32H44v18H34v38H10z"/></svg>';
el('rationales').innerHTML=geometries.map(g=>`<article><h3>${g.letter} · ${g.name}</h3><p>${g.premise}</p><p><b>${g.risk}</b></p></article>`).join('');

function renderItems(){
 const html=items.map(item=>`<div class="learning-item ${item.id===focus?'current':''}" data-item="${item.id}"><span class="item-marker" aria-hidden="true"></span><div><strong>${item.title}</strong><small>${item.detail}</small></div>${item.id===focus?'<span class="current-label">Current</span>':''}</div>`).join('');
 el('learner-list').innerHTML=html;el('org-list').innerHTML=html;
 document.querySelectorAll('[data-focus]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.focus===focus)));
}
function renderGeometry(){
 el('system').dataset.geometry=geometry.id;
 el('selected-name').textContent=`${geometry.letter} · ${geometry.name}`;
 el('selected-reason').textContent=geometry.consequence;
 el('construction-mark').innerHTML=mark(geometry);
 el('construction-label').textContent=geometry.construction;
 el('optical').innerHTML=[16,24,32].map(size=>`<div>${mark(geometry,size,true)}<small>${size}px</small></div>`).join('');
 el('wordmark').innerHTML=`${mark(geometry)}<span>Project VE</span>`;
 document.querySelectorAll('.mini-brand').forEach(node=>node.innerHTML=`${mark(geometry,24)}<span>Project VE</span>`);
}
el('invert').addEventListener('click',()=>{
 const value=el('naked-grid').classList.toggle('inverted');
 el('invert').setAttribute('aria-pressed',String(value));
 el('invert').textContent=value?'Black on white':'White on black';
});
el('reveal').addEventListener('click',()=>{
 const expanded=el('rationales').hidden;
 el('rationales').hidden=!expanded;
 el('reveal').setAttribute('aria-expanded',String(expanded));
 el('reveal').textContent=expanded?'Hide the reasoning':'Reveal the reasoning';
});
el('geometry').addEventListener('change',event=>{geometry=geometries.find(g=>g.id===event.target.value);renderGeometry();});
el('mono').addEventListener('click',()=>{
 const enabled=el('system').classList.toggle('monochrome');
 el('mono').setAttribute('aria-pressed',String(enabled));
 el('mono').textContent=enabled?'Restore provisional colour':'Test system in monochrome';
});
document.querySelectorAll('[data-focus]').forEach(button=>button.addEventListener('click',()=>{focus=button.dataset.focus;renderItems();}));
el('organisation').addEventListener('change',event=>{
 const data=event.target.value==='kinetic'?{name:'Kinetic Studio',monogram:'ks',colour:'#7e344b',background:'#f3e7ec'}:{name:'Northstar Collective',monogram:'NC',colour:'#825736',background:'#f2eae2'};
 document.querySelectorAll('.org-name').forEach(node=>node.textContent=data.name);
 document.querySelectorAll('.org-monogram').forEach(node=>node.textContent=data.monogram);
 el('system').style.setProperty('--org',data.colour);el('system').style.setProperty('--org-bg',data.background);
});
renderGeometry();renderItems();
