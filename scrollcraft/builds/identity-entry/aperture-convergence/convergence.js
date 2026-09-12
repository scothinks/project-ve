const $=id=>document.getElementById(id);
const identity=$('identity');
const themes={
 aubergine:{light:{canvas:'#f6f3ed',surface:'#fffdf9',ink:'#252327',muted:'#625968',line:'#918794',primary:'#583c63','on-primary':'#fffdf9',focus:'#e8e0ec',support:'#f0d2b8'},dark:{canvas:'#201c23',surface:'#2b2530',ink:'#f6f3ed',muted:'#c4b9ca',line:'#95889f',primary:'#d6bce2','on-primary':'#281b2e',focus:'#43344b',support:'#624737'}},
 teal:{light:{canvas:'#f3f4ef',surface:'#fffefa',ink:'#202927',muted:'#52645e',line:'#81958c',primary:'#20584c','on-primary':'#fffefa',focus:'#dce9e2',support:'#f0d2b8'},dark:{canvas:'#192420',surface:'#23312b',ink:'#f3f4ef',muted:'#bbcfc4',line:'#829d8e',primary:'#b3d7c6','on-primary':'#142a21',focus:'#334b40',support:'#624737'}}
};
const neutral={light:{canvas:'#fff',surface:'#fff',ink:'#000',muted:'#333',line:'#777',primary:'#000','on-primary':'#fff',focus:'#eee',support:'#ddd'},dark:{canvas:'#000',surface:'#111',ink:'#fff',muted:'#ddd',line:'#999',primary:'#fff','on-primary':'#000',focus:'#333',support:'#444'}};
const tenants={northstar:{name:'Northstar Collective',monogram:'NC',bg:'#f3e8dc',ink:'#794b2e',font:'Georgia,serif'},kinetic:{name:'Kinetic Studio',monogram:'ks',bg:'#dee9f0',ink:'#254c68',font:'Source Sans,Arial,sans-serif'},fieldwork:{name:'Fieldwork',monogram:'fw.',bg:'#292729',ink:'#f6f3ed',font:'Source Serif,Georgia,serif'}};
document.querySelector('[data-geometry=original]').innerHTML=symbol(144,inheritedA);
document.querySelector('[data-geometry=angular]').innerHTML=symbol(144,angularA);
document.querySelector('[data-geometry=master]').innerHTML=symbol(144);
$('construction').innerHTML=symbol(240);
document.querySelectorAll('[data-signature-mark]').forEach(node=>node.innerHTML=symbol(node.classList.contains('small')?24:64)+'<span>Project VE</span>');
$('scale-proof').innerHTML=[false,true].map(inverse=>`<div class="scale-row ${inverse?'inverse':''}">${[16,24,32,64].map(size=>`<div>${symbol(size,masterA,true)}<small>${size}px${size<32?' optical':''}</small></div>`).join('')}</div>`).join('');
let focus='listening';
function renderItems(){
 const items=[['listening','Active listening','Practise a better conversation'],['decisions','Clear decisions','Turn perspective into action']];
 const html=items.map(([id,title,detail])=>`<div class="learning-item ${focus===id?'current':''}" data-item="${id}"><div><strong>${title}</strong><small>${detail}</small></div>${focus===id?'<span class="current-label">Current</span>':''}</div>`).join('');
 ['learner-list','org-list','tenant-list'].forEach(id=>$(id).innerHTML=html);
 document.querySelectorAll('[data-focus]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.focus===focus)));
}
function renderTenant(){
 const tenant=tenants[$('tenant').value];const mono=['mono','inverse'].includes($('mode').value);const inverse=$('mode').value==='inverse';
 identity.style.setProperty('--tenant-bg',mono?(inverse?'#111':'#eee'):tenant.bg);
 identity.style.setProperty('--tenant-ink',mono?(inverse?'#fff':'#000'):tenant.ink);
 $('tenant-name').textContent=tenant.name;$('tenant-name').style.fontFamily=tenant.font;
 document.querySelector('.tenant-monogram').textContent=tenant.monogram;
}
function renderTheme(){
 const mode=$('mode').value;const isDark=mode==='dark'||mode==='inverse';
 const theme=['mono','inverse'].includes(mode)?neutral[isDark?'dark':'light']:themes[$('palette').value][isDark?'dark':'light'];
 Object.entries(theme).forEach(([key,value])=>identity.style.setProperty('--'+key,value));
 identity.dataset.palette=$('palette').value;identity.dataset.mode=mode;identity.dataset.signature=$('signature').value;
 const labels={ink:'Everyday ink',canvas:'Canvas',primary:'Primary action',focus:'Current field',support:'Editorial support'};
 $('swatches').innerHTML=Object.entries(labels).map(([key,label])=>`<div class="swatch" style="background:${theme[key]};color:${key==='ink'?theme.canvas:key==='primary'?theme['on-primary']:theme.ink}"><strong>${label}</strong><div><small>${key}</small><small>${theme[key].toUpperCase()}</small></div></div>`).join('');
 renderTenant();
}
$('invert').addEventListener('click',()=>{const active=$('naked').classList.toggle('inverted');$('invert').setAttribute('aria-pressed',String(active));});
$('reveal').addEventListener('click',()=>{const show=$('geometry-notes').hidden;$('geometry-notes').hidden=!show;$('reveal').setAttribute('aria-expanded',String(show));$('reveal').textContent=show?'Hide geometry notes':'Show geometry notes';});
['palette','mode','signature'].forEach(id=>$(id).addEventListener('change',renderTheme));
$('tenant').addEventListener('change',renderTenant);
document.querySelectorAll('[data-focus]').forEach(button=>button.addEventListener('click',()=>{focus=button.dataset.focus;renderItems();}));
renderTheme();renderItems();
