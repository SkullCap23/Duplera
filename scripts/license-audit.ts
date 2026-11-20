import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const packages:{name:string;version:string;license:string;path:string;notice:string}[]=[];
const seen=new Set<string>();
async function scan(directory:string){
 let entries;try{entries=await readdir(directory,{withFileTypes:true})}catch{return}
 for(const entry of entries){if(entry.name.startsWith('.')||!entry.isDirectory())continue;const path=join(directory,entry.name);if(entry.name.startsWith('@')){await scan(path);continue;}
  try{
   const pkg=JSON.parse(await readFile(join(path,'package.json'),'utf8')),id=pkg.name+'@'+pkg.version;
   if(!seen.has(id)){
    seen.add(id);const files=await readdir(path),texts=[];
    for(const name of files.filter(n=>/^(licen[sc]e|copying|notice)([-_.]|$)/i.test(n)))try{texts.push(name+'\n'+await readFile(join(path,name),'utf8'))}catch{}
    if(!texts.length){const mapped=pkg.name.startsWith('@esbuild/')?'esbuild':pkg.name==='@metamask/abi-utils'?'metamask':pkg.name.startsWith('@napi-rs/canvas-')?'canvas':pkg.name.startsWith('@next/')?'next'+pkg.version.replaceAll('.',''):pkg.name.startsWith('@nomicfoundation/edr-')?'edr':pkg.name.startsWith('@nomicfoundation/solidity-analyzer')?'analyzer':pkg.name==='@openzeppelin/contracts'?'openzeppelin':pkg.name==='client-only'?'client-only':['pg-types','pgpass'].includes(pkg.name)?pkg.name:null;if(mapped)try{texts.push(await readFile('docs/licenses/'+mapped+'.txt','utf8'))}catch{}}
    packages.push({name:pkg.name,version:pkg.version,license:typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license??'UNKNOWN'),path,notice:texts.join('\n\n')});
   }
   await scan(join(path,'node_modules'));
  }catch{}
 }
}
await scan('node_modules');packages.sort((a,b)=>a.name.localeCompare(b.name));await mkdir('docs/results',{recursive:true});
await writeFile('docs/results/dependency-licenses.json',JSON.stringify({generatedAt:new Date().toISOString(),packages:packages.map(({notice,...pkg})=>({...pkg,noticeFound:!!notice})),requiresReview:packages.filter(p=>p.license==='UNKNOWN'||!p.notice).map(p=>p.name)},null,2));
await writeFile('THIRD_PARTY_NOTICES.txt',packages.map(p=>p.name+' '+p.version+'\nDeclared licence: '+p.license+'\n'+(p.notice||'No root-level notice file bundled; consult upstream package licence.')).join('\n\n'+'='.repeat(72)+'\n\n'));
console.log('Inventoried '+packages.length+' installed packages and collected available licence/notice text. Review flags are retained in dependency-licenses.json.');
