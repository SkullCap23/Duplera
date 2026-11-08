/** Keep provider payloads and calldata out of user-facing notices. */
export function userErrorMessage(error:unknown):string {
 const nodes:Record<string,unknown>[]=[],seen=new Set<unknown>();
 function visit(value:unknown,depth=0){
  if(!value||typeof value!=='object'||seen.has(value)||depth>5)return;
  seen.add(value);const node=value as Record<string,unknown>;nodes.push(node);
  for(const key of ['error','info','cause','originalError','data'])visit(node[key],depth+1);
 }
 visit(error);
 const has=(...codes:(string|number)[])=>nodes.some(node=>codes.includes(node.code as string|number));
 if(has('ACTION_REJECTED',4001))return 'Wallet request cancelled. Your draft is retained.';
 if(has(-32002))return 'A wallet request is already open. Open MetaMask and complete or cancel it before trying again.';
 if(has('INSUFFICIENT_FUNDS'))return 'Not enough test POL for the network fee. Check your Amoy wallet balance.';
 if(has('UNKNOWN_ERROR',-32603))return 'The wallet or network could not complete the request. Check MetaMask Activity and refresh the claim before retrying; the transaction may already have been submitted.';
 if(has('CALL_EXCEPTION'))return 'The contract rejected this operation. Refresh the claim and check its current state, ownership and reservation deadline.';
 if(has('TIMEOUT','NETWORK_ERROR','SERVER_ERROR'))return 'The network is taking too long or is unavailable. Check MetaMask Activity and refresh the claim before retrying.';
 const message=error instanceof Error?error.message:'';
 if(!message||message.length>300||/0x[\da-f]{40,}|payload=|jsonrpc|could not coalesce|eth_sendTransaction/i.test(message))return 'The operation could not be completed. Refresh the claim and check MetaMask Activity before retrying.';
 return message;
}
