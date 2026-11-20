import {randomUUID} from 'node:crypto';
import {db,owned,chain,HttpError,address} from './server';
import {lineage} from './issuance';
import {verifyInvoiceVersion} from '../../../packages/domain/src/issuance';
import {verifyChainReceipt} from '../../../packages/evidence/src/chain';

export const investigationTools=['get_submission','get_analysis','get_lineage','get_claim_status','verify_disclosure'] as const;
export type InvestigationTool=typeof investigationTools[number];
export async function executeInvestigationTool(owner:string,transport:string,tool:string,args:Record<string,unknown>){
 const resource=typeof args.submissionId==='string'?args.submissionId:null;
 let outcome='denied';
 try{
  if(!investigationTools.includes(tool as InvestigationTool))throw new HttpError(400,'Unknown investigation tool');
  if(tool==='verify_disclosure'){
   const {d,provider}=await chain();const result=await verifyChainReceipt(provider,d,args.receipt);outcome='ok';return result;
  }
  if(!resource)throw new HttpError(400,'Submission ID required');
  const s=await owned(resource,owner);
  let result:unknown;
  if(tool==='get_submission')result={sourceId:'submission:'+s.id,invoice:s.original,pdfDigest:s.pdf_digest,issuerDigest:s.issuer_digest??null,assertion:'Submitted fields; not proof of trade authenticity'};
  if(tool==='get_analysis'){
   const a=(await db.query('SELECT id,result,review,created_at FROM analyses WHERE submission_id=$1 AND owner=$2 ORDER BY created_at DESC LIMIT 1',[resource,owner])).rows[0];
   result={sourceId:'analysis:'+resource,analysis:a??null,assertion:'Snapshot only; current chain state takes precedence'};
  }
  if(tool==='get_lineage'){
   let signatureValid=false,registered=false,head=false;
   if(s.issuer_digest){
    const row=(await db.query('SELECT v.package,s.active FROM invoice_versions v JOIN suppliers s ON v.issuer=s.wallet WHERE v.digest=$1',[s.issuer_digest])).rows[0];
    const {d}=await chain();if(row){try{verifyInvoiceVersion(row.package,d.chainId,d.address);signatureValid=true}catch{}registered=!!row.active;}
    const history=await lineage(s.issuer_digest);head=history.at(-1)?.digest===s.issuer_digest;
    result={sourceId:'lineage:'+resource,signatureValid,registered,head,versions:history};
   }else result={sourceId:'lineage:'+resource,signatureValid:false,registered:false,head:false,versions:[],assertion:'Unsigned legacy submission; no verified supplier issuance'};
  }
  if(tool==='get_claim_status'){
   const {registry,provider,d}=await chain(),id=await registry.currentClaim(s.matching_token),status=Number(await registry.getEffectiveStatus(id));
   const block=await provider.getBlock('latest');
   result={sourceId:'chain:'+resource,claimId:id.toString(),state:['NONE','RESERVED','FINANCED','CANCELLED','EXPIRED','RELEASED'][status],active:status===1||status===2,chainId:d.chainId,registry:d.address,observedBlock:block?.number,observedBlockHash:block?.hash};
  }
  outcome='ok';return result;
 }finally{
  await db.query('INSERT INTO tool_audit(id,owner,transport,tool,resource_id,outcome) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),address(owner),transport,tool,resource,outcome]);
 }
}
