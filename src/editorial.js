import { hash, render, validateArticle, requiredAssets } from './personalize.js';

export function plain(value) {
  return String(value || '').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[0-9a-f]+|[0-9]+);/gi, entity => {
    const names = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
    if (entity.toLowerCase() in names) return names[entity.toLowerCase()];
    const n = entity[2].toLowerCase()==='x' ? parseInt(entity.slice(3),16) : parseInt(entity.slice(2),10);
    return n>0 && n<=0x10ffff ? String.fromCodePoint(n) : '';
  }).replace(/\s+/g,' ').trim();
}
export function editorialFingerprint(article, site) {
  const copy = structuredClone(article);
  if(copy.editorial) delete copy.editorial.approvals;
  return hash({article:copy,site});
}
export function prepareForSite(article, site) {
  if (!article.editorial?.enabled) return {article,site};
  const e=article.editorial, v=e.variants?.[site.id];
  if(!v) throw new Error('Prepare this affiliate version first.');
  if(!Array.isArray(v.categoryIds)||v.categoryIds.some(id=>!Number.isInteger(id)||id<1)) throw new Error('Choose valid category IDs.');
  const prepared={...article,title:v.title,content:v.content,excerpt:v.excerpt||''};
  delete prepared.editorial;
  validateArticle(prepared);
  return {article:prepared,site:{...site,categoryIds:[...new Set(v.categoryIds)]}};
}
export function internalUrl(raw,site) {
  try {
    if(typeof raw!=='string'||!raw.trim()||raw.trim().startsWith('#')) return null;
    const base=new URL(site.url), url=new URL(raw,base.href+'/');
    // Confine local subdirectory installs to their configured WordPress root.
    const prefix=base.pathname.replace(/\/$/,'');
    if(url.protocol!=='https:'||url.origin!==base.origin||url.username||url.password||
       (prefix && url.pathname!==prefix && !url.pathname.startsWith(prefix+'/')) ||
       /\/(wp-admin|wp-login\.php|wp-json)(\/|$)/i.test(url.pathname)) return null;
    url.hash='';return url.href;
  } catch {return null;}
}
export async function inspectEditorial(article,site,fetcher=fetch) {
  const e=article.editorial, {article:a,site:target}=prepareForSite(article,site);
  const errors=[],warnings=[],links=[];
  if(!e?.enabled) return {errors:['Enable editorial preparation first.'],warnings,links};
  if(typeof e.source!=='string'||!e.source.trim()||typeof e.ticket!=='string'||!e.ticket.trim()) errors.push('Add the approved source article and ticket rules.');
  if(!Number.isInteger(e.minimumLinks)||e.minimumLinks<0||e.minimumLinks>30) throw new Error('Required internal links must be between 0 and 30.');
  if(!['retain','omit'].includes(e.quotePolicy)) throw new Error('Choose a quote policy.');
  if(!Number.isInteger(e.requiredQuoteCount)||e.requiredQuoteCount<0||e.requiredQuoteCount>50) throw new Error('Invalid required quote count.');
  if(!Number.isInteger(e.requiredInlineImages)||e.requiredInlineImages<0||e.requiredInlineImages>20) throw new Error('Invalid inline image count.');
  const v=e.variants[site.id];
  if(!Array.isArray(v.issues)||v.issues.some(i=>typeof i.text!=='string'||typeof i.resolution!=='string')) throw new Error('Invalid editorial issues.');
  for(const issue of v.issues) if(issue.text.trim()&&!issue.resolution.trim()) errors.push('Unresolved: '+issue.text);
  const preview=render(a,target,Object.fromEntries(requiredAssets(a).map(k=>[k,{url:'https://images.invalid/'+k,alt:a.assets[k].alt}])));
  const sourceText=plain(e.source), finalText=plain(preview.title+' '+preview.content+' '+preview.excerpt);
  if(typeof e.protectedText!=='string') throw new Error('Protected text must be one exact excerpt per line.');
  for(const line of e.protectedText.split('\n').map(plain).filter(Boolean)) {
    if(!sourceText.includes(line)) errors.push('Protected excerpt is absent from the source: '+line.slice(0,100));
    if(!finalText.includes(line)) errors.push('Protected excerpt changed or missing: '+line.slice(0,100));
  }
  const quoteCount=(a.content.match(/<blockquote\b/gi)||[]).length;
  if(e.quotePolicy==='omit'&&quoteCount) errors.push('This ticket requires removing quote blocks. Check for remaining quoted prose too.');
  if(e.quotePolicy==='retain'&&quoteCount!==e.requiredQuoteCount) errors.push(`Expected ${e.requiredQuoteCount} quote blocks; found ${quoteCount}.`);
  if(quoteCount && (a.content.match(/<!--\s*wp:quote(?:\s|-->)/g)||[]).length!==quoteCount) errors.push('Use native WordPress quote markup (Format quote blocks).');
  if(e.requireFeatured&&!a.featured) errors.push('Select the required featured image.');
  const inlineCount=new Set([...a.content.matchAll(/{{\s*image:([a-z0-9-]+)\s*}}/g)].map(m=>m[1])).size;
  if(inlineCount!==e.requiredInlineImages) errors.push(`Expected ${e.requiredInlineImages} distinct inline images; found ${inlineCount}.`);
  const appointment=site.personalization.appointment_url;
  const decodeAttr=value=>value.replace(/&amp;/g,'&').replace(/&#0*38;/g,'&');
  let appointmentFound=false;const seen=new Map();let internalOccurrences=0;
  const anchors=[...preview.content.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)];
  if(anchors.length>80) throw new Error('Limit article links to 80.');
  for(const m of anchors) {
    const raw=decodeAttr(m[2]);
    if(appointment && raw===String(appointment)){appointmentFound=true;continue;}
    if(!plain(m[3])) {warnings.push('An empty link was excluded.');continue;}
    const url=internalUrl(raw,site);
    if(!url){warnings.push('External or out-of-scope link: '+raw);continue;}
    internalOccurrences++;
    if(!seen.has(url))seen.set(url,{url,text:plain(m[3])});
  }
  if(!appointmentFound) errors.push('Add the configured appointment link to the article.');
  if(seen.size>30) throw new Error('Limit internal destinations to 30 per article.');
  const entries=[...seen.values()];
  async function verify(entry) {
    try {
      const response=await fetcher(entry.url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});
      const ok=response.ok && /text\/html/i.test(response.headers.get('content-type')||'');
      links.push({...entry,ok,status:response.status});
      await response.body?.cancel();
      if(!ok) errors.push('Link is unavailable or not an HTML page: '+entry.url);
    } catch {links.push({...entry,ok:false});errors.push('Link could not be verified (redirects require the final URL): '+entry.url);}
  }
  for(let i=0;i<entries.length;i+=4) await Promise.all(entries.slice(i,i+4).map(verify));
  const count=e.distinctLinks?seen.size:internalOccurrences;
  if(count<e.minimumLinks) errors.push(`Needs ${e.minimumLinks} internal ${e.distinctLinks?'destinations':'links'}, excluding appointment; found ${count}.`);
  return {errors,warnings,links,internalCount:count,quoteCount,inlineCount,preview,categoryIds:target.categoryIds};
}

export async function catalog(site,wp) {
  const result={siteId:site.id,categories:[],pages:[],warnings:[],checkedAt:new Date().toISOString()};
  for(const type of ['categories','pages','posts']) {
    let complete=false;
    for(let page=1;page<=3;page++) {
      try {
        const fields=type==='categories'?'id,name':'id,title,link,excerpt,content';
        const rows=await wp(site,`${type}?per_page=50&page=${page}&${type==='categories'?'':'status=publish&'}_fields=${fields}`);
        if(!Array.isArray(rows)) throw new Error('Unexpected response.');
        for(const row of rows) {
          if(type==='categories') result.categories.push({id:row.id,name:plain(row.name)});
          else if(internalUrl(row.link,site)) result.pages.push({type,id:row.id,title:plain(row.title?.rendered),url:row.link,excerpt:plain(row.content?.rendered||row.excerpt?.rendered).slice(0,1800)});
        }
        if(rows.length<50){complete=true;break;}
      } catch { result.warnings.push(`Could not finish ${type}; review the site's pages manually.`);complete=true;break; }
    }
    if(!complete)result.warnings.push(`${type} limited to 150 entries; this inventory is incomplete.`);
  }
  return result;
}
