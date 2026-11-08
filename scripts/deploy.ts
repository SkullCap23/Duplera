import {JsonRpcProvider,ContractFactory,Contract,Wallet,randomBytes,hexlify,getAddress,keccak256} from "ethers";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {readEnvironment} from './lib/environment';
const provider=new JsonRpcProvider("http://127.0.0.1:8545",undefined,{cacheTimeout:-1});
try{await main()}finally{provider.destroy()}
async function main(){
if(Number((await provider.getNetwork()).chainId)!==31337) throw new Error("Local deployment requires chain 31337");
const artifact=JSON.parse(await readFile("artifacts/InvoiceRegistry.json","utf8"));
const env=await readEnvironment('apps/web/.env.local');let previous:any;
try{previous=JSON.parse(await readFile('deployments/local.json','utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
if(previous&&!process.argv.includes('--new')){
 if(previous.chainId!==31337||await provider.getCode(previous.address)==='0x')throw new Error('Saved local deployment is unavailable. Start the original chain, or deliberately choose a new database and run deploy:local -- --new before db:setup.');
 const registry=new Contract(previous.address,artifact.abi,provider);
 if(!env.ANALYSIS_PRIVATE_KEY||getAddress(await registry.analysisSigner())!==new Wallet(env.ANALYSIS_PRIVATE_KEY).address)throw new Error('Existing local deployment signer differs from the environment; refusing to replace secrets');
 if(previous.bytecodeHash&&previous.bytecodeHash!==keccak256('0x'+artifact.evm.bytecode.object))throw new Error('Contract source differs from the current local deployment; use a deliberate new deployment/database');
 console.log('Existing local deployment verified and reused: '+previous.address);return;
}
if(previous&&process.argv.includes('--new')&&!process.env.DATABASE_URL)throw new Error('A deliberate new deployment requires DATABASE_URL for a dedicated database');
const admin=await provider.getSigner(0), signer=Wallet.createRandom();
const registry=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,admin).deploy(await admin.getAddress(),signer.address);
await registry.waitForDeployment();
const lenders=await Promise.all([1,2,3].map(async i=>(await provider.getSigner(i)).getAddress()));
for(const lender of lenders) await (await registry.getFunction("grantLender")(lender)).wait();
const receipt=await registry.deploymentTransaction()!.wait();
const deployment={chainId:31337,address:await registry.getAddress(),lenders,admin:await admin.getAddress(),analysisSigner:signer.address,blockNumber:receipt!.blockNumber,blockHash:receipt!.blockHash,transactionHash:receipt!.hash,compiler:'0.8.38',optimizerRuns:200,evmVersion:'paris',bytecodeHash:keccak256('0x'+artifact.evm.bytecode.object),abi:artifact.abi};
await mkdir("deployments",{recursive:true});
await writeFile("deployments/local.json",JSON.stringify(deployment,null,2));
if(previous){await mkdir('.local/deployment-backups',{recursive:true});const label=Date.now();await writeFile('.local/deployment-backups/'+label+'.json',JSON.stringify(previous,null,2),{flag:'wx',mode:0o600});await writeFile('.local/deployment-backups/'+label+'.env',await readFile('apps/web/.env.local','utf8'),{flag:'wx',mode:0o600});}
await writeFile("apps/web/.env.local",`DATABASE_URL=${process.env.DATABASE_URL??env.DATABASE_URL??'postgres://duplera:duplera@localhost:5432/duplera'}\nRPC_URL=http://127.0.0.1:8545\nCHAIN_ID=31337\nREGISTRY_ADDRESS=${deployment.address}\nANALYSIS_PRIVATE_KEY=${signer.privateKey}\nREGISTRY_SECRET=${hexlify(randomBytes(32))}\nAPP_ORIGIN=${process.env.APP_ORIGIN??env.APP_ORIGIN??'http://localhost:3000'}\n`,{mode:0o600});
console.log("Local registry deployed:",deployment.address,"\nLenders:",lenders,"\nLocal-only service secrets written to ignored apps/web/.env.local");
}
