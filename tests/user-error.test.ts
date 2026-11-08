import {test} from 'node:test';
import assert from 'node:assert/strict';
import {userErrorMessage} from '../apps/web/lib/user-error';

test('nested wallet rejection and pending requests give actionable messages',()=>{
 assert.match(userErrorMessage({code:'UNKNOWN_ERROR',error:{code:4001}}),/cancelled/);
 assert.match(userErrorMessage({info:{error:{code:-32002}}}),/already open/);
});
test('ambiguous send failure does not expose RPC payloads or claim the transaction was not sent',()=>{
 const message=userErrorMessage({code:'UNKNOWN_ERROR',error:{code:-32603,message:'Internal JSON-RPC error.'},message:'payload={eth_sendTransaction:0x929bd5cd}'});
 assert.match(message,/may already have been submitted/);
 assert.doesNotMatch(message,/payload|929bd5cd|eth_sendTransaction/);
});
test('validation messages remain useful while unclassified technical payloads are hidden',()=>{
 assert.equal(userErrorMessage(new Error('Switch your wallet to chain 80002.')),'Switch your wallet to chain 80002.');
 assert.doesNotMatch(userErrorMessage(new Error('RPC payload=secret-calldata')),/secret-calldata/);
});
