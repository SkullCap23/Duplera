import {factSelectionSchema,parseFactSelection,type Fact} from '../../../packages/domain/src/agent';
export class GeminiSelectionError extends Error{constructor(public status:number,message:string){super(message)}}
/** The final model step only orders verified facts; it never supplies report prose. */
export async function selectGeminiFacts(input:{key:string;model:string;system:string;question:string;facts:Fact[]},request:typeof fetch=fetch){
 const response=await request('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(input.model)+':generateContent',{
  method:'POST',headers:{'content-type':'application/json','x-goog-api-key':input.key},
  body:JSON.stringify({systemInstruction:{parts:[{text:input.system}]},contents:[{role:'user',parts:[{text:JSON.stringify({question:input.question,verifiedFacts:input.facts})}]}],generationConfig:{maxOutputTokens:1000,temperature:0,thinkingConfig:{thinkingLevel:'minimal'},responseMimeType:'application/json',responseJsonSchema:factSelectionSchema(input.facts)}}),
  signal:AbortSignal.timeout(45000)
 });
 if(response.status===429)throw new GeminiSelectionError(429,'Free model quota exhausted. Try later or use local Ollama; no paid fallback was used.');
 if(!response.ok)throw new GeminiSelectionError(503,'Free model request failed. Evidence remains available; no paid fallback was used.');
 const result=await response.json(),candidate=result.candidates?.[0];
 if(candidate?.finishReason!=='STOP')throw new GeminiSelectionError(422,'Model response was incomplete or blocked. Verified evidence is preserved.');
 try{return parseFactSelection((candidate.content?.parts??[]).filter((part:any)=>typeof part.text==='string'&&!part.thought).map((part:any)=>part.text).join(''),input.facts)}
 catch{throw new GeminiSelectionError(422,'Model returned unsupported findings. Verified evidence is preserved.')}
}
