import {readFile,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {readEnvironment} from './lib/environment';
import {databaseConfig} from '../apps/web/lib/database-config';

const env=await readEnvironment('.local/cloud.env');
const ca=Buffer.from(await readFile('.local/supabase-ca.crt')).toString('base64');
const pool=new Pool({...databaseConfig(env.DATABASE_URL,ca),max:1,connectionTimeoutMillis:10000});
try {
 const binding=(await pool.query('SELECT chain_id,registry FROM registry_configuration WHERE singleton')).rows[0];
 if(Number(binding?.chain_id)!==80002||binding.registry!==env.REGISTRY_ADDRESS.toLowerCase())throw new Error('Hosted registry binding mismatch');
}finally{await pool.end();}
const keys=['DATABASE_URL','DEPLOYMENT_FILE','CHAIN_ID','REGISTRY_ADDRESS','RPC_URL','ANALYSIS_PRIVATE_KEY','REGISTRY_SECRET','CONFIRMATIONS'];
const values=keys.map(key=>{
 if(!env[key]||/[\r\n]/.test(env[key]))throw new Error('Missing or invalid '+key);
 return key+'='+env[key];
});
values.push('DATABASE_CA_BASE64='+ca);
if(env.APP_ORIGIN)values.push('APP_ORIGIN='+env.APP_ORIGIN);
await writeFile('.local/vercel.env',values.join('\n')+'\n',{mode:0o600});
console.log('Verified the production database TLS configuration and wrote ignored .local/vercel.env. Import this file into Vercel only; never commit or share its contents in chat.');
if(!env.APP_ORIGIN)console.log('APP_ORIGIN is intentionally omitted until Vercel assigns the production domain. Set it and redeploy before wallet login.');
