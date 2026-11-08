import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {performance} from "node:perf_hooks";
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs";
import {invoiceSchema,identity} from "@duplera/domain";
import {compare,isCandidate,REVIEW_THRESHOLD,RULESET} from "@duplera/matching";
import {extractInvoiceFields} from '../packages/domain/src/extraction';
// Evaluated fields are extracted from PDFs, never supplied from the ground-truth values.
async function extract(filename:string){
 const bytes=new Uint8Array(await readFile(`data/synthetic/${filename}`));
 const digest=createHash("sha256").update(bytes).digest("hex");
 const task=getDocument({data:bytes,useSystemFonts:true});const doc=await task.promise;let text="";
 for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);text+=(await p.getTextContent()).items.map(x=>"str" in x?x.str:"").join("\n")+"\n";}
 await task.destroy();
 const {fields}=extractInvoiceFields(text);
 return {invoice:invoiceSchema.parse(fields),digest};
}
const manifest=JSON.parse(await readFile("data/synthetic/manifest.json","utf8"));
const split=process.env.EVALUATION_SPLIT??'held-out';
if(!['held-out','entity-held-out'].includes(split))throw new Error('Invalid evaluation split');
const heldout=manifest.records.filter((r:any)=>r.split===split);
if(!heldout.length)throw new Error('No records in evaluation split');
const familySplits=new Map<string,string>();
for(const r of manifest.records){if(familySplits.has(r.family)&&familySplits.get(r.family)!==r.split)throw new Error('Invoice family leaks across splits');familySplits.set(r.family,r.split);}
if(split==='entity-held-out'){
 const train=manifest.records.filter((r:any)=>r.variant==='base'&&r.split!=='entity-held-out'),suppliers=new Set(train.map((r:any)=>r.groundTruth.supplierIdentifier)),buyers=new Set(train.map((r:any)=>r.groundTruth.buyerIdentifier));
 for(const r of heldout.filter((r:any)=>r.variant==='base'))if(suppliers.has(r.groundTruth.supplierIdentifier)||buyers.has(r.groundTruth.buyerIdentifier))throw new Error('Entity-held-out split shares an original supplier or buyer');
}
const cache=new Map<string,Awaited<ReturnType<typeof extract>>>();const times:number[]=[];
for(const row of heldout){if(!cache.has(row.filename)){const start=performance.now();cache.set(row.filename,await extract(row.filename));times.push(performance.now()-start);}}
type Counts={tp:number;fn:number;fp:number;tn:number};
const methods:Record<string,Counts>={raw:{tp:0,fn:0,fp:0,tn:0},identity:{tp:0,fn:0,fp:0,tn:0},structured:{tp:0,fn:0,fp:0,tn:0}};
const byMutation:Record<string,Record<string,Counts>>={};let retrieved=0,positives=0;
function record(method:string,mutation:string,expected:boolean,actual:boolean){const key=expected?(actual?"tp":"fn"):(actual?"fp":"tn");methods[method][key]++;byMutation[mutation]??={};byMutation[mutation][method]??={tp:0,fn:0,fp:0,tn:0};byMutation[mutation][method][key]++;}
for(const row of heldout.filter((r:any)=>r.variant!=="base")){
 const base=heldout.find((r:any)=>r.family===row.family&&r.variant==="base"),a=cache.get(base.filename)!,b=cache.get(row.filename)!;
 const candidate=isCandidate(a.invoice,b.invoice),expected=row.relationship!=='distinct_invoice';
 if(expected){positives++;if(candidate)retrieved++;}
 record("raw",row.variant,expected,a.digest===b.digest);record("identity",row.variant,expected,identity(a.invoice)===identity(b.invoice));record("structured",row.variant,expected,candidate&&compare(a.invoice,b.invoice).score>=REVIEW_THRESHOLD);
}
// Distinct base invoices provide a reproducible negative set, including recurring similar records.
const bases=heldout.filter((r:any)=>r.variant==="base");for(let i=0;i<bases.length;i++)for(let j=i+1;j<Math.min(i+11,bases.length);j++){
 const a=cache.get(bases[i].filename)!,b=cache.get(bases[j].filename)!;
 record("raw","distinct",false,a.digest===b.digest);record("identity","distinct",false,identity(a.invoice)===identity(b.invoice));record("structured","distinct",false,isCandidate(a.invoice,b.invoice)&&compare(a.invoice,b.invoice).score>=REVIEW_THRESHOLD);
}
times.sort((a,b)=>a-b);
const results={generatedAt:new Date().toISOString(),ruleset:RULESET,threshold:REVIEW_THRESHOLD,scope:"Synthetic family-held-out PDFs; thresholds fixed in source before evaluation",families:bases.length,candidateRecall:positives?retrieved/positives:null,methods:Object.fromEntries(Object.entries(methods).map(([k,v])=>[k,{...v,precision:v.tp/(v.tp+v.fp)||0,recall:v.tp/(v.tp+v.fn)||0,falsePositiveRate:v.fp/(v.fp+v.tn)||0}])),byMutation,extractionMs:{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]},hardware:{platform:process.platform,arch:process.arch,node:process.version},limitations:["Synthetic data; no real fraud or bank-grade accuracy claims","Negative-pair sampling is deterministic and incomplete","No OCR; labelled text layouts only","Family-based split, not entity-held-out"]};
await mkdir("docs/results",{recursive:true});await writeFile(`docs/results/detection${split==='entity-held-out'?'-entity':''}.json`,JSON.stringify({...results,split,pdfsExtracted:cache.size,rulesetSha256:createHash('sha256').update(await readFile('packages/matching/src/index.ts')).digest('hex'),limitations:results.limitations.filter(l=>!l.includes('not entity-held-out'))},null,2));console.log(JSON.stringify({split,families:results.families,candidateRecall:results.candidateRecall,methods:results.methods,extractionMs:results.extractionMs},null,2));
