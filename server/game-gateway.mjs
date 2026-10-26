import {readFileSync} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {gameSockets} from './game-sockets.mjs';

export function loadIntegrations(file=process.env.GAME_SERVICES_FILE||new URL('./game-services.json',import.meta.url)) {
 const entries=JSON.parse(readFileSync(file,'utf8'));
 const result=new Map();
 for(const [id,entry] of Object.entries(entries)){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))throw Error('Invalid game service id');
  const url=new URL(process.env[entry.urlEnv]||entry.url);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Game services must use HTTP(S) origins');
  result.set(id,{...entry,url:url.origin,token:process.env[entry.tokenEnv]||process.env.RUNTIME_TOKEN||''});
 }
 return result;
}

// A configured game owns all browser assets, room logic and native rules.
// The store supplies revocable identity and records generic play activity only.
export function installGameGateway({app,services,account,needUser,limited,origin,runtimeFetch=fetch,assetFetch=fetch,recordPlay,recordActivity,knownAccount}) {
 const streams=new Set();
 app.get('/api/items',async(req,res)=>{
  const user=account(req);
  const games=await Promise.all([...services].filter(([,service])=>service.items).map(async([id,service])=>{
   try{
    const result=await runtimeFetch(service.url+'/games/'+id+'/api/items',{headers:user?{'X-Runtime-Token':service.token,'X-UTXOPlay-Account':user.id}:{},signal:AbortSignal.timeout(10000)});
    if(!result.ok)throw Error('Inventory unavailable');
    const data=await result.json();
    if(!Array.isArray(data.items)||data.items.length>100)throw Error('Invalid item catalog');
    return {id,balance:data.balance,items:data.items};
   }catch{return {id,error:'Inventory unavailable. Try again shortly.',items:[]};}
  }));
  res.set('Cache-Control','no-store').json({games});
 });
 app.use('/games/:game/api',needUser,async(req,res)=>{
  const id=req.params.game,service=services.get(id),endpoint=req.path;
  if(!service)return res.status(404).json({error:'Unknown game'});
  if(!['GET','POST'].includes(req.method)||!/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(endpoint))return res.status(404).json({error:'Unknown endpoint'});
  if(req.method==='POST'&&limited(req.account.id+':'+id+':'+endpoint,endpoint==='/new'?10:service.actionLimit||120,60000))return res.status(429).json({error:'Please wait before trying again.'});
  if(req.body?.type==='create'&&limited(req.account.id+':'+id+':create',20,3600000))return res.status(429).json({error:'Match creation limit reached.'});
  const controller=new AbortController();
  const onClose=()=>controller.abort();res.on('close',onClose);
  let timer;const deadline=setTimeout(()=>controller.abort(),20000);deadline.unref();
  try{
   const result=await runtimeFetch(service.url+'/games/'+id+'/api'+endpoint,{
    method:req.method,headers:{'Content-Type':'application/json','X-Runtime-Token':service.token,'X-UTXOPlay-Account':req.account.id},
    body:req.method==='POST'?JSON.stringify(req.body||{}):undefined,
    signal:controller.signal
   });
   const type=result.headers.get('content-type')||'application/json';
   // SSE connections have no ordinary response deadline;
   // they are still closed on cookie revocation, client disconnect or shutdown.
   if(type.startsWith('text/event-stream')){
    clearTimeout(deadline);
    res.status(result.status).set({'Content-Type':type,'Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();
    streams.add(controller);
    timer=setInterval(()=>{if(account(req)?.id!==req.account.id)controller.abort();},1000);timer.unref();
    await pipeline(Readable.fromWeb(result.body),res,{signal:controller.signal});
    return;
   }
   const content=await result.text();
   if(result.ok){
    const action=req.method==='POST'&&endpoint.endsWith('/action');
    if(action)recordActivity(req.account.id,id);
    if(service.recordReads&&req.method==='GET'&&endpoint==='/state'||action||req.method==='POST'&&['create','join'].includes(req.body?.type))recordPlay.run(req.account.id,id,Date.now(),req.method==='POST'?1:0);
    if(action){
     for(const player of (result.headers.get('x-game-players')||'').split(',').slice(0,2))if(/^[a-f0-9]{64}$/.test(player)&&player!==req.account.id&&knownAccount(player)){recordPlay.run(player,id,Date.now(),1);recordActivity(player,id);}
    }
   }
   if(endpoint.endsWith('/export'))res.set('Content-Disposition',`attachment; filename="${id}-session.json"`);
   res.status(result.status).type(type).send(content);
  }catch(error){
   if(!res.headersSent&&!res.destroyed)res.status(503).json({error:'The game is unavailable. Please retry; your saved progress is safe.'});
   else res.end();
  }finally{clearTimeout(deadline);clearInterval(timer);streams.delete(controller);res.off('close',onClose);}
 });
 app.use('/games/:game',async(req,res)=>{
  const id=req.params.game,service=services.get(id);
  if(!service)return res.status(404).send('Unknown game');
  if(!['GET','HEAD'].includes(req.method))return res.sendStatus(405);
  if(req.path==='/'&&!req.originalUrl.split('?')[0].endsWith('/'))return res.redirect(308,'/games/'+id+'/');
  // Only paths below this game's configured mount can be fetched. Never proxy a
  // URL, another game, cookies, client-supplied credentials, or upstream redirects.
  let pathname;try{pathname=decodeURIComponent(req.path);}catch{return res.sendStatus(400);}
  if(pathname.includes('\\')||pathname.split('/').some(p=>p==='..'||p==='.')||pathname.includes('\0'))return res.sendStatus(400);
  const controller=new AbortController(),close=()=>controller.abort();res.on('close',close);
  try{
   const headers={};for(const name of ['range','if-none-match','if-modified-since'])if(req.headers[name])headers[name]=req.headers[name];
   const url=service.url+'/games/'+id+req.url;
   const upstream=await assetFetch(url,{method:req.method,headers,redirect:'manual',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
   if(upstream.status>=300&&upstream.status<400&&upstream.status!==304)return res.status(502).send('Invalid game asset redirect');
   res.status(upstream.status);
   for(const name of ['content-type','cache-control','etag','last-modified','content-range','accept-ranges']){const value=upstream.headers.get(name);if(value)res.set(name,value);}
   res.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'");
   if(upstream.body&&req.method!=='HEAD')await pipeline(Readable.fromWeb(upstream.body),res,{signal:controller.signal});else res.end();
  }catch{if(!res.headersSent&&!res.destroyed)res.status(503).send('The game is unavailable. Please retry.');else res.end();}
  finally{res.off('close',close);}
 });
 const routes=new Map([...services].filter(([,s])=>s.socket).map(([id,s])=>['/games/'+id+'/api/socket',{url:s.url+'/games/'+id+'/api/socket',token:s.token}]));
 const sockets=gameSockets({account,origin,limited,routes});
 return {attach:sockets.attach,close(){for(const stream of streams)stream.abort();sockets.close();}};
}
