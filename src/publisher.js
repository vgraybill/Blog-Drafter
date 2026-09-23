import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hash, requiredAssets, render, validateArticle } from './personalize.js';
import { jsonRequest } from './wordpress.js';

export function createPublisher(store, wp) {
  let busy = false;
  async function assetFor(ref) {
    if (!/^[a-f0-9]{64}$/.test(ref?.assetId || '')) throw new Error('Invalid local asset ID.');
    const meta = await store.read(`assets/${ref.assetId}.json`,null);
    if (!meta) throw new Error('Local image is missing. Choose the file again.');
    const bytes = await readFile(path.join(store.root,'assets',ref.assetId));
    if (hash(bytes) !== ref.assetId) throw new Error('Local image changed. Choose the file again.');
    return {...meta,bytes,alt:String(ref.alt || '')};
  }
  async function preflight(article, site) {
    try {
      validateArticle(article);
      const images = {};
      for (const key of requiredAssets(article)) { const a = await assetFor(article.assets[key]); images[key] = {url:`/api/assets/${article.assets[key].assetId}`,alt:a.alt}; }
      const preview = render(article,site,images);
      const user = await wp(site,'users/me?context=edit');
      if (!user.id || !user.capabilities?.edit_posts) throw new Error('Account must have edit_posts permission.');
      if (requiredAssets(article).length && !user.capabilities?.upload_files) throw new Error('Account must have upload_files permission.');
      if (user.id !== site.authorId) {
        if (!user.capabilities?.edit_others_posts) throw new Error('Assigning another author requires edit_others_posts.');
        const author = await wp(site,`users/${site.authorId}?context=edit`);
        if (author.id !== site.authorId) throw new Error('Expected author was not found.');
      }
      for (const id of site.categoryIds) { const category = await wp(site,`categories/${id}`); if(category.id !== id) throw new Error(`Category ${id} was not found.`); }
      const result = {siteId:site.id,ready:true,preview,message:'Ready — read-only checks passed.'};
      await store.log({articleId:article.id,siteId:site.id,operation:'preflight',ready:true});
      return result;
    } catch (e) {
      await store.log({articleId:article?.id,siteId:site.id,operation:'preflight',ready:false,error:e.message});
      return {siteId:site.id,ready:false,message:e.message};
    }
  }
  async function publishSite(article,site,runId) {
    const stateKey = `state/${hash({site:site.id,url:site.url,article:article.id})}.json`;
    const state = await store.read(stateKey,{media:{},post:null});
    const fingerprint = hash({article,site});
    if (state.post?.status === 'done') return {siteId:site.id,...state.post,status:'skipped',message:'Article already created; existing draft was not overwritten.'};
    if (state.fingerprint && state.fingerprint !== fingerprint) throw new Error('Article or site configuration changed after a partial run. Restore the original inputs or reconcile the recorded WordPress items first.');
    if (state.post?.status === 'pending' || state.post?.status === 'unknown') throw new Error('Previous post creation outcome is unknown. Inspect WordPress before another attempt.');
    state.fingerprint = fingerprint;
    const save = () => store.write(stateKey,state);
    const event = details => store.log({runId,articleId:article.id,siteId:site.id,...details});
    const images = {};
    for (const key of requiredAssets(article)) {
      const asset = await assetFor(article.assets[key]);
      const assetKey = hash({file:article.assets[key].assetId,alt:asset.alt});
      let media = state.media[assetKey];
      if (media?.status === 'pending' || media?.status === 'unknown') throw new Error(`Image ${key}: previous upload outcome is unknown. Inspect WordPress and local state before another attempt.`);
      if (media?.id) {
        const existing = await wp(site,`media/${media.id}?context=edit`);
        if (existing.id !== media.id || !/^https:\/\//.test(existing.source_url || '')) throw new Error(`Saved image ${key} cannot be verified.`);
        media.url = existing.source_url;
      } else {
        state.media[assetKey] = {status:'pending'}; await save();
        const form = new FormData();
        form.append('file',new Blob([asset.bytes],{type:asset.type}),`publisher-${article.assets[key].assetId.slice(0,20)}.${asset.extension}`);
        form.append('alt_text',asset.alt);
        form.append('slug',`publisher-${assetKey.slice(0,24)}`);
        let response;
        try { response = await wp(site,'media',{method:'POST',body:form}); }
        catch(e) { state.media[assetKey] = {status:e.unknown ? 'unknown' : 'failed'}; await save(); throw e; }
        if (!Number.isInteger(response.id) || !/^https:\/\//.test(response.source_url || '')) throw new Error('Upload response is incomplete; outcome is unknown.');
        media = state.media[assetKey] = {status:'uploaded',id:response.id,url:response.source_url};
        await save(); await event({operation:'media-upload',asset:key,...media});
      }
      // A separate idempotent metadata update also covers hosts that ignore upload fields.
      await wp(site,`media/${media.id}`,jsonRequest({alt_text:asset.alt}));
      const verified = await wp(site,`media/${media.id}?context=edit`);
      if (verified.alt_text !== asset.alt) throw new Error(`Alt text for ${key} was not preserved by WordPress.`);
      media.status = 'done'; await save();
      images[key] = {url:media.url,alt:asset.alt,id:media.id};
    }
    if (state.post?.status === 'pending' || state.post?.status === 'unknown') throw new Error('Previous post creation outcome is unknown. Inspect WordPress before another attempt.');
    const content = render(article,site,images);
    state.post = {status:'pending'}; await save();
    let post;
    try { post = await wp(site,'posts',jsonRequest({...content,status:'draft',slug:`publisher-${article.id.toLowerCase()}`,author:site.authorId,...(site.categoryIds.length?{categories:site.categoryIds}:{}),...(article.featured ? {featured_media:images[article.featured].id} : {})})); }
    catch(e) { state.post = {status:e.unknown ? 'unknown' : 'failed'}; await save(); throw e; }
    if (!Number.isInteger(post.id)) throw new Error('Post response is incomplete; outcome is unknown.');
    state.post = {status:post.status === 'draft' ? 'done' : 'unknown',id:post.id,url:post.link,editUrl:`${site.url}/wp-admin/post.php?post=${post.id}&action=edit`};
    await save(); await event({operation:'post-create',...state.post});
    if (post.status !== 'draft') throw new Error('WordPress returned a non-draft status. Inspect this site immediately.');
    return {siteId:site.id,...state.post,message:'Draft created.'};
  }
  return {preflight, async publish(article,sites,runId,perSite={}) {
    if (busy) throw new Error('A batch is already running.');
    busy = true;
    try {
      const results = [];
      for (const baseSite of sites) {
        const {article:siteArticle,site}=perSite[baseSite.id]||{article,site:baseSite};
        try { const check = await preflight(siteArticle,site); if(!check.ready) throw new Error(check.message); results.push(await publishSite(siteArticle,site,runId)); }
        catch(e) { await store.log({runId,articleId:article.id,siteId:site.id,operation:'publish-error',error:e.message}); results.push({siteId:site.id,status:'failed',message:e.message}); }
      }
      return results;
    } finally { busy = false; }
  }};
}

