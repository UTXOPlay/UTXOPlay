import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectGames,apiError} from '../src/ui-model.mjs';
const games=JSON.parse(readFileSync(new URL('../server/catalog.json',import.meta.url)));
test('search tolerates case and surrounding spaces while combining genre and play style',()=>{
 assert.deepEqual(selectGames(games,{query:'  SKYward  ',genre:'Arcade',mode:'solo'}).map(g=>g.id),['sling']);
 assert.deepEqual(selectGames(games,{query:'skyward',genre:'Action'}),[]);
 assert.deepEqual(selectGames(games,{query:'skyward',mode:'friends'}),[]);
 assert.deepEqual(selectGames(games,{mode:'solo'}).map(g=>g.id),['neon-miner','prism-breaker','neon-coil','starfall','drift-run','botstrike','teeworlds','sling','chess','rune-foundry','lumen-weave','orbit-courier','mosslight','block-party']);
 assert.deepEqual(selectGames(games,{genre:'Strategy',mode:'friends'}).map(g=>g.id),['chess']);
 assert.equal(selectGames(games,{query:'   '}).length,14);
 assert.equal(games.length,14);
});
test('network failures and timeouts have actionable messages, server validation is preserved',()=>{
 assert.match(apiError(new TypeError('Failed to fetch')),/connection/);
 assert.match(apiError(new DOMException('timeout','TimeoutError')),/try again/);
 assert.equal(apiError(new Error('Use an HTTPS URL.')),'Use an HTTPS URL.');
});
test('curated listings identify independent game sources and presentation metadata',()=>{
 for(const game of games){if(game.id==='block-party')assert.equal(game.sourceStatus,'local');else assert.match(game.sourceUrl,/^https:\/\/github.com\/UTXOPlay\/(myelin-|BotStrike$)/);assert.ok(game.presentation.accent);assert.ok(game.replayDescription);}
});

test('wallet button distinguishes authentication phases and never treats a selected signer as login',async()=>{
 const {walletButtonState:state}=await import('../src/ui-model.mjs');
 assert.equal(state({}).state,'disconnected');assert.equal(state({user:{guest:true}}).label,'Connect wallet');
 assert.equal(state({signer:{}}).state,'ready');assert.equal(state({loadingUser:true}).state,'checking');
 for(const phase of ['loading','signature','verifying','logout']){const view=state({walletBusy:true,walletPhase:phase});assert.equal(view.state,phase);assert.equal(view.busy,true);}
 assert.equal(state({isOpen:true}).state,'choosing');assert.equal(state({walletError:'Rejected'}).state,'error');
 const signed=state({user:{guest:false,address:'ckb1abcdefghijklmnopqrstuvwxyz'}});assert.equal(signed.state,'connected');assert.match(signed.label,/^ckb1ab…wxyz$/);assert.equal(signed.busy,false);
});

test('catalog distinguishes original developers, ports and the publisher, and supports creator search',async()=>{
 const address='ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq238rvp7e36zawvdqruc5mpctgz6v95ngc4628yc';
 const {ccc}=await import('@ckb-ccc/shell');const owner=ccc.ClientPublicMainnet.open();
 try {const parsed=await ccc.Address.fromString(address,owner.value);assert.ok(parsed.script);}finally{await owner.dispose();}
 for(const game of games)assert.deepEqual(game.publisher,{name:game.id==='botstrike'?'UTXOPlay Labs':'Arthur Zhang',address});
 const botstrike=games.find(g=>g.id==='botstrike');
 assert.deepEqual(botstrike.developer,{name:'Arthur Zhang',address});assert.equal(botstrike.upstream,undefined);assert.equal(botstrike.sourceUrl,'https://github.com/UTXOPlay/BotStrike');
 const tee=games.find(g=>g.id==='teeworlds');assert.match(tee.developer.name,/Magnus Auvinen/);assert.equal(tee.developer.address,null);
 for(const game of games.filter(g=>g.id!=='teeworlds'))assert.deepEqual(game.developer,{name:'Arthur Zhang',address});
 for(const game of [tee]){assert.deepEqual(game.portedBy,{name:'Arthur Zhang',address});assert.ok(game.developer.sourceUrl.startsWith('https://github.com/'));}
 assert.deepEqual(selectGames(games,{query:'  UTXOPLAY LABS '}).map(g=>g.id),['botstrike']);
 assert.equal(selectGames(games,{query:'Arthur Zhang'}).length,14);
});

test('creator collections use wallet identity and do not merge unknown or cross-publisher developer claims',async()=>{
 const {creatorCollection,creatorHref}=await import('../src/ui-model.mjs');
 assert.equal(creatorCollection(games,'publisher','botstrike').games.length,14);
 assert.equal(creatorCollection(games,'developer','sling').games.length,13);
 assert.equal(creatorCollection(games,'developer','botstrike').games.length,13);
 assert.equal(creatorCollection(games,'portedBy','botstrike'),null);
 assert.equal(creatorCollection(games,'publisher','missing'),null);
 assert.equal(creatorHref({id:'unknown',developer:{name:'Not specified',address:null}},'developer'),null);
 const arthur=games[0].publisher.address;
 const vendor=(id,publisher,developer)=>({id,vendor:true,publisher,developer});
 const a=vendor('a',{name:'Same name',address:'publisher-a'},{name:'Arthur Zhang',address:arthur});
 const b=vendor('b',{name:'Same name',address:'publisher-b'},{name:'Arthur Zhang',address:arthur});
 const c=vendor('c',{name:'Renamed',address:'publisher-a'},{name:'Another credit',address:arthur});
 const unknown1=vendor('unknown1',a.publisher,{name:'Unknown Artist',address:null});
 const unknown2=vendor('unknown2',a.publisher,{name:'Unknown Artist',address:null});
 const all=[...games,a,b,c,unknown1,unknown2];
 assert.deepEqual(creatorCollection(all,'publisher','a').games.map(g=>g.id),['a','c','unknown1','unknown2']);
 assert.deepEqual(creatorCollection(all,'developer','a').games.map(g=>g.id),['a','c']);
 assert.equal(creatorCollection(all,'developer','sling').games.length,13);
 assert.deepEqual(creatorCollection(all,'developer','unknown1').games.map(g=>g.id),['unknown1']);
 assert.equal(creatorHref(games[0],'publisher'),'/creators/publisher/neon-miner');
});


test('creator role navigation follows the same identity without crossing publisher claims',async()=>{
 const {creatorRoleLinks}=await import('../src/ui-model.mjs');
 assert.deepEqual(creatorRoleLinks(games,'publisher','botstrike').map(x=>[x.role,x.count]),[['developer',13],['publisher',14]]);
 assert.deepEqual(creatorRoleLinks(games,'developer','botstrike').map(x=>[x.role,x.count]),[['developer',13],['publisher',14]]);
 assert.deepEqual(creatorRoleLinks(games,'publisher','missing'),[]);
 const claim={id:'claim',vendor:true,developer:games[0].developer,publisher:{name:'Other publisher',address:'other-wallet'}};
 assert.deepEqual(creatorRoleLinks([...games,claim],'developer','claim').map(x=>x.role),['developer']);
 const own={...claim,id:'own',developer:claim.publisher};
 assert.deepEqual(creatorRoleLinks([...games,claim,own],'publisher','claim').map(x=>[x.role,x.count]),[['developer',1],['publisher',2]]);
});
test('collection search combines filters, sorts titles naturally and preserves store order',async()=>{
 const {filterCreatorGames}=await import('../src/ui-model.mjs');
 const sample=[{id:'z',title:'Sector 10',genre:'Arcade',pricing:'free'},{id:'a',title:'Sector 2',genre:'Arcade',pricing:'free'},{id:'b',title:'Sector 1',genre:'Puzzle',pricing:'paid'}];
 const original=structuredClone(sample);
 assert.deepEqual(filterCreatorGames(sample,{query:'  sector ',genre:'Arcade',freeOnly:true,sort:'az'}).map(g=>g.id),['a','z']);
 assert.deepEqual(filterCreatorGames(sample,{sort:'za'}).map(g=>g.id),['z','a','b']);
 assert.deepEqual(filterCreatorGames(sample,{genre:'Puzzle',freeOnly:true}),[]);
 assert.deepEqual(filterCreatorGames(games,{query:'UTXOPlay Labs'}).map(g=>g.id),['botstrike']);
 assert.deepEqual(filterCreatorGames(sample).map(g=>g.id),['z','a','b']);
 assert.deepEqual(sample,original);
});
