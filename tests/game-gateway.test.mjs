import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket,WebSocketServer} from 'ws';
import {createApp} from '../server/index.mjs';

async function listen(app){const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));return server;}
const url=s=>'http://127.0.0.1:'+s.address().port;
const token='gateway-test-secret-'.repeat(3),origin='http://store.example';
async function fixture(t){
 const upstream=express();upstream.use(express.json());const calls=[];
 upstream.use((req,res,next)=>{calls.push({path:req.url,headers:req.headers,body:req.body});next();});
 upstream.get('/games/external/api/items',(req,res)=>res.json({balance:req.headers['x-utxoplay-account']?42:null,items:[{id:'tool',name:'Tool',price:3}]}));
 upstream.get('/games/external/api/events',(_req,res)=>{res.set('Content-Type','text/event-stream');res.write('event: ready\ndata: {}\n\n');const timer=setInterval(()=>res.write(': ping\n\n'),200);res.on('close',()=>clearInterval(timer));});
 upstream.all('/games/external/api/{*endpoint}',(req,res)=>res.json({account:req.headers['x-utxoplay-account']}));
 upstream.get('/games/external/redirect',(_req,res)=>res.redirect('https://unconfigured.invalid/'));
 upstream.get('/games/external/',(_req,res)=>res.cookie('malicious','ignored').type('html').send('<h1>External</h1>'));
 upstream.get('/games/external/asset.js',(req,res)=>res.type('js').send('export const independent=true;'));
 const native=await listen(upstream),wss=new WebSocketServer({server:native});
 wss.on('connection',(ws,req)=>{calls.push({socket:true,headers:req.headers});ws.send(JSON.stringify({account:req.headers['x-utxoplay-account']}));ws.on('message',raw=>ws.send(raw));});
 const dir=mkdtempSync(path.join(tmpdir(),'game-gateway-'));
 const catalog=[{id:'external',title:'External game',genre:'Other',mode:'Single player',cover:'/example.png'}];
 const store=createApp({dataDir:dir,origin,catalog,gameServices:new Map([['external',{url:url(native),token,socket:true,recordReads:true,items:true}]]),marketplaceOptions:{startWorker:false}});
 const server=await listen(store.app);store.attachSockets(server);
 t.after(async()=>{store.close();for(const c of wss.clients)c.terminate();wss.close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>native.close(r))]);rmSync(dir,{recursive:true,force:true});});
 return {store,calls,base:url(server),async req(p,body,cookie='',headers={}){return fetch(url(server)+p,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});}};
}
async function guest(f){const r=await f.req('/api/guest',{});return {id:(await r.json()).user.id,cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
test('a game unknown to the store code works through configured asset, HTTP and item boundaries',async t=>{
 const f=await fixture(t),a=await guest(f),b=await guest(f);
 const page=await f.req('/games/external/',undefined,a.cookie,{'X-Runtime-Token':'injected'});assert.equal(page.status,200);assert.equal(page.headers.getSetCookie().length,0);assert.match(await page.text(),/External/);
 const call=f.calls.at(-1);assert.equal(call.headers.cookie,undefined);assert.equal(call.headers['x-runtime-token'],undefined);
 const asset=await f.req('/games/external/asset.js?v=2');assert.equal(asset.status,200);assert.equal(f.calls.at(-1).path,'/games/external/asset.js?v=2');
 assert.equal((await f.req('/games/external/redirect')).status,502);
 assert.equal((await f.req('/games/unknown/')).status,404);
 assert.equal((await f.req('/games/external/api/state')).status,401);
 const state=await f.req('/games/external/api/state',undefined,a.cookie,{'X-UTXOPlay-Account':b.id,'X-Runtime-Token':'injected'});assert.equal((await state.json()).account,a.id);assert.equal(f.calls.at(-1).headers['x-runtime-token'],token);
 assert.equal((await f.req('/games/external/api/action',{},a.cookie,{Origin:'http://evil.invalid'})).status,403);
 const anonItems=await f.req('/api/items');assert.equal((await anonItems.json()).games[0].balance,null);
 const items=await f.req('/api/items',undefined,a.cookie);assert.equal((await items.json()).games[0].balance,42);assert.equal(f.calls.at(-1).headers['x-utxoplay-account'],a.id);
});
test('SSE streams relay immediately and close when the store session is revoked',async t=>{
 const f=await fixture(t),a=await guest(f),controller=new AbortController();
 const response=await fetch(f.base+'/games/external/api/events',{headers:{Cookie:a.cookie},signal:controller.signal});
 assert.equal(response.status,200);const reader=response.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/event: ready/);
 await f.req('/api/auth/logout',{},a.cookie);
 await Promise.race([(async()=>{try{while(!(await reader.read()).done){}}catch{}})(),new Promise((_,reject)=>{const timer=setTimeout(()=>{controller.abort();reject(Error('Revoked SSE stayed open'));},4000);timer.unref();})]);
 controller.abort();
});
test('WebSocket upgrades use authenticated identity, reject wrong origins, and revoke live sessions',async t=>{
 const f=await fixture(t),a=await guest(f);
 const ws=new WebSocket(f.base.replace('http','ws')+'/games/external/api/socket',{headers:{Origin:origin,Cookie:a.cookie,'X-UTXOPlay-Account':'f'.repeat(64)}});t.after(()=>ws.terminate());
 const first=await new Promise((resolve,reject)=>{ws.once('message',raw=>resolve(JSON.parse(raw)));ws.once('error',reject);});assert.equal(first.account,a.id);
 const rejected=new WebSocket(f.base.replace('http','ws')+'/games/external/api/socket',{headers:{Origin:'https://evil.invalid',Cookie:a.cookie}});rejected.on('error',()=>{});
 assert.equal(await new Promise(r=>rejected.once('unexpected-response',(_req,res)=>{r(res.statusCode);res.resume();rejected.terminate();})),403);
 const closed=new Promise(resolve=>ws.once('close',resolve));await f.req('/api/auth/logout',{},a.cookie);
 await Promise.race([closed,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Revoked socket stayed open')),6500);timer.unref();})]);
});
