import {readFile} from 'node:fs/promises';
export async function readEnvironment(filename:string){
 try{const text=await readFile(filename,'utf8');return Object.fromEntries(text.split(/\r?\n/).filter(l=>l.trim()&&!l.trimStart().startsWith('#')).map(l=>{const index=l.indexOf('=');if(index<1)throw new Error('Malformed environment assignment');return [l.slice(0,index).trim(),l.slice(index+1).trim()]}));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e;}
}
export async function loadEnvironment(filename:string){const values=await readEnvironment(filename);for(const [name,value] of Object.entries(values))if(process.env[name]===undefined)process.env[name]=value;}
