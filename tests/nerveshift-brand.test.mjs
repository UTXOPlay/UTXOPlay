import test from 'node:test';
import assert from 'node:assert/strict';
import {rebrandModule} from '../tools/rebrand-nerveshift.mjs';
test('deployed bundle rename changes public links and responsive art while retaining account IDs and other images',()=>{
 const src='const id="drift-run",name="NIGHTSHIFT",url="/games/nightshift/",path=id=>"/games/"+(id==="drift-run"?"nightshift":id)+"/",art={"/assets/nightshift-keyart.webp":[{"url":"/assets/old.webp"}],"/assets/chess.webp":[{"url":"/assets/chess-320.webp"}]};export {id,name,url,path,art};';
 const transformed=rebrandModule(src),result=new Function(transformed.code.replace('export {id,name,url,path,art};','return {id,name,url,path,art};'))();
 assert.equal(result.id,'drift-run');assert.equal(result.name,'NerveShift');assert.equal(result.url,'/games/nerveshift/');assert.equal(result.path('drift-run'),'/games/nerveshift/');assert.equal(result.path('chess'),'/games/chess/');assert.deepEqual(result.art['/assets/chess.webp'],[{url:'/assets/chess-320.webp'}]);assert.equal(result.art['/assets/nerveshift-keyart.webp'].length,3);assert.deepEqual(result.art['/assets/nightshift-keyart.webp'],result.art['/assets/nerveshift-keyart.webp']);
});
