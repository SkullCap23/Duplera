import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {Wallet,getAddress} from 'ethers';
import {readEnvironment} from './lib/environment';

// Explicitly isolated from apps/web/.env.local and its old local database.
const env=await readEnvironment('.local/cloud.env');
const deployment=JSON.parse(await readFile('deployments/amoy.json','utf8'));
if(!env.SETUP_DATABASE_URL)throw new Error('Fill SETUP_DATABASE_URL in .local/cloud.env before cloud setup');
const url=new URL(env.SETUP_DATABASE_URL);
if(!url.hostname.endsWith('.supabase.co')&&!url.hostname.endsWith('.supabase.com'))throw new Error('Cloud setup requires a Supabase database hostname');
if(url.searchParams.get('sslmode')!=='verify-full')throw new Error('Use sslmode=verify-full for verified TLS');
if(deployment.chainId!==80002||env.CHAIN_ID!=='80002'||getAddress(env.REGISTRY_ADDRESS)!==getAddress(deployment.address))throw new Error('Cloud configuration must match the Amoy deployment');
if(!env.REGISTRY_SECRET||env.REGISTRY_SECRET.length<64||!env.ANALYSIS_PRIVATE_KEY)throw new Error('Missing cloud registry secrets');
const signer=new Wallet(env.ANALYSIS_PRIVATE_KEY).address.toLowerCase();
if(signer!==deployment.analysisSigner.toLowerCase())throw new Error('Analysis signer differs from deployed contract');
const fingerprint=createHash('sha256').update(env.REGISTRY_SECRET).digest('hex');
// Use the CA downloaded from this project's Supabase dashboard; retain hostname verification.
const caPath=resolve('.local/supabase-ca.crt');
await readFile(caPath,'utf8');
url.searchParams.set('sslrootcert',caPath);
const pool=new Pool({connectionString:url.href,max:1,connectionTimeoutMillis:10000});
try {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query(await readFile('packages/domain/schema.sql','utf8'));
  await client.query('INSERT INTO registry_configuration(singleton,chain_id,registry,analysis_signer,secret_fingerprint) VALUES(true,$1,$2,$3,$4) ON CONFLICT DO NOTHING',[80002,deployment.address.toLowerCase(),signer,fingerprint]);
  const saved=(await client.query('SELECT * FROM registry_configuration WHERE singleton')).rows[0];
  if(Number(saved.chain_id)!==80002||saved.registry!==deployment.address.toLowerCase()||saved.analysis_signer!==signer||saved.secret_fingerprint!==fingerprint)throw new Error('Database already belongs to another registry or secrets; refusing rebinding');
  for(const [i,wallet] of deployment.lenders.entries())await client.query('INSERT INTO institutions(chain_id,registry,synthetic_id,name,wallet) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[80002,deployment.address.toLowerCase(),'SYN-LENDER-'+(i+1),'Lender '+String.fromCharCode(65+i)+' (Synthetic)',wallet.toLowerCase()]);
  await client.query(await readFile('scripts/cloud-rls.sql','utf8'));
  await client.query('COMMIT');
  console.log('Supabase schema, Amoy binding, lender directory and RLS applied successfully.');
 } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
} finally{await pool.end();}
