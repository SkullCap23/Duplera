import {JsonRpcProvider,Wallet,ContractFactory,getAddress,formatEther} from 'ethers';
import {readFile} from 'node:fs/promises';
import {loadEnvironment} from './lib/environment';
import {deployResumable} from '../packages/domain/src/deployment';
await loadEnvironment('.local/amoy.env');
const required=['AMOY_RPC_URL','AMOY_DEPLOYER_PRIVATE_KEY','AMOY_ANALYSIS_SIGNER','AMOY_LENDERS'] as const;
const missing=required.filter(k=>!process.env[k]);
if(missing.length){console.error('Amoy configuration missing: '+missing.join(', '));console.error('See docs/AMOY.md. No transactions submitted.');process.exit(1);}
const provider=new JsonRpcProvider(process.env.AMOY_RPC_URL,undefined,{cacheTimeout:-1});
try{
 if(Number((await provider.getNetwork()).chainId)!==80002)throw new Error('Only Polygon Amoy chain 80002 is permitted');
 if(!/^0x[\da-fA-F]{64}$/.test(process.env.AMOY_DEPLOYER_PRIVATE_KEY!))throw new Error('Invalid test administrator key format');
 const deployer=new Wallet(process.env.AMOY_DEPLOYER_PRIVATE_KEY!,provider),signer=getAddress(process.env.AMOY_ANALYSIS_SIGNER!);
 const lenders=process.env.AMOY_LENDERS!.split(',').map(x=>getAddress(x.trim()));if(lenders.length!==3||new Set(lenders).size!==3)throw new Error('Configure three distinct lender addresses');
 if(signer===deployer.address||lenders.includes(signer)||lenders.includes(deployer.address))throw new Error('Use distinct admin, analysis signer and lender accounts');
 const balance=await provider.getBalance(deployer.address);console.log({chainId:80002,deployer:deployer.address,balancePOL:formatEther(balance),analysisSigner:signer,lenders});
 if(balance===0n){console.log('No test POL available. No transactions submitted. Fund the dedicated test administrator using an eligible no-purchase faucet.');process.exitCode=2;}
 else{
 const artifact=JSON.parse(await readFile('artifacts/InvoiceRegistry.json','utf8'));
 const factory=new ContractFactory(artifact.abi,artifact.evm.bytecode.object,deployer),request=await factory.getDeployTransaction(deployer.address,signer),gas=await provider.estimateGas(request),fee=await provider.getFeeData();
 console.log({estimatedDeploymentGas:gas.toString(),estimatedDeploymentPOL:formatEther(gas*(fee.maxFeePerGas??fee.gasPrice??0n)),note:'Membership transactions require additional gas; this is an estimate.'});
 if(process.argv.includes('--check')){console.log('Preflight complete; no transactions submitted.');process.exitCode=0;}
 else{
  const result=await deployResumable({chainId:80002,admin:deployer,analysisSigner:signer,lenders,provider,artifact,journalPath:'.local/amoy-deployment.json',outputPath:'deployments/amoy.json',confirmations:2});
  console.log('Registry deployed or recovered: '+result.address);
 }
 }
}finally{provider.destroy()}
