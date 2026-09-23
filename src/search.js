export async function searchPosts(wp,sites,input) {
  const params=new URLSearchParams({context:'edit',per_page:'100',status:'publish,future,draft,pending,private',orderby:input.dateField==='modified'?'modified':'date',order:'desc'});
  if(input.slug) {if(typeof input.slug!=='string'||input.slug.length>200||/[\s,/?#]/.test(input.slug)) throw new Error('Enter one exact slug, not a URL.');params.set('slug',input.slug);}
  for(const field of ['from','to']) if(input[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(input[field]) || !Number.isFinite(Date.parse(input[field])) || new Date(input[field]).toISOString().slice(0,10)!==input[field])) throw new Error('Invalid date.');
  if(input.from && input.to && input.from>input.to) throw new Error('Start date must precede end date.');
  const prefix=input.dateField==='modified'?'modified_':'';
  // WordPress's REST collection date filters are inclusive and use site-local dates without Z.
  if(input.from) params.set(`${prefix}after`,`${input.from}T00:00:00`);
  if(input.to) params.set(`${prefix}before`,`${input.to}T23:59:59`);
  const results=[];
  for(const site of sites) {
    const posts=[];let truncated=false;
    try {
      for(let page=1;page<=10;page++) {
        params.set('page',String(page));
        let batch;
        try{batch=await wp(site,`posts?${params}`);}catch(e){if(page>1&&e.message.includes('rest_post_invalid_page_number')) break;throw e;}
        if(!Array.isArray(batch)) throw new Error('Malformed search response.');
        for(const p of batch) {
          if(!Number.isInteger(p.id)) throw new Error('Malformed post ID.');
          posts.push({id:p.id,title:p.title?.raw || p.title?.rendered || '(Untitled)',slug:p.slug,status:p.status,date:p.date,modified:p.modified,editUrl:`${site.url}/wp-admin/post.php?post=${p.id}&action=edit`});
        }
        if(batch.length<100) break;
        if(page===10) truncated=true;
      }
      results.push({siteId:site.id,posts,truncated});
    }catch(e){results.push({siteId:site.id,posts,error:e.message});}
  }
  return results;
}
