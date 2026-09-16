import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]))).flat();}
const paths=(await walk('dist')).filter(p=>!p.endsWith('/sw.js')).sort();
const hash=createHash('sha256');for(const p of paths)hash.update(await readFile(p));
const cache=`flow-shell-${hash.digest('hex').slice(0,12)}`;
const assets=paths.map(p=>'/'+p.slice(5));
await writeFile('dist/sw.js',`const CACHE=${JSON.stringify(cache)};
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('flow-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(r=>r.ok?r:caches.match('/index.html')).catch(()=>caches.match('/index.html')));return;
  }
  if(ASSETS.includes(url.pathname))event.respondWith(caches.match(url.pathname).then(r=>r||fetch(event.request)));
});
`);
console.log(`PWA shell: ${assets.length} assets, ${cache}`);
