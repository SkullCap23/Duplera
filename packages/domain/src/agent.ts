export type Fact={id:string;statement:string;sourceId:string;critical?:boolean};
export function investigationFacts(evidence:Record<string,any>):Fact[]{
 const facts:Fact[]=[];
 const chain=evidence.get_claim_status;
 if(chain)facts.push({id:'financing-state',statement:chain.active?'An active '+chain.state+' claim blocks a new reservation.':'No effective active financing claim was observed at block '+chain.observedBlock+'.',sourceId:chain.sourceId,critical:true});
 const issuance=evidence.get_lineage;
 if(issuance)facts.push({id:'supplier-issuance',statement:issuance.signatureValid&&issuance.registered?(issuance.head?'The invoice has a valid registered supplier signature and is the current version.':'The signed invoice is superseded; use the current amendment.'):'Verified supplier issuance has not been established.',sourceId:issuance.sourceId,critical:true});
 if(issuance?.versions?.length>1)facts.push({id:'amendment-history',statement:'The receivable has '+issuance.versions.length+' registered versions. Amendments retain the original financing identity, including when invoice numbers change.',sourceId:issuance.sourceId,critical:true});
 const analysis=evidence.get_analysis;
 if(analysis)facts.push({id:'analysis-snapshot',statement:analysis.analysis?'The saved analysis reported '+analysis.analysis.result.status+'; this is a historical snapshot.':'No saved analysis exists; perform analysis before requesting a reservation.',sourceId:analysis.sourceId});
 if(analysis?.analysis?.result?.matches?.length)facts.push({id:'matching-evidence',statement:'The saved analysis contains '+analysis.analysis.result.matches.length+' matching record(s). Similarity indicates possible reuse and does not establish fraudulent intent.',sourceId:analysis.sourceId});
 const submission=evidence.get_submission;
 if(submission)facts.push({id:'submitted-assertions',statement:'Invoice fields are submitted assertions. Signatures and commitments do not establish goods delivery, legal priority or actual payment.',sourceId:submission.sourceId,critical:true});
 return facts;
}
export function groundedSelection(facts:Fact[],selected:string[]){
 if(selected.some(id=>!facts.some(f=>f.id===id)))throw new Error('Model cited an unknown fact');
 return [...new Set([...facts.filter(f=>f.critical).map(f=>f.id),...selected])].map(id=>facts.find(f=>f.id===id)!);
}
