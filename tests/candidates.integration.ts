import {test} from 'node:test';import assert from 'node:assert/strict';
import {Pool} from 'pg';import {randomUUID} from 'node:crypto';
import {readEnvironment} from '../scripts/lib/environment';
import {retrieveCandidates} from '../packages/domain/src/candidates';
const env=await readEnvironment('apps/web/.env.local');
test('indexed retrieval finds old raw digests outside identity/date scopes beyond 10,000 newer rows',async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL??env.DATABASE_URL}),client=await pool.connect();
 try{
  await client.query('BEGIN');const old=randomUUID(),owner='candidate-test-'+randomUUID();
  const invoice={supplierCountry:'IN',supplierIdentifierType:'SYNTHETIC_TAX_ID',supplierIdentifier:'OLD',supplierName:'Old',buyerIdentifier:'OLD',buyerName:'Old',invoiceNumberNamespace:'FY',invoiceNumber:'OLD',invoiceDate:'2000-01-01',currency:'INR',amountMinor:'100',description:'Synthetic'};
  await client.query('INSERT INTO submissions(id,owner,idempotency_key,original,normalised,pdf_digest,matching_token,evidence,created_at) VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8)',[old,owner,randomUUID(),invoice,'a'.repeat(64),'old-token',{},'2000-01-01']);
  await client.query(`INSERT INTO submissions(id,owner,idempotency_key,original,normalised,pdf_digest,matching_token,evidence) SELECT gen_random_uuid(),$1,gen_random_uuid(),$2::jsonb,$2::jsonb,'different','different','{}'::jsonb FROM generate_series(1,10010)`,[owner,{...invoice,invoiceDate:'2026-11-20'}]);
  const result=await retrieveCandidates(client,{...invoice,supplierIdentifier:'NEW',buyerIdentifier:'NEW',invoiceDate:'2026-11-20'},'a'.repeat(64),randomUUID(),'new-token');
  assert.ok(result.some(r=>r.id===old));
  const indexes=(await client.query("SELECT indexname FROM pg_indexes WHERE tablename='submissions'")).rows.map(r=>r.indexname);assert.ok(indexes.includes('submissions_digest_idx'));assert.ok(indexes.includes('submissions_date_idx'));
 }finally{await client.query('ROLLBACK');client.release();await pool.end()}
});
