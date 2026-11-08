import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {Wallet,hexlify,randomBytes,verifyMessage} from 'ethers';
import {baselineReserve,baselineTransition,type Approval} from '../packages/domain/src/baseline';
import {attestationTypes,registryDomain} from '@duplera/domain';
const bytes=()=>hexlify(randomBytes(32));
test('PostgreSQL reference enforces approvals, races, replay, expiry and revocation',async()=>{
 const db=new Pool({connectionString:process.env.DATABASE_URL??'postgres://duplera:duplera@localhost:5432/duplera'});
 const lender=Wallet.createRandom(),other=Wallet.createRandom(),oracle=Wallet.createRandom(),receiptSigner=new Wallet(bytes());
 const authority={chainId:31337,verifyingContract:Wallet.createRandom().address,analysisSigner:oracle.address,receiptSigner};
 const domain=registryDomain(authority.chainId,authority.verifyingContract);
 const approval=(token=bytes()):Approval=>({schemaVersion:1,matchingToken:token,evidenceRoot:bytes(),lenderAddress:lender.address,evidenceContext:bytes(),analysisId:bytes(),attestationNonce:bytes(),validUntil:Math.floor(Date.now()/1000)+300});
 async function reserve(a:Approval){return baselineReserve(db,lender.address,a,await oracle.signTypedData(domain,attestationTypes,a),authority)}
 try{
  await db.query('INSERT INTO baseline_members(wallet) VALUES($1),($2)',[lender.address.toLowerCase(),other.address.toLowerCase()]);
  const invalid=approval();await assert.rejects(baselineReserve(db,lender.address,invalid,await other.signTypedData(domain,attestationTypes,invalid),authority));
  await assert.rejects(baselineReserve(db,other.address,invalid,await oracle.signTypedData(domain,attestationTypes,invalid),authority));
  await assert.rejects(reserve({...approval(),validUntil:1}));
  const first=approval(),second=approval(first.matchingToken),race=await Promise.allSettled([reserve(first),reserve(second)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  const winner=race.find(r=>r.status==='fulfilled');assert.equal(winner?.status,'fulfilled');if(winner?.status!=='fulfilled')throw new Error('No winner');
  const {claim,receipt,signature}=winner.value,id=String(claim.id);assert.equal(verifyMessage(JSON.stringify(receipt),signature),receiptSigner.address);
  await assert.rejects(baselineTransition(db,id,other.address,'confirm'));await baselineTransition(db,id,lender.address,'confirm');
  await db.query("UPDATE baseline_claims SET deadline=now()-interval '1 hour' WHERE id=$1",[id]);await assert.rejects(reserve(approval(first.matchingToken)));
  await baselineTransition(db,id,lender.address,'release');
  const consumed=claim.root===first.evidenceRoot?first:second;await assert.rejects(reserve(consumed));
  const old=await reserve(approval(first.matchingToken));await db.query("UPDATE baseline_claims SET deadline=now()-interval '1 second' WHERE id=$1",[old.claim.id]);
  await assert.rejects(baselineTransition(db,String(old.claim.id),lender.address,'confirm'));const replacement=await reserve(approval(first.matchingToken));
  assert.equal((await db.query('SELECT state FROM baseline_claims WHERE id=$1',[old.claim.id])).rows[0].state,'EXPIRED');
  await db.query('UPDATE baseline_members SET approved=false WHERE wallet=$1',[lender.address.toLowerCase()]);
  await assert.rejects(baselineTransition(db,String(replacement.claim.id),lender.address,'confirm'));await assert.rejects(reserve(approval()));
  await baselineTransition(db,String(replacement.claim.id),lender.address,'cancel');
 }finally{await db.end()}
});
