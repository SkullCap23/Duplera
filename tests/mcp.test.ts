import {test} from 'node:test';import assert from 'node:assert/strict';
import {serveMcp} from '../packages/domain/src/mcp';
const headers={'content-type':'application/json',accept:'application/json, text/event-stream'};
test('MCP initialization, discovery, permission denial and real tool dispatch use protocol envelopes',async()=>{
 async function send(body:unknown){return serveMcp(new Request('http://localhost/api/mcp',{method:'POST',headers,body:JSON.stringify(body)}),async(name,args)=>{if(args.submissionId==='11111111-1111-4111-8111-111111111111')throw Error('Private');return {tool:name,state:'RELEASED'}})}
 const init=await send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'duplera-test',version:'1'}}});assert.equal(init.status,200);
 const tools=await(await send({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})).json();assert.equal(tools.result.tools.length,5);
 const denied=await(await send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'get_submission',arguments:{submissionId:'11111111-1111-4111-8111-111111111111'}}})).json();assert.equal(denied.result.isError,true);assert.doesNotMatch(JSON.stringify(denied),/Private/);
 const good=await(await send({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'get_claim_status',arguments:{submissionId:'22222222-2222-4222-8222-222222222222'}}})).json();assert.match(good.result.content[0].text,/RELEASED/);
});
