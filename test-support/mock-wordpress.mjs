// Loaded only by isolated integration tests. No real WordPress traffic is sent.
const media=new Map();let mediaId=1,postId=100;const posts=[];
const original=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 const parsed=new URL(url);if(!parsed.hostname.endsWith('.test.invalid'))return original(url,options);
 const endpoint=parsed.pathname.split('/wp-json/wp/v2/')[1];
 let value;
 if(!endpoint)return new Response('<html>Verified mock page</html>',{headers:{'content-type':'text/html'}});
 if(endpoint==='users/me')value={id:7,capabilities:{edit_posts:true,upload_files:true,read_private_posts:true}};
 else if(endpoint==='categories/12')value={id:12,name:'General'};
 else if(endpoint==='categories/13')value={id:13,name:'Skin health'};
 else if(endpoint==='categories')value=[{id:12,name:'General'},{id:13,name:'Skin health'}];
 else if(endpoint==='pages')value=[{id:1,title:{rendered:'Skin care'},link:parsed.origin+'/skin/',content:{rendered:'<p>Skin health education.</p>'}}];
 else if(endpoint==='media'&&options.method==='POST'){const id=mediaId++;value={id,source_url:`${parsed.origin}/uploads/${id}.png`,alt_text:options.body.get('alt_text')};media.set(id,value);}
 else if(endpoint.startsWith('media/')){value=media.get(Number(endpoint.split('/')[1]));if(options.method)value.alt_text=JSON.parse(options.body).alt_text;}
 else if(endpoint==='posts'&&options.method==='POST'){const payload=JSON.parse(options.body);value={...payload,id:postId++,link:`${parsed.origin}/draft`,title:{raw:payload.title},date:'2026-09-17T10:00:00',modified:'2026-09-17T10:00:00'};posts.push({...value,origin:parsed.origin});}
 else if(endpoint==='posts'){value=posts.filter(p=>p.origin===parsed.origin);}
 else return new Response(JSON.stringify({code:'not_found'}),{status:404});
 return new Response(JSON.stringify(value));
};
