import {Pool} from "pg";
import {Contract,JsonRpcProvider,Wallet,getAddress} from "ethers";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {createHash,randomBytes} from "node:crypto";
import {cookies} from "next/headers";
const globalDb=globalThis as typeof globalThis & {dupleraPool?:Pool;dupleraRpc?:{url:string;provider:JsonRpcProvider}};
export const db=globalDb.dupleraPool??new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:3000});
globalDb.dupleraPool=db;
export const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
export const randomHex=()=>"0x"+randomBytes(32).toString("hex");
export async function deployment(){
  const filename=process.env.DEPLOYMENT_FILE??"deployments/local.json";
  const d=JSON.parse(await readFile(resolve(process.cwd(),"../..",filename),"utf8"));
  if(process.env.REGISTRY_ADDRESS && address(process.env.REGISTRY_ADDRESS)!==address(d.address))throw new Error("Deployment address mismatch");
  if(process.env.CHAIN_ID && Number(process.env.CHAIN_ID)!==d.chainId)throw new Error("Deployment chain mismatch");
  const confirmations=Number(process.env.CONFIRMATIONS??1);if(!Number.isInteger(confirmations)||confirmations<1||confirmations>64)throw new Error('Invalid confirmation policy');
  return {...d,confirmations};
}
export async function chain(){
  const d=await deployment(); const url=process.env.RPC_URL??"http://127.0.0.1:8545";
  if(globalDb.dupleraRpc?.url!==url){globalDb.dupleraRpc?.provider.destroy();globalDb.dupleraRpc={url,provider:new JsonRpcProvider(url,undefined,{cacheTimeout:-1})};}
  const provider=globalDb.dupleraRpc.provider;
  if(Number((await provider.getNetwork()).chainId)!==d.chainId) throw new Error("RPC network mismatch");
  if(await provider.getCode(d.address)==="0x") throw new Error("Registry is not deployed on configured network");
  return {d,provider,registry:new Contract(d.address,d.abi,provider)};
}
export async function actor(){
  await assertDatabaseScope();
  const session=(await cookies()).get("duplera-session")?.value;
  if(!session) throw new HttpError(401,"Connect and sign in with your lender wallet");
  const {rows}=await db.query("SELECT wallet FROM sessions WHERE token_hash=$1 AND expires_at>now()",[hash(session)]);
  if(!rows.length) throw new HttpError(401,"Session expired");
  return rows[0].wallet as string;
}
export async function assertDatabaseScope(){
 const d=await deployment(),configured=(await db.query('SELECT * FROM registry_configuration WHERE singleton')).rows[0];
 if(!configured||Number(configured.chain_id)!==d.chainId||configured.registry!==address(d.address)||configured.analysis_signer!==address(signer().address)||configured.secret_fingerprint!==hash(process.env.REGISTRY_SECRET??''))throw new Error('Database/deployment binding mismatch. Run db:setup with the original configuration or use a dedicated database.');
}
export async function endSession(){const token=(await cookies()).get("duplera-session")?.value;if(token)await db.query("DELETE FROM sessions WHERE token_hash=$1",[hash(token)]);}
export async function lender(){const wallet=await actor(); const {registry}=await chain(); if(!await registry.hasRole(await registry.LENDER_ROLE(),wallet)) throw new HttpError(403,"Wallet is not an approved lender"); return wallet;}
export function signer(){if(!process.env.ANALYSIS_PRIVATE_KEY) throw new Error("Analysis signer unavailable");return new Wallet(process.env.ANALYSIS_PRIVATE_KEY);}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export async function owned(id:string,wallet:string){
  const {rows}=await db.query("SELECT * FROM submissions WHERE id=$1 AND owner=$2",[id,wallet]);
  if(!rows.length) throw new HttpError(404,"Submission not found");return rows[0];
}
export function originCheck(req:Request){if(req.headers.get("origin")!==process.env.APP_ORIGIN) throw new HttpError(403,"Invalid request origin");}
export async function jsonBody(req:Request){
  if(Number(req.headers.get("content-length"))>30000)throw new HttpError(413,"Request too large");
  const reader=req.body?.getReader();if(!reader)throw new HttpError(400,"JSON body required");let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>30000){await reader.cancel();throw new HttpError(413,"Request too large");}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export const address=(s:string)=>{try{return getAddress(s).toLowerCase()}catch{throw new HttpError(400,"Invalid wallet or contract address")}};
export async function rateLimit(scope:string,subject:string,limit:number,windowSeconds:number){
  const bucket=Math.floor(Date.now()/1000/windowSeconds);
  const result=await db.query("INSERT INTO api_limits(scope,subject,bucket,used) VALUES($1,$2,$3,1) ON CONFLICT(scope,subject,bucket) DO UPDATE SET used=api_limits.used+1 RETURNING used",[scope,subject,bucket]);
  if(result.rows[0].used>limit)throw new HttpError(429,"Request limit reached; retry after the current time window");
}
