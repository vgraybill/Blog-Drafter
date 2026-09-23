import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProposals, quoteBlocks } from '../public/editorial-ui.js';

test('AI import never accepts model approvals or issue resolutions and rejects unselected sites',()=>{
 const data={schemaVersion:1,variants:[{siteId:'a',title:'Proposal',content:'<p>Draft</p>',categoryIds:[12],issues:[{text:'Verify lab ownership',resolution:'AI claims verified'}],approved:true,approvalToken:'forged'}]};
 const result=parseProposals(data,['a']);assert.equal(result.a.issues[0].resolution,'');assert.equal(result.a.approved,undefined);assert.equal(result.a.approvalToken,undefined);
 assert.throws(()=>parseProposals(data,['b']),/unselected/);
 assert.throws(()=>parseProposals({...data,variants:[data.variants[0],data.variants[0]]},['a','b']),/duplicate/);
 assert.throws(()=>parseProposals({...data,schemaVersion:9},['a']),/schemaVersion/);
});
test('quote conversion preserves approved paragraphs and does not double-wrap or flatten complex content',()=>{
 const html='<p>Original introduction.</p><blockquote><p>Exact &amp; approved quote.</p><p>Second paragraph.</p></blockquote>';
 const converted=quoteBlocks(html);assert.ok(converted.startsWith('<p>Original introduction.</p>'));assert.match(converted,/<!-- wp:quote -->/);assert.match(converted,/<p>Exact &amp; approved quote.<\/p>/);assert.equal((converted.match(/<!-- wp:paragraph -->/g)||[]).length,2);
 assert.throws(()=>quoteBlocks(converted),/already exists/);
 assert.throws(()=>quoteBlocks('<blockquote><figure>Portrait</figure></blockquote>'),/complex formatting/);
});
