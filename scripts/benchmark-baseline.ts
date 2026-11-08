import {Pool} from 'pg';import {Wallet,hexlify,randomBytes} from 'ethers';import {performance} from 'node:perf_hooks';import {mkdir,writeFile} from 'node:fs/promises';
import {baselineReserve,baselineTransition,type Approval} from '../packages/domain/src/baseline';import {registryDomain,attestationTypes} from '@duplera/domain';
const db=new Pool({connectionString:process.env.DATABASE_URL??'postgres://duplera:duplera@localhost:5432/duplera'}),bytes=()=>hexlify(randomBytes(32));
const owner=Wallet.createRandom(),oracle=Wallet.createRandom(),authority={chainId:31337,verifyingContract:Wallet.createRandom().address,analysisSigner:oracle.address,receiptSigner:new Wallet(bytes())};
const timings:Record<string,number[]>={reserve:[],confirm:[],release:[]};
try{
 await db.query('INSERT INTO baseline_members(wallet) VALUES($1)',[owner.address.toLowerCase()]);
 for(let i=0;i<50;i++){
  const a:Approval={schemaVersion:1,matchingToken:bytes(),evidenceRoot:bytes(),lenderAddress:owner.address,evidenceContext:bytes(),analysisId:bytes(),attestationNonce:bytes(),validUntil:Math.floor(Date.now()/1000)+300};
  const signature=await oracle.signTypedData(registryDomain(31337,authority.verifyingContract),attestationTypes,a);let start=performance.now();const result=await baselineReserve(db,owner.address,a,signature,authority);timings.reserve.push(performance.now()-start);
  for(const action of ['confirm','release'] as const){start=performance.now();await baselineTransition(db,String(result.claim.id),owner.address,action);timings[action].push(performance.now()-start);}
 }
 const results={generatedAt:new Date().toISOString(),samples:50,platform:process.platform,node:process.version,measurement:'Local PostgreSQL adapter elapsed time, includes signature verification and receipt signing for reserve; excludes login/network consensus',operations:Object.fromEntries(Object.entries(timings).map(([k,v])=>{v.sort((a,b)=>a-b);return[k,{medianMs:v[25],p95Ms:v[47]}]}))};
 await mkdir('docs/results',{recursive:true});await writeFile('docs/results/postgres.json',JSON.stringify(results,null,2));console.log(results);
}finally{await db.end()}
