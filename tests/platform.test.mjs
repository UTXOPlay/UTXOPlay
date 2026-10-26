import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ccc} from '@ckb-ccc/shell';
import {createApp} from '../server/index.mjs';
import {verifyWallet} from '../server/auth.mjs';
const owner=ccc.ClientPublicMainnet.open();
const signer=new ccc.SignerCkbPrivateKey(owner.value,'0x'+'12'.repeat(32));
const other=new ccc.SignerCkbPrivateKey(owner.value,'0x'+'13'.repeat(32));
const address=await signer.getRecommendedAddress();
const origin='https://store.utxoplay.io';
const dir=mkdtempSync(path.join(tmpdir(),'utxoplay-test-'));
const calls=[];
const service=createApp({dataDir:dir,origin,runtimeFetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({session:{id:options.headers['X-UTXOPlay-Account']},game:{}}),{status:200});}});
const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
function jar(response){return response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
async function req(url,body,cookie='',extra={}){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...extra},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:jar(r),response:r};}
after(async()=>{await new Promise(r=>server.close(r));service.close();rmSync(dir,{recursive:true,force:true});await owner.dispose();});
test('actual CKB signature is verified and address ownership is enforced',async()=>{const message='UTXOPlay ownership test';const proof=await signer.signMessage(message);const result=await verifyWallet(message,proof,address);assert.equal(result.address,address);await assert.rejects(()=>verifyWallet(message,proof,awaitAddress()),/./);function awaitAddress(){return 'ckt1invalid';}await assert.rejects(()=>verifyWallet('different challenge',proof,address));const wrongAddress=await other.getRecommendedAddress();await assert.rejects(()=>verifyWallet(message,proof,wrongAddress),/does not control/);});
test('unknown and JoyID session-key schemes fail closed',async()=>{await assert.rejects(()=>verifyWallet('test',{identity:'x',signature:'x',signType:'Unknown'},address));await assert.rejects(()=>verifyWallet('test',{identity:JSON.stringify({keyType:'main_session_key',publicKey:'12'}),signature:'{}',signType:'JoyId'},address),/Passkey/);});
test('guest accounts are isolated and game proxy ignores injected account headers',async()=>{const a=await req('/api/guest',{}),b=await req('/api/guest',{});assert.notEqual(a.data.user.id,b.data.user.id);const state=await req('/games/chess/api/state',undefined,a.cookie,{'X-UTXOPlay-Account':b.data.user.id});assert.equal(state.status,200);assert.equal(state.data.session.id,a.data.user.id);assert.equal((await req('/api/library',undefined,b.cookie)).data.games.length,0);assert.equal((await req('/api/library',undefined,a.cookie)).data.games[0].game,'chess');assert.equal((await req('/games/chess/api/state')).status,401);assert.equal((await req('/api/developer/projects',{title:'Game',description:'A game',url:'https://example.com'},a.cookie)).status,403);});
test('wallet challenge is browser-bound, single use, persistent identity and revocable',async()=>{const challenge=await req('/api/auth/challenge',{address});const proof=await signer.signMessage(challenge.data.message);const payload={id:challenge.data.id,proof};assert.equal((await req('/api/auth/verify',payload)).status,401);const login=await req('/api/auth/verify',payload,challenge.cookie);assert.equal(login.status,200,JSON.stringify(login.data));assert.equal(login.data.user.address,address);assert.equal((await req('/api/auth/verify',payload,challenge.cookie)).status,401);assert.equal((await req('/api/me',undefined,login.cookie)).data.user.id,login.data.user.id);await req('/api/auth/logout',{},login.cookie);assert.equal((await req('/api/me',undefined,login.cookie)).data.user,null);const next=await req('/api/auth/challenge',{address});const again=await req('/api/auth/verify',{id:next.data.id,proof:await signer.signMessage(next.data.message)},next.cookie);assert.equal(again.data.user.id,login.data.user.id);});
test('wrong origin, wrong address signature, and cross-account projects are rejected',async()=>{assert.equal((await req('/api/guest',{},'',{Origin:'https://evil.invalid'})).status,403);const challenge=await req('/api/auth/challenge',{address});assert.equal((await req('/api/auth/verify',{id:challenge.data.id,proof:await other.signMessage(challenge.data.message)},challenge.cookie)).status,401);const c=await req('/api/auth/challenge',{address});const login=await req('/api/auth/verify',{id:c.data.id,proof:await signer.signMessage(c.data.message)},c.cookie);assert.equal((await req('/api/developer/projects',{title:'My game',description:'A private draft',url:'https://example.com/game'},login.cookie)).status,201);assert.equal((await req('/api/developer/projects',undefined,login.cookie)).data.projects.length,1);const guest=await req('/api/guest',{});assert.equal((await req('/api/developer/projects',undefined,guest.cookie)).data.projects.length,0);assert.equal((await req('/api/developer/projects',{title:'My game',description:'bad',url:'javascript:alert(1)'},login.cookie)).status,400);});
test('Teeworlds catalog and proxy use the dedicated runtime with authenticated identity',async()=>{
 const catalog=await req('/api/games');assert.equal(catalog.data.games.length,13);assert.equal(catalog.data.games.find(g=>g.id==='teeworlds').mode,'Online duel + practice');
 const guest=await req('/api/guest',{});const r=await req('/games/teeworlds/api/action',{type:'create',mode:'duel'},guest.cookie,{'X-UTXOPlay-Account':'f'.repeat(64)});assert.equal(r.status,200);
 const call=calls.at(-1);assert.equal(call.url,'http://127.0.0.1:8883/games/teeworlds/api/action');assert.equal(call.options.headers['X-UTXOPlay-Account'],guest.data.user.id);
 assert.equal((await req('/api/library',undefined,guest.cookie)).data.games[0].game,'teeworlds');
 assert.equal((await req('/games/teeworlds/api/action',{type:'create',mode:'duel'},guest.cookie,{Origin:'https://evil.invalid'})).status,403);
});

test('OpenStrike uses its own runtime and authenticated account',async()=>{
 const guest=await req('/api/guest',{});const r=await req('/games/openstrike/api/action',{type:'create',mode:'duel'},guest.cookie,{'X-UTXOPlay-Account':'f'.repeat(64)});assert.equal(r.status,200);
 const call=calls.at(-1);assert.equal(call.url,'http://127.0.0.1:8884/games/openstrike/api/action');assert.equal(call.options.headers['X-UTXOPlay-Account'],guest.data.user.id);
 assert.equal((await req('/api/library',undefined,guest.cookie)).data.games[0].game,'openstrike');
 assert.equal((await req('/games/openstrike/api/action',{type:'create',mode:'duel'},guest.cookie,{Origin:'https://evil.invalid'})).status,403);
});

test('library polling coalesces writes but user actions update last played immediately',async()=>{
 const guest=await req('/api/guest',{});const id=guest.data.user.id;
 await req('/games/chess/api/state',undefined,guest.cookie);
 const last=()=>service.db.prepare('SELECT updated FROM plays WHERE account=? AND game=?').get(id,'chess').updated;
 const stamp=Date.now()-1000;service.db.prepare('UPDATE plays SET updated=? WHERE account=?').run(stamp,id);
 await req('/games/chess/api/state',undefined,guest.cookie);assert.equal(last(),stamp);
 await req('/games/chess/api/action',{type:'move',uci:'e2e4'},guest.cookie);assert.ok(last()>stamp);
 service.db.prepare('UPDATE plays SET updated=? WHERE account=?').run(Date.now()-61000,id);
 await req('/games/chess/api/state',undefined,guest.cookie);assert.ok(last()>stamp);
});

test('persistent quotas retain counts and reset only after expiry',async()=>{
 const guestKey='guest:127.0.0.1',future=Date.now()+86400000;
 service.db.prepare('INSERT INTO limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,expires=excluded.expires').run(guestKey,12,future);
 assert.equal((await req('/api/guest',{})).status,429);
 assert.equal(service.db.prepare('SELECT expires FROM limits WHERE key=?').get(guestKey).expires,future);
 service.db.prepare('UPDATE limits SET expires=? WHERE key=?').run(Date.now()-1,guestKey);
 assert.equal((await req('/api/guest',{})).status,200);
 assert.equal(service.db.prepare('SELECT count FROM limits WHERE key=?').get(guestKey).count,1);
});

 test('arcade games route independently with authenticated identity',async()=>{
  const guest=await req('/api/guest',{});
  for(const id of ['prism-breaker','neon-coil','starfall','drift-run']){
   const r=await req(`/games/${id}/api/state`,undefined,guest.cookie,{'X-UTXOPlay-Account':'f'.repeat(64)});assert.equal(r.status,200);
   const call=calls.at(-1);assert.equal(call.url,`http://127.0.0.1:${id==='prism-breaker'?8887:8885}/games/${id}/api/state`);assert.equal(call.options.headers['X-UTXOPlay-Account'],guest.data.user.id);
  }
 });

test('Neon Prospector routes to its isolated Myelin runtime',async()=>{const guest=await req('/api/guest',{});const r=await req('/games/neon-miner/api/state',undefined,guest.cookie);assert.equal(r.status,200);assert.equal(calls.at(-1).url,'http://127.0.0.1:8886/games/neon-miner/api/state');assert.equal(calls.at(-1).options.headers['X-UTXOPlay-Account'],guest.data.user.id);});

test('atelier games use their independent authenticated runtime',async()=>{const guest=await req('/api/guest',{});for(const id of ['rune-foundry','lumen-weave','orbit-courier','mosslight']){const r=await req(`/games/${id}/api/state`,undefined,guest.cookie);assert.equal(r.status,200);assert.equal(calls.at(-1).url,`http://127.0.0.1:8888/games/${id}/api/state`);assert.equal(calls.at(-1).options.headers['X-UTXOPlay-Account'],guest.data.user.id);}});
