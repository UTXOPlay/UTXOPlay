import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {installGamePages} from '../server/game-pages.mjs';import {gameIdFromPath,canonicalGamePath} from '../shared/game-paths.mjs';
import {canonicalPageModule} from '../tools/canonical-game-pages.mjs';
test('canonical game IDs retain existing library/account IDs',()=>{assert.equal(canonicalGamePath('drift-run'),'/games/nightshift/');assert.equal(gameIdFromPath('/games/nightshift/'),'drift-run');assert.equal(gameIdFromPath('/play/vendor-abc'),'vendor-abc');assert.equal(gameIdFromPath('/games/chess/api/state'),null);});
test('document launch, legacy redirects and embedded runtime share one public prefix',async t=>{
 const app=express();installGamePages(app);app.use((req,res)=>res.json({url:req.url}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const request=(p,headers={})=>fetch('http://127.0.0.1:'+server.address().port+p,{headers,redirect:'manual'});
 for(const p of ['/play/drift-run','/play/nightshift/']){const r=await request(p+'?a=1');assert.equal(r.status,308);assert.equal(r.headers.get('location'),'/games/nightshift/?a=1');}
 assert.equal((await(await request('/games/nightshift/',{Accept:'text/html'})).json()).url,'/');
 assert.equal((await(await request('/games/chess/',{'Sec-Fetch-Dest':'document'})).json()).url,'/');
 for(const suffix of ['?launch=x','?review=1','api/state','_arcade/car.glb'])assert.equal((await(await request('/games/nightshift/'+suffix,{Accept:'text/html'})).json()).url,'/games/nightshift/'+suffix);
 assert.equal((await(await request('/games/nightshift/',{'Sec-Fetch-Dest':'iframe',Accept:'text/html'})).json()).url,'/games/nightshift/');
});
test('AST migration changes route expressions and vendor IDs without altering unrelated slices',()=>{
 const source='const page="/games/nightshift/";const id="drift-run";const match=page==="/play/"+id;const vendor=page.startsWith("/play/vendor-");const api="/api/games/"+page.slice(6);const unrelated="abcdefgh".slice(6);export {match,vendor,api,unrelated};';
 const result=canonicalPageModule(source);assert.deepEqual(result.counts,{routes:1,prefixes:1,vendorIds:1});assert.match(result.code,/"abcdefgh"\.slice\(6\)/);assert.ok(!result.code.includes('"/play/"'));
 const fn=new Function(result.code.replace('export {match,vendor,api,unrelated};','return {match,vendor,api,unrelated};'));assert.deepEqual(fn(),{match:true,vendor:false,api:'/api/games/drift-run',unrelated:'gh'});
});
