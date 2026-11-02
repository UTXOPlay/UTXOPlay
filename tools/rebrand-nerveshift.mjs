// Narrow overlay of the deployed Store: retain unrelated published modules.
import {parseAst} from 'rollup/parseAst';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const images=JSON.parse(readFileSync(new URL('../shared/nerveshift-images.json',import.meta.url)));
const key='/assets/nerveshift-keyart.webp',variants=images[key];
export function rebrandModule(source){
 const edits=[],counts={text:0,images:0};
 function walk(n){
  if(!n||typeof n!=='object')return;
  if(n.type==='ObjectExpression'&&n.properties.some(p=>p.key?.value?.startsWith?.('/assets/nightshift-'))){
   for(const p of n.properties){if(p.key?.value?.startsWith?.('/assets/nightshift-')){edits.push({start:p.value.start,end:p.value.end,text:JSON.stringify(variants)});counts.images++;}}
   edits.push({start:n.end-1,end:n.end-1,text:','+JSON.stringify(key)+':'+JSON.stringify(variants)});counts.images++;
   for(const p of n.properties){if(!p.key?.value?.startsWith?.('/assets/nightshift-'))walk(p);}return;
  }
  if(n.type==='Literal'&&typeof n.value==='string'){
   let value=n.value.replaceAll('NIGHTSHIFT','NerveShift').replaceAll('NightShift','NerveShift').replaceAll('/games/nightshift','/games/nerveshift').replaceAll('/play/nightshift','/play/nerveshift');if(value==='nightshift')value='nerveshift';
   if(value!==n.value){edits.push({start:n.start,end:n.end,text:JSON.stringify(value)});counts.text++;}return;
  }
  for(const v of Object.values(n)){if(Array.isArray(v)){for(const c of v)walk(c);}else if(v&&typeof v==='object')walk(v);}
 }
 walk(parseAst(source));let code=source,edge=source.length;
 for(const e of edits.sort((a,b)=>b.start-a.start)){if(e.end>edge)throw Error('Overlapping NerveShift edits');code=code.slice(0,e.start)+e.text+code.slice(e.end);edge=e.start;}
 parseAst(code);return {code,counts,changed:edits.length>0};
}
export function rebrandStore(root,output){
 const dir=path.join(root,'dist'),names=readdirSync(path.join(dir,'assets')).filter(n=>n.endsWith('.js')),sources=new Map(names.map(n=>[n,readFileSync(path.join(dir,'assets',n),'utf8')])),html=readFileSync(path.join(dir,'index.html'),'utf8');
 const refs=s=>[...s.matchAll(/["'`]((?:\.\/|\/?assets\/)?[\w.-]+\.js)["'`]/g)].map(m=>path.basename(m[1])).filter(n=>sources.has(n));
 const active=new Set(),queue=refs(html);while(queue.length){const n=queue.pop();if(active.has(n))continue;active.add(n);queue.push(...refs(sources.get(n)));}
 const transformed=new Map([...active].map(n=>[n,rebrandModule(sources.get(n))])),changed=new Set([...transformed].filter(([,v])=>v.changed).map(([n])=>n));
 let more=true;while(more){more=false;for(const n of active)if(!changed.has(n)&&refs(sources.get(n)).some(r=>changed.has(r))){changed.add(n);more=true;}}
 const salt=JSON.stringify(images)+'NerveShift-16.0.1',renames=new Map([...changed].map(n=>[n,n.replace(/\.js$/,'.nerveshift-'+createHash('sha256').update(salt+'\0'+sources.get(n)).digest('hex').slice(0,12)+'.js')]));
 const rewrite=s=>{for(const [a,b]of renames)s=s.replaceAll(a,b);return s;};
 const save=(name,body)=>{const f=path.join(output,name);mkdirSync(path.dirname(f),{recursive:true});writeFileSync(f,body);writeFileSync(f+'.br',brotliCompressSync(body));writeFileSync(f+'.gz',gzipSync(body));};
 for(const n of changed){const code=rewrite(transformed.get(n).code);parseAst(code);save('dist/assets/'+renames.get(n),code);}
 save('dist/index.html',rewrite(html));
 if(existsSync(path.join(dir,'.vite/manifest.json')))save('dist/.vite/manifest.json',rewrite(readFileSync(path.join(dir,'.vite/manifest.json'),'utf8')));
 const base=JSON.parse(readFileSync(path.join(root,'shared/store-image-variants.json')));
 Object.assign(base,images);for(const k of Object.keys(base))if(k.startsWith('/assets/nightshift-'))base[k]=variants;
 const out=path.join(output,'shared/store-image-variants.json');mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(base,null,2)+'\n');
 return {activeModules:active.size,changedModules:changed.size,renames:Object.fromEntries(renames),edits:Object.fromEntries([...transformed].filter(([,v])=>v.changed).map(([n,v])=>[n,v.counts]))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(rebrandStore(path.resolve(process.argv[2]),path.resolve(process.argv[3])),null,2));
