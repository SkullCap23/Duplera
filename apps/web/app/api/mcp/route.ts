import {serveMcp} from '../../../../../packages/domain/src/mcp';
import {db,hash,chain,HttpError,rateLimit,jsonBody,assertDatabaseScope} from '../../../lib/server';
import {executeInvestigationTool} from '../../../lib/investigation-tools';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(req:Request){
 try{
  if(req.headers.get('origin')&&req.headers.get('origin')!==process.env.APP_ORIGIN)throw new HttpError(403,'Origin not permitted');
  await assertDatabaseScope();
  const bearer=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43,100})$/)?.[1];
  if(!bearer)throw new HttpError(401,'Duplera MCP access token required');
  const audience=process.env.APP_ORIGIN+'/api/mcp';
  const token=(await db.query("SELECT owner,scopes FROM access_tokens WHERE token_hash=$1 AND audience=$2 AND NOT revoked AND expires_at>now()",[hash(bearer),audience])).rows[0];
  if(!token?.scopes.includes('investigation:read'))throw new HttpError(401,'Token expired, revoked or out of scope');
  const {registry}=await chain();if(!await registry.hasRole(await registry.LENDER_ROLE(),token.owner))throw new HttpError(403,'Lender authorisation is no longer active');
  await rateLimit('mcp',token.owner,120,3600);
  const body=await jsonBody(req);
  return await serveMcp(new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify(body)}),(name,args)=>executeInvestigationTool(token.owner,'mcp',name,args));
 }catch(error){
  const status=error instanceof HttpError?error.status:503;
  return Response.json({error:status===503?'MCP service unavailable':(error as Error).message},{status,headers:status===401?{'WWW-Authenticate':'Bearer realm="Duplera MCP"'}:undefined});
 }
}
export async function GET(){return new Response('Stateless MCP uses POST',{status:405,headers:{Allow:'POST'}})}
