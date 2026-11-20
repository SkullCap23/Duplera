import {AsyncLocalStorage} from 'node:async_hooks';
import {JsonRpcProvider} from 'ethers';
const state=globalThis as typeof globalThis & {dupleraRpcMetrics?:AsyncLocalStorage<{calls:number;methods:Record<string,number>}>};
export const rpcMetrics=state.dupleraRpcMetrics??=new AsyncLocalStorage<{calls:number;methods:Record<string,number>}>();
export class MeasuredRpcProvider extends JsonRpcProvider {
 override async send(method:string,params:any):Promise<any>{
  const metrics=rpcMetrics.getStore();if(metrics){metrics.calls++;metrics.methods[method]=(metrics.methods[method]??0)+1;}
  return super.send(method,params);
 }
}
