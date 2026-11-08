import {readFile} from 'node:fs/promises';import {JsonRpcProvider,getAddress} from 'ethers';import {receiptSchema,verifyChainReceipt} from '../packages/evidence/src/chain';
const filename=process.argv[2];if(!filename)throw new Error('Usage: npm run verify:receipt -- path/to/disclosure.json; set RPC_URL and DEPLOYMENT_FILE independently');
const raw=await readFile(filename,'utf8');if(Buffer.byteLength(raw)>30000)throw new Error('Disclosure package exceeds 30 KB');
const receipt=receiptSchema.parse(JSON.parse(raw)),d=JSON.parse(await readFile(process.env.DEPLOYMENT_FILE??'deployments/local.json','utf8'));
if(receipt.chainId!==d.chainId||getAddress(receipt.contractAddress)!==getAddress(d.address))throw new Error('Package differs from independently configured deployment');
const provider=new JsonRpcProvider(process.env.RPC_URL??'http://127.0.0.1:8545',undefined,{cacheTimeout:-1});
try{
 if(Number((await provider.getNetwork()).chainId)!==d.chainId)throw new Error('RPC chain mismatch');
 const result=await verifyChainReceipt(provider,{...d,confirmations:Number(process.env.CONFIRMATIONS??1)},receipt);
 console.log(JSON.stringify({...result,source:'Independent RPC and local proof verification; no application API or database'},null,2));if(!result.valid)process.exitCode=1;
}finally{provider.destroy()}
