import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reservationReference} from '../packages/evidence/src/reservation';

test('reservation export uses a saved successful receipt without historical log scanning',async()=>{
 const address='0x1111111111111111111111111111111111111111';
 const provider:any={getTransactionReceipt:async()=>({status:1,to:address,hash:'saved',blockNumber:42,blockHash:'block',logs:[{address}]}),getBlockNumber:async()=>{throw Error('Should not scan history')}};
 const registry:any={getAddress:async()=>address,interface:{parseLog:()=>({name:'ClaimReserved',args:{claimId:1n}})}};
 assert.deepEqual(await reservationReference(provider,registry,'1',0,['saved']),{transactionHash:'saved',blockNumber:42,blockHash:'block'});
});

test('missing history falls back to bounded contiguous log ranges',async()=>{
 const ranges:number[][]=[];
 const provider:any={getBlockNumber:async()=>15000};
 const registry:any={filters:{ClaimReserved:()=>({})},queryFilter:async(_:unknown,start:number,end:number)=>{ranges.push([start,end]);assert.ok(end-start<2000);return start<=9000&&end>=9000?[{transactionHash:'found',blockNumber:9000,blockHash:'block'}]:[];}};
 assert.equal((await reservationReference(provider,registry,'1',100)).transactionHash,'found');
 assert.deepEqual(ranges,[[13001,15000],[11001,13000],[9001,11000],[7001,9000]]);
});
