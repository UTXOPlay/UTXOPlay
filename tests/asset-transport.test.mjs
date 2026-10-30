import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {brotliCompressSync,gzipSync,brotliDecompressSync,gunzipSync}from'node:zlib';
import {installGameGateway}from'../server/game-gateway.mjs';

const bytes=Buffer.from('geometry vertex data '.repeat(4096)),encoded={br:brotliCompressSync(bytes),gzip:gzipSync(bytes),identity:bytes};
async function listen(app){const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));return s;}
async function fixture(t){
 const calls=[],native=express();native.use((req,res)=>{calls.push(req.headers);const encoding=req.headers['accept-encoding']==='br'?'br':req.headers['accept-encoding']==='gzip'?'gzip':'identity',etag='"mesh-'+encoding+'"';res.set({'ETag':etag,'Vary':'Accept-Encoding','Cache-Control':'public, max-age=3600','Accept-Ranges':'bytes'});res.type('model/gltf-binary');if(encoding!=='identity')res.set('Content-Encoding',encoding);
 if(req.path.endsWith('/redirect'))return res.redirect('https://unconfigured.invalid/');
 if(req.headers['if-none-match']===etag&&req.headers['cache-control']!=='no-cache')return res.status(304).end();
 if(req.headers.range&&(!req.headers['if-range']||req.headers['if-range']===etag)){res.removeHeader('Content-Encoding');res.set('Content-Range','bytes 4-11/'+bytes.length);return res.status(206).send(bytes.subarray(4,12));}
 res.send(encoded[encoding]);});
 const source=await listen(native),app=express();app.disable('etag');const account=req=>req.headers.cookie?{id:'trusted-owner'}:null;
 const access={status:(_a,id)=>({pricing:id==='paid'?'paid':'free'}),requireAccess:a=>{if(!a)throw Object.assign(Error('Locked'),{status:402});return true;}};
 const gateway=installGameGateway({app,services:new Map(['public','paid','private'].map(id=>[id,{url:'http://127.0.0.1:'+source.address().port,privatePreview:id==='private',token:'trusted-runtime-token'}])),account,needUser:(_q,r)=>r.sendStatus(401),limited:()=>false,origin:'https://store.example',recordPlay:{run(){}},recordActivity(){},knownAccount:()=>false,access});
 const store=await listen(app);t.after(async()=>{gateway.close();await Promise.all([new Promise(r=>store.close(r)),new Promise(r=>source.close(r))]);});
 const get=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:store.address().port,path,method,headers},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));res.on('error',reject);});req.on('error',reject);req.end();});return{get,calls};
}
test('encoded model bytes, validators, lengths and Vary survive the gateway',async t=>{
 const f=await fixture(t);for(const encoding of ['br','gzip','identity']){const r=await f.get('/games/public/model.glb',{'Accept-Encoding':encoding,'Cookie':'private-store-cookie','Authorization':'untrusted','X-Runtime-Token':'untrusted'});assert.equal(r.status,200);assert.deepEqual(r.bytes,encoded[encoding]);assert.equal(+r.headers['content-length'],encoded[encoding].length);assert.match(r.headers.vary,/Accept-Encoding/i);assert.equal(r.headers.etag,'"mesh-'+encoding+'"');assert.equal(r.headers['content-encoding'],encoding==='identity'?undefined:encoding);assert.deepEqual(encoding==='br'?brotliDecompressSync(r.bytes):encoding==='gzip'?gunzipSync(r.bytes):r.bytes,bytes);const call=f.calls.at(-1);assert.equal(call.cookie,undefined);assert.equal(call.authorization,undefined);assert.equal(call['x-runtime-token'],undefined);}
});
test('conditional requests retain 304 instead of Fetch forcing a full 200',async t=>{
 const f=await fixture(t);for(const encoding of ['br','gzip','identity']){const r=await f.get('/games/public/model.glb',{'Accept-Encoding':encoding,'If-None-Match':'"mesh-'+encoding+'"'});assert.equal(r.status,304);assert.equal(r.bytes.length,0);assert.equal(f.calls.at(-1)['cache-control'],undefined);assert.equal(f.calls.at(-1).pragma,undefined);}
 const changed=await f.get('/games/public/model.glb',{'Accept-Encoding':'br','If-None-Match':'"older-mesh"'});assert.equal(changed.status,200);assert.deepEqual(changed.bytes,encoded.br);
});
test('HEAD and range/If-Range keep the selected representation semantics',async t=>{
 const f=await fixture(t);const head=await f.get('/games/public/model.glb',{'Accept-Encoding':'br'},'HEAD');assert.equal(head.status,200);assert.equal(head.bytes.length,0);assert.equal(+head.headers['content-length'],encoded.br.length);
 const partial=await f.get('/games/public/model.glb',{'Range':'bytes=4-11','If-Range':'"mesh-identity"'});assert.equal(partial.status,206);assert.equal(partial.headers['content-range'],'bytes 4-11/'+bytes.length);assert.deepEqual(partial.bytes,bytes.subarray(4,12));assert.equal(f.calls.at(-1)['if-range'],'"mesh-identity"');
 const stale=await f.get('/games/public/model.glb',{'Range':'bytes=4-11','If-Range':'"old"'});assert.equal(stale.status,200);assert.deepEqual(stale.bytes,bytes);
});
test('asset redirects stay confined to the configured origin',async t=>{const f=await fixture(t);assert.equal((await f.get('/games/public/redirect')).status,502);});

test('the real platform factory uses encoded asset transport by default',async t=>{
 const{createApp}=await import('../server/index.mjs');const{mkdtempSync,rmSync}=await import('node:fs');const{tmpdir}=await import('node:os');const{join}=await import('node:path');const data=mkdtempSync(join(tmpdir(),'asset-factory-'));const app=express();app.get('/games/public/model.glb',(_q,r)=>r.set({'Content-Encoding':'br','Content-Type':'model/gltf-binary','Content-Length':String(encoded.br.length)}).end(encoded.br));const native=await listen(app);const store=createApp({dataDir:data,origin:'http://store.example',catalog:[{id:'public',title:'Public',cover:'/example.png',genre:'Other',mode:'Single player'}],gameServices:new Map([['public',{url:'http://127.0.0.1:'+native.address().port,token:'fixture-token'}]]),marketplaceOptions:{startWorker:false}});const server=await listen(store.app);t.after(async()=>{store.close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>native.close(r))]);rmSync(data,{recursive:true,force:true});});const result=await new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port:server.address().port,path:'/games/public/model.glb',headers:{'Accept-Encoding':'br'}},r=>{const chunks=[];r.on('data',x=>chunks.push(x));r.on('end',()=>resolve({status:r.statusCode,body:Buffer.concat(chunks),encoding:r.headers['content-encoding']}));r.on('error',reject);}).on('error',reject);});assert.equal(result.status,200);assert.equal(result.encoding,'br');assert.deepEqual(result.body,encoded.br);assert.deepEqual(brotliDecompressSync(result.body),bytes);
});
