import {Wallet,randomBytes,hexlify} from 'ethers';import {mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('.local',{recursive:true});
let accounts:any;
try{accounts=JSON.parse(await readFile('.local/amoy-wallets.json','utf8'));}catch(e){
 if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;
 const make=()=>{const wallet=Wallet.createRandom();return {address:wallet.address,privateKey:wallet.privateKey}};
 accounts={chainId:80002,createdAt:new Date().toISOString(),admin:make(),analysis:make(),lenders:[make(),make(),make()],registrySecret:hexlify(randomBytes(32))};
 await writeFile('.local/amoy-wallets.json',JSON.stringify(accounts,null,2),{flag:'wx',mode:0o600});
}
for(const account of [accounts.admin,accounts.analysis,...accounts.lenders])if(new Wallet(account.privateKey).address!==account.address)throw new Error('Stored account address does not match its key');
const publicAccounts={chainId:80002,admin:accounts.admin.address,analysisSigner:accounts.analysis.address,lenders:accounts.lenders.map((w:any)=>w.address),purpose:'Dedicated synthetic-project test accounts; not funded or deployed by this preparation command'};
await writeFile('.local/amoy-addresses.json',JSON.stringify(publicAccounts,null,2));
try{await writeFile('.local/amoy.env',`AMOY_RPC_URL=https://polygon-amoy.drpc.org\nAMOY_DEPLOYER_PRIVATE_KEY=${accounts.admin.privateKey}\nAMOY_ANALYSIS_SIGNER=${accounts.analysis.address}\nAMOY_LENDERS=${publicAccounts.lenders.join(',')}\n`,{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
console.log(JSON.stringify(publicAccounts,null,2));console.log('Private keys remain in ignored .local files. Re-running preparation reuses these accounts.');
