import {db,chain,address,HttpError,owned} from "./server";
const actions=new Set(["reserve","confirmFinancing","cancelReservation","releaseFinancing","expireReservation"]);
export async function registerTransaction(wallet:string,hash:string,submissionId?:string){
  const {d,provider,registry}=await chain();
  const tx=await provider.getTransaction(hash);
  if(!tx)throw new HttpError(409,"Transaction is not visible to the configured RPC yet. Retry with the same hash.");
  if(address(tx.from)!==wallet||!tx.to||address(tx.to)!==address(d.address)||Number(tx.chainId)!==d.chainId)throw new HttpError(403,"Transaction sender, destination or network mismatch");
  const parsed=registry.interface.parseTransaction({data:tx.data,value:tx.value});
  if(!parsed||!actions.has(parsed.name))throw new HttpError(400,"Unsupported registry operation");
  let claimId:string|null=null;
  if(parsed.name==="reserve"){
    if(!submissionId)throw new HttpError(400,"Reservation requires its submission");
    const s=await owned(submissionId,wallet),a=parsed.args[0];
    if(a.matchingToken!==s.matching_token||a.evidenceRoot!==s.evidence.root||a.evidenceContext!==s.evidence.context||address(a.lenderAddress)!==wallet)throw new HttpError(409,"Reservation does not bind this submission");
  }else{
    claimId=parsed.args[0].toString();const c=await registry.getClaim(claimId);
    if(parsed.name!=="expireReservation"&&address(c.lender)!==wallet)throw new HttpError(403,"Transaction is not for this lender's claim");
    if(submissionId){const s=await owned(submissionId,wallet);if(c.evidenceRoot!==s.evidence.root||c.evidenceContext!==s.evidence.context)throw new HttpError(409,"Claim and submission differ");}
    else{const matching=await db.query("SELECT id FROM submissions WHERE owner=$1 AND evidence->>'root'=$2 AND evidence->>'context'=$3 LIMIT 1",[wallet,c.evidenceRoot,c.evidenceContext]);submissionId=matching.rows[0]?.id;}
  }
  await db.query("INSERT INTO wallet_transactions(chain_id,registry,tx_hash,owner,submission_id,action,claim_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",[d.chainId,address(d.address),hash,wallet,submissionId??null,parsed.name,claimId]);
  return reconcileTransaction(wallet,hash);
}
export async function reconcileTransaction(wallet:string,hash:string){
  const {d,provider,registry}=await chain();
  const {rows}=await db.query("SELECT * FROM wallet_transactions WHERE chain_id=$1 AND registry=$2 AND tx_hash=$3 AND owner=$4",[d.chainId,address(d.address),hash,wallet]);
  const saved=rows[0];if(!saved)throw new HttpError(404,"Transaction not found");
  const receipt=await provider.getTransactionReceipt(hash);let status="SUBMITTED",claimId=saved.claim_id,blockNumber=null,blockHash=null;
  if(!receipt){
    const canonical=saved.block_number?await provider.getBlock(Number(saved.block_number)):null;
    status=saved.status==='REORGED'||(saved.block_hash&&canonical?.hash!==saved.block_hash)?'REORGED':(await provider.getTransaction(hash))?'SUBMITTED':'UNKNOWN';
  }
  else{
    const block=await provider.getBlock(receipt.blockNumber);
    if(!block||block.hash!==receipt.blockHash)status="REORGED";
    else{
      blockNumber=receipt.blockNumber;blockHash=receipt.blockHash;
      if(receipt.status!==1)status="FAILED";
      else{
        if(saved.action==="reserve"){
          const e=receipt.logs.filter(l=>address(l.address)===address(d.address)).map(l=>{try{return registry.interface.parseLog(l)}catch{return null}}).find(e=>e?.name==="ClaimReserved");
          if(!e)throw new HttpError(409,"Successful receipt lacks the expected reservation event");
          claimId=e.args.claimId.toString();
        }
        status=(await provider.getBlockNumber())-receipt.blockNumber+1>=Number(process.env.CONFIRMATIONS??1)?"CONFIRMED":"INCLUDED";
      }
    }
  }
  await db.query("UPDATE wallet_transactions SET status=$1,claim_id=$2,block_number=$3,block_hash=$4,updated_at=now() WHERE chain_id=$5 AND registry=$6 AND tx_hash=$7 AND owner=$8",[status,claimId,blockNumber,blockHash,d.chainId,address(d.address),hash,wallet]);
  return {hash,action:saved.action,submissionId:saved.submission_id,claimId,status,blockNumber,blockHash};
}
