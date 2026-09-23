import { mkdir, readFile, writeFile, rename, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export class Store {
  constructor(root) { this.root = root; }
  async init() { for (const folder of ['assets','state','logs','articles']) await mkdir(path.join(this.root,folder),{recursive:true}); }
  async read(name, fallback = {}) { try { return JSON.parse(await readFile(path.join(this.root,name),'utf8')); } catch (e) { if(e.code === 'ENOENT') return fallback; throw e; } }
  async write(name, value) { const dest = path.join(this.root,name), temp = `${dest}.${randomUUID()}.tmp`; await writeFile(temp,JSON.stringify(value,null,2)); await rename(temp,dest); }
  async log(event) { await appendFile(path.join(this.root,'logs','events.jsonl'),JSON.stringify({timestamp:new Date().toISOString(),...event})+'\n'); }
}
