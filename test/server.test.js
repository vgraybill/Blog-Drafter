import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { pathToFileURL } from 'node:url';

// A complete HTTP round-trip, with fake HTTPS WordPress responses in the child process.
test('local HTTP workflow enforces review, isolates secrets and creates drafts on two sites',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'wp-publisher-http-'));
 const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
 await cp('src',path.join(root,'src'),{recursive:true});await cp('public',path.join(root,'public'),{recursive:true});await writeFile(path.join(root,'package.json'),'{"type":"module"}');await mkdir(path.join(root,'config'));
 const sites=['a','b'].map(id=>({id,name:id,url:`https://${id}.test.invalid`,group:'A',authorId:7,categoryIds:[12],personalization:{practice_name:`Practice ${id}`}}));
 await writeFile(path.join(root,'config','sites.json'),JSON.stringify(sites));
 const child=spawn(process.execPath,['--import',pathToFileURL(path.resolve('test-support/mock-wordpress.mjs')).href,path.join(root,'src','server.js')],{env:{...process.env,PORT:String(port),WP_A_USERNAME:'test',WP_A_APP_PASSWORD:'private-test-password',WP_B_USERNAME:'test',WP_B_APP_PASSWORD:'private-test-password'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{child.kill();if(child.exitCode===null)await once(child,'exit');assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
 let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);child.stdout.on('data',chunk=>{if(chunk.toString().includes('WordPress Blog Publisher:')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited early: '+stderr));});});
 const base=`http://127.0.0.1:${port}`;
 const session=await (await fetch(`${base}/api/session`)).json();assert.equal(session.sites.length,2);assert.ok(!JSON.stringify(session).includes('private-test-password'));
 assert.equal((await fetch(`${base}/api/session`,{headers:{Origin:'https://evil.invalid'}})).status,403);
 assert.equal((await fetch(`${base}/api/preflight`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 const call=async(route,data)=>{const res=await fetch(`${base}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify(data)});return {status:res.status,data:await res.json()};};
 const image=await call('assets',{base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='});assert.equal(image.status,200);
 const article={id:'http-acceptance',title:'Hello {{practice_name}}',content:'<p>{{practice_name}}</p>{{image:photo}}',excerpt:'',featured:'photo',assets:{photo:{assetId:image.data.assetId,alt:'Practice'}}};
 const preflight=await call('preflight',{article,siteIds:['a','b']});assert.equal(preflight.status,200);assert.ok(preflight.data.results.every(r=>r.ready));
 assert.equal((await call('publish',{planId:preflight.data.planId,confirm:true})).status,400);
 const preview=await call('preview',{planId:preflight.data.planId,siteId:'a'});assert.match(preview.data.content,/Practice a/);
 assert.equal((await call('publish',{planId:preflight.data.planId,confirm:true})).status,400);
 await call('preview',{planId:preflight.data.planId,siteId:'b'});
 const publication=await call('publish',{planId:preflight.data.planId,confirm:true});assert.equal(publication.status,200);assert.deepEqual(publication.data.results.map(r=>r.status),['done','done']);
 assert.equal((await call('publish',{planId:preflight.data.planId,confirm:true})).status,400);
 const search=await call('search',{siteIds:['a','b'],slug:'publisher-http-acceptance'});assert.equal(search.data.results[0].posts[0].status,'draft');assert.equal(search.data.results[1].posts[0].status,'draft');
 const workspace={...article,id:'editorial-acceptance',featured:'',assets:{},editorial:{enabled:true,source:'Approved clinical copy.',ticket:'Preserve clinical copy.',protectedText:'Approved clinical copy.',minimumLinks:1,distinctLinks:true,quotePolicy:'retain',requiredQuoteCount:0,requiredInlineImages:0,requireFeatured:false,approvals:{},variants:{}}};
 for(const id of ['a','b'])workspace.editorial.variants[id]={title:`Version ${id}`,content:`<p>Approved clinical copy.</p><a href="https://${id}.test.invalid/skin/">Skin</a><a href="https://${id}.test.invalid/appointments/">Schedule</a>`,excerpt:'',categoryIds:[13],issues:[],notes:''};
 // Add verified appointment URLs to the isolated site fixture before approval.
 sites.forEach(s=>{s.personalization.appointment_url=`https://${s.id}.test.invalid/appointments/`;});await writeFile(path.join(root,'config','sites.json'),JSON.stringify(sites));
 const candidates=await call('catalog',{siteId:'a'});assert.equal(candidates.data.categories.length,2);assert.equal(candidates.data.pages[0].title,'Skin care');
 const denied=await call('preflight',{article:workspace,siteIds:['a','b']});assert.ok(denied.data.results.every(r=>!r.ready));
 for(const id of ['a','b']){const approval=await call('editorial-approve',{article:workspace,siteId:id,confirm:true});assert.equal(approval.status,200,JSON.stringify(approval.data));workspace.editorial.approvals[id]=approval.data.token;}
 const edited=structuredClone(workspace);edited.editorial.variants.a.title='Unapproved edit';const stale=await call('preflight',{article:edited,siteIds:['a','b']});assert.ok(stale.data.results.every(r=>!r.ready));
 await call('workspace',{article:workspace});const restored=await(await fetch(`${base}/api/session`)).json();assert.equal(restored.article.editorial.source,'Approved clinical copy.');assert.ok(!JSON.stringify(restored).includes('private-test-password'));
 const approved=await call('preflight',{article:workspace,siteIds:['a','b']});assert.ok(approved.data.results.every(r=>r.ready));
 for(const id of ['a','b'])await call('preview',{planId:approved.data.planId,siteId:id});
 const made=await call('publish',{planId:approved.data.planId,confirm:true});assert.deepEqual(made.data.results.map(r=>r.status),['done','done']);
 const personalized=await call('search',{siteIds:['a','b'],slug:'publisher-editorial-acceptance'});assert.ok(personalized.data.results[0].posts.some(p=>p.title==='Version a'));assert.ok(personalized.data.results[1].posts.some(p=>p.title==='Version b'));
 const repeat=await call('preflight',{article,siteIds:['a','b']});await call('preview',{planId:repeat.data.planId,siteId:'b'});await call('preview',{planId:repeat.data.planId,siteId:'a'});const skipped=await call('publish',{planId:repeat.data.planId,confirm:true});assert.deepEqual(skipped.data.results.map(r=>r.status),['skipped','skipped']);
});
