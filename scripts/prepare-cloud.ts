import {readFile,writeFile} from 'node:fs/promises';
import {Wallet,getAddress} from 'ethers';

const deployment=JSON.parse(await readFile('deployments/amoy.json','utf8'));
const wallets=JSON.parse(await readFile('.local/amoy-wallets.json','utf8'));
if(deployment.chainId!==80002||getAddress(deployment.analysisSigner)!==new Wallet(wallets.analysis.privateKey).address)throw new Error('Amoy deployment and analysis account do not match');
const contents=[
 '# Private cloud configuration. Never commit or paste this file into chat.',
 '# Fill DATABASE_URL with the Supabase transaction pooler URL (port 6543).',
 '# Fill SETUP_DATABASE_URL with its session pooler URL (port 5432).',
 '# Use URL-encoded database passwords and TLS, e.g. ?sslmode=verify-full.',
 'DATABASE_URL=',
 'SETUP_DATABASE_URL=',
 'APP_ORIGIN=',
 'DEPLOYMENT_FILE=deployments/amoy.json',
 'CHAIN_ID=80002',
 `REGISTRY_ADDRESS=${deployment.address}`,
 'RPC_URL=https://polygon-amoy.drpc.org',
 `ANALYSIS_PRIVATE_KEY=${wallets.analysis.privateKey}`,
 `REGISTRY_SECRET=${wallets.registrySecret}`,
 'CONFIRMATIONS=2',''
].join('\n');
try {
 await writeFile('.local/cloud.env',contents,{flag:'wx',mode:0o600});
 console.log('Created ignored .local/cloud.env with the existing Amoy analysis signer and registry secret. Fill only the connection URLs and application origin locally. No secrets printed.');
} catch(error){
 if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
 console.log('Existing .local/cloud.env preserved.');
}
