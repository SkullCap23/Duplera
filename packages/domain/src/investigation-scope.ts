/** A routing hint only: never grants access or changes verified findings. */
export function investigationScopeReply(question:string):string|null{
 const text=question.normalize('NFKC').toLowerCase();
 // Mixed greetings and case questions must still reach the evidence checks.
 if(/\b(invoice|receivable|financ\w*|claim|reserv\w*|supplier|issu\w*|amend\w*|version|head|predecessor|digest|sign\w*|evidence|registr\w*|chain|block\w*|cancel\w*|expir\w*|releas\w*|match\w*|similar\w*|duplicat\w*|fraud\w*|authentic\w*|deliver\w*|payment|paid|goods|source\w*|citation\w*|limitation\w*|eligib\w*|supersed\w*|lineage|tamper\w*|document|record|proof|prove|changed|conflict)\b/.test(text))return null;
 return 'I’m Duplera’s investigation assistant. I can review the selected invoice’s financing status, supplier signatures, amendment history and matching evidence. Ask a question about that case to begin.';
}
