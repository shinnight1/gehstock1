/* Vollständiger Quellcode + fertige Website + Server, ohne lokale Kontodaten. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { zipSchreiben } from './zip.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'Hideout-Komplett-Online.zip');
const tempRoot=path.resolve(os.tmpdir());
const stage=fs.mkdtempSync(path.join(tempRoot,'hideout-online-paket-'));
const roots=['src','art','docs','tools','netlify','arena','dist','build.mjs','package.json','package-lock.json','netlify.toml','README.md','ONLINE-START.md','.gitignore'];
const excluded=new Set(['node_modules','.git','.local','.netlify','.claude','.codex','dist-types','coverage','.DS_Store']);
function include(source){const rel=path.relative(root,source),parts=rel.split(path.sep),name=path.basename(source);return !parts.some(p=>excluded.has(p)||p.startsWith('.env'))&&!/\.(zip|log|tsbuildinfo|pem|key)$/i.test(name)&&!(parts[0]==='arena'&&parts.includes('dist'));}
try{
  for(const required of ['dist/index.html','dist/games/arena/index.html','netlify/functions/gehstockmon.mjs','netlify/functions/lib/gehstockmon-rules.mjs','ONLINE-START.md']){
    if(!fs.existsSync(path.join(root,required)))throw new Error('Vollständigen Build zuerst ausführen: fehlt '+required);
  }
  for(const name of roots)fs.cpSync(path.join(root,name),path.join(stage,name),{recursive:true,filter:include});
  // Bauen aus einer festen Kopie: parallele Änderungen am Projekt können
  // dadurch nicht Quellcode und ausgelieferte Bundles auseinanderziehen.
  const dependencies=[path.join(stage,'node_modules'),path.join(stage,'arena','node_modules')];
  for(const target of dependencies){
    const source=path.join(root,path.relative(stage,target));
    if(!fs.existsSync(source))throw new Error('Abhängigkeiten fehlen: '+source);
    fs.symlinkSync(source,target,process.platform==='win32'?'junction':'dir');
  }
  try{
    execFileSync(process.execPath,[path.join(stage,'tools','deploy-bauen.mjs')],{cwd:stage,stdio:'inherit'});
    for(const test of ['test.mjs','gehstockmon-tests.mjs','gehstockmon-world-tests.mjs'])execFileSync(process.execPath,[path.join(stage,'tools',test)],{cwd:stage,stdio:'inherit'});
  }finally{
    for(const target of dependencies)if(fs.existsSync(target))fs.unlinkSync(target);
  }
  const result=zipSchreiben(stage,output);
  console.log(JSON.stringify({path:output,files:result.dateien,bytes:result.bytes,megabytes:(result.bytes/1048576).toFixed(2)}));
}finally{
  const target=path.resolve(stage),relative=path.relative(tempRoot,target);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!path.basename(target).startsWith('hideout-online-paket-'))throw new Error('Ungültiger temporärer Paketordner');
  fs.rmSync(target,{recursive:true,force:true});
}
