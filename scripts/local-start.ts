import {spawn,type ChildProcess} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createWriteStream} from 'node:fs';
import {createConnection} from 'node:net';
import {Pool} from 'pg';
import {JsonRpcProvider} from 'ethers';
import {readEnvironment} from './lib/environment';
const root=process.cwd(),children:ChildProcess[]=[];
const tsx=resolve('node_modules/tsx/dist/cli.mjs');
function start(args:string[],cwd=root){const log=createWriteStream('.local/local-runtime.log',{flags:'a'});const child=spawn(process.execPath,args,{cwd,stdio:['ignore','pipe','pipe'],windowsHide:true,env:process.env});child.stdout?.pipe(log,{end:false});child.stderr?.pipe(log,{end:false});child.once('exit',()=>log.end());children.push(child);return child;}
function run(args:string[]){return new Promise<void>((ok,fail)=>{const child=start(args);child.once('exit',code=>code===0?ok():fail(Error('Setup command failed')));child.once('error',fail)});}
async function open(port:number){return new Promise<boolean>(ok=>{const s=createConnection({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();ok(true)});s.once('error',()=>ok(false));});}
async function wait(port:number){for(let i=0;i<60;i++){if(await open(port))return;await new Promise(r=>setTimeout(r,1000));}throw Error('Service did not start: '+port);}
async function stop(){if(children.some(c=>c.spawnargs.includes('scripts/postgres.ts')&&c.exitCode===null))await new Promise<void>(ok=>{const c=spawn(resolve('node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'),['-D',resolve('.local/postgres'),'-m','fast','-w','stop'],{windowsHide:true,stdio:'ignore'});c.once('exit',()=>ok());c.once('error',()=>ok())});for(const child of children.reverse())if(child.exitCode===null)child.kill('SIGTERM');await writeFile('.local/runtime.json',JSON.stringify({stopped:true}));}
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{stop().finally(()=>process.exit(0))});
try{
 await mkdir('.local',{recursive:true});
 const cloud=await readEnvironment('.local/cloud.env');
 for(const key of ['GROQ_API_KEY','GROQ_MODEL','AGENT_PROVIDER','OLLAMA_MODEL','OLLAMA_URL'])if(cloud[key]&&!process.env[key])process.env[key]=cloud[key];
 if(!await open(5432)){start([tsx,'scripts/postgres.ts']);await wait(5432);}
 for(let attempt=0;;attempt++){const pool=new Pool({connectionString:'postgres://duplera:duplera@127.0.0.1:5432/postgres',connectionTimeoutMillis:1000});try{await pool.query('SELECT 1');break}catch(error){if(attempt>=60)throw error;await new Promise(r=>setTimeout(r,1000))}finally{await pool.end()}}
 if(!await open(8545)){start([resolve('node_modules/hardhat/dist/src/cli.js'),'node']);await wait(8545);}
 if(await open(3001))throw Error('Port 3001 is occupied; stop that instance before starting a new one');
 const provider=new JsonRpcProvider('http://127.0.0.1:8545');let reusable=false;
 try{const d=JSON.parse(await readFile('deployments/local.json','utf8'));reusable=Number((await provider.getNetwork()).chainId)===31337&&await provider.getCode(d.address)!=='0x';}catch{}finally{provider.destroy()}
 process.env.APP_ORIGIN='http://localhost:3001';
 if(!reusable){
  const name='duplera_'+Date.now(),pool=new Pool({connectionString:'postgres://duplera:duplera@127.0.0.1:5432/postgres'});
  try{await pool.query('CREATE DATABASE "'+name+'" ENCODING \'UTF8\' TEMPLATE template0 LC_COLLATE \'C\' LC_CTYPE \'C\'')}finally{await pool.end()}
  process.env.DATABASE_URL='postgres://duplera:duplera@127.0.0.1:5432/'+name;
  await run([tsx,'scripts/compile.ts']);await run([tsx,'scripts/deploy.ts','--new']);
 }
 await run([tsx,'scripts/db-setup.ts']);
 const web=start([resolve('node_modules/next/dist/bin/next'),'dev','--webpack','-p','3001'],resolve('apps/web'));
 let ready=false;
 for(let attempt=0;attempt<90;attempt++){
  if(web.exitCode!==null)throw Error('Web server exited before readiness; inspect .local/local-runtime.log');
  try{if((await fetch('http://localhost:3001/api/config',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,1000));
 }
 if(!ready)throw Error('Web server failed HTTP readiness');
 await writeFile('.local/runtime.json',JSON.stringify({root,launcherPid:process.pid,pids:children.filter(c=>c.exitCode===null).map(c=>c.pid),startedAt:new Date().toISOString()}));
 console.log('Local Duplera ready: http://localhost:3001. Previous databases and deployment backups are preserved. Ctrl+C stops child processes.');
 await new Promise(()=>{});
}catch(error){await stop();throw error}
