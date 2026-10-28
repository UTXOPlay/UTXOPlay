import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {installNightshiftRoutes} from '../server/nightshift-routes.mjs';

async function fixture(t){
 const app=express();installNightshiftRoutes(app);app.use(express.json());
 app.use('/games/:game',(req,res)=>res.json({game:req.params.game,path:req.url,original:req.originalUrl,method:req.method,body:req.body}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 return (path,options={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...options});
}
test('legacy entry links and missing slash preserve launch tokens on the canonical URL',async t=>{
 const request=await fixture(t);
 for(const path of ['/games/drift-run','/games/drift-run/','/games/nightshift']){
  const response=await request(path+'?launch=drift-run%3A1&review=1');assert.equal(response.status,308);
  assert.equal(response.headers.get('location'),'/games/nightshift/?launch=drift-run%3A1&review=1');
 }
 const head=await request('/games/drift-run/',{method:'HEAD'});assert.equal(head.status,308);assert.equal(await head.text(),'');
});
test('canonical pages, assets and API commands retain the existing game identity',async t=>{
 const request=await fixture(t);
 for(const suffix of ['/','/_arcade/car.glb?v=8.1.1','/api/state']){
  const response=await request('/games/nightshift'+suffix);assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.game,'drift-run');assert.equal(data.path,suffix);assert.equal(data.original,'/games/nightshift'+suffix);
 }
 const action={type:'upgrade',vehicle:0,choice:1};
 const response=await request('/games/nightshift/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});
 const data=await response.json();assert.equal(data.method,'POST');assert.equal(data.path,'/api/action');assert.deepEqual(data.body,action);
 assert.equal((await request('/games/drift-run/api/state')).status,200);
});
test('similar names and other games never enter the NIGHTSHIFT alias',async t=>{
 const request=await fixture(t);
 for(const game of ['nightshift-other','chess','drift-coast']){
  const response=await request('/games/'+game+'/');assert.equal(response.status,200);assert.equal((await response.json()).game,game);
 }
});
