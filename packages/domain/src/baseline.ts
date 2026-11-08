import type {Pool} from "pg";
import {verifyTypedData,getAddress,Wallet} from "ethers";
import {attestationTypes,registryDomain} from "./index";
export type Approval={schemaVersion:number;matchingToken:string;evidenceRoot:string;lenderAddress:string;evidenceContext:string;analysisId:string;attestationNonce:string;validUntil:number};
export type BaselineAuthority={chainId:number;verifyingContract:string;analysisSigner:string;receiptSigner:Wallet};
const address=(s:string)=>getAddress(s).toLowerCase();
const bytes32=/^0x[\da-fA-F]{64}$/;
// The actor comes from a verified wallet session; approval checks happen inside the adapter.
export async function baselineReserve(db:Pool,actor:string,a:Approval,signature:string,authority:BaselineAuthority){
 const owner=address(actor);
 if(a.schemaVersion!==1||address(a.lenderAddress)!==owner||![a.matchingToken,a.evidenceRoot,a.evidenceContext,a.analysisId,a.attestationNonce].every(v=>bytes32.test(v)&&!/^0x0+$/.test(v)))throw new Error("Invalid approval");
 if(address(verifyTypedData(registryDomain(authority.chainId,authority.verifyingContract),attestationTypes,a,signature))!==address(authority.analysisSigner))throw new Error("Invalid approval signer");
 const c=await db.connect();try{await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[a.matchingToken]);
  const membership=await c.query("SELECT approved FROM baseline_members WHERE wallet=$1 FOR SHARE",[owner]);
  if(!membership.rows[0]?.approved)throw new Error("Unapproved lender");
  const time=await c.query("SELECT floor(extract(epoch FROM clock_timestamp())) AS seconds");
  if(a.validUntil<=Number(time.rows[0].seconds))throw new Error("Expired approval");
  const expired=await c.query("UPDATE baseline_claims SET state='EXPIRED' WHERE token=$1 AND state='RESERVED' AND deadline<=clock_timestamp() RETURNING id",[a.matchingToken]);
  for(const old of expired.rows)await c.query("INSERT INTO baseline_audit(claim_id,actor,action) VALUES($1,$2,'EXPIRED')",[old.id,owner]);
  const result=await c.query("INSERT INTO baseline_claims(token,lender,root,context,schema_version,state,deadline) VALUES($1,$2,$3,$4,$5,'RESERVED',clock_timestamp()+interval '15 minutes') RETURNING *",[a.matchingToken,owner,a.evidenceRoot,a.evidenceContext,a.schemaVersion]);
  const claim=result.rows[0];
  await c.query("INSERT INTO baseline_nonces(nonce,claim_id) VALUES($1,$2)",[a.attestationNonce,claim.id]);
  await c.query("INSERT INTO baseline_audit(claim_id,actor,action) VALUES($1,$2,'RESERVED')",[claim.id,owner]);
  const receipt={adapter:"duplera-postgres-v1",claimId:String(claim.id),token:a.matchingToken,lender:owner,root:a.evidenceRoot,context:a.evidenceContext,schemaVersion:1,deadline:claim.deadline.toISOString()};
  const receiptSignature=await authority.receiptSigner.signMessage(JSON.stringify(receipt));
  await c.query("COMMIT");return {claim,receipt,signature:receiptSignature};
 }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
export async function baselineTransition(db:Pool,id:string,actor:string,action:"confirm"|"cancel"|"release"|"expire"){
 const owner=address(actor),c=await db.connect();try{await c.query("BEGIN");
  const {rows}=await c.query("SELECT *,deadline>clock_timestamp() AS before_deadline FROM baseline_claims WHERE id=$1 FOR UPDATE",[id]);const claim=rows[0];
  if(!claim)throw new Error("Unknown claim");
  if(action!=="expire"&&claim.lender!==owner)throw new Error("Not claim lender");
  if(action==="confirm"){
    const membership=await c.query("SELECT approved FROM baseline_members WHERE wallet=$1 FOR SHARE",[owner]);
    if(!membership.rows[0]?.approved||claim.state!=="RESERVED"||!claim.before_deadline)throw new Error("Invalid transition");
  }
  if(action==="cancel"&&(claim.state!=="RESERVED"||!claim.before_deadline))throw new Error("Invalid transition");
  if(action==="release"&&claim.state!=="FINANCED")throw new Error("Invalid transition");
  if(action==="expire"&&(claim.state!=="RESERVED"||claim.before_deadline))throw new Error("Invalid transition");
  const state={confirm:"FINANCED",cancel:"CANCELLED",release:"RELEASED",expire:"EXPIRED"}[action];
  await c.query("UPDATE baseline_claims SET state=$1 WHERE id=$2",[state,id]);await c.query("INSERT INTO baseline_audit(claim_id,actor,action) VALUES($1,$2,$3)",[id,owner,state]);await c.query("COMMIT");
 }catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
