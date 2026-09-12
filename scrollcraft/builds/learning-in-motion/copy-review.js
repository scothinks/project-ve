/* Local review tool. No edits are submitted or applied to the application. */
(async()=>{
  const $=id=>document.getElementById(id);
  try {
    const response=await fetch('copy-review.json');if(!response.ok)throw new Error('Copy document unavailable.');
    const data=await response.json();const edits=new Map();const rows=[];let downloaded=false;
    for(const group of new Set(data.entries.map(entry=>entry.group))){const option=document.createElement('option');option.value=group;option.textContent=group;$('group').append(option);}
    for(const [index,entry] of data.entries.entries()){
      const row=document.createElement('article');const meta=document.createElement('div');meta.className='entry-meta';
      const label=document.createElement('label');label.htmlFor=`copy-${index}`;label.textContent=entry.id;
      const group=document.createElement('small');group.textContent=entry.group;meta.append(label,group);
      const input=document.createElement('textarea');input.id=label.htmlFor;input.value=entry.copy;input.rows=Math.max(2,Math.min(7,Math.ceil(entry.copy.length/80)));input.spellcheck=true;
      input.addEventListener('input',()=>{if(input.value===entry.copy)edits.delete(entry.id);else edits.set(entry.id,input.value);downloaded=false;row.classList.toggle('changed',edits.has(entry.id));update();});row.append(meta,input);
      if(entry.note){const note=document.createElement('p');note.className='entry-note';note.textContent=entry.note;row.append(note);}
      $('entries').append(row);rows.push({row,entry,input});
    }
    function update(){const query=$('search').value.toLowerCase();const group=$('group').value;let visible=0;for(const {row,entry,input} of rows){row.hidden=Boolean((group&&entry.group!==group)||!`${entry.id} ${input.value}`.toLowerCase().includes(query));if(!row.hidden)visible++;}$('status').textContent=`${visible} of ${rows.length} strings · ${edits.size} edited${downloaded?' · Downloaded':''}`;}
    $('search').addEventListener('input',update);$('group').addEventListener('change',update);$('download').disabled=false;
    $('download').addEventListener('click',()=>{const result={...data,status:'User copy edits for review',entries:data.entries.map(entry=>({...entry,copy:edits.get(entry.id)??entry.copy}))};const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='project-ve-copy-edits.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);downloaded=true;update();});
    window.addEventListener('beforeunload',event=>{if(edits.size&&!downloaded){event.preventDefault();event.returnValue='';}});update();
  } catch(error){$('status').textContent=`Could not load the editor. Use the original Markdown download. ${error.message}`;}
})();
