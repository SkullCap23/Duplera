import {test} from 'node:test';import assert from 'node:assert/strict';
import {retryReadRpc} from '../apps/web/lib/rpc-metrics';
test('transient read failures retry within a finite budget',async()=>{
 let calls=0;assert.equal(await retryReadRpc('eth_call',async()=>{if(++calls<3)throw Object.assign(Error('408'),{code:'SERVER_ERROR'});return '0x1'}),'0x1');assert.equal(calls,3);
 calls=0;await assert.rejects(retryReadRpc('eth_getBlockByNumber',async()=>{calls++;throw Object.assign(Error('offline'),{code:'NETWORK_ERROR'})}));assert.equal(calls,3);
});
test('broadcasts and contract reverts are never automatically retried',async()=>{
 for(const [method,code] of [['eth_sendRawTransaction','NETWORK_ERROR'],['eth_call','CALL_EXCEPTION']]){let calls=0;await assert.rejects(retryReadRpc(method,async()=>{calls++;throw Object.assign(Error('failed'),{code})}));assert.equal(calls,1);}
});
