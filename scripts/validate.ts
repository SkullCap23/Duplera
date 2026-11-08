import {spawn} from 'node:child_process';import {mkdir,writeFile} from 'node:fs/promises';
const cli=process.env.npm_execpath;if(!cli)throw new Error('Run through npm run validate');
const names=['doctor','compile','typecheck','test','test:contracts','test:baseline','test:deployment','test:projection','build','test:e2e','verify:receipt'];
const checks:{command:string;exitCode:number;elapsedMs:number}[]=[];
for(const name of names){
 const start=Date.now(),args=[cli,'run',name,...(name==='verify:receipt'?['--','.local/receipt-valid.json']:[])];
 const code=await new Promise<number>((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:'inherit',shell:false,env:process.env});child.on('error',reject);child.on('exit',code=>resolve(code??1));});
 checks.push({command:'npm run '+name,exitCode:code,elapsedMs:Date.now()-start});
 await mkdir('docs/results',{recursive:true});await writeFile('docs/results/acceptance.json',JSON.stringify({checkedAt:new Date().toISOString(),complete:checks.length===names.length&&checks.every(c=>c.exitCode===0),checks},null,2));
 if(code!==0){process.exitCode=code;break;}
}
