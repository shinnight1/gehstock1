/* Lokales Gegenstück zu Netlify Blobs: derselbe Handler, dauerhafte Testwelt. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local/gehstockmon-world.json');
export function transientStore() {
  let data=null, version=0;
  return {
    async getWithMetadata(){return data?{data:structuredClone(data),etag:String(version)}:null;},
    async setJSON(key,next,options={}) {
      if((options.onlyIfNew&&data)||(options.onlyIfMatch!==undefined&&options.onlyIfMatch!==String(version)))return {modified:false};
      data=structuredClone(next);version++;return {modified:true,etag:String(version)};
    }
  };
}
export function devStore() {
  let data = null, version = 0;
  try { const stored = JSON.parse(fs.readFileSync(file, 'utf8')); data = stored.data; version = stored.version; } catch (e) { if (e.code !== 'ENOENT') console.warn('Lokale GehstockMon-Welt wird neu angelegt:', e.message); }
  return {
    async getWithMetadata() { return data ? { data: structuredClone(data), etag: String(version) } : null; },
    async setJSON(key, next, options = {}) {
      if ((options.onlyIfNew && data) || (options.onlyIfMatch !== undefined && options.onlyIfMatch !== String(version))) return { modified: false };
      const nextVersion = version + 1; fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify({ data: next, version: nextVersion })); fs.renameSync(file + '.tmp', file);
      data = structuredClone(next); version = nextVersion; return { modified: true, etag: String(version) };
    }
  };
}
