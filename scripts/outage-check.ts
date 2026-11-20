import {spawn} from 'node:child_process';import {resolve} from 'node:path';import {writeFile,readFile} from 'node:fs/promises';
const origin='http://127.0.0.1:3002';
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p','3002','-H','127.0.0.1'],{cwd:resolve('apps/web'),windowsHide:true,stdio:'ignore',env:{...process.env,DATABASE_URL:'postgres://unavailable:unavailable@127.0.0.1:1/unavailable',DATABASE_CA_BASE64:'',RPC_URL:'http://127.0.0.1:2',APP_ORIGIN:origin}});
try{
 let ready=false;for(let i=0;i<40;i++){try{if((await fetch(origin+'/api/config')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('Outage fixture did not start');
 const results=[];
 for(const[path,body]of [['auth/challenge',{wallet:'0x70997970C51812dc3A010C7d01b50e0d17dc79C8'}],['verify',JSON.parse(await readFile('.local/receipt-valid.json','utf8'))]] as const){const response=await fetch(origin+'/api/'+path,{method:'POST',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(response.status!==503)throw Error('Outage did not fail closed: '+path);results.push({operation:path,status:response.status,accepted:false});}
 await writeFile('docs/results/outages.json',JSON.stringify({checkedAt:new Date().toISOString(),method:'Separate production app process with unreachable database and RPC; metadata stays available, private login and evidence verification fail closed',results},null,2));console.log('Database and RPC outage fixtures fail closed with HTTP 503.');
}finally{child.kill('SIGTERM');}
