import {Pool} from "pg";
import {readFile} from "node:fs/promises";
import {readEnvironment} from './lib/environment';import {createHash} from 'node:crypto';import {Wallet,getAddress} from 'ethers';
const env=await readEnvironment('apps/web/.env.local');
const pool=new Pool({connectionString:process.env.DATABASE_URL??env.DATABASE_URL??"postgres://duplera:duplera@localhost:5432/duplera"});
try {
 await pool.query(await readFile('packages/domain/schema.sql','utf8'));
 const file=process.env.DEPLOYMENT_FILE??env.DEPLOYMENT_FILE??'deployments/local.json';let d:any;try{d=JSON.parse(await readFile(file,'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(d){
  const secret=process.env.REGISTRY_SECRET??env.REGISTRY_SECRET,key=process.env.ANALYSIS_PRIVATE_KEY??env.ANALYSIS_PRIVATE_KEY;
  if(!secret||!key)throw new Error('Deployment exists but registry secrets are missing; configure them before binding the database');
  const fingerprint=createHash('sha256').update(secret).digest('hex'),signer=new Wallet(key).address.toLowerCase();
  await pool.query('INSERT INTO registry_configuration(singleton,chain_id,registry,analysis_signer,secret_fingerprint) VALUES(true,$1,$2,$3,$4) ON CONFLICT DO NOTHING',[d.chainId,getAddress(d.address).toLowerCase(),signer,fingerprint]);
  const saved=(await pool.query('SELECT * FROM registry_configuration WHERE singleton')).rows[0];
  if(Number(saved.chain_id)!==d.chainId||saved.registry!==getAddress(d.address).toLowerCase()||saved.analysis_signer!==signer||saved.secret_fingerprint!==fingerprint)throw new Error('Database belongs to another registry or secret. Use its original configuration or a dedicated new database; automatic rebinding is disabled.');
  for(const [i,wallet] of d.lenders.entries())await pool.query('INSERT INTO institutions(chain_id,registry,synthetic_id,name,wallet) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[d.chainId,getAddress(d.address).toLowerCase(),'SYN-LENDER-'+(i+1),'Lender '+String.fromCharCode(65+i)+' (Synthetic)',getAddress(wallet).toLowerCase()]);
  console.log('Database schema ready; registry binding verified and synthetic lenders seeded.');
 }else console.log('Schema ready. Deploy locally, then re-run db:setup to bind this database.');
} finally {await pool.end();}
