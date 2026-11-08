import { canonicalise, type Invoice } from "@duplera/domain";
export const RULESET = "structured-v1";
export const REVIEW_THRESHOLD = 0.78;
export function resemblance(a: string, b: string): number {
  if (!a || !b) return 0;
  let row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j-1]+1,row[j]+1,row[j-1]+Number(a[i-1]!==b[j-1]));
    row = next;
  }
  return 1-row[b.length]/Math.max(a.length,b.length);
}
export function compare(left: Invoice, right: Invoice) {
  const a=canonicalise(left), b=canonicalise(right);
  const dayGap=Math.abs(Date.parse(a.invoiceDate)-Date.parse(b.invoiceDate))/86400000;
  const aa=BigInt(a.amountMinor), bb=BigInt(b.amountMinor);
  const amount=Number((aa<bb?aa:bb)*10000n/(aa>bb?aa:bb))/10000;
  const at=new Set(a.description.split(/\W+/).filter(Boolean)), bt=new Set(b.description.split(/\W+/).filter(Boolean));
  const overlap=[...at].filter(t=>bt.has(t)).length/new Set([...at,...bt]).size;
  const signals=[
    {name:"supplier identifier",value:Number(a.supplierIdentifier===b.supplierIdentifier && a.supplierCountry===b.supplierCountry),weight:0.20},
    {name:"buyer identifier",value:Number(a.buyerIdentifier===b.buyerIdentifier),weight:0.15},
    {name:"invoice number resemblance",value:resemblance(a.invoiceNumber,b.invoiceNumber),weight:0.25},
    {name:"invoice date proximity",value:Math.max(0,1-dayGap/30),weight:0.10},
    {name:"amount proximity",value:amount,weight:0.15},
    {name:"currency",value:Number(a.currency===b.currency),weight:0.05},
    {name:"description overlap",value:overlap,weight:0.10},
  ];
  return {score: signals.reduce((s,x)=>s+x.value*x.weight,0), signals, dayGap};
}
export function isCandidate(a: Invoice,b: Invoice): boolean {
  const x=canonicalise(a),y=canonicalise(b);
  const days=Math.abs(Date.parse(x.invoiceDate)-Date.parse(y.invoiceDate))/86400000;
  return (x.supplierIdentifier===y.supplierIdentifier && days<=60) ||
    (x.buyerIdentifier===y.buyerIdentifier && x.currency===y.currency && compare(x,y).signals[4].value>=0.90) ||
    (resemblance(x.invoiceNumber,y.invoiceNumber)>=0.7 && days<=60);
}
