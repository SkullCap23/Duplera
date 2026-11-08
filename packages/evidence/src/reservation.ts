import {Contract,getAddress,type JsonRpcProvider} from 'ethers';

/** Locate the creation event without an unbounded eth_getLogs request. */
export async function reservationReference(provider:JsonRpcProvider,registry:Contract,claimId:string,fromBlock:number,transactionHashes:string[]=[]){
 for(const hash of transactionHashes){
  const receipt=await provider.getTransactionReceipt(hash);
  if(!receipt||receipt.status!==1||!receipt.to||getAddress(receipt.to)!==getAddress(await registry.getAddress()))continue;
  const event=receipt.logs.filter(log=>getAddress(log.address)===getAddress(receipt.to!)).map(log=>{try{return registry.interface.parseLog(log)}catch{return null}}).find(event=>event?.name==='ClaimReserved'&&event.args.claimId.toString()===claimId);
  if(event)return {transactionHash:receipt.hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash};
 }
 const tip=await provider.getBlockNumber();
 // Reverse search supports reservations that were not recorded in application history.
 for(let end=tip;end>=fromBlock;end-=2000){
  const start=Math.max(fromBlock,end-1999);
  const events=await registry.queryFilter(registry.filters.ClaimReserved(claimId),start,end);
  if(events.length>1)throw new Error('Multiple reservation events for one claim');
  if(events.length===1){const event=events[0];return {transactionHash:event.transactionHash,blockNumber:event.blockNumber,blockHash:event.blockHash};}
 }
 throw new Error('Reservation inclusion could not be established');
}
