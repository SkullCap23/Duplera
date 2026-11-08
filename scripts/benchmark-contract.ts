import {readFile,writeFile,mkdir} from 'node:fs/promises';import {performance} from 'node:perf_hooks';
import {JsonRpcProvider,ContractFactory,Contract,Wallet,randomBytes,hexlify} from 'ethers';
import {registryDomain,attestationTypes} from '@duplera/domain';
const provider=new JsonRpcProvider('http://127.0.0.1:8545',undefined,{cacheTimeout:-1});
try{
 if(Number((await provider.getNetwork()).chainId)!==31337)throw new Error('Local benchmark only');
 const artifact=JSON.parse(await readFile('artifacts/InvoiceRegistry.json','utf8')),admin=await provider.getSigner(0),lender=await provider.getSigner(1),oracle=Wallet.createRandom();
 const deployed=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,admin).deploy(await admin.getAddress(),oracle.address);await deployed.waitForDeployment();
 const d=await deployed.getAddress(),adminContract=new Contract(d,artifact.abi,admin),c=adminContract.connect(lender) as Contract;
 await(await adminContract.grantLender(await lender.getAddress())).wait();
 const measures:Record<string,{ms:number[];gas:number[]}>=Object.fromEntries(['reserve','confirm','release'].map(k=>[k,{ms:[],gas:[]}])),bytes=()=>hexlify(randomBytes(32));
 for(let i=0;i<20;i++){
  const block=await provider.getBlock('latest'),a={schemaVersion:1,matchingToken:bytes(),evidenceRoot:bytes(),lenderAddress:await lender.getAddress(),evidenceContext:bytes(),analysisId:bytes(),attestationNonce:bytes(),validUntil:block!.timestamp+300},signature=await oracle.signTypedData(registryDomain(31337,d),attestationTypes,a);
  let start=performance.now(),tx=await c.reserve(a,signature),receipt=await tx.wait();measures.reserve.ms.push(performance.now()-start);measures.reserve.gas.push(Number(receipt.gasUsed));const id=await c.currentClaim(a.matchingToken);
  for(const [label,action] of [['confirm','confirmFinancing'],['release','releaseFinancing']]){start=performance.now();tx=await c[action](id);receipt=await tx.wait();if(receipt.status!==1)throw new Error('Benchmark transaction failed');measures[label].ms.push(performance.now()-start);measures[label].gas.push(Number(receipt.gasUsed));}
 }
 const percentile=(v:number[],fraction:number)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(v.length*fraction))];
 const results={generatedAt:new Date().toISOString(),chainId:31337,samples:20,node:process.version,platform:process.platform,scope:'Local auto-mined EVM JSON-RPC submission to inclusion; includes gas estimation and local RPC; excludes login, PDF analysis and public-network consensus',operations:Object.fromEntries(Object.entries(measures).map(([k,v])=>[k,{medianMs:percentile(v.ms,.5),p95Ms:percentile(v.ms,.95),medianGas:percentile(v.gas,.5)}]))};
 await mkdir('docs/results',{recursive:true});await writeFile('docs/results/local-evm.json',JSON.stringify(results,null,2));console.log(results);
}finally{provider.destroy()}
