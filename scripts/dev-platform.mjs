// Optional integration launcher. Store-only development needs no game checkouts.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const entries=JSON.parse(readFileSync(process.env.GAME_SERVICES_FILE||path.join(root,'server/game-services.json')));
const token=process.env.RUNTIME_TOKEN||randomBytes(32).toString('hex');
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');process.exit(code);},4000).unref();}
function start(command,args,cwd,env){const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:'inherit'});children.push(child);child.on('error',e=>{console.error(e.message);stop(1);});child.on('exit',code=>{if(!stopping)stop(code||1);});}
const repos=new Map(Object.values(entries).map(e=>[e.repository,e]));
for(const [repo,entry] of repos){
 if(!/^[a-z0-9-]+$/.test(repo))throw Error('Invalid repository name');
 const checkout=path.resolve(process.env.GAME_CHECKOUTS_ROOT||path.join(root,'..'),repo);
 if(!existsSync(path.join(checkout,'host/start.mjs'))||!existsSync(path.join(checkout,'dist')))throw Error(`Clone and build https://github.com/UTXOPlay/${repo} before running dev:platform.`);
 const url=new URL(process.env[entry.urlEnv]||entry.url);
 if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('dev:platform only launches local game services');
 const dataDir=path.join(root,'data','standalone',repo);mkdirSync(dataDir,{recursive:true});
 start(process.execPath,['host/start.mjs'],checkout,{BIND:'127.0.0.1',WEB_PORT:url.port,GAME_ORIGIN:url.origin,DATA_DIR:dataDir,RUNTIME_TOKEN:process.env[entry.tokenEnv]||token});
}
start(process.execPath,['server/index.mjs'],root,{BIND:'127.0.0.1',PORT:'8790',PUBLIC_ORIGIN:'http://127.0.0.1:8790',RUNTIME_TOKEN:token});
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
console.log('UTXOPlay integration: http://127.0.0.1:8790');
