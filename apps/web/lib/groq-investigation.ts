import {factSelectionSchema,parseFactSelection,type Fact} from '../../../packages/domain/src/agent';

export class GroqInvestigationError extends Error{constructor(public status:number,message:string){super(message)}}
type Input={key?:string;model:string;system:string;submissionId:string;question:string;tools:any[];call:(name:string,args:any)=>Promise<any>;getFacts:()=>Fact[]};
/** Three scoped tool calls, then a separate schema-constrained selection of verified facts. */
export async function runGroqInvestigation(input:Input,request:typeof fetch=fetch){
 if(!input.key)throw new GroqInvestigationError(503,'Groq API key is not configured. Set GROQ_API_KEY on the server.');
 if(input.model!=='openai/gpt-oss-20b')throw new GroqInvestigationError(503,'Groq model is outside the reviewed allowlist');
 const messages:any[]=[{role:'system',content:input.system},{role:'user',content:JSON.stringify({submissionId:input.submissionId,question:input.question})}];
 const complete=async(body:any)=>{
  let response:Response;
  try{response=await request('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+input.key},body:JSON.stringify({model:input.model,temperature:0,max_completion_tokens:2000,reasoning_effort:'low',...body}),signal:AbortSignal.timeout(30000)});}
  catch{throw new GroqInvestigationError(503,'Groq connection failed or timed out. Evidence remains available.');}
  if(response.status===429)throw new GroqInvestigationError(429,'Groq rate limit reached. Try later; no fallback provider was used.');
  if(response.status===401||response.status===403)throw new GroqInvestigationError(503,'Groq rejected authentication. Check the server GROQ_API_KEY.');
  if(!response.ok)throw new GroqInvestigationError(503,'Groq request failed (HTTP '+response.status+'). Evidence remains available; no fallback provider was used.');
  try{return (await response.json()).choices?.[0];}catch{throw new GroqInvestigationError(502,'Groq returned an invalid response');}
 };
 for(const expected of ['get_submission','get_lineage','get_analysis']){
  if(Buffer.byteLength(JSON.stringify(messages))>64000)throw new GroqInvestigationError(413,'Case evidence exceeds the bounded investigation budget');
  const result=await complete({messages,tools:input.tools.map(t=>({type:'function',function:t})),tool_choice:{type:'function',function:{name:expected}},parallel_tool_calls:false});
  const calls=result?.message?.tool_calls;
  if(result?.finish_reason!=='tool_calls'||calls?.length!==1||calls[0].type!=='function'||calls[0].function?.name!==expected||typeof calls[0].id!=='string')throw new GroqInvestigationError(422,'Groq did not request the required evidence. Verified evidence is preserved.');
  let args:any;try{args=JSON.parse(calls[0].function.arguments);}catch{throw new GroqInvestigationError(422,'Groq returned invalid tool arguments');}
  if(!args||Object.keys(args).length!==1||args.submissionId!==input.submissionId)throw new GroqInvestigationError(403,'Groq tool call is outside the selected case');
  const evidence=await input.call(expected,args);
  messages.push({role:'assistant',content:null,tool_calls:calls},{role:'tool',tool_call_id:calls[0].id,content:JSON.stringify(evidence)});
 }
 const facts=input.getFacts();
 const result=await complete({messages:[{role:'system',content:input.system},{role:'user',content:JSON.stringify({question:input.question,verifiedFacts:facts})}],response_format:{type:'json_schema',json_schema:{name:'verified_fact_selection',strict:true,schema:factSelectionSchema(facts)}}});
 if(result?.finish_reason!=='stop')throw new GroqInvestigationError(422,'Groq response was incomplete. Verified evidence is preserved.');
 try{return parseFactSelection(result.message.content,facts);}catch{throw new GroqInvestigationError(422,'Groq returned unsupported findings. Verified evidence is preserved.');}
}
