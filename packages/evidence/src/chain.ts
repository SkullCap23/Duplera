import {Contract,getAddress,type JsonRpcProvider} from 'ethers';
import {z} from 'zod';
import {verifyDisclosure} from './index';
const hex32=z.string().regex(/^0x[\da-fA-F]{64}$/);
export const receiptSchema=z.object({
 chainId:z.number().int().positive(),contractAddress:z.string().refine(v=>{try{getAddress(v);return true}catch{return false}}),
 claimId:z.string().regex(/^[1-9]\d*$/).max(78),schemaVersion:z.literal(1),evidenceContext:hex32,root:hex32,
 transactionHash:hex32,blockReference:z.object({number:z.number().int().nonnegative(),hash:hex32}),
 disclosures:z.array(z.object({value:z.array(z.union([z.string(),z.number()])).length(5),proof:z.array(z.string()).max(64)})).min(1).max(30),
});
export async function verifyChainReceipt(provider:JsonRpcProvider,deployment:{chainId:number;address:string;abi:any[];confirmations?:number},input:unknown){
 const receipt=receiptSchema.parse(input),address=getAddress(deployment.address);
 if(receipt.chainId!==deployment.chainId||getAddress(receipt.contractAddress)!==address)throw new Error('Receipt deployment mismatch');
 if(Number((await provider.getNetwork()).chainId)!==deployment.chainId)throw new Error('RPC chain mismatch');
 const contract=new Contract(address,deployment.abi,provider),claim=await contract.getClaim(receipt.claimId);
 const [tx,block,tip]=await Promise.all([provider.getTransactionReceipt(receipt.transactionHash),provider.getBlock(receipt.blockReference.number),provider.getBlockNumber()]);
 const event=tx?.logs.filter(l=>getAddress(l.address)===address).map(l=>{try{return contract.interface.parseLog(l)}catch{return null}}).find(e=>e?.name==='ClaimReserved'&&e.args.claimId.toString()===receipt.claimId);
 const inclusionVerified=!!tx&&tx.status===1&&!!tx.to&&getAddress(tx.to)===address&&getAddress(tx.from)===getAddress(claim.lender)&&tx.blockNumber===receipt.blockReference.number&&tx.blockHash===receipt.blockReference.hash&&block?.hash===receipt.blockReference.hash&&!!event&&event.args.evidenceRoot===claim.evidenceRoot&&event.args.evidenceContext===claim.evidenceContext&&event.args.matchingToken===claim.matchingToken&&getAddress(event.args.lender)===getAddress(claim.lender);
 const evidenceValid=receipt.root===claim.evidenceRoot&&receipt.evidenceContext===claim.evidenceContext&&receipt.schemaVersion===Number(claim.schemaVersion)&&verifyDisclosure(claim.evidenceRoot,claim.evidenceContext,receipt.schemaVersion,receipt.disclosures);
 const confirmations=inclusionVerified?Math.max(0,tip-receipt.blockReference.number+1):0;
 return {valid:inclusionVerified&&evidenceValid&&confirmations>=(deployment.confirmations??1),inclusionVerified,evidenceValid,confirmations,root:claim.evidenceRoot,context:claim.evidenceContext,claimId:receipt.claimId,meaning:'Committed-field consistency and canonical inclusion; does not establish invoice authenticity.'};
}
