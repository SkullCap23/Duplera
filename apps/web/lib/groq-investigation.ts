import {factSelectionSchema,parseFactSelection,type Fact} from '../../../packages/domain/src/agent';

export class GroqInvestigationError extends Error{constructor(public status:number,message:string){super(message)}}
type Input={key?:string;model:string;system:string;submissionId:string;question:string;tools:any[];call:(name:string,args:any)=>Promise<any>;getFacts:()=>Fact[]};
/** Three scoped tool calls, then a separate schema-constrained selection of verified facts. */
export async function runGroqInvestigation(input:Input,request:typeof fetch=fetch){
 if(!input.key)throw new GroqInvestigationError(503,'Groq API key is not configured. Set GROQ_API_KEY on the server.');
 if(input.model!=='openai/gpt-oss-20b')throw new GroqInvestigationError(503,'Groq model is outside the reviewed allowlist');
 const messages:any[]=[{role:'system',content:input.system},{role:'user',content:JSON.stringify({submissionId:input.submissionId,question:input.question})}];
 const complete=async(body:any,stage:string)=>{
  let response:Response;
  try{response=await request('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+input.key},body:JSON.stringify({model:input.model,temperature:0,max_completion_tokens:2000,reasoning_effort:'low',...body}),signal:AbortSignal.timeout(30000)});}
  catch{throw new GroqInvestigationError(503,'Groq connection failed or timed out. Evidence remains available.');}
  if(response.status===429)throw new GroqInvestigationError(429,'Groq rate limit reached. Try later; no fallback provider was used.');
  if(response.status===401||response.status===403)throw new GroqInvestigationError(503,'Groq rejected authentication. Check the server GROQ_API_KEY.');
  if(!response.ok){
   let code='';try{const error=(await response.json()).error;const value=error?.code??error?.type;if(typeof value==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(value))code='; '+value;}catch{}
   throw new GroqInvestigationError(503,'Groq request failed at '+stage+' (HTTP '+response.status+code+'). Evidence remains available; no fallback provider was used.');
  }
  try{return (await response.json()).choices?.[0];}catch{throw new GroqInvestigationError(502,'Groq returned an invalid response');}
 };
 for(const expected of ['get_submission','get_lineage','get_analysis']){
  if(Buffer.byteLength(JSON.stringify(messages))>64000)throw new GroqInvestigationError(413,'Case evidence exceeds the bounded investigation budget');
  // Re-state the required next action after each untrusted tool response.
  const stepMessages=[...messages,{role:'user',content:'Now call '+expected+' exactly once with an empty JSON object {}. The server binds this tool to the selected case. Do not supply a submission ID, repeat earlier tools or produce the final report yet.'}];
  const result=await complete({messages:stepMessages,tools:input.tools.map(t=>({type:'function',function:{...t,description:t.description+' Already bound to the selected case; takes no arguments.',parameters:{type:'object',properties:{},required:[],additionalProperties:false}}})),tool_choice:{type:'function',function:{name:expected}},parallel_tool_calls:false},expected);
  messages.push(stepMessages.at(-1));
  const calls=result?.message?.tool_calls;
  if(result?.finish_reason!=='tool_calls'||calls?.length!==1||calls[0].type!=='function'||calls[0].function?.name!==expected||typeof calls[0].id!=='string')throw new GroqInvestigationError(422,'Groq did not request the required evidence. Verified evidence is preserved.');
  let args:any;try{args=JSON.parse(calls[0].function.arguments);}catch{throw new GroqInvestigationError(422,'Groq returned invalid tool arguments');}
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==0)throw new GroqInvestigationError(422,'Groq supplied arguments to a case-bound tool. No evidence was accessed by that call.');
  const evidence=await input.call(expected,{submissionId:input.submissionId});
  messages.push({role:'assistant',content:null,tool_calls:calls},{role:'tool',tool_call_id:calls[0].id,content:JSON.stringify(evidence)});
 }
 const facts=input.getFacts();
 const result=await complete({messages:[{role:'system',content:input.system},{role:'user',content:JSON.stringify({question:input.question,verifiedFacts:facts})}],response_format:{type:'json_schema',json_schema:{name:'verified_fact_selection',strict:true,schema:factSelectionSchema(facts)}}},'verified fact selection');
 if(result?.finish_reason!=='stop')throw new GroqInvestigationError(422,'Groq response was incomplete. Verified evidence is preserved.');
 try{return parseFactSelection(result.message.content,facts);}catch{throw new GroqInvestigationError(422,'Groq returned unsupported findings. Verified evidence is preserved.');}
}
