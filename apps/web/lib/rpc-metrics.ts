import {AsyncLocalStorage} from 'node:async_hooks';
import {JsonRpcProvider} from 'ethers';
const state=globalThis as typeof globalThis & {dupleraRpcMetrics?:AsyncLocalStorage<{calls:number;methods:Record<string,number>}>};
export const rpcMetrics=state.dupleraRpcMetrics??=new AsyncLocalStorage<{calls:number;methods:Record<string,number>}>();
export async function retryReadRpc<T>(method:string,work:()=>Promise<T>):Promise<T>{
 const safe=/^(eth_get\w+|eth_call|eth_chainId|net_version)$/.test(method);
 for(let attempt=0;;attempt++)try{return await work()}catch(error){
  const code=(error as {code?:string})?.code;
  if(!safe||attempt>=2||!['TIMEOUT','NETWORK_ERROR','SERVER_ERROR'].includes(code??''))throw error;
  await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
 }
}
export class MeasuredRpcProvider extends JsonRpcProvider {
 override async send(method:string,params:any):Promise<any>{
  return retryReadRpc(method,()=>{
   const metrics=rpcMetrics.getStore();if(metrics){metrics.calls++;metrics.methods[method]=(metrics.methods[method]??0)+1;}
   return super.send(method,params);
  });
 }
}
