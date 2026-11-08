import {Contract,ContractFactory,Transaction,Wallet,JsonRpcProvider,keccak256,getCreateAddress,getAddress,resolveAddress,type TransactionRequest} from 'ethers';
import {readFile,writeFile,rename,mkdir,unlink} from 'node:fs/promises';import {dirname} from 'node:path';import {randomUUID} from 'node:crypto';
type Settings={chainId:number;admin:Wallet;analysisSigner:string;lenders:string[];provider:JsonRpcProvider;artifact:{abi:any[];evm:{bytecode:{object:string}}};journalPath:string;outputPath:string;confirmations:number;afterBroadcast?:(stage:string)=>Promise<void>};
type Stage={raw:string;hash:string};
type Journal={chainId:number;admin:string;analysisSigner:string;lenders:string[];bytecodeHash:string;stages:Record<string,Stage>;address?:string};
async function atomicJson(path:string,value:unknown){const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600});await rename(temporary,path);}
export async function deployResumable(s:Settings){
 if(Number((await s.provider.getNetwork()).chainId)!==s.chainId)throw new Error('Deployment network mismatch');
 if(!Number.isInteger(s.confirmations)||s.confirmations<1)throw new Error('Invalid confirmations');
 const admin=s.admin.connect(s.provider),analysisSigner=getAddress(s.analysisSigner),lenders=s.lenders.map(getAddress);
 const bytecode='0x'+s.artifact.evm.bytecode.object,expected={chainId:s.chainId,admin:admin.address,analysisSigner,lenders,bytecodeHash:keccak256(bytecode)};
 await mkdir(dirname(s.journalPath),{recursive:true});await mkdir(dirname(s.outputPath),{recursive:true});
 const lock=s.journalPath+'.lock';await writeFile(lock,JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}),{flag:'wx'});
 try{
  let journal:Journal;
  try{journal=JSON.parse(await readFile(s.journalPath,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;journal={...expected,stages:{}};await atomicJson(s.journalPath,journal);}
  for(const key of Object.keys(expected) as (keyof typeof expected)[])if(JSON.stringify(journal[key])!==JSON.stringify(expected[key]))throw new Error('Deployment journal configuration mismatch: '+key);
  async function transaction(stage:string,request:TransactionRequest){
   let saved=journal.stages[stage];
   if(!saved){const populated=await admin.populateTransaction(request);const raw=await admin.signTransaction(populated);saved={raw,hash:keccak256(raw)};journal.stages[stage]=saved;await atomicJson(s.journalPath,journal);}
   const decoded=Transaction.from(saved.raw);
   const expectedTo=request.to?await resolveAddress(request.to,s.provider):null;
   if(decoded.hash!==saved.hash||decoded.from!==admin.address||Number(decoded.chainId)!==s.chainId||decoded.to!==expectedTo||decoded.data!==(request.data??'0x')||decoded.value!==BigInt(request.value??0))throw new Error('Stored signed transaction differs from the expected deployment stage');
   let receipt=await s.provider.getTransactionReceipt(saved.hash);
   if(!receipt){
    if(!await s.provider.getTransaction(saved.hash)){
     if(await s.provider.getTransactionCount(admin.address,'latest')>decoded.nonce)throw new Error('Deployment nonce was used by another transaction; inspect the journal');
     await s.provider.broadcastTransaction(saved.raw);
    }
    await s.afterBroadcast?.(stage);
    receipt=await s.provider.waitForTransaction(saved.hash,s.confirmations,60000);
   }else if(await receipt.confirmations()<s.confirmations){receipt=await s.provider.waitForTransaction(saved.hash,s.confirmations,60000);}
   if(!receipt||receipt.status!==1)throw new Error('Deployment stage failed or timed out: '+stage);
   if((await s.provider.getBlock(receipt.blockNumber))?.hash!==receipt.blockHash)throw new Error('Deployment receipt is not canonical');
   return {receipt,decoded};
  }
  const factory=new ContractFactory(s.artifact.abi,bytecode,admin),request=await factory.getDeployTransaction(admin.address,analysisSigner);
  const deployed=await transaction('deploy',request),address=getCreateAddress({from:admin.address,nonce:deployed.decoded.nonce});
  if(deployed.receipt.contractAddress!==address)throw new Error('Unexpected deployed address');
  journal.address=address;await atomicJson(s.journalPath,journal);
  const contract=new Contract(address,s.artifact.abi,admin),membershipTransactions:string[]=[];
  if(getAddress(await contract.analysisSigner())!==analysisSigner)throw new Error('Deployed analysis signer mismatch');
  for(const lender of lenders){
   const request=await contract.getFunction('grantLender').populateTransaction(lender);const outcome=await transaction('lender:'+lender,request);membershipTransactions.push(outcome.receipt.hash);
   if(!await contract.hasRole(await contract.LENDER_ROLE(),lender))throw new Error('Lender authorisation is missing');
  }
  const result={...expected,address,blockNumber:deployed.receipt.blockNumber,blockHash:deployed.receipt.blockHash,transactionHash:deployed.receipt.hash,membershipTransactions,confirmations:s.confirmations,compiler:'0.8.38',optimizerRuns:200,evmVersion:'paris',abi:s.artifact.abi};
  await atomicJson(s.outputPath,result);return result;
 }finally{await unlink(lock);}
}
