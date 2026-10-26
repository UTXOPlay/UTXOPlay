import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sameDraft,reconcileSavedDraft,creditChanges,missingCreditNames} from '../src/publishing-model.mjs';
test('saved drafts accept server normalization without false unsaved changes',()=>{
 const submitted={title:' Game ',developerName:' Studio ',developerSourceUrl:'https://example.com',publisherName:' Publisher '};
 const saved={publisherName:'Publisher',developerName:'Studio',title:'Game',developerSourceUrl:'https://example.com/'};
 const current=reconcileSavedDraft(submitted,submitted,saved);
 assert.deepEqual(current,saved);assert.ok(sameDraft(current,saved));
 assert.ok(sameDraft({...saved,developerAddress:''},{developerAddress:null,...saved}));
 assert.ok(!sameDraft({...saved,title:'Changed'},saved));
});
test('a save response does not overwrite fields edited while saving',()=>{
 const submitted={title:' First ',developerName:' Studio ',publisherName:'Publisher'};
 const saved={title:'First',developerName:'Studio',publisherName:'Publisher',developerAddress:''};
 const current={...submitted,title:'New title'};
 const result=reconcileSavedDraft(current,submitted,saved);
 assert.equal(result.title,'New title');assert.equal(result.developerName,'Studio');
 assert.equal(result.developerAddress,'');assert.ok(!sameDraft(result,saved));
 assert.equal(current.developerName,' Studio ');
});
test('credit review reports additions and removals independently of payment fields',()=>{
 const live={developerName:'Old studio',developerAddress:'old-wallet',publisherName:'Publisher',payoutAddress:'first'};
 const draft={developerName:'New studio',developerAddress:'',publisherName:' Publisher ',developerSourceUrl:'https://example.com/',payoutAddress:'second'};
 assert.deepEqual(creditChanges(live,draft).map(x=>[x.key,x.before,x.after]),[
 ['developerName','Old studio','New studio'],['developerAddress','old-wallet',''],['developerSourceUrl','','https://example.com/']]);
 assert.deepEqual(creditChanges(null,draft),[]);
 assert.deepEqual(missingCreditNames({developerName:'  ',publisherName:''}),['developerName','publisherName']);
 assert.deepEqual(missingCreditNames({developerName:'Example Developer',publisherName:'Arthur Zhang',developerAddress:''}),[]);
});
