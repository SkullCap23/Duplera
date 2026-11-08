import type {Pool} from 'pg';
import {Contract,type JsonRpcProvider} from 'ethers';
type Deployment={chainId:number;address:string;blockNumber:number;abi:any[]};
export async function replayEvents(db:Pool,provider:JsonRpcProvider,d:Deployment,requestedStart?:number){
 if(Number((await provider.getNetwork()).chainId)!==d.chainId)throw new Error('Projection network mismatch');
 const registry=d.address.toLowerCase(),contract=new Contract(d.address,d.abi,provider),tip=await provider.getBlockNumber();
 const cursor=(await db.query('SELECT * FROM projection_cursors WHERE chain_id=$1 AND registry=$2',[d.chainId,registry])).rows[0];
 let start=requestedStart??d.blockNumber;
 if(requestedStart===undefined&&cursor){const canonical=await provider.getBlock(Number(cursor.block_number));if(canonical?.hash===cursor.block_hash)start=Math.max(d.blockNumber,Number(cursor.block_number)-50);}
 if(!Number.isSafeInteger(start)||start<d.blockNumber)throw new Error('Invalid replay start');
 const connection=await db.connect();let count=0;
 try{
  await connection.query('BEGIN');await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[d.chainId+':'+registry]);
  // Remove orphaned tail events when the chain tip itself has moved backwards.
  await connection.query('DELETE FROM chain_events WHERE chain_id=$1 AND registry=$2 AND block_number>$3',[d.chainId,registry,tip]);
  for(let from=start;from<=tip;from+=500){
   const to=Math.min(tip,from+499),before=await provider.getBlock(to);if(!before?.hash)throw new Error('Canonical block unavailable');
   const logs=await provider.getLogs({address:d.address,fromBlock:from,toBlock:to});
   if((await provider.getBlock(to))?.hash!==before.hash)throw new Error('Chain changed during event read; retry');
   await connection.query('DELETE FROM chain_events WHERE chain_id=$1 AND registry=$2 AND block_number BETWEEN $3 AND $4',[d.chainId,registry,from,to]);
   for(const log of logs){const event=contract.interface.parseLog(log);if(!event)continue;
    if((await provider.getBlock(log.blockNumber))?.hash!==log.blockHash)throw new Error('Orphaned log encountered; retry');
    await connection.query('INSERT INTO chain_events VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING',[d.chainId,registry,log.transactionHash,log.index,log.blockNumber,log.blockHash,event.name,JSON.stringify(event.args,(_,v)=>typeof v==='bigint'?v.toString():v)]);count++;
   }
  }
  const end=await provider.getBlock(tip);if(!end?.hash)throw new Error('Chain tip unavailable');
  await connection.query('INSERT INTO projection_cursors VALUES($1,$2,$3,$4) ON CONFLICT(chain_id,registry) DO UPDATE SET block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash',[d.chainId,registry,tip,end.hash]);
  await connection.query('COMMIT');return {from:start,to:tip,events:count};
 }catch(e){await connection.query('ROLLBACK');throw e}finally{connection.release()}
}
