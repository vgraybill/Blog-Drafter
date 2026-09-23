import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectEditorial, prepareForSite, editorialFingerprint, internalUrl } from '../src/editorial.js';

const site={id:'a',url:'https://a.test.invalid',categoryIds:[12],personalization:{practice_name:'Affiliate A',appointment_url:'https://booking.invalid/a'}};
function article(){return {id:'editorial-case',title:'Shared',content:'<p>Shared template</p>',assets:{},editorial:{enabled:true,source:'Golden State Dermatopathology\nApproved quotation.',ticket:'Preserve attribution; two links and an appointment link.',protectedText:'Golden State Dermatopathology\nApproved quotation.',minimumLinks:2,distinctLinks:true,quotePolicy:'retain',requiredQuoteCount:1,requiredInlineImages:0,requireFeatured:false,approvals:{},variants:{a:{title:'For {{practice_name}}',content:'<p>Golden State Dermatopathology</p><!-- wp:quote --><blockquote class="wp-block-quote"><!-- wp:paragraph --><p>Approved quotation.</p><!-- /wp:paragraph --></blockquote><!-- /wp:quote --><p><a href="https://a.test.invalid/skin/">Skin</a> <a href="https://a.test.invalid/biopsy/">Biopsy</a> <a href="{{appointment_url}}">Schedule</a></p>',excerpt:'',categoryIds:[13],issues:[],notes:''}}}};}
const healthy=async()=>new Response('<html>Page</html>',{headers:{'content-type':'text/html'}});
test('affiliate variant and categories are independent; approval binds content, policy and site',()=>{
 const a=article(),p=prepareForSite(a,site);assert.equal(p.site.categoryIds[0],13);assert.equal(site.categoryIds[0],12);assert.equal(p.article.title,'For {{practice_name}}');assert.equal(p.article.editorial,undefined);
 const original=editorialFingerprint(a,site);a.editorial.approvals.a='untrusted';assert.equal(editorialFingerprint(a,site),original);a.editorial.variants.a.content+=' changed';assert.notEqual(editorialFingerprint(a,site),original);
 assert.notEqual(editorialFingerprint(article(),{...site,authorId:2}),original);
});
test('editorial checks preserve quotes and protected text, exclude appointment and verify internal links without credentials',async()=>{
 const calls=[];const result=await inspectEditorial(article(),site,async(url,options)=>{calls.push(url);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);return healthy();});
 assert.deepEqual(result.errors,[]);assert.equal(result.internalCount,2);assert.equal(calls.length,2);assert.match(result.preview.title,/Affiliate A/);
 const a=article();a.editorial.variants.a.content=a.editorial.variants.a.content.replace('Approved quotation.','Invented quotation.');
 assert.ok((await inspectEditorial(a,site,healthy)).errors.some(x=>x.includes('Protected excerpt changed')));
});
test('duplicates and external pages cannot satisfy internal link minimum; redirects fail verification',async()=>{
 const a=article();a.editorial.variants.a.content=a.editorial.variants.a.content.replace('/biopsy/','/skin/#details');
 const r=await inspectEditorial(a,site,healthy);assert.equal(r.internalCount,1);assert.ok(r.errors.some(x=>x.includes('Needs 2')));
 a.editorial.variants.a.content=a.editorial.variants.a.content.replace('https://a.test.invalid/skin/#details','https://other.invalid/skin/');
 const failed=await inspectEditorial(a,site,async()=>{throw new Error('redirect');});assert.equal(failed.internalCount,1);assert.ok(failed.errors.some(x=>x.includes('could not be verified')));
});
test('unresolved issues, missing assets and incorrect quote policies block approval',async()=>{
 const a=article();a.editorial.variants.a.issues=[{text:'Confirm lab ownership',resolution:''}];a.editorial.requireFeatured=true;a.editorial.quotePolicy='omit';a.editorial.requiredInlineImages=2;
 const result=await inspectEditorial(a,site,healthy);assert.ok(result.errors.some(x=>x.includes('Unresolved')));assert.ok(result.errors.some(x=>x.includes('featured')));assert.ok(result.errors.some(x=>x.includes('removing quote')));assert.ok(result.errors.some(x=>x.includes('inline images')));
});
test('internal link scope excludes other local projects, admin URLs, credentials and non-HTTPS',()=>{
 const local={url:'https://localhost/stovall08/blog'};
 assert.equal(internalUrl('#heading',local),null);
 assert.equal(internalUrl('https://localhost/another-project/',local),null);
 assert.equal(internalUrl('https://localhost/stovall08/blog/wp-admin/',local),null);
 assert.equal(internalUrl('https://u:p@localhost/stovall08/blog/page',local),null);
 assert.equal(internalUrl('http://localhost/stovall08/blog/page',local),null);
 assert.equal(internalUrl('https://localhost/stovall08/blog/page#part',local),'https://localhost/stovall08/blog/page');
});
