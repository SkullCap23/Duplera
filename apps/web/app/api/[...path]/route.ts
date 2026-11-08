import {NextResponse} from "next/server";
import {randomUUID,randomBytes} from "node:crypto";
import {verifyMessage,keccak256,toUtf8Bytes} from "ethers";
import {z} from "zod";
import {canonicalise,invoiceSchema,matchingToken,attestationTypes,registryDomain} from "@duplera/domain";
import {compare,isCandidate,REVIEW_THRESHOLD,RULESET} from "@duplera/matching";
import {buildEvidence,disclose,storedEvidenceMatches} from "@duplera/evidence";
import {db,hash,randomHex,chain,actor,lender,signer,HttpError,owned,originCheck,jsonBody,address,deployment,endSession,rateLimit,assertDatabaseScope} from "../../../lib/server";
import {registerTransaction,reconcileTransaction} from "../../../lib/transactions";
import {receiptSchema,verifyChainReceipt} from '../../../../../packages/evidence/src/chain';
import {reservationReference} from '../../../../../packages/evidence/src/reservation';
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{path:string[]}>};
export async function GET(req:Request,ctx:Context){return handle(req,ctx)}
export async function POST(req:Request,ctx:Context){return handle(req,ctx)}
async function handle(req:Request,ctx:Context){try{
  const {path}=await ctx.params, route=path.join("/");
  if(req.method==="POST") originCheck(req);
  if(route==="config" && req.method==="GET") return NextResponse.json(await deployment());
  if(route==="auth/challenge" && req.method==="POST"){
    await assertDatabaseScope();
    const b=await jsonBody(req), wallet=address(z.string().parse(b.wallet));
    const {registry}=await chain();if(!await registry.hasRole(await registry.LENDER_ROLE(),wallet)) throw new HttpError(403,"Unapproved lender");
    await rateLimit("login",wallet,10,300);
    const id=randomUUID(),expires=new Date(Date.now()+300000);
    const message=`Duplera lender login\nOrigin: ${process.env.APP_ORIGIN}\nWallet: ${wallet}\nNonce: ${randomHex()}\nExpires: ${expires.toISOString()}\nChain: ${(await deployment()).chainId}`;
    await db.query("INSERT INTO challenges(id,wallet,message,expires_at) VALUES($1,$2,$3,$4)",[id,wallet,message,expires]);
    return NextResponse.json({id,message});
  }
  if(route==="auth/verify" && req.method==="POST"){
    const b=await jsonBody(req), id=z.uuid().parse(b.id), signature=z.string().max(200).parse(b.signature);
    const {rows}=await db.query("SELECT * FROM challenges WHERE id=$1 AND NOT consumed AND expires_at>now()",[id]);
    const c=rows[0];let recovered="";try{if(c)recovered=address(verifyMessage(c.message,signature))}catch{}
    if(!c || recovered!==c.wallet) throw new HttpError(401,"Invalid login signature");
    const consumed=await db.query("UPDATE challenges SET consumed=true WHERE id=$1 AND NOT consumed RETURNING id",[id]);
    if(!consumed.rowCount) throw new HttpError(401,"Challenge already used");
    const token=randomBytes(32).toString("hex");await db.query("INSERT INTO sessions VALUES($1,$2,$3)",[hash(token),c.wallet,new Date(Date.now()+3600000)]);
    const response=NextResponse.json({wallet:c.wallet});response.cookies.set("duplera-session",token,{httpOnly:true,sameSite:"strict",secure:process.env.APP_ORIGIN?.startsWith("https:"),maxAge:3600,path:"/"});return response;
  }
  if(route==="auth/logout" && req.method==="POST"){
    await endSession();const response=NextResponse.json({ok:true});response.cookies.delete("duplera-session");return response;
  }
  if(route==="verify" && req.method==="POST"){
    const b=receiptSchema.parse(await jsonBody(req));const {registry,d,provider}=await chain();
    if(b.chainId!==d.chainId || address(b.contractAddress)!==address(d.address)) throw new HttpError(400,"Receipt network or contract mismatch");
    const claimId=z.string().regex(/^[1-9]\d*$/).max(78).parse(b.claimId);
    if(BigInt(claimId)>await registry.claimCount())throw new HttpError(404,'Claim not found');
    return NextResponse.json({...await verifyChainReceipt(provider,d,b),source:'live chain'});
  }
  const wallet=await actor();
  if(route==="auth/session"&&req.method==="GET")return NextResponse.json({wallet});
  if(route==='institutions'&&req.method==='GET'){
    const {d,registry}=await chain();const {rows}=await db.query('SELECT synthetic_id,name,wallet FROM institutions WHERE chain_id=$1 AND registry=$2 ORDER BY synthetic_id',[d.chainId,address(d.address)]);
    const role=await registry.LENDER_ROLE();return NextResponse.json(await Promise.all(rows.map(async r=>({...r,approved:await registry.hasRole(role,r.wallet)}))));
  }
  if(path[0]==='claims'&&path.length===2&&req.method==='GET'){
    const id=z.string().regex(/^[1-9]\d*$/).max(78).parse(path[1]),{d,registry,provider}=await chain();
    if(BigInt(id)>await registry.claimCount())throw new HttpError(404,'Claim not found');
    const c=await registry.getClaim(id);if(address(c.lender)!==wallet)throw new HttpError(404,'Claim not found');
    const submitted=await db.query("SELECT id,original,normalised,pdf_digest,matching_token,evidence FROM submissions WHERE owner=$1 AND evidence->>'context'=$2",[wallet,c.evidenceContext]);
    const s=submitted.rows[0];let metadataConsistent=false;
    if(s){try{metadataConsistent=s.matching_token===c.matchingToken&&matchingToken(s.original,process.env.REGISTRY_SECRET??'')===c.matchingToken&&storedEvidenceMatches(s.original,s.pdf_digest,s.evidence,c.evidenceRoot,c.evidenceContext)&&JSON.stringify(canonicalise(s.original))===JSON.stringify(canonicalise(s.normalised));}catch{}}
    const block=await provider.getBlock('latest');
    return NextResponse.json({claimId:id,source:'live chain',chainId:d.chainId,contractAddress:d.address,recordedState:Number(c.state),effectiveState:Number(await registry.getEffectiveStatus(id)),lender:c.lender,evidenceRoot:c.evidenceRoot,evidenceContext:c.evidenceContext,schemaVersion:Number(c.schemaVersion),createdAt:Number(c.createdAt),reservationDeadline:Number(c.reservationDeadline),transitionedAt:Number(c.transitionedAt),observedBlock:{number:block?.number,hash:block?.hash},metadataConsistent,submission:s?{id:s.id,invoice:s.original,pdfDigest:s.pdf_digest}:null});
  }
  if(route==="transactions"&&req.method==="POST"){
    const b=await jsonBody(req);return NextResponse.json(await registerTransaction(wallet,z.string().regex(/^0x[\da-fA-F]{64}$/).parse(b.hash),b.submissionId?z.uuid().parse(b.submissionId):undefined));
  }
  if(route==="transactions"&&req.method==="GET"){
    const {d}=await chain();const {rows}=await db.query("SELECT tx_hash AS hash,submission_id AS \"submissionId\",action,claim_id AS \"claimId\",status,block_number AS \"blockNumber\" FROM wallet_transactions WHERE owner=$1 AND chain_id=$2 AND registry=$3 ORDER BY created_at DESC LIMIT 100",[wallet,d.chainId,address(d.address)]);return NextResponse.json(rows);
  }
  if(path[0]==="transactions"&&path.length===2&&req.method==="GET")return NextResponse.json(await reconcileTransaction(wallet,z.string().regex(/^0x[\da-fA-F]{64}$/).parse(path[1])));
  if(route==="submissions" && req.method==="GET"){
    const {rows}=await db.query("SELECT id,original,created_at FROM submissions WHERE owner=$1 ORDER BY created_at DESC LIMIT 100",[wallet]);return NextResponse.json(rows);
  }
  if(route==="submissions" && req.method==="POST"){
    await lender();const b=await jsonBody(req), invoice=invoiceSchema.parse(b.invoice),key=z.uuid().parse(b.idempotencyKey),digest=z.string().regex(/^[a-f0-9]{64}$/).parse(b.pdfDigest);
    const previous=await db.query("SELECT id,original,pdf_digest FROM submissions WHERE owner=$1 AND idempotency_key=$2",[wallet,key]);
    if(previous.rowCount){if(JSON.stringify(canonicalise(previous.rows[0].original))!==JSON.stringify(canonicalise(invoice))||previous.rows[0].pdf_digest!==digest)throw new HttpError(409,"Idempotency key was used for another submission");return NextResponse.json({id:previous.rows[0].id});}
    await rateLimit('submission',wallet,100,3600);
    const normalised=canonicalise(invoice), token=matchingToken(invoice,process.env.REGISTRY_SECRET??"");
    const evidence=buildEvidence(invoice,digest),id=randomUUID();
    const {rows}=await db.query("INSERT INTO submissions(id,owner,idempotency_key,original,normalised,pdf_digest,matching_token,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(owner,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id,original,pdf_digest",[id,wallet,key,invoice,normalised,digest,token,evidence]);
    if(JSON.stringify(canonicalise(rows[0].original))!==JSON.stringify(normalised)||rows[0].pdf_digest!==digest)throw new HttpError(409,'Idempotency key was used for another submission');return NextResponse.json({id:rows[0].id});
  }
  if(path[0]==="submissions"&&path.length===2&&req.method==="GET"){
    const s=await owned(z.uuid().parse(path[1]),wallet);
    const latest=await db.query("SELECT id,result,review FROM analyses WHERE submission_id=$1 AND owner=$2 ORDER BY created_at DESC LIMIT 1",[s.id,wallet]);
    return NextResponse.json({id:s.id,invoice:s.original,pdfDigest:s.pdf_digest,analysis:latest.rows[0]?{id:latest.rows[0].id,...latest.rows[0].result,review:latest.rows[0].review}:null});
  }
  if(path[0]==="submissions" && path.length===3){
    const id=z.uuid().parse(path[1]),s=await owned(id,wallet);
    if(path[2]==="analyse" && req.method==="POST"){
      await lender();await rateLimit("analysis",wallet,100,3600);const {registry}=await chain(),current=await registry.currentClaim(s.matching_token),status=Number(await registry.getEffectiveStatus(current));
      const pool=await db.query("SELECT id,owner,normalised,pdf_digest,matching_token FROM submissions WHERE id<>$1 ORDER BY created_at DESC LIMIT 10000",[id]);
      const matches=pool.rows.filter(r=>r.matching_token===s.matching_token||isCandidate(s.normalised,r.normalised)).map(r=>({
        relation:r.matching_token===s.matching_token?"EXACT_IDENTITY":"SIMILAR",sameFile:r.pdf_digest===s.pdf_digest,
        ...compare(s.normalised,r.normalised),reference:hash(r.id).slice(0,12)
      })).filter(r=>r.relation==="EXACT_IDENTITY"||r.score>=REVIEW_THRESHOLD).sort((a,b)=>b.score-a.score).slice(0,20);
      const result={ruleset:RULESET,status:status===1||status===2?"ACTIVE_CONFLICT":matches.some(m=>m.relation==="SIMILAR")?"REVIEW_REQUIRED":current>0n?"HISTORICAL_MATCH":"NO_ACTIVE_CONFLICT",claimId:current.toString(),matches,scanned:pool.rows.length,limited:pool.rows.length===10000};
      const analysisId=randomUUID();await db.query("INSERT INTO analyses(id,submission_id,owner,result) VALUES($1,$2,$3,$4)",[analysisId,id,wallet,result]);return NextResponse.json({id:analysisId,...result});
    }
    if(path[2]==="attest" && req.method==="POST"){
      await lender();const b=await jsonBody(req),analysisId=z.uuid().parse(b.analysisId),requestKey=z.uuid().parse(b.idempotencyKey);
      const client=await db.connect();try{
      await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[wallet+requestKey]);
      const previous=await client.query("SELECT * FROM attestation_requests WHERE owner=$1 AND request_key=$2",[wallet,requestKey]);
      if(previous.rowCount){const p=previous.rows[0];if(p.submission_id!==id||p.analysis_id!==analysisId)throw new HttpError(409,"Idempotency key belongs to a different attestation request");await client.query("COMMIT");return NextResponse.json(p.response);}
      const {rows}=await client.query("SELECT * FROM analyses WHERE id=$1 AND submission_id=$2 AND owner=$3 AND created_at>now()-interval '10 minutes'",[analysisId,id,wallet]);
      const a=rows[0];if(!a || a.result.limited) throw new HttpError(409,"Complete analysis required");
      if(a.result.status==="REVIEW_REQUIRED"&&!a.review) throw new HttpError(409,"Record a review disposition first");
      const {registry,provider,d}=await chain(),current=await registry.currentClaim(s.matching_token),status=Number(await registry.getEffectiveStatus(current));
      if(status===1||status===2) throw new HttpError(409,"Active exact claim cannot be overridden");
      if(address(await registry.analysisSigner())!==address(signer().address)) throw new Error("Analysis signer configuration mismatch");
      // Pending headers may have null block numbers, which the ethers Block formatter rejects.
      const [block,pending]=await Promise.all([provider.getBlock('latest'),provider.send('eth_getBlockByNumber',['pending',false]).catch(()=>null)]);if(!block)throw new Error('Chain unavailable');
      const pendingTime=typeof pending?.timestamp==='string'&&/^0x[\da-f]+$/i.test(pending.timestamp)?Number(BigInt(pending.timestamp)):0;
      if(!Number.isSafeInteger(pendingTime))throw new Error('Invalid pending block timestamp');
      const approvalTime=Math.max(block.timestamp,pendingTime,Math.floor(Date.now()/1000));
      const payload={schemaVersion:1,matchingToken:s.matching_token,evidenceRoot:s.evidence.root,lenderAddress:wallet,evidenceContext:s.evidence.context,analysisId:keccak256(toUtf8Bytes(analysisId)),attestationNonce:randomHex(),validUntil:approvalTime+300};
      const signature=await signer().signTypedData(registryDomain(d.chainId,d.address),attestationTypes,payload);
      const response={payload,signature};
      await client.query("INSERT INTO attestations VALUES($1,$2,$3,$4,$5,now())",[randomUUID(),id,wallet,payload,signature]);
      await client.query("INSERT INTO attestation_requests VALUES($1,$2,$3,$4,$5)",[wallet,requestKey,id,analysisId,response]);
      await client.query("COMMIT");return NextResponse.json(response);
      }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
    }
    if(path[2]==="disclosure" && req.method==="POST"){
      const b=await jsonBody(req), claimId=z.string().regex(/^[1-9]\d*$/).parse(b.claimId),paths=z.array(z.string().max(160)).min(1).max(20).parse(b.fields);
      const {registry,provider,d}=await chain(),c=await registry.getClaim(claimId);
      if(address(c.lender)!==wallet || c.evidenceRoot!==s.evidence.root || c.evidenceContext!==s.evidence.context) throw new HttpError(409,"Claim does not bind this submission");
      const block=await provider.getBlock("latest");
      const saved=await db.query("SELECT tx_hash FROM wallet_transactions WHERE chain_id=$1 AND registry=$2 AND owner=$3 AND submission_id=$4 AND action='reserve' AND claim_id=$5",[d.chainId,address(d.address),wallet,id,claimId]);
      const event=await reservationReference(provider,registry,claimId,d.blockNumber,saved.rows.map(row=>row.tx_hash));
      const receipt={chainId:d.chainId,contractAddress:d.address,claimId,schemaVersion:1,evidenceContext:c.evidenceContext,root:c.evidenceRoot,transactionHash:event.transactionHash,blockReference:{number:event.blockNumber,hash:event.blockHash},observedBlock:{number:block?.number,hash:block?.hash},disclosures:disclose(s.evidence.tree,paths)};
      if(!(await verifyChainReceipt(provider,d,receipt)).valid)throw new HttpError(409,'Reservation evidence is not canonically confirmed. Refresh history and retry.');
      return NextResponse.json(receipt);
    }
  }
  if(path[0]==="analyses" && path[2]==="review" && req.method==="POST"){
    const b=await jsonBody(req),disposition=z.string().trim().min(20).max(1000).parse(b.disposition);
    const result=await db.query("UPDATE analyses SET review=$1,reviewed_at=now() WHERE id=$2 AND owner=$3 RETURNING id",[disposition,z.uuid().parse(path[1]),wallet]);if(!result.rowCount) throw new HttpError(404,"Analysis not found");return NextResponse.json({ok:true});
  }
  throw new HttpError(404,"Unknown operation");
}catch(e){
  if(e instanceof HttpError)return NextResponse.json({error:e.message},{status:e.status});
  if(e instanceof z.ZodError || e instanceof SyntaxError)return NextResponse.json({error:"Invalid request",details:e instanceof z.ZodError?e.issues:undefined},{status:400});
  console.error(e);return NextResponse.json({error:"Service unavailable. Check database, RPC and deployment configuration."},{status:503});
}}
