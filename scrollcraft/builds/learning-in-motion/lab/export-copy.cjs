// Export the stable review inventory. Do not rediscover IDs from deduplicated DOM text.
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'copy-review.json'),'utf8'));
const previous=fs.readFileSync(path.join(root,'COPY-REVIEW.md'),'utf8');
let md=previous.split(/^## /m)[0].trimEnd()+'\n';let group='';
for(const e of data.entries){if(group!==e.group){group=e.group;md+=`\n## ${group}\n`;}md+=`\n### ${e.id}\n\n${e.copy}\n${e.note?`\n*${e.note}*\n`:''}`;}
fs.writeFileSync(path.join(root,'COPY-REVIEW.md'),md);
console.log(`Exported ${data.entries.length} stable copy IDs (${data.status}).`);
