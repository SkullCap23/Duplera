import {readFile,writeFile} from 'node:fs/promises';
import {Contract,JsonRpcProvider,formatEther,getAddress,keccak256} from 'ethers';
import {loadEnvironment} from './lib/environment';

await loadEnvironment('.local/amoy.env');
const deployment=JSON.parse(await readFile('deployments/amoy.json','utf8'));
class VerificationProvider extends JsonRpcProvider {
 override async send(method:string,params:any):Promise<any>{
  for(let attempt=0;;attempt++){
   try{return await super.send(method,params);}
   catch(error){
    if(attempt>=3||!String((error as Error).message).includes('Temporary internal error'))throw error;
    await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
   }
  }
 }
}
const provider=new VerificationProvider(process.env.AMOY_RPC_URL,undefined,{cacheTimeout:-1,batchMaxCount:1});
try {
 const chainId=Number((await provider.getNetwork()).chainId);
 if(chainId!==80002||deployment.chainId!==chainId)throw new Error('Amoy chain mismatch');
 const code=await provider.getCode(deployment.address);
 if(code==='0x')throw new Error('Contract bytecode missing');
 const contract=new Contract(deployment.address,deployment.abi,provider);
 const signer=getAddress(await contract.analysisSigner());
 if(signer!==getAddress(deployment.analysisSigner))throw new Error('Analysis signer mismatch');
 if(!await contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(),deployment.admin))throw new Error('Administrator role missing');
 const lenders=[];
 for(const address of deployment.lenders){
  const authorised=await contract.hasRole(await contract.LENDER_ROLE(),address);
  if(!authorised)throw new Error('Lender role missing: '+address);
  lenders.push({address,authorised});
 }
 const transactions=[];
 for(const hash of [deployment.transactionHash,...deployment.membershipTransactions]){
  const receipt=await provider.getTransactionReceipt(hash);
  if(!receipt||receipt.status!==1)throw new Error('Unsuccessful receipt: '+hash);
  const confirmations=await receipt.confirmations();
  if(confirmations<deployment.confirmations)throw new Error('Insufficient confirmations: '+hash);
  if((await provider.getBlock(receipt.blockNumber))?.hash!==receipt.blockHash)throw new Error('Noncanonical receipt: '+hash);
  transactions.push({hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,confirmations,feePOL:formatEther(receipt.fee)});
 }
 const result={verifiedAt:new Date().toISOString(),chainId,address:deployment.address,runtimeCodeHash:keccak256(code),admin:deployment.admin,analysisSigner:signer,lenders,transactions,remainingAdminBalancePOL:formatEther(await provider.getBalance(deployment.admin))};
 await writeFile('docs/results/amoy-deployment.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
} finally {provider.destroy();}
