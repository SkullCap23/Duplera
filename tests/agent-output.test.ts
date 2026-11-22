import {test} from 'node:test';import assert from 'node:assert/strict';
import {factSelectionSchema,parseFactSelection,groundedSelection,type Fact} from '../packages/domain/src/agent';
import {selectGeminiFacts,GeminiSelectionError} from '../apps/web/lib/gemini-selection';
const facts:Fact[]=[{id:'financing-state',statement:'An active FINANCED claim blocks a new reservation.',sourceId:'chain:test',critical:true},{id:'supplier-issuance',statement:'Verified supplier issuance has not been established.',sourceId:'lineage:test',critical:true},{id:'analysis-snapshot',statement:'Historical snapshot.',sourceId:'analysis:test'}];
test('final response schema permits only verified fact IDs and parser still rejects unsupported content',()=>{
 assert.deepEqual(factSelectionSchema(facts).properties.selectedFactIds.items.enum,facts.map(f=>f.id));
 for(const text of ['Here is the report: {}','{"selectedFactIds":["invented"]}','{"selectedFactIds":[{"id":"financing-state"}]}','{"selectedFactIds":[],"claim":"No conflict"}','{"selectedFactIds":null}'])assert.throws(()=>parseFactSelection(text,facts));
 assert.equal(groundedSelection(facts,parseFactSelection('{"selectedFactIds":[]}',facts)).filter(f=>f.critical).length,2);
});
test('Gemini final step requests constrained JSON without replaying document/tool instructions',async()=>{
 let calls=0;const request:typeof fetch=async(_url,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.equal(body.generationConfig.responseMimeType,'application/json');assert.deepEqual(body.generationConfig.responseJsonSchema,factSelectionSchema(facts));assert.equal(body.tools,undefined);assert.equal(body.toolConfig,undefined);assert.equal(JSON.parse(body.contents[0].parts[0].text).verifiedFacts.length,3);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'not report JSON'},{text:'{"selectedFactIds":["analysis-snapshot"]}'}]}}]})};
 assert.deepEqual(await selectGeminiFacts({key:'fixture-key',model:'gemini-3.1-flash-lite',system:'Select verified IDs only',question:'Explain the state',facts},request),['analysis-snapshot']);assert.equal(calls,1);
});
test('malformed, invented and truncated model output fail closed without retry or fallback',async()=>{
 for(const [finishReason,text] of [['STOP','not JSON'],['STOP','{"selectedFactIds":["invented"]}'],['MAX_TOKENS','{"selectedFactIds":[]}']]){let calls=0;await assert.rejects(selectGeminiFacts({key:'fixture-key',model:'gemini-3.1-flash-lite',system:'IDs only',question:'Test',facts},async()=>{calls++;return Response.json({candidates:[{finishReason,content:{parts:[{text}]}}]})}),e=>e instanceof GeminiSelectionError&&e.status===422);assert.equal(calls,1);}
});
test('quota exhaustion fails with no paid fallback',async()=>{
 await assert.rejects(selectGeminiFacts({key:'fixture-key',model:'gemini-3.1-flash-lite',system:'IDs only',question:'Test',facts},async()=>new Response('{}',{status:429})),e=>e instanceof GeminiSelectionError&&e.status===429);
});
