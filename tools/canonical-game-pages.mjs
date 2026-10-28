// A narrow AST build pass also allows the currently deployed frontend to be
// migrated without rebuilding unrelated, unpublished platform changes.
import {parseAst} from 'rollup/parseAst';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {canonicalGamePath,gameIdFromPath} from '../shared/game-paths.mjs';
const helpers=canonicalGamePath.toString().replace('canonicalGamePath','__utxoGamePath')+'\n'+gameIdFromPath.toString().replace('gameIdFromPath','__utxoGameId');
export function canonicalPageModule(source){
 const edits=[],counts={routes:0,prefixes:0,vendorIds:0};
 function walk(node,parent){
  if(!node||typeof node!=='object')return;
  if(node.type==='BinaryExpression'&&node.operator==='+'&&node.left.type==='Literal'&&node.left.value==='/play/'){
   edits.push({start:node.start,end:node.end,value:'__utxoGamePath(('+source.slice(node.right.start,node.right.end)+'))'});counts.routes++;return;
  }
  if(node.type==='Literal'&&typeof node.value==='string'&&node.value.startsWith('/play/')){
   edits.push({start:node.start,end:node.end,value:JSON.stringify(node.value.replace('/play/','/games/'))});counts.prefixes++;return;
  }
  if(node.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&node.callee.property?.name==='slice'&&node.arguments.length===1&&node.arguments[0]?.value===6&&parent?.type==='BinaryExpression'&&parent.left?.value==='/api/games/'){
   edits.push({start:node.start,end:node.end,value:'__utxoGameId('+source.slice(node.callee.object.start,node.callee.object.end)+')'});counts.vendorIds++;return;
  }
  for(const [key,value]of Object.entries(node)){if(key==='parent')continue;if(Array.isArray(value))for(const child of value)walk(child,node);else if(value&&typeof value==='object')walk(value,node);}
 }
 walk(parseAst(source),null);if(!edits.length)return{code:source,counts,changed:false};
 if(source.includes('__utxoGamePath')||source.includes('__utxoGameId'))throw Error('Canonical helper name collision');
 let code=source,last=source.length;for(const edit of edits.sort((a,b)=>b.start-a.start)){if(edit.end>last)throw Error('Overlapping canonical route edits');code=code.slice(0,edit.start)+edit.value+code.slice(edit.end);last=edit.start;}
 code+='\n'+helpers+'\n';parseAst(code);return{code,counts,changed:true};
}
export function migrateGamePageBundle(root,output=root){
 const assetDir=path.join(root,'assets'),names=readdirSync(assetDir).filter(n=>n.endsWith('.js')),sources=new Map(names.map(name=>[name,readFileSync(path.join(assetDir,name),'utf8')])),html=readFileSync(path.join(root,'index.html'),'utf8');
 const refs=source=>[...source.matchAll(/["'`]((?:\.\/|\/?assets\/)?[\w.-]+\.js)["'`]/g)].map(m=>path.basename(m[1])).filter(name=>sources.has(name));
 const active=new Set(),queue=refs(html);while(queue.length){const name=queue.pop();if(active.has(name))continue;active.add(name);queue.push(...refs(sources.get(name)));}
 const transformed=new Map([...active].map(name=>[name,canonicalPageModule(sources.get(name))])),changed=new Set([...transformed].filter(([,v])=>v.changed).map(([name])=>name));
 let growing=true;while(growing){growing=false;for(const name of active)if(!changed.has(name)&&refs(sources.get(name)).some(ref=>changed.has(ref))){changed.add(name);growing=true;}}
 const renames=new Map([...changed].map(name=>[name,name.replace(/\.js$/,'.games-'+createHash('sha256').update(name+'\0'+sources.get(name)+'\0'+helpers).digest('hex').slice(0,12)+'.js')]));
 const rewrite=source=>{for(const [old,next]of renames)source=source.replaceAll(old,next);return source;};
 const save=(name,source)=>{const target=path.join(output,name);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,source);writeFileSync(target+'.br',brotliCompressSync(source));writeFileSync(target+'.gz',gzipSync(source));};
 for(const name of changed){const code=rewrite(transformed.get(name).code);parseAst(code);save('assets/'+renames.get(name),code);}
 save('index.html',rewrite(html));const manifest=path.join(root,'.vite/manifest.json');if(existsSync(manifest))save('.vite/manifest.json',rewrite(readFileSync(manifest,'utf8')));
 return{activeModules:active.size,changedModules:changed.size,renames:Object.fromEntries(renames),edits:Object.fromEntries([...transformed].filter(([,v])=>v.changed).map(([name,v])=>[name,v.counts]))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(migrateGamePageBundle(path.resolve(process.argv[2]||'dist'),path.resolve(process.argv[3]||process.argv[2]||'dist')),null,2));
