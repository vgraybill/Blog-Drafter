import http from 'node:http';
import { readFile, writeFile, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Store } from './store.js';
import { hash, validateArticle } from './personalize.js';
import { wp } from './wordpress.js';
import { createPublisher } from './publisher.js';
import { searchPosts } from './search.js';
import { catalog, inspectEditorial, prepareForSite, editorialFingerprint } from './editorial.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const store = new Store(path.join(root,'data'));
await store.init();
const port = Number(process.env.PORT || 3210);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
const origin = `http://127.0.0.1:${port}`;
const csrf = randomUUID();
const plans = new Map();
const approvals = new Map();
const publisher = createPublisher(store,wp);
const lockPath = path.join(store.root,'server.lock');
try {
  const lock = await open(lockPath,'wx'); await lock.writeFile(String(process.pid)); await lock.close();
} catch(e) {
  if (e.code !== 'EEXIST') throw e;
  throw new Error('Another instance may be running. If the previous process crashed, confirm it has stopped, then remove data/server.lock and restart.');
}
function cleanup() { return unlink(lockPath).catch(()=>{}); }
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await cleanup();process.exit(0);});

async function sites() {
  let raw;
  try { raw = JSON.parse(await readFile(path.join(root,'config','sites.json'),'utf8')); }
  catch(e) { if(e.code === 'ENOENT') return []; throw new Error('config/sites.json is not valid JSON.'); }
  if (!Array.isArray(raw)) throw new Error('Site registry must be an array.');
  const seen = new Set(), prefixes = new Set();
  return raw.map(s=>{
    if (!/^[a-z][a-z0-9-]{0,60}$/.test(s.id || '') || seen.has(s.id)) throw new Error('Site IDs must be unique lowercase letters, digits and hyphens.');
    seen.add(s.id);
    const prefix = s.id.replace(/-/g,'_'); if(prefixes.has(prefix)) throw new Error('Credential prefix collision.'); prefixes.add(prefix);
    const url = new URL(s.url);
    if(url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error(`Invalid HTTPS URL for ${s.id}.`);
    if(!Number.isInteger(s.authorId) || s.authorId < 1 || !Array.isArray(s.categoryIds) || !s.categoryIds.every(id=>Number.isInteger(id)&&id>0)) throw new Error(`Invalid author/category IDs for ${s.id}.`);
    if(!s.personalization || typeof s.personalization !== 'object' || Array.isArray(s.personalization) || !Object.values(s.personalization).every(v=>typeof v === 'string' || typeof v === 'number')) throw new Error(`Invalid personalization for ${s.id}.`);
    return {id:s.id,name:String(s.name || s.id),url:url.href.replace(/\/$/,''),group:String(s.group || ''),authorId:s.authorId,categoryIds:s.categoryIds,personalization:s.personalization};
  });
}
function select(all, ids) {
  if(!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id=>!all.some(s=>s.id === id))) throw new Error('Select valid target sites.');
  return ids.map(id=>all.find(s=>s.id === id));
}
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw new Error('JSON request required.');
  let length=0;const chunks=[];
  for await(const chunk of req) { length+=chunk.length;if(length>15*1024*1024) throw new Error('Request exceeds 15 MB.');chunks.push(chunk); }
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('Invalid JSON request.');}
}
function send(res,status,value,type='application/json') { res.writeHead(status,{'Content-Type':type});res.end(type === 'application/json' ? JSON.stringify(value) : value); }
function currentPlan(id) { const plan=plans.get(id);if(!plan || Date.now()>plan.expires) throw new Error('Preflight expired. Run it again.');return plan; }
function imageType(bytes) {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {type:'image/png',extension:'png'};
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255) return {type:'image/jpeg',extension:'jpg'};
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP') return {type:'image/webp',extension:'webp'};
  throw new Error('Choose a JPEG, PNG or WebP image.');
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
  try {
    if(req.headers.host!==`127.0.0.1:${port}` || (req.headers.origin && req.headers.origin!==origin) || req.headers['sec-fetch-site']==='cross-site') return send(res,403,{error:'Local same-origin access required.'});
    const url = new URL(req.url,origin), route=url.pathname;
    if(req.method==='GET') {
      if(route==='/api/session') return send(res,200,{csrf,sites:await sites(),article:await store.read('articles/workspace.json',await store.read('articles/latest.json',null))});
      if(/^\/api\/assets\/[a-f0-9]{64}$/.test(route)) {
        const id=route.split('/').pop(),meta=await store.read(`assets/${id}.json`,null);
        if(!meta) return send(res,404,{error:'Image not found.'});
        return send(res,200,await readFile(path.join(store.root,'assets',id)),meta.type);
      }
      const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript'],'/editorial-ui.js':['editorial-ui.js','text/javascript'],'/styles.css':['styles.css','text/css']};
      if(files[route]) return send(res,200,await readFile(path.join(root,'public',files[route][0])),files[route][1]);
      return send(res,404,{error:'Not found.'});
    }
    if(req.method!=='POST' || req.headers['x-csrf-token']!==csrf) return send(res,403,{error:'Invalid local session. Reload the page.'});
    const input=await body(req);
    if(route==='/api/assets') {
      if(typeof input.base64!=='string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new Error('Invalid image data.');
      const bytes=Buffer.from(input.base64,'base64');if(!bytes.length || bytes.length>10*1024*1024) throw new Error('Images must be between 1 byte and 10 MB.');
      const meta=imageType(bytes),assetId=hash(bytes);
      await writeFile(path.join(store.root,'assets',assetId),bytes);await store.write(`assets/${assetId}.json`,meta);
      return send(res,200,{assetId,...meta});
    }
    if(route==='/api/workspace') {
      const article=input.article;
      validateArticle({...article,title:article?.title||'(Untitled)',content:'<p>Workspace</p>',featured:''});
      if(typeof article.content!=='string'||article.content.length>500000) throw new Error('Invalid shared article content.');
      await store.write('articles/workspace.json',article);
      return send(res,200,{saved:true});
    }
    if(route==='/api/catalog') {
      const site=select(await sites(),[input.siteId])[0];
      return send(res,200,await catalog(site,wp));
    }
    if(route==='/api/editorial-check' || route==='/api/editorial-approve') {
      const site=select(await sites(),[input.siteId])[0];
      const check=await inspectEditorial(input.article,site);
      if(route==='/api/editorial-approve') {
        if(input.confirm!==true) throw new Error('Confirm review of this affiliate first.');
        if(check.errors.length) throw new Error('Resolve all editorial checks before approval.');
        const prepared=prepareForSite(input.article,site);
        const connection=await publisher.preflight(prepared.article,prepared.site);
        if(!connection.ready) throw new Error(connection.message);
        for(const [key,a] of approvals) if(a.expires<Date.now()) approvals.delete(key);
        if(approvals.size>=100) approvals.delete(approvals.keys().next().value);
        const token=randomUUID();approvals.set(token,{fingerprint:editorialFingerprint(input.article,site),expires:Date.now()+15*60*1000});
        return send(res,200,{...check,token});
      }
      return send(res,200,check);
    }
    if(route==='/api/preflight') {
      const article=input.article,targets=select(await sites(),input.siteIds),results=[];
      validateArticle(article?.editorial?.enabled?{...article,content:'<p>Affiliate versions</p>',featured:''}:article);
      const perSite={};
      for(const site of targets) {
        try {
          if(article.editorial?.enabled) {
            const approval=approvals.get(article.editorial.approvals?.[site.id]);
            if(!approval || approval.expires<Date.now() || approval.fingerprint!==editorialFingerprint(article,site)) throw new Error('Review and approve the current affiliate version (approvals expire after 15 minutes).');
          }
          const prepared=prepareForSite(article,site);perSite[site.id]=prepared;
          results.push(await publisher.preflight(prepared.article,prepared.site));
        } catch(e) {results.push({siteId:site.id,ready:false,message:e.message});}
      }
      await store.write('articles/workspace.json',article);await store.write('articles/latest.json',article);await store.write(`articles/${article.id}.json`,article);
      const id=randomUUID();
      for(const [key,plan] of plans) if(Date.now()>plan.expires) plans.delete(key);
      if(plans.size>100) plans.delete(plans.keys().next().value);
      plans.set(id,{article,targets,perSite,results,reviewed:[],expires:Date.now()+15*60*1000});
      return send(res,200,{planId:id,results});
    }
    if(route==='/api/preview') {
      const plan=currentPlan(input.planId),result=plan.results.find(r=>r.siteId===input.siteId&&r.ready);
      if(!result) throw new Error('Choose a ready site to preview.');
      if(!plan.reviewed.includes(input.siteId)) plan.reviewed.push(input.siteId);return send(res,200,result.preview);
    }
    if(route==='/api/publish') {
      const plan=currentPlan(input.planId);
      if(input.confirm!==true || plan.results.some(r=>r.ready&&!plan.reviewed.includes(r.siteId))) throw new Error('Review every ready affiliate preview and explicitly confirm first.');
      const fresh=select(await sites(),plan.targets.map(s=>s.id));
      if(hash(fresh)!==hash(plan.targets)) throw new Error('Site configuration changed. Run preflight again.');
      const ready=plan.targets.filter(s=>plan.results.some(r=>r.siteId===s.id&&r.ready));
      if(!ready.length) throw new Error('No ready sites.');
      if(plan.article.editorial?.enabled) for(const site of ready) {
        const approval=approvals.get(plan.article.editorial.approvals?.[site.id]);
        if(!approval || approval.expires<Date.now() || approval.fingerprint!==editorialFingerprint(plan.article,site)) throw new Error('Editorial approval expired or changed. Approve again and rerun preflight.');
      }
      plans.delete(input.planId);
      const runId=randomUUID(),results=await publisher.publish(plan.article,ready,runId,plan.perSite);
      for(const result of plan.results.filter(r=>!r.ready)) results.push({siteId:result.siteId,status:'failed',message:result.message});
      return send(res,200,{runId,results});
    }
    if(route==='/api/search') return send(res,200,{results:await searchPosts(wp,select(await sites(),input.siteIds),input)});
    return send(res,404,{error:'Not found.'});
  } catch(e) { send(res,400,{error:e.code ? 'Local file operation failed. Check file permissions and configuration.' : e.message}); }
});
server.on('error',async e=>{console.error(e.message);await cleanup();process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log(`WordPress Blog Publisher: ${origin}\nDraft-only mode. Configure config/sites.json and .env before connecting.`));
